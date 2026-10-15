import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  GIFT_WRAP_HALALAS,
  HOTEL_DELIVERY_DAYS,
  HOTEL_DELIVERY_OTHER_CITY_HALALAS,
  internationalShipping,
  type Language,
  type OrderStatus,
  type ProductSection,
  type Translated,
} from '@rafeeq/shared';
import { isAdmin, type AuthUser } from '../auth/auth-user.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { orderItems, orders, places, products, providers, statusEvents, users } from '../db/schema.js';
import { assertProviderManager, ownsProvider } from '../common/access.js';
import { badRequest, conflict, forbidden, notFound } from '../common/errors.js';
import { toPage, type PageQuery } from '../common/pagination.js';
import { pick } from '../common/translate.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { lockOrder, releaseStock, transitionOrder } from './order-lifecycle.js';

export type CartItem = { productId: string; quantity: number };
export type DeliveryInput =
  | { deliveryType: 'hotel'; room?: string }
  | { deliveryType: 'international'; country: string; line1: string; city: string; postcode?: string };

export type ProductInput = {
  shopId: string;
  section: ProductSection;
  title: Translated;
  description?: Translated;
  priceHalalas: number;
  stock: number;
  lowStockAlert?: number;
  weightGrams: number;
  isFood?: boolean;
  shipsAbroad?: boolean;
  shipsToCountries?: string[];
  active?: boolean;
};

const STATUS_WORDS: Record<OrderStatus, Translated> = {
  pending_payment: { en: 'waiting for payment', ar: 'بانتظار الدفع', ur: 'ادائیگی کا انتظار', id: 'menunggu pembayaran', ms: 'menunggu bayaran', tr: 'ödeme bekleniyor' },
  paid: { en: 'paid', ar: 'مدفوع', ur: 'ادا ہو گیا', id: 'dibayar', ms: 'dibayar', tr: 'ödendi' },
  packed: { en: 'packed', ar: 'تم التغليف', ur: 'پیک ہو گیا', id: 'dikemas', ms: 'dibungkus', tr: 'paketlendi' },
  out_for_delivery: { en: 'on the way to your hotel', ar: 'في الطريق إلى فندقك', ur: 'ہوٹل کے راستے میں', id: 'dalam perjalanan ke hotel', ms: 'dalam perjalanan ke hotel', tr: 'otelinize yolda' },
  shipped: { en: 'shipped', ar: 'تم الشحن', ur: 'بھیج دیا گیا', id: 'dikirim', ms: 'dihantar', tr: 'kargoya verildi' },
  delivered: { en: 'delivered', ar: 'تم التسليم', ur: 'پہنچا دیا گیا', id: 'terkirim', ms: 'dihantar', tr: 'teslim edildi' },
  cancelled: { en: 'cancelled', ar: 'ملغى', ur: 'منسوخ', id: 'dibatalkan', ms: 'dibatalkan', tr: 'iptal edildi' },
  refunded: { en: 'refunded', ar: 'مسترد', ur: 'رقم واپس', id: 'dikembalikan', ms: 'dipulangkan', tr: 'iade edildi' },
};

/**
 * Gifts shop (guide: Gifts shop): Makkah gifts, Madinah gifts and dates from verified
 * shops, delivered to the hotel or shipped home. One shop per order; the app keeps a
 * separate cart per shop.
 */
@Injectable()
export class ShopService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(PaymentsService) private readonly payments: PaymentsService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  // ───────────── browsing ─────────────

  async list(q: PageQuery & { section?: ProductSection; shopId?: string; q?: string; country?: string; lang?: Language }) {
    const lang = q.lang ?? 'en';
    const where: (SQL | undefined)[] = [eq(products.active, true), eq(providers.status, 'approved')];
    if (q.section) where.push(eq(products.section, q.section));
    if (q.shopId) where.push(eq(products.shopId, q.shopId));
    if (q.q) {
      const like = `%${q.q.replace(/[%_]/g, '')}%`;
      where.push(or(ilike(sql`${products.title}->>'en'`, like), ilike(sql`${products.title}->>${lang}`, like)));
    }
    if (q.country) {
      const c = q.country.toUpperCase();
      where.push(and(eq(products.shipsAbroad, true), sql`(cardinality(${products.shipsToCountries}) = 0 or ${c} = any(${products.shipsToCountries}))`));
    }
    const rows = await this.db
      .select({ p: products, shopName: providers.name, shopCity: providers.city })
      .from(products)
      .innerJoin(providers, eq(providers.id, products.shopId))
      .where(and(...where))
      .orderBy(asc(products.section), asc(products.priceHalalas))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(rows.map((r) => this.view(r.p, r.shopName, r.shopCity, lang)), q);
  }

  private view(p: typeof products.$inferSelect, shopName: Translated, shopCity: string, lang: Language) {
    return {
      id: p.id,
      section: p.section,
      title: pick(p.title, lang),
      description: pick(p.description, lang),
      priceHalalas: p.priceHalalas,
      inStock: p.stock > 0,
      stock: p.stock,
      weightGrams: p.weightGrams,
      isFood: p.isFood,
      shipsAbroad: p.shipsAbroad,
      shipsToCountries: p.shipsToCountries,
      shop: { id: p.shopId, name: pick(shopName, lang), city: shopCity },
    };
  }

  async get(id: string, lang: Language) {
    const [r] = await this.db
      .select({ p: products, shopName: providers.name, shopCity: providers.city, shopStatus: providers.status })
      .from(products)
      .innerJoin(providers, eq(providers.id, products.shopId))
      .where(eq(products.id, id));
    if (!r || !r.p.active || r.shopStatus !== 'approved') throw notFound('product');
    return this.view(r.p, r.shopName, r.shopCity, lang);
  }

  // ───────────── quote and order ─────────────

  /**
   * Price an order before payment: subtotal, delivery and gift wrap, plus warnings
   * (food that can't go to that country, hotel delivery after the pilgrim leaves).
   */
  async quote(user: AuthUser, items: CartItem[], delivery: DeliveryInput, giftWrap = false) {
    if (!items.length) throw badRequest('order.empty', 'The cart is empty');
    const merged = new Map<string, number>();
    for (const it of items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    const rows = await this.db
      .select({ p: products, shopCity: providers.city, shopStatus: providers.status })
      .from(products)
      .innerJoin(providers, eq(providers.id, products.shopId))
      .where(inArray(products.id, [...merged.keys()]));
    if (rows.length !== merged.size) throw notFound('product');
    const shopIds = new Set(rows.map((r) => r.p.shopId));
    if (shopIds.size !== 1) throw badRequest('order.one_shop', 'An order can have products from one shop only');
    const shopId = [...shopIds][0];
    const shopCity = rows[0].shopCity;

    const lines = rows.map((r) => {
      const quantity = merged.get(r.p.id)!;
      if (!r.p.active || r.shopStatus !== 'approved') throw conflict('order.product_unavailable', 'A product is no longer sold', { productId: r.p.id });
      if (r.p.stock < quantity) throw conflict('order.out_of_stock', 'Not enough stock', { productId: r.p.id, available: r.p.stock });
      return { productId: r.p.id, quantity, unitPriceHalalas: r.p.priceHalalas, weightGrams: r.p.weightGrams * quantity, product: r.p };
    });
    const subtotal = lines.reduce((s, l) => s + l.unitPriceHalalas * l.quantity, 0);
    const warnings: { code: string; productId?: string }[] = [];
    let shipping: number;
    let days: number;

    const [profile] = await this.db.select({ hotelPlaceId: users.hotelPlaceId, travelTo: users.travelTo }).from(users).where(eq(users.id, user.id));
    if (delivery.deliveryType === 'hotel') {
      if (!profile?.hotelPlaceId) throw badRequest('order.no_hotel', 'Set your hotel in your profile first');
      const [hotel] = await this.db.select({ city: places.city }).from(places).where(eq(places.id, profile.hotelPlaceId));
      const sameCity = hotel.city === shopCity;
      shipping = sameCity ? 0 : HOTEL_DELIVERY_OTHER_CITY_HALALAS;
      days = sameCity ? HOTEL_DELIVERY_DAYS.sameCity : HOTEL_DELIVERY_DAYS.otherCity;
      if (profile.travelTo && profile.travelTo.getTime() < Date.now() + days * 24 * 3600_000) {
        warnings.push({ code: 'may_arrive_after_departure' });
      }
    } else {
      const country = delivery.country.toUpperCase();
      if (country === 'SA') throw badRequest('order.domestic', 'Use hotel delivery inside Saudi Arabia');
      for (const l of lines) {
        if (!l.product.shipsAbroad) throw conflict('order.not_shippable', 'A product cannot be shipped abroad', { productId: l.productId });
        if (l.product.shipsToCountries.length && !l.product.shipsToCountries.includes(country)) {
          throw conflict('order.country_not_allowed', 'This product cannot be shipped to that country', { productId: l.productId, country });
        }
        if (l.product.isFood) warnings.push({ code: 'customs_may_apply', productId: l.productId });
      }
      const rate = internationalShipping(country, lines.reduce((s, l) => s + l.weightGrams, 0));
      if (!rate) throw conflict('order.country_not_served', 'We do not ship to that country yet', { country });
      shipping = rate.halalas;
      days = rate.days;
    }
    const wrap = giftWrap ? GIFT_WRAP_HALALAS : 0;
    return {
      shopId,
      lines: lines.map(({ product: _p, weightGrams: _w, ...l }) => l),
      subtotalHalalas: subtotal,
      shippingHalalas: shipping,
      giftWrapHalalas: wrap,
      totalHalalas: subtotal + shipping + wrap,
      estimatedDays: days,
      warnings,
      hotelPlaceId: profile?.hotelPlaceId ?? null,
    };
  }

  async createOrder(user: AuthUser, input: { items: CartItem[]; delivery: DeliveryInput; giftWrap?: boolean; giftMessage?: string }) {
    if (user.role !== 'pilgrim') throw forbidden('order.pilgrims_only', 'Only pilgrim accounts can order');
    const q = await this.quote(user, input.items, input.delivery, input.giftWrap);
    const address =
      input.delivery.deliveryType === 'hotel'
        ? ({ kind: 'hotel', placeId: q.hotelPlaceId!, room: input.delivery.room } as const)
        : ({ kind: 'international', line1: input.delivery.line1, city: input.delivery.city, country: input.delivery.country.toUpperCase(), postcode: input.delivery.postcode } as const);
    const order = await this.db.transaction(async (tx) => {
      const [o] = await tx
        .insert(orders)
        .values({
          pilgrimId: user.id,
          shopId: q.shopId,
          deliveryType: input.delivery.deliveryType,
          address,
          country: input.delivery.deliveryType === 'international' ? input.delivery.country.toUpperCase() : null,
          subtotalHalalas: q.subtotalHalalas,
          shippingHalalas: q.shippingHalalas,
          giftWrapHalalas: q.giftWrapHalalas,
          totalHalalas: q.totalHalalas,
          giftMessage: input.giftWrap ? input.giftMessage : null,
          status: 'pending_payment',
        })
        .returning();
      await tx.insert(orderItems).values(q.lines.map((l) => ({ orderId: o.id, productId: l.productId, quantity: l.quantity, unitPriceHalalas: l.unitPriceHalalas })));
      await tx.insert(statusEvents).values({ entityType: 'order', entityId: o.id, fromStatus: null, toStatus: 'pending_payment', actorId: user.id });
      return o;
    });
    return { ...(await this.getOrder(user, order.id)), warnings: q.warnings, estimatedDays: q.estimatedDays };
  }

  async getOrder(user: AuthUser, id: string, langOverride?: Language) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, id));
    if (!o) throw notFound('order');
    if (o.pilgrimId !== user.id && !ownsProvider(user, o.shopId) && !isAdmin(user)) throw notFound('order');
    const lang = langOverride ?? user.language;
    const items = await this.db
      .select({ it: orderItems, title: products.title, section: products.section })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, id));
    const [shop] = await this.db.select({ name: providers.name, phone: providers.phone }).from(providers).where(eq(providers.id, o.shopId));
    const history = await this.db
      .select({ from: statusEvents.fromStatus, to: statusEvents.toStatus, at: statusEvents.at, reason: statusEvents.reason })
      .from(statusEvents)
      .where(and(eq(statusEvents.entityType, 'order'), eq(statusEvents.entityId, id)))
      .orderBy(asc(statusEvents.at));
    const [buyer] = o.pilgrimId === user.id ? [null] : await this.db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, o.pilgrimId));
    let hotel: { name: string; lat: number; lng: number } | null = null;
    if (o.address.kind === 'hotel') {
      const [h] = await this.db.select().from(places).where(eq(places.id, o.address.placeId));
      if (h) hotel = { name: pick(h.name, lang), lat: h.lat, lng: h.lng };
    }
    return {
      id: o.id,
      status: o.status,
      statusText: pick(STATUS_WORDS[o.status], lang),
      shop: { id: o.shopId, name: pick(shop.name, lang), phone: shop.phone },
      deliveryType: o.deliveryType,
      address: o.address,
      hotel,
      items: items.map((r) => ({ productId: r.it.productId, title: pick(r.title, lang), section: r.section, quantity: r.it.quantity, unitPriceHalalas: r.it.unitPriceHalalas })),
      subtotalHalalas: o.subtotalHalalas,
      shippingHalalas: o.shippingHalalas,
      giftWrapHalalas: o.giftWrapHalalas,
      totalHalalas: o.totalHalalas,
      giftMessage: o.giftMessage,
      courier: o.courier,
      trackingNumber: o.trackingNumber,
      buyer,
      history,
      createdAt: o.createdAt.toISOString(),
    };
  }

  async myOrders(user: AuthUser, q: PageQuery) {
    const rows = await this.db
      .select({ o: orders, shopName: providers.name })
      .from(orders)
      .innerJoin(providers, eq(providers.id, orders.shopId))
      .where(eq(orders.pilgrimId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(
      rows.map((r) => ({
        id: r.o.id,
        status: r.o.status,
        statusText: pick(STATUS_WORDS[r.o.status], user.language),
        shop: pick(r.shopName, user.language),
        deliveryType: r.o.deliveryType,
        totalHalalas: r.o.totalHalalas,
        trackingNumber: r.o.trackingNumber,
        createdAt: r.o.createdAt.toISOString(),
      })),
      q,
    );
  }

  /** Pilgrim cancels before the shop packs: full refund, stock goes back. */
  async cancel(user: AuthUser, id: string) {
    await this.db.transaction(async (tx) => {
      const o = await lockOrder(tx, id);
      if (o.pilgrimId !== user.id) throw notFound('order');
      if (o.status === 'pending_payment') {
        await transitionOrder(tx, o, 'cancelled', { actorId: user.id, reason: 'cancelled before payment' });
        return;
      }
      if (o.status !== 'paid') throw conflict('order.cannot_cancel', 'The shop has already packed this order');
      await releaseStock(tx, o.id);
      const cancelled = await transitionOrder(tx, o, 'cancelled', { actorId: user.id, reason: 'cancelled by pilgrim' });
      const refunded = await this.payments.refund(tx, { orderId: o.id }, o.totalHalalas, 'order cancelled', user.id);
      if (refunded > 0) await transitionOrder(tx, cancelled, 'refunded', { actorId: user.id });
    });
    return this.getOrder(user, id);
  }

  // ───────────── shop side ─────────────

  private async assertShop(user: AuthUser, shopId: string) {
    assertProviderManager(user, shopId);
    const [p] = await this.db.select().from(providers).where(eq(providers.id, shopId));
    if (!p) throw notFound('provider');
    if (p.kind !== 'shop') throw badRequest('product.not_a_shop', 'Only shops can list products');
    return p;
  }

  async shopProducts(user: AuthUser, shopId: string) {
    await this.assertShop(user, shopId);
    const rows = await this.db.select().from(products).where(eq(products.shopId, shopId)).orderBy(asc(products.section));
    return rows.map((p) => ({ ...p, lowStock: p.stock <= p.lowStockAlert }));
  }

  async createProduct(user: AuthUser, input: ProductInput) {
    const shop = await this.assertShop(user, input.shopId);
    if (shop.status === 'suspended' || shop.status === 'rejected') throw conflict('provider.not_active', 'Shop is not active');
    const [row] = await this.db
      .insert(products)
      .values({ ...input, shipsToCountries: (input.shipsToCountries ?? []).map((c) => c.toUpperCase()) })
      .returning();
    return row;
  }

  async updateProduct(user: AuthUser, id: string, patch: Partial<Omit<ProductInput, 'shopId'>>) {
    const [p] = await this.db.select().from(products).where(eq(products.id, id));
    if (!p) throw notFound('product');
    await this.assertShop(user, p.shopId);
    const [row] = await this.db
      .update(products)
      .set({ ...patch, ...(patch.shipsToCountries ? { shipsToCountries: patch.shipsToCountries.map((c) => c.toUpperCase()) } : {}) })
      .where(eq(products.id, id))
      .returning();
    return row;
  }

  async lowStock(user: AuthUser, shopId: string) {
    await this.assertShop(user, shopId);
    return this.db.select().from(products).where(and(eq(products.shopId, shopId), lte(products.stock, products.lowStockAlert)));
  }

  async shopOrders(user: AuthUser, q: PageQuery & { shopId: string; status?: OrderStatus }) {
    await this.assertShop(user, q.shopId);
    const rows = await this.db
      .select({ o: orders, buyer: users.name })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.pilgrimId))
      .where(and(eq(orders.shopId, q.shopId), q.status ? eq(orders.status, q.status) : sql`${orders.status} <> 'pending_payment'`))
      .orderBy(desc(orders.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    const ids = rows.map((r) => r.o.id);
    const counts = ids.length
      ? await this.db.select({ orderId: orderItems.orderId, n: sql<number>`sum(${orderItems.quantity})::int` }).from(orderItems).where(inArray(orderItems.orderId, ids)).groupBy(orderItems.orderId)
      : [];
    return toPage(
      rows.map((r) => ({
        id: r.o.id,
        status: r.o.status,
        buyer: r.buyer,
        deliveryType: r.o.deliveryType,
        country: r.o.country,
        items: counts.find((c) => c.orderId === r.o.id)?.n ?? 0,
        totalHalalas: r.o.totalHalalas,
        giftWrap: r.o.giftWrapHalalas > 0,
        trackingNumber: r.o.trackingNumber,
        createdAt: r.o.createdAt.toISOString(),
      })),
      q,
    );
  }

  /** Shop moves an order along: packed → out for delivery (hotel) or shipped (abroad) → delivered. */
  async advance(user: AuthUser, id: string, to: 'packed' | 'out_for_delivery' | 'shipped' | 'delivered', extra: { courier?: string; trackingNumber?: string } = {}) {
    const o = await this.db.transaction(async (tx) => {
      const o = await lockOrder(tx, id);
      if (!ownsProvider(user, o.shopId) && !isAdmin(user)) throw notFound('order');
      if (to === 'out_for_delivery' && o.deliveryType !== 'hotel') throw conflict('order.wrong_delivery', 'International orders are shipped, not delivered to a hotel');
      if (to === 'shipped') {
        if (o.deliveryType !== 'international') throw conflict('order.wrong_delivery', 'Hotel orders go out for delivery');
        if (!extra.trackingNumber || !extra.courier) throw badRequest('order.tracking_required', 'Enter the courier and tracking number');
      }
      return transitionOrder(tx, o, to, { actorId: user.id, set: to === 'shipped' ? { courier: extra.courier, trackingNumber: extra.trackingNumber } : {} });
    });
    const [shop] = await this.db.select({ name: providers.name }).from(providers).where(eq(providers.id, o.shopId));
    this.realtime.emit(`user:${o.pilgrimId}`, 'order.updated', { id: o.id, status: o.status });
    await this.notifications.toUsers([o.pilgrimId], 'order.status', { shop: shop.name, status: STATUS_WORDS[o.status] }, { data: { orderId: o.id } });
    return this.getOrder(user, id);
  }

  /** Shop cancels a paid order it cannot fulfil: full refund. */
  async shopCancel(user: AuthUser, id: string, reason: string) {
    await this.db.transaction(async (tx) => {
      const o = await lockOrder(tx, id);
      if (!ownsProvider(user, o.shopId) && !isAdmin(user)) throw notFound('order');
      if (!['paid', 'packed'].includes(o.status)) throw conflict('order.cannot_cancel', 'Only paid or packed orders can be cancelled');
      await releaseStock(tx, o.id);
      const cancelled = await transitionOrder(tx, o, 'cancelled', { actorId: user.id, reason: `shop: ${reason}` });
      const refunded = await this.payments.refund(tx, { orderId: o.id }, o.totalHalalas, `shop cancelled: ${reason}`, user.id);
      if (refunded > 0) await transitionOrder(tx, cancelled, 'refunded', { actorId: user.id });
    });
    return this.getOrder(user, id);
  }

  async adminOrders(q: PageQuery & { status?: OrderStatus; lang?: Language }) {
    const rows = await this.db
      .select({ o: orders, shopName: providers.name, buyer: users.name })
      .from(orders)
      .innerJoin(providers, eq(providers.id, orders.shopId))
      .innerJoin(users, eq(users.id, orders.pilgrimId))
      .where(q.status ? eq(orders.status, q.status) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(q.limit + 1)
      .offset(q.offset);
    return toPage(
      rows.map((r) => ({ id: r.o.id, status: r.o.status, shop: pick(r.shopName, q.lang ?? 'en'), buyer: r.buyer, deliveryType: r.o.deliveryType, totalHalalas: r.o.totalHalalas, createdAt: r.o.createdAt.toISOString(), isSample: r.o.isSample })),
      q,
    );
  }
}
