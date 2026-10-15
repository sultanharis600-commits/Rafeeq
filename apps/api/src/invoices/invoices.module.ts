import { Controller, Get, Header, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Post, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { eq, inArray } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import { formatHalalas, vatIncluded } from '@rafeeq/shared';
import { CurrentUser, isAdmin, Public, type AuthUser } from '../auth/auth-user.js';
import { AuthUsersService } from '../auth/auth-users.service.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { availabilitySlots, bookings, orderItems, orders, payments, products, providers, services, users } from '../db/schema.js';
import { ownsProvider } from '../common/access.js';
import { conflict, notFound } from '../common/errors.js';
import { pick } from '../common/translate.js';

type Line = { description: string; quantity: number; unitHalalas: number; totalHalalas: number };

/**
 * Sample PDF invoice per booking and order (guide: MVP scope). It is NOT a tax invoice:
 * ZATCA e-invoicing through Bidec ERP or a certified provider comes after the MVP.
 * Prices are VAT-inclusive; the VAT share is shown. Latin text only (pdfkit has no Arabic shaping).
 */
@Injectable()
export class InvoicesService {
  constructor(@InjectDb() private readonly db: Database) {}

  async forBooking(user: AuthUser, id: string): Promise<Buffer> {
    const [row] = await this.db
      .select({ b: bookings, s: services, p: providers, pilgrim: users, startsAt: availabilitySlots.startsAt })
      .from(bookings)
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(providers, eq(providers.id, services.providerId))
      .innerJoin(users, eq(users.id, bookings.pilgrimId))
      .leftJoin(availabilitySlots, eq(availabilitySlots.id, bookings.slotId))
      .where(eq(bookings.id, id));
    if (!row || (row.b.pilgrimId !== user.id && !ownsProvider(user, row.p.id) && !isAdmin(user))) throw notFound('booking');
    if (row.b.status === 'pending_payment') throw conflict('invoice.not_paid', 'No invoice before payment');
    const pays = await this.db.select().from(payments).where(eq(payments.bookingId, id));
    const refunded = pays.reduce((s, p) => s + p.refundedHalalas, 0);
    const lines: Line[] = [
      {
        description: `${pick(row.s.title, 'en')}${row.startsAt ? ` — ${saudi(row.startsAt)}` : ''}`,
        quantity: row.b.quantity,
        unitHalalas: Math.round(row.b.totalHalalas / row.b.quantity),
        totalHalalas: row.b.totalHalalas,
      },
    ];
    return render({
      number: `RFQ-B-${id.slice(0, 8).toUpperCase()}`,
      date: row.b.createdAt,
      seller: { name: pick(row.p.name, 'en'), cr: row.p.crNumber },
      buyer: { name: row.pilgrim.name },
      lines,
      totalHalalas: row.b.totalHalalas,
      refundedHalalas: refunded,
      status: row.b.status,
    });
  }

  async forOrder(user: AuthUser, id: string): Promise<Buffer> {
    const [row] = await this.db
      .select({ o: orders, p: providers, pilgrim: users })
      .from(orders)
      .innerJoin(providers, eq(providers.id, orders.shopId))
      .innerJoin(users, eq(users.id, orders.pilgrimId))
      .where(eq(orders.id, id));
    if (!row || (row.o.pilgrimId !== user.id && !ownsProvider(user, row.p.id) && !isAdmin(user))) throw notFound('order');
    if (row.o.status === 'pending_payment') throw conflict('invoice.not_paid', 'No invoice before payment');
    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const prods = items.length
      ? await this.db.select({ id: products.id, title: products.title }).from(products).where(inArray(products.id, items.map((i) => i.productId)))
      : [];
    const lines: Line[] = items.map((i) => ({
      description: pick(prods.find((p) => p.id === i.productId)?.title, 'en'),
      quantity: i.quantity,
      unitHalalas: i.unitPriceHalalas,
      totalHalalas: i.unitPriceHalalas * i.quantity,
    }));
    if (row.o.shippingHalalas) lines.push({ description: `Shipping to ${row.o.country ?? ''}`.trim(), quantity: 1, unitHalalas: row.o.shippingHalalas, totalHalalas: row.o.shippingHalalas });
    if (row.o.giftWrapHalalas) lines.push({ description: 'Gift wrap and message card', quantity: 1, unitHalalas: row.o.giftWrapHalalas, totalHalalas: row.o.giftWrapHalalas });
    const pays = await this.db.select().from(payments).where(eq(payments.orderId, id));
    return render({
      number: `RFQ-O-${id.slice(0, 8).toUpperCase()}`,
      date: row.o.createdAt,
      seller: { name: pick(row.p.name, 'en'), cr: row.p.crNumber },
      buyer: { name: row.pilgrim.name },
      lines,
      totalHalalas: row.o.totalHalalas,
      refundedHalalas: pays.reduce((s, p) => s + p.refundedHalalas, 0),
      status: row.o.status,
    });
  }
}

function saudi(d: Date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function render(inv: {
  number: string;
  date: Date;
  seller: { name: string; cr: string | null };
  buyer: { name: string };
  lines: Line[];
  totalHalalas: number;
  refundedHalalas: number;
  status: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Rafeeq invoice ${inv.number}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#0b5d57').fontSize(22).text('Rafeeq', { continued: true }).fillColor('#4b5754').fontSize(12).text('   Bidec marketplace');
    doc.moveDown(0.5);
    doc.fillColor('#b00020').fontSize(10).text('SAMPLE INVOICE — demo mode. Not a tax invoice. ZATCA e-invoicing is added before launch.');
    doc.moveDown();
    doc.fillColor('#1c2421').fontSize(11);
    doc.text(`Invoice: ${inv.number}`);
    doc.text(`Date: ${saudi(inv.date)} (Saudi time)`);
    doc.text(`Status: ${inv.status}`);
    doc.moveDown();
    doc.text(`Seller: ${inv.seller.name}${inv.seller.cr ? ` · CR ${inv.seller.cr}` : ''}`);
    doc.text('Marketplace: Bidec (commission invoiced separately to the seller)');
    doc.text(`Buyer: ${inv.buyer.name}`);
    doc.moveDown();

    const top = doc.y;
    const cols = [50, 330, 380, 470];
    doc.fontSize(10).fillColor('#4b5754');
    ['Description', 'Qty', 'Unit (SAR)', 'Total (SAR)'].forEach((h, i) => doc.text(h, cols[i], top, { width: i === 0 ? 270 : 80 }));
    doc.moveTo(50, top + 15).lineTo(545, top + 15).strokeColor('#e8dcc4').stroke();
    let y = top + 22;
    doc.fillColor('#1c2421');
    for (const l of inv.lines) {
      doc.text(l.description, cols[0], y, { width: 270 });
      doc.text(String(l.quantity), cols[1], y, { width: 40 });
      doc.text(formatHalalas(l.unitHalalas), cols[2], y, { width: 80 });
      doc.text(formatHalalas(l.totalHalalas), cols[3], y, { width: 80 });
      y = Math.max(doc.y, y + 16) + 6;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e8dcc4').stroke();
    y += 10;
    const right = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 12 : 10).text(label, 330, y, { width: 130 }).text(value, cols[3], y, { width: 80 });
      y += bold ? 20 : 16;
    };
    right('Total incl. VAT', formatHalalas(inv.totalHalalas), true);
    right('of which VAT 15%', formatHalalas(vatIncluded(inv.totalHalalas)));
    if (inv.refundedHalalas) right('Refunded', `-${formatHalalas(inv.refundedHalalas)}`);
    doc.end();
  });
}

@ApiTags('invoices')
@ApiBearerAuth()
@Controller()
export class InvoicesController {
  constructor(
    @Inject(InvoicesService) private readonly invoices: InvoicesService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthUsersService) private readonly users: AuthUsersService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  private get linkSecret() {
    return `${this.config.get('JWT_SECRET', { infer: true })}:invoice-links`;
  }

  /**
   * A link that opens the invoice in the phone's browser for 10 minutes, without the
   * login token (which never leaves the app).
   */
  @Post(':kind/:id/invoice-link')
  @HttpCode(200)
  async link(@CurrentUser() user: AuthUser, @Param('kind') kind: string, @Param('id', ParseUUIDPipe) id: string) {
    if (kind !== 'bookings' && kind !== 'orders') throw notFound('invoice');
    const k = kind === 'orders' ? 'order' : 'booking';
    // Checks access now, so the link can't be made for someone else's booking.
    if (k === 'booking') await this.invoices.forBooking(user, id);
    else await this.invoices.forOrder(user, id);
    // Signed with a separate secret so an invoice link can never be used as a login token.
    const token = await this.jwt.signAsync({ sub: user.id, k, id }, { expiresIn: '10m', secret: this.linkSecret });
    return { path: `/v1/invoices/${token}`, expiresInSeconds: 600 };
  }

  @Public()
  @Get('invoices/:token')
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async signed(@Param('token') token: string) {
    let claims: { sub: string; k: 'booking' | 'order'; id: string };
    try {
      claims = await this.jwt.verifyAsync(token, { secret: this.linkSecret });
    } catch {
      throw notFound('invoice');
    }
    const user = await this.users.load(claims.sub);
    if (!user || !claims.k) throw notFound('invoice');
    const pdf = claims.k === 'booking' ? await this.invoices.forBooking(user, claims.id) : await this.invoices.forOrder(user, claims.id);
    return new StreamableFile(pdf, { disposition: `inline; filename="rafeeq-${claims.id.slice(0, 8)}.pdf"` });
  }

  @Get('bookings/:id/invoice.pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Sample PDF invoice (not a ZATCA tax invoice)' })
  @Header('Content-Type', 'application/pdf')
  async booking(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.invoices.forBooking(user, id), { disposition: `inline; filename="rafeeq-${id.slice(0, 8)}.pdf"` });
  }

  @Get('orders/:id/invoice.pdf')
  @ApiProduces('application/pdf')
  @Header('Content-Type', 'application/pdf')
  async order(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return new StreamableFile(await this.invoices.forOrder(user, id), { disposition: `inline; filename="rafeeq-${id.slice(0, 8)}.pdf"` });
  }
}

@Module({ controllers: [InvoicesController], providers: [InvoicesService] })
export class InvoicesModule {}
