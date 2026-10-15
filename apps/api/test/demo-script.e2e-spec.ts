/**
 * The guide's 15-minute demo script (docs/guide.md › MVP scope and sample data), run end
 * to end against the API with the sample data. If this passes, every backend step of the
 * live demo works. docs/demo-script.md has the same steps for a person clicking through.
 */
import { createTestApp, PHONES, sid, type TestApp } from './helpers.js';

const SANDBOX_CARD = '4111 1111 1111 1111';
const HOUR = 3600_000;

type Slot = { id: string; startsAt: string; remaining: number };

describe('demo script, end to end', () => {
  let t: TestApp;
  let ahmed: string;
  let siti: string;

  beforeAll(async () => {
    t = await createTestApp();
    ahmed = await t.login(PHONES.ahmed);
    siti = await t.login(PHONES.siti);
  });
  afterAll(() => t.close());

  async function slot(serviceKey: string): Promise<Slot> {
    const res = await t.http().get(`/v1/services/${sid(serviceKey)}/slots`).expect(200);
    const s = (res.body as Slot[]).find((x) => x.remaining > 0 && new Date(x.startsAt).getTime() > Date.now() + 2 * HOUR);
    expect(s).toBeTruthy();
    return s!;
  }

  async function payBooking(token: string, bookingId: string) {
    const pay = await t.as(token).post('/v1/payments/checkout', { bookingId, method: 'card' }).expect(200);
    await t.as(token).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: SANDBOX_CARD }).expect(200);
  }

  let transferId: string;
  let luggageId: string;

  it('1. Ahmed picks Indonesian, logs in, books an airport-to-hotel transfer and pays', async () => {
    const me = await t.as(ahmed).get('/v1/me').expect(200);
    expect(me.body.language).toBe('id');

    const s = await slot('svc-jed-airport-makkah-van');
    const b = await t.as(ahmed).post('/v1/bookings', { serviceId: sid('svc-jed-airport-makkah-van'), slotId: s.id }).expect(201);
    expect(b.body.status).toBe('pending_payment');
    transferId = b.body.id;
    await payBooking(ahmed, transferId);

    const detail = await t.as(ahmed).get(`/v1/bookings/${transferId}`).expect(200);
    expect(detail.body.status).toBe('paid');
    expect(detail.body.service.title).toContain('Bandara Jeddah');
  });

  it('2. The provider accepts and assigns a driver; Ahmed sees the driver on the map', async () => {
    const owner = await t.login(PHONES.transportOwner);
    const list = await t.as(owner).get(`/v1/provider/bookings?providerId=${sid('sample-transport')}&status=paid`).expect(200);
    expect(list.body.items.some((b: { id: string }) => b.id === transferId)).toBe(true);

    await t.as(owner).post(`/v1/provider/bookings/${transferId}/accept`).expect(200);
    await t.as(owner).post(`/v1/provider/bookings/${transferId}/assign`, { staffId: sid('staff:staff-khalid') }).expect(200);

    const khalid = await t.login(PHONES.khalid);
    await t.as(khalid).post(`/v1/staff/bookings/${transferId}/location`, { lat: 21.6796, lng: 39.1565 }).expect(200);

    const detail = await t.as(ahmed).get(`/v1/bookings/${transferId}`).expect(200);
    expect(detail.body.status).toBe('accepted');
    expect(detail.body.staff.name).toContain('Khalid');
    expect(detail.body.liveLocation).toMatchObject({ lat: 21.6796, lng: 39.1565 });
  });

  it('3. Ahmed books bag shipping; staff scan the bags; one bag is overdue and a lost-bag case opens', async () => {
    const s = await slot('svc-luggage-ship-home');
    const b = await t.as(ahmed).post('/v1/bookings', { serviceId: sid('svc-luggage-ship-home'), slotId: s.id, quantity: 2 }).expect(201);
    luggageId = b.body.id;
    expect(b.body.totalHalalas).toBe(2 * 18000);
    await payBooking(ahmed, luggageId);

    const owner = await t.login(PHONES.luggageOwner);
    await t.as(owner).post(`/v1/provider/bookings/${luggageId}/accept`).expect(200);
    await t.as(owner).post(`/v1/provider/bookings/${luggageId}/assign`, { staffId: sid('staff:staff-saeed') }).expect(200);

    // Tags are printed from the admin panel
    const admin = await t.login(PHONES.adminOps);
    const tags = await t.as(admin).post('/v1/admin/bag-tags', { count: 2 }).expect(201);
    const [tagA, tagB] = tags.body as string[];

    // Saeed scans both at the hotel, then only bag A in the van
    const saeed = await t.login(PHONES.saeed);
    const now = Date.now();
    const scans = await t.as(saeed)
      .post('/v1/staff/bag-scans', {
        scans: [
          { tagCode: tagA, placeLabel: 'hotel_lobby', scannedAt: new Date(now - 30 * 60_000), clientId: 'demo-1', bookingId: luggageId, label: 'Blue suitcase' },
          { tagCode: tagB, placeLabel: 'hotel_lobby', scannedAt: new Date(now - 30 * 60_000), clientId: 'demo-2', bookingId: luggageId, label: 'Zamzam carton' },
          { tagCode: tagA, placeLabel: 'van', scannedAt: new Date(now - 15 * 60_000), clientId: 'demo-3' },
        ],
      })
      .expect(200);
    expect((scans.body as { ok: boolean }[]).every((r) => r.ok)).toBe(true);

    const detail = await t.as(ahmed).get(`/v1/bookings/${luggageId}`).expect(200);
    expect(detail.body.bags).toHaveLength(2);
    const bagA = detail.body.bags.find((g: { tagCode: string }) => g.tagCode === tagA);
    const timeline = await t.as(ahmed).get(`/v1/bags/${bagA.id}`).expect(200);
    expect(timeline.body.scans.map((s: { place: string }) => s.place)).toEqual(['hotel_lobby', 'van']);

    // Bag B missed the van. The overdue job runs every 5 minutes; the admin panel's
    // demo button checks as if an hour had passed.
    const check = await t.as(admin).post('/v1/admin/bags/check-overdue', { aheadMinutes: 60 }).expect(200);
    expect(check.body.opened).toBeGreaterThanOrEqual(1);
    const cases = await t.as(admin).get('/v1/admin/lost-bag-cases?status=open').expect(200);
    const list = (cases.body.items ?? cases.body) as { tagCode?: string; bag?: { tagCode: string } }[];
    expect(list.some((c) => (c.tagCode ?? c.bag?.tagCode) === tagB)).toBe(true);
  });

  it('4. Ahmed orders a Madinah dates box to his hotel; the shop packs and delivers it', async () => {
    const order = {
      items: [{ productId: sid('p-dates-madinah-1kg'), quantity: 1 }],
      delivery: { deliveryType: 'hotel', room: '1204' },
    };
    const quote = await t.as(ahmed).post('/v1/orders/quote', order).expect(200);
    // The shop is in Madinah and Ahmed's hotel is in Makkah: 65 SAR box + 25 SAR delivery between cities
    expect(quote.body.subtotalHalalas).toBe(6500);
    expect(quote.body.totalHalalas).toBe(9000);
    const created = await t.as(ahmed).post('/v1/orders', order).expect(201);
    const orderId = created.body.id as string;
    const pay = await t.as(ahmed).post('/v1/payments/checkout', { orderId, method: 'apple_pay' }).expect(200);
    await t.as(ahmed).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: SANDBOX_CARD }).expect(200);

    const shop = await t.login(PHONES.datesOwner);
    for (const step of ['pack', 'out-for-delivery', 'deliver']) {
      await t.as(shop).post(`/v1/provider/orders/${orderId}/${step}`).expect(200);
    }
    const done = await t.as(ahmed).get(`/v1/orders/${orderId}`).expect(200);
    expect(done.body.status).toBe('delivered');
  });

  it('5. He opens the shopping places guide, finds a gift shop and taps "Shop online"', async () => {
    const places = await t.as(ahmed).get('/v1/places?city=makkah&type=shopping').expect(200);
    const withShop = (places.body as { shopOnline: { shopId: string } | null }[]).find((p) => p.shopOnline);
    expect(withShop).toBeTruthy();
    const products = await t.as(ahmed).get(`/v1/products?shopId=${withShop!.shopOnline!.shopId}`).expect(200);
    expect(products.body.items.length).toBeGreaterThan(0);
  });

  it('6. The elderly user: accessibility mode, a step-free route to a Haram gate, wheelchair help', async () => {
    const me = await t.as(siti).get('/v1/me').expect(200);
    expect(me.body.accessibilityMode).toBe(true);
    expect(me.body.accessibilityNeeds).toContain('wheelchair');

    const routes = await t.as(siti).get(`/v1/routes?city=makkah&fromPlaceId=${me.body.hotel.id}&accessibleOnly=true&lang=id`).expect(200);
    const toGate = (routes.body as { toPlaceId: string; steps: { text: string }[] }[]).find((r) => r.toPlaceId === sid('gate-king-abdulaziz'));
    expect(toGate).toBeTruthy();
    expect(toGate!.steps.at(-1)!.text).toContain('Anda telah tiba');

    // The offline map pack has the same route for use without network
    const pack = await t.http().get('/v1/map-packs/makkah').expect(200);
    expect(pack.body.routes.length).toBeGreaterThanOrEqual(6);

    const s = await slot('svc-wheelchair-hotel-gate');
    const b = await t.as(siti).post('/v1/bookings', { serviceId: sid('svc-wheelchair-hotel-gate'), slotId: s.id }).expect(201);
    await payBooking(siti, b.body.id);
    const owner = await t.login(PHONES.careOwner);
    const view = await t.as(owner).get(`/v1/bookings/${b.body.id}`).expect(200);
    expect(view.body.needs).toContain('wheelchair');
  });

  it('7. She presses "I\'m lost" with data off: the SMS reaches the leader, the map shows her, the finder can find her', async () => {
    // With no data, the app sends "RFQ LOST lat,lng accuracy" by SMS; the SMS provider forwards it here.
    await t.http()
      .post('/v1/sms/inbound')
      .set('x-rafeeq-sms-secret', 'dev-sms-secret')
      .send({ from: PHONES.siti, body: 'Siti Aminah is lost and needs help.\nRFQ LOST 21.42150,39.82580 25' })
      .expect(200)
      .expect((r) => expect(r.body.handled).toBe(true));

    // Ahmed leads the family group: he sees the alert and her location
    const groups = await t.as(ahmed).get('/v1/groups').expect(200);
    const family = (groups.body as { id: string; alerts: { userId: string; id: string }[]; members: { userId: string; lastLocation: { lat: number } | null; bleIds: unknown[] }[] }[]).find((g) => g.id === sid('group-wijaya'))!;
    const alert = family.alerts.find((a) => a.userId === sid('pilgrim-siti'));
    expect(alert).toBeTruthy();
    const sitiMember = family.members.find((m) => m.userId === sid('pilgrim-siti'))!;
    expect(sitiMember.lastLocation?.lat).toBeCloseTo(21.4215, 4);
    expect(sitiMember.bleIds).toHaveLength(3); // for the Bluetooth finder, valid without network

    // An SMS was sent to the leader with a map link
    const admin = await t.login(PHONES.adminOps);
    const outbox = await t.as(admin).get('/v1/admin/outbox?channel=sms').expect(200);
    const toAhmed = (outbox.body.items as { to: string | null; body: string }[]).find((m) => m.to === 'Ahmed Wijaya');
    expect(toAhmed?.body).toContain('maps.google.com/?q=21.42150,39.82580');

    // Found: Ahmed closes the alert
    await t.as(ahmed).patch(`/v1/lost-alerts/${alert!.id}`, { status: 'resolved' }).expect(200);
  });

  it("8. Admin panel: today's bookings, orders, bags, open alerts and commission", async () => {
    const admin = await t.login(PHONES.adminOps);
    const o = await t.as(admin).get('/v1/admin/overview').expect(200);
    expect(o.body.bookings.count).toBeGreaterThanOrEqual(3);
    expect(o.body.bookings.commissionHalalas).toBeGreaterThan(0);
    expect(o.body.shop.orders).toBeGreaterThanOrEqual(1);
    expect(o.body.safety.openBagCases).toBeGreaterThanOrEqual(1);
    expect(o.body.safety.openLostAlerts).toBe(0);
  });
});
