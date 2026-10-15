import { and, eq } from 'drizzle-orm';
import { auditLogs, locationPoints, outboxMessages, products } from '../src/db/schema.js';
import { createTestApp, PHONES, sid, type TestApp } from './helpers.js';

const SUCCESS = '4111 1111 1111 1111';

describe('Lost Companion', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('leader sees the family with last known locations and rotating Bluetooth IDs', async () => {
    const ahmed = await t.login(PHONES.ahmed);
    const groups = await t.as(ahmed).get('/v1/groups').expect(200);
    const family = groups.body.find((g: { name: string }) => g.name === 'Wijaya family');
    expect(family.members).toHaveLength(4);
    const siti = family.members.find((m: { name: string }) => m.name === 'Siti Aminah');
    expect(siti.lastLocation).toBeTruthy();
    expect(siti.trackerTag).toContain('AirTag');
    expect(siti.bleIds).toHaveLength(3);
    expect(siti.bleIds[0].id).toMatch(/^[0-9a-f]{16}$/);
    // Other people can't open the group
    const mehmet = await t.login(PHONES.mehmet);
    await t.as(mehmet).get(`/v1/groups/${family.id}`).expect(404);
  });

  it("I'm lost: push to the group, SMS to the leader and emergency contacts; resolve closes it", async () => {
    const siti = await t.login(PHONES.siti);
    const res = await t.as(siti).post('/v1/lost-alerts', { lat: 21.4219, lng: 39.8257, accuracyM: 20 }).expect(201);
    expect(res.body.status).toBe('open');
    const sms = await t.db.select().from(outboxMessages).where(and(eq(outboxMessages.template, 'lost.alert'), eq(outboxMessages.channel, 'sms')));
    const toLeader = sms.find((m) => m.toAddress === PHONES.ahmed);
    expect(toLeader?.body).toContain('maps.google.com/?q=21.42190,39.82570');
    expect(toLeader?.body).toContain('Saya tersesat'); // Ahmed reads Indonesian
    expect(sms.some((m) => m.toAddress === '+628000000001')).toBe(true); // daughter in Jakarta
    // Pressing again updates instead of spamming
    const again = await t.as(siti).post('/v1/lost-alerts', { lat: 21.422, lng: 39.826 }).expect(201);
    expect(again.body.repeated).toBe(true);

    const ahmed = await t.login(PHONES.ahmed);
    const alerts = await t.as(ahmed).get('/v1/lost-alerts').expect(200);
    expect(alerts.body[0].name).toBe('Siti Aminah');
    await t.as(ahmed).patch(`/v1/lost-alerts/${res.body.id}`, { status: 'acknowledged' }).expect(200);
    await t.as(ahmed).patch(`/v1/lost-alerts/${res.body.id}`, { status: 'resolved' }).expect(200);
    const fatima = await t.login(PHONES.fatima);
    await t.as(fatima).patch(`/v1/lost-alerts/${res.body.id}`, { status: 'resolved' }).expect(404);
  });

  it('SMS fallback: the provider webhook turns "RFQ LOST lat,lng" into an alert', async () => {
    await t.http().post('/v1/sms/inbound').send({ from: PHONES.siti, body: 'RFQ LOST 21.42100,39.82600 35' }).expect(401);
    const res = await t.http()
      .post('/v1/sms/inbound')
      .set('x-rafeeq-sms-secret', 'dev-sms-secret')
      .send({ from: PHONES.siti, body: 'RFQ LOST 21.42100,39.82600 35' })
      .expect(200);
    expect(res.body.handled).toBe(true);
    const [p] = await t.db.select().from(locationPoints).where(and(eq(locationPoints.userId, sid('pilgrim-siti')), eq(locationPoints.source, 'sms')));
    expect(p.lat).toBeCloseTo(21.421, 3);
    const unknown = await t.http().post('/v1/sms/inbound').set('x-rafeeq-sms-secret', 'dev-sms-secret').send({ from: '+966599999999', body: 'LOST' }).expect(200);
    expect(unknown.body.handled).toBe(false);
  });

  it('locations need consent and a group; withdrawing consent deletes them', async () => {
    const sarah = await t.login(PHONES.sarah); // not in a group, no consent
    const r = await t.as(sarah).post('/v1/locations', { points: [{ lat: 24.467, lng: 39.611, recordedAt: new Date() }] }).expect(409);
    expect(r.body.code).toBe('location.no_consent');
    const nur = await t.login('+966500000057');
    const ok = await t.as(nur).post('/v1/locations', { points: [{ lat: 21.42, lng: 39.82, recordedAt: new Date() }, { lat: 21.42, lng: 39.82, recordedAt: new Date(Date.now() + 3600_000) }] }).expect(200);
    expect(ok.body).toEqual({ stored: 1, ignored: 1 });
    await t.as(nur).patch('/v1/me', { locationSharing: false }).expect(200);
    const left = await t.db.select().from(locationPoints).where(eq(locationPoints.userId, sid('pilgrim-nur')));
    expect(left).toHaveLength(0);
  });

  it('creates a group, joins by code, admin needs a reason to see a location', async () => {
    const sarah = await t.login(PHONES.sarah);
    const g = await t.as(sarah).post('/v1/groups', { name: 'Ahmed family UK' }).expect(201);
    const aisyah = await t.login(PHONES.aisyah);
    const joined = await t.as(aisyah).post('/v1/groups/join', { joinCode: g.body.joinCode.toLowerCase(), relation: 'friend' }).expect(200);
    expect(joined.body.members).toHaveLength(2);

    const ops = await t.login(PHONES.adminOps);
    const list = await t.as(ops).get('/v1/admin/lost-alerts').expect(200);
    const alert = list.body.alerts[0];
    expect(alert.lat).toBeUndefined(); // counts and age only
    await t.as(ops).post(`/v1/admin/lost-alerts/${alert.id}/location`, { reason: 'x' }).expect(400);
    const seen = await t.as(ops).post(`/v1/admin/lost-alerts/${alert.id}/location`, { reason: 'Son called the support line asking for help' }).expect(200);
    expect(seen.body.lastKnown).toBeTruthy();
    const logs = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'lost_alert.view_location'));
    expect(logs).toHaveLength(1);
  });
});

describe('gifts shop and places', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('browses sections in the pilgrim language and filters by shipping country', async () => {
    const res = await t.http().get('/v1/products?section=dates&lang=id').expect(200);
    expect(res.body.items.some((p: { title: string }) => p.title === 'Kurma Madinah, kotak 1 kg')).toBe(true);
    const gb = await t.http().get('/v1/products?section=dates&country=GB').expect(200);
    expect(gb.body.items).toHaveLength(0); // food not confirmed for GB
    const id = await t.http().get('/v1/products?section=dates&country=ID').expect(200);
    expect(id.body.items.length).toBeGreaterThan(0);
  });

  it('demo flow: Madinah dates to the Makkah hotel, shop packs and delivers', async () => {
    const ahmed = await t.login(PHONES.ahmed);
    const item = { productId: sid('p-dates-madinah-1kg'), quantity: 2 };
    const quote = await t.as(ahmed).post('/v1/orders/quote', { items: [item], delivery: { deliveryType: 'hotel' } }).expect(200);
    expect(quote.body).toMatchObject({ subtotalHalalas: 13000, shippingHalalas: 2500, totalHalalas: 15500, estimatedDays: 2 }); // Madinah shop → Makkah hotel

    const order = await t.as(ahmed).post('/v1/orders', { items: [item], delivery: { deliveryType: 'hotel', room: '1204' }, giftWrap: true, giftMessage: 'Untuk Ibu' }).expect(201);
    expect(order.body.totalHalalas).toBe(16500);
    const [before] = await t.db.select().from(products).where(eq(products.id, item.productId));
    const pay = await t.as(ahmed).post('/v1/payments/checkout', { orderId: order.body.id, method: 'mada' }).expect(200);
    await t.as(ahmed).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: SUCCESS }).expect(200);
    const [after] = await t.db.select().from(products).where(eq(products.id, item.productId));
    expect(after.stock).toBe(before.stock - 2);

    const shop = await t.login(PHONES.datesOwner);
    const list = await t.as(shop).get(`/v1/provider/orders?shopId=${sid('sample-dates-house')}&status=paid`).expect(200);
    expect(list.body.items.map((o: { id: string }) => o.id)).toContain(order.body.id);
    await t.as(shop).post(`/v1/provider/orders/${order.body.id}/ship`, { courier: 'x', trackingNumber: 'y' }).expect(409); // hotel order
    await t.as(shop).post(`/v1/provider/orders/${order.body.id}/pack`).expect(200);
    await t.as(shop).post(`/v1/provider/orders/${order.body.id}/out-for-delivery`).expect(200);
    const done = await t.as(shop).post(`/v1/provider/orders/${order.body.id}/deliver`).expect(200);
    expect(done.body.history.map((h: { to: string }) => h.to)).toEqual(['pending_payment', 'paid', 'packed', 'out_for_delivery', 'delivered']);
    const mine = await t.as(ahmed).get(`/v1/orders/${order.body.id}`).expect(200);
    expect(mine.body.statusText).toBe('terkirim');
    const other = await t.login(PHONES.giftsOwner);
    await t.as(other).get(`/v1/orders/${order.body.id}`).expect(404);
  });

  it('international: food only to confirmed countries, tracking number required, cancel refunds and restocks', async () => {
    const sarah = await t.login(PHONES.sarah);
    const dates = { productId: sid('p-souvenir-dates-sampler'), quantity: 1 };
    const blocked = await t.as(sarah)
      .post('/v1/orders/quote', { items: [dates], delivery: { deliveryType: 'international', country: 'GB', line1: '1 High St', city: 'London' } })
      .expect(409);
    expect(blocked.body.code).toBe('order.country_not_allowed');
    await t.as(sarah).post('/v1/orders/quote', { items: [{ productId: sid('p-dates-ajwa-1kg'), quantity: 1 }, { productId: sid('p-prayer-mat'), quantity: 1 }], delivery: { deliveryType: 'hotel' } }).expect(400); // two shops

    const scarf = { productId: sid('p-madinah-scarf'), quantity: 2 };
    const q = await t.as(sarah).post('/v1/orders/quote', { items: [scarf], delivery: { deliveryType: 'international', country: 'GB', line1: '1 High St', city: 'London' } }).expect(200);
    expect(q.body.shippingHalalas).toBe(7500); // 330 g → base rate
    const o = await t.as(sarah).post('/v1/orders', { items: [scarf], delivery: { deliveryType: 'international', country: 'GB', line1: '1 High St', city: 'London' } }).expect(201);
    const pay = await t.as(sarah).post('/v1/payments/checkout', { orderId: o.body.id, method: 'card' }).expect(200);
    await t.as(sarah).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: SUCCESS }).expect(200);
    const [stockPaid] = await t.db.select().from(products).where(eq(products.id, scarf.productId));
    const cancelled = await t.as(sarah).post(`/v1/orders/${o.body.id}/cancel`).expect(200);
    expect(cancelled.body.status).toBe('refunded');
    const [stockBack] = await t.db.select().from(products).where(eq(products.id, scarf.productId));
    expect(stockBack.stock).toBe(stockPaid.stock + 2);
  });

  it('places guide links shops online; map pack has every place and route for offline use', async () => {
    const shopping = await t.http().get('/v1/places?city=madinah&type=shopping&lang=tr').expect(200);
    expect(shopping.body).toHaveLength(5);
    const datesHouse = shopping.body.find((p: { name: string }) => p.name.includes('Hurma Evi'));
    expect(datesHouse.shopOnline.shopId).toBe(sid('sample-dates-house'));
    const pack = await t.http().get('/v1/map-packs/makkah').expect(200);
    expect(pack.body.places).toHaveLength(13);
    expect(pack.body.routes).toHaveLength(6);
    expect(pack.body.routes[0].steps[0].instruction.ur).toBeTruthy();
    const pack2 = await t.http().get('/v1/map-packs/makkah').expect(200);
    expect(pack2.body.version).toBe(pack.body.version);
    const routes = await t.http().get(`/v1/routes?fromPlaceId=${sid('hotel-makkah-ibrahim-khalil')}&accessibleOnly=true&lang=id`).expect(200);
    expect(routes.body[0].steps.at(-1).text).toContain('Anda telah tiba');

    const ops = await t.login(PHONES.adminOps);
    await t.as(ops).patch(`/v1/admin/places/${sid('gate-king-fahd')}`, { hours: { always: '24h', note: 'checked on site' } }).expect(200);
    const pack3 = await t.http().get('/v1/map-packs/makkah').expect(200);
    expect(pack3.body.version).not.toBe(pack.body.version);
  });

  it('admin overview, outbox and content', async () => {
    const ops = await t.login(PHONES.adminOps);
    const ov = await t.as(ops).get('/v1/admin/overview?days=30').expect(200);
    expect(ov.body.bookings.count).toBeGreaterThan(5);
    expect(ov.body.safety.openBagCases).toBeGreaterThanOrEqual(1);
    expect(ov.body.topNationalities.length).toBeGreaterThan(0);
    const outbox = await t.as(ops).get('/v1/admin/outbox?channel=sms').expect(200);
    expect(outbox.body.items.every((m: { body: string; template: string }) => m.template !== 'auth.otp' || m.body === '(login code hidden)')).toBe(true);
    const banners = await t.http().get('/v1/content?kind=banner&lang=ur').expect(200);
    expect(banners.body[0].title).toContain('ہلکے');
    const pilgrim = await t.login(PHONES.ahmed);
    await t.as(pilgrim).get('/v1/admin/overview').expect(403);
  });
});
