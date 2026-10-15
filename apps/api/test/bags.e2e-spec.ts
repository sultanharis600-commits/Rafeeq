import { eq } from 'drizzle-orm';
import { bags, bagScans, lostBagCases, outboxMessages } from '../src/db/schema.js';
import { BagsService } from '../src/bags/bags.service.js';
import { createTestApp, PHONES, sid, type TestApp } from './helpers.js';

const SUCCESS = '4111 1111 1111 1111';

describe('baggage tracking', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('pilgrim sees the timeline of the sample bags, including the overdue one', async () => {
    const ahmed = await t.login(PHONES.ahmed);
    const mine = await t.as(ahmed).get('/v1/bags').expect(200);
    expect(mine.body.map((b: { status: string }) => b.status).sort()).toEqual(['delivered', 'in_transit', 'overdue']);
    const overdue = mine.body.find((b: { status: string }) => b.status === 'overdue');
    const tl = await t.as(ahmed).get(`/v1/bags/${overdue.id}`).expect(200);
    expect(tl.body.scans).toHaveLength(1);
    expect(tl.body.scans[0]).toMatchObject({ place: 'hotel_lobby', heldBy: 'Saeed' });
    expect(tl.body.cases[0]).toMatchObject({ status: 'open', reason: 'overdue_scan' });
    const fatima = await t.login(PHONES.fatima);
    await t.as(fatima).get(`/v1/bags/${overdue.id}`).expect(404);
  });

  it('demo flow: book luggage, link pre-printed tags, scan at each handover (offline batch)', async () => {
    const ahmed = await t.login(PHONES.ahmed);
    const slots = await t.http().get(`/v1/services/${sid('svc-luggage-hotel-airport')}/slots`).expect(200);
    const b = await t.as(ahmed).post('/v1/bookings', { serviceId: sid('svc-luggage-hotel-airport'), slotId: slots.body[0].id, quantity: 2 }).expect(201);
    expect(b.body.totalHalalas).toBe(8000);
    const pay = await t.as(ahmed).post('/v1/payments/checkout', { bookingId: b.body.id, method: 'stc_pay' }).expect(200);
    await t.as(ahmed).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: SUCCESS }).expect(200);
    const owner = await t.login(PHONES.luggageOwner);
    await t.as(owner).post(`/v1/provider/bookings/${b.body.id}/accept`).expect(200);
    await t.as(owner).post(`/v1/provider/bookings/${b.body.id}/assign`, { staffId: sid('staff:staff-saeed') }).expect(200);

    const admin = await t.login(PHONES.adminOps);
    const tags = await t.as(admin).post('/v1/admin/bag-tags', { count: 3 }).expect(201);
    expect(tags.body).toHaveLength(3);
    const [tagA, tagB, tagC] = tags.body as string[];

    const saeed = await t.login(PHONES.saeed);
    const t0 = Date.now() - 30 * 60_000;
    // A new tag needs the booking on its first scan
    const notLinked = await t.as(saeed).post('/v1/staff/bag-scans', { scans: [{ tagCode: tagA, placeLabel: 'hotel_lobby', scannedAt: new Date(t0) }] }).expect(200);
    expect(notLinked.body[0]).toMatchObject({ ok: false, error: 'bag.not_linked' });

    const batch = await t.as(saeed)
      .post('/v1/staff/bag-scans', {
        scans: [
          { tagCode: tagA, placeLabel: 'hotel_lobby', scannedAt: new Date(t0), bookingId: b.body.id, label: 'Green suitcase', clientId: 'phone1-1' },
          { tagCode: tagB, placeLabel: 'hotel_lobby', scannedAt: new Date(t0 + 60_000), bookingId: b.body.id, label: 'Box', clientId: 'phone1-2' },
          { tagCode: tagC, placeLabel: 'hotel_lobby', scannedAt: new Date(t0 + 90_000), bookingId: b.body.id, clientId: 'phone1-3' }, // only 2 bags booked
          { tagCode: tagA, placeLabel: 'van', scannedAt: new Date(t0 + 15 * 60_000), clientId: 'phone1-4' },
        ],
      })
      .expect(200);
    expect(batch.body.map((r: { ok: boolean }) => r.ok)).toEqual([true, true, false, true]);
    expect(batch.body[2].error).toBe('bag.too_many');

    // The same offline batch synced again is stored once
    const again = await t.as(saeed).post('/v1/staff/bag-scans', { scans: [{ tagCode: tagA, placeLabel: 'van', scannedAt: new Date(t0 + 15 * 60_000), clientId: 'phone1-4' }] }).expect(200);
    expect(again.body[0]).toMatchObject({ ok: true, duplicate: true });

    // An older scan arriving late doesn't move the bag backwards
    await t.as(saeed).post('/v1/staff/bag-scans', { scans: [{ tagCode: tagA, placeLabel: 'hotel_lobby', scannedAt: new Date(t0 - 60_000), clientId: 'phone1-0' }] }).expect(200);
    const [bagA] = await t.db.select().from(bags).where(eq(bags.tagCode, tagA));
    expect(bagA.status).toBe('in_transit');
    const scansA = await t.db.select().from(bagScans).where(eq(bagScans.bagId, bagA.id));
    expect(scansA).toHaveLength(3);

    const booking = await t.as(ahmed).get(`/v1/bookings/${b.body.id}`).expect(200);
    expect(booking.body.status).toBe('in_progress');
    expect(booking.body.bags).toHaveLength(2);
    const tl = await t.as(ahmed).get(`/v1/bags/${bagA.id}`).expect(200);
    expect(tl.body.scans.map((s: { place: string }) => s.place)).toEqual(['hotel_lobby', 'hotel_lobby', 'van']);

    const pushes = await t.db.select().from(outboxMessages).where(eq(outboxMessages.template, 'bag.scanned'));
    expect(pushes.some((p) => p.body.includes('Green suitcase') && p.body.includes('Di dalam van'))).toBe(true);

    // Staff of another provider can't scan these
    const khalid = await t.login(PHONES.khalid);
    const denied = await t.as(khalid).post('/v1/staff/bag-scans', { scans: [{ tagCode: tagA, placeLabel: 'van', scannedAt: new Date() }] }).expect(200);
    expect(denied.body[0]).toMatchObject({ ok: false, error: 'bag.not_your_booking' });
  });

  it('opens a lost-bag case when a handover is missed, closes it when the bag is scanned', async () => {
    const svc = t.app.get(BagsService);
    const opened = await svc.markOverdue(new Date(Date.now() + 4 * 3600_000));
    expect(opened).toBeGreaterThanOrEqual(1);
    const cases = await t.db.select().from(lostBagCases).where(eq(lostBagCases.status, 'open'));
    expect(cases.length).toBeGreaterThanOrEqual(2);

    const [overdue] = await t.db.select().from(bags).where(eq(bags.tagCode, 'RFQ-2X6P5D'));
    const saeed = await t.login(PHONES.saeed);
    await t.as(saeed).post('/v1/staff/bag-scans', { scans: [{ tagCode: 'RFQ-2X6P5D', placeLabel: 'shipping_depot', scannedAt: new Date() }] }).expect(200);
    const [closed] = await t.db.select().from(lostBagCases).where(eq(lostBagCases.bagId, overdue.id));
    expect(closed.status).toBe('resolved');

    const owner = await t.login(PHONES.luggageOwner);
    const view = await t.as(owner).get(`/v1/provider/bags?providerId=${sid('sample-luggage')}`).expect(200);
    expect(view.body.bags.length).toBeGreaterThanOrEqual(8);
  });

  it('pilgrim reports a bag missing; support resolves it', async () => {
    const fatima = await t.login(PHONES.fatima);
    const mine = await t.as(fatima).get('/v1/bags').expect(200);
    const c = await t.as(fatima).post(`/v1/bags/${mine.body[0].id}/report-missing`, { notes: 'Not at storage desk' }).expect(201);
    const support = await t.login(PHONES.adminSupport);
    const list = await t.as(support).get('/v1/admin/lost-bag-cases?status=open').expect(200);
    expect(list.body.map((r: { c: { id: string } }) => r.c.id)).toContain(c.body.id);
    await t.as(support).post(`/v1/admin/lost-bag-cases/${c.body.id}/resolve`, { outcome: 'found', notes: 'Was on the second shelf' }).expect(200);
    await t.as(support).post(`/v1/admin/lost-bag-cases/${c.body.id}/resolve`, { outcome: 'found', notes: 'again' }).expect(409);
  });
});
