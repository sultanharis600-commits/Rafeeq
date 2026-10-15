import { and, eq } from 'drizzle-orm';
import { availabilitySlots, bookings, payments, statusEvents } from '../src/db/schema.js';
import { createTestApp, PHONES, sid, type TestApp } from './helpers.js';

const SUCCESS = '4111 1111 1111 1111';
const DECLINED = '4000 0000 0000 0002';

describe('marketplace: providers, catalogue, bookings, payments', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  async function firstSlot(serviceKey: string) {
    const res = await t.http().get(`/v1/services/${sid(serviceKey)}/slots`).expect(200);
    const slot = res.body.find((s: { remaining: number }) => s.remaining > 0);
    expect(slot).toBeTruthy();
    return slot as { id: string; startsAt: string; remaining: number };
  }

  async function bookAndPay(phone: string, serviceKey: string, extra: object = {}) {
    const token = await t.login(phone);
    const slot = await firstSlot(serviceKey);
    const b = await t.as(token).post('/v1/bookings', { serviceId: sid(serviceKey), slotId: slot.id, ...extra }).expect(201);
    const pay = await t.as(token).post('/v1/payments/checkout', { bookingId: b.body.id, method: 'mada' }).expect(200);
    await t.as(token).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: SUCCESS }).expect(200);
    return { token, bookingId: b.body.id as string, slot };
  }

  it('lists categories and searches in the pilgrim language', async () => {
    const cats = await t.http().get('/v1/categories?city=makkah').expect(200);
    expect(cats.body.find((c: { category: string }) => c.category === 'luggage').services).toBeGreaterThan(0);

    const token = await t.login(PHONES.ahmed); // Indonesian
    const res = await t.as(token).get('/v1/services?category=transport&city=makkah&q=Jeddah').expect(200);
    const van = res.body.items.find((s: { id: string }) => s.id === sid('svc-jed-airport-makkah-van'));
    expect(van.title).toBe('Bandara Jeddah ke hotel Makkah (van, hingga 10 orang)');
    expect(van.provider.verified).toBe(true);

    // The pending Madinah guide is not listed
    const guides = await t.http().get('/v1/services?city=madinah&category=guides').expect(200);
    expect(guides.body.items).toHaveLength(0);
  });

  it('shows details with options, slots and reviews', async () => {
    const res = await t.http().get(`/v1/services/${sid('svc-jed-airport-makkah-van')}?lang=ar`).expect(200);
    expect(res.body.title).toContain('مطار جدة');
    expect(res.body.options[0]).toMatchObject({ key: 'child_seat', priceHalalas: 3000 });
    expect(res.body.slots.length).toBeGreaterThan(5);
    expect(res.body.reviews[0].author).toBe('Ahmed');
  });

  it('books, holds capacity, fails then succeeds payment, and notifies the provider', async () => {
    const token = await t.login(PHONES.ahmed);
    const slot = await firstSlot('svc-jed-airport-makkah-van');
    const created = await t.as(token)
      .post('/v1/bookings', { serviceId: sid('svc-jed-airport-makkah-van'), slotId: slot.id, options: ['child_seat'] })
      .expect(201);
    expect(created.body).toMatchObject({ status: 'pending_payment', totalHalalas: 38000 });
    const [held] = await t.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slot.id));
    expect(held.held).toBe(1);

    const pay = await t.as(token).post('/v1/payments/checkout', { bookingId: created.body.id, method: 'card' }).expect(200);
    expect(pay.body.amountHalalas).toBe(38000);
    const declined = await t.as(token).post(`/v1/payments/${pay.body.paymentId}/sandbox/complete`, { cardNumber: DECLINED }).expect(200);
    expect(declined.body.status).toBe('failed');

    const retry = await t.as(token).post('/v1/payments/checkout', { bookingId: created.body.id, method: 'apple_pay' }).expect(200);
    expect(retry.body.paymentId).not.toBe(pay.body.paymentId);
    await t.as(token).post(`/v1/payments/${retry.body.paymentId}/sandbox/complete`, { cardNumber: SUCCESS }).expect(200);
    // paying twice is idempotent
    await t.as(token).post(`/v1/payments/${retry.body.paymentId}/sandbox/complete`, { cardNumber: SUCCESS }).expect(200);

    const after = await t.as(token).get(`/v1/bookings/${created.body.id}`).expect(200);
    expect(after.body.status).toBe('paid');
    expect(after.body.acceptBy).toBeTruthy();
    const [slotAfter] = await t.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slot.id));
    expect(slotAfter).toMatchObject({ held: 0, booked: held.booked + 1 });

    const owner = await t.login(PHONES.transportOwner);
    const list = await t.as(owner).get(`/v1/provider/bookings?providerId=${sid('sample-transport')}&status=paid`).expect(200);
    expect(list.body.items.map((b: { id: string }) => b.id)).toContain(created.body.id);
  });

  it('keeps bookings private between pilgrims and providers', async () => {
    const { bookingId } = await bookAndPay(PHONES.ahmed, 'svc-makkah-haram-shuttle', { quantity: 2 });
    const fatima = await t.login(PHONES.fatima);
    await t.as(fatima).get(`/v1/bookings/${bookingId}`).expect(404);
    const otherOwner = await t.login(PHONES.datesOwner);
    await t.as(otherOwner).get(`/v1/bookings/${bookingId}`).expect(404);
    await t.as(otherOwner).post(`/v1/provider/bookings/${bookingId}/accept`).expect(404);
    await t.as(otherOwner).get(`/v1/provider/bookings?providerId=${sid('sample-transport')}`).expect(403);
    await t.as(fatima).post('/v1/payments/checkout', { bookingId, method: 'card' }).expect(403);
  });

  it('runs the full job: accept, assign driver, live location, start, complete', async () => {
    const { token, bookingId } = await bookAndPay(PHONES.aisyah, 'svc-jed-airport-makkah-van');
    const owner = await t.login(PHONES.transportOwner);
    await t.as(owner).post(`/v1/provider/bookings/${bookingId}/accept`).expect(200);
    const khalidStaff = sid('staff:staff-khalid');
    const assigned = await t.as(owner).post(`/v1/provider/bookings/${bookingId}/assign`, { staffId: khalidStaff }).expect(200);
    expect(assigned.body.staff.name).toContain('Khalid');

    const khalid = await t.login(PHONES.khalid);
    await t.as(khalid).post(`/v1/staff/bookings/${bookingId}/location`, { lat: 21.68, lng: 39.16 }).expect(200);
    const seen = await t.as(token).get(`/v1/bookings/${bookingId}`).expect(200);
    expect(seen.body.liveLocation).toMatchObject({ lat: 21.68, lng: 39.16 });
    expect(seen.body.staff.phone).toBeTruthy(); // contact shown once accepted

    await t.as(khalid).post(`/v1/staff/bookings/${bookingId}/complete`).expect(409); // must start first
    await t.as(khalid).post(`/v1/staff/bookings/${bookingId}/start`).expect(200);
    const done = await t.as(khalid).post(`/v1/staff/bookings/${bookingId}/complete`).expect(200);
    expect(done.body.status).toBe('completed');
    expect(done.body.history.map((h: { to: string }) => h.to)).toEqual(['pending_payment', 'paid', 'accepted', 'in_progress', 'completed']);

    // another staff member of a different provider cannot touch it
    const saeed = await t.login(PHONES.saeed);
    await t.as(saeed).post(`/v1/staff/bookings/${bookingId}/start`).expect(404);
  });

  it('decline refunds in full and suggests alternatives', async () => {
    const { token, bookingId } = await bookAndPay(PHONES.mehmet, 'svc-makkah-haram-shuttle');
    const owner = await t.login(PHONES.transportOwner);
    const res = await t.as(owner).post(`/v1/provider/bookings/${bookingId}/decline`, { reason: 'van broken' }).expect(200);
    expect(res.body.status).toBe('refunded');
    const [p] = await t.db.select().from(payments).where(eq(payments.bookingId, bookingId));
    expect(p).toMatchObject({ status: 'refunded', refundedHalalas: p.amountHalalas });
    await t.as(token).get(`/v1/bookings/${bookingId}/alternatives`).expect(200);
  });

  it('cancellation refund follows the policy', async () => {
    const { token, bookingId } = await bookAndPay(PHONES.sarah, 'svc-photo-session-hotel');
    const before = await t.as(token).get(`/v1/bookings/${bookingId}`).expect(200);
    expect(before.body.cancel.allowed).toBe(true);
    const expected = before.body.cancel.refundHalalas;
    const res = await t.as(token).post(`/v1/bookings/${bookingId}/cancel`, { reason: 'changed plans' }).expect(200);
    expect(res.body.refundHalalas).toBe(expected);
    expect(['refunded', 'cancelled']).toContain(res.body.status);
  });

  it('expires unpaid holds and unanswered bookings', async () => {
    const token = await t.login(PHONES.abdullah);
    const slot = await firstSlot('svc-umrah-guide-english');
    const b = await t.as(token).post('/v1/bookings', { serviceId: sid('svc-umrah-guide-english'), slotId: slot.id }).expect(201);
    const { BookingsService } = await import('../src/bookings/bookings.service.js');
    const svc = t.app.get(BookingsService);
    expect(await svc.expireHolds(new Date(Date.now() + 11 * 60_000))).toBeGreaterThanOrEqual(1);
    const [row] = await t.db.select().from(bookings).where(eq(bookings.id, b.body.id));
    expect(row.status).toBe('cancelled');
    const [slotRow] = await t.db.select().from(availabilitySlots).where(eq(availabilitySlots.id, slot.id));
    expect(slotRow.held).toBe(0);
    await t.as(token).post('/v1/payments/checkout', { bookingId: b.body.id, method: 'card' }).expect(409);

    const paid = await bookAndPay(PHONES.abdullah, 'svc-umrah-guide-english');
    expect(await svc.expireUnaccepted(new Date(Date.now() + 31 * 60_000))).toBeGreaterThanOrEqual(1);
    const [late] = await t.db.select().from(bookings).where(eq(bookings.id, paid.bookingId));
    expect(late.status).toBe('refunded');
    const events = await t.db.select().from(statusEvents).where(and(eq(statusEvents.entityId, paid.bookingId), eq(statusEvents.toStatus, 'declined')));
    expect(events[0].reason).toContain('did not answer');
  });

  it('refuses to overbook a slot', async () => {
    const token = await t.login(PHONES.fatima);
    const slot = await firstSlot('svc-makkah-madinah-car'); // capacity 1
    await t.as(token).post('/v1/bookings', { serviceId: sid('svc-makkah-madinah-car'), slotId: slot.id }).expect(201);
    const other = await t.login(PHONES.mehmet);
    const res = await t.as(other).post('/v1/bookings', { serviceId: sid('svc-makkah-madinah-car'), slotId: slot.id }).expect(409);
    expect(res.body.code).toBe('booking.not_enough_capacity');
    await t.as(token).post('/v1/bookings', { serviceId: sid('svc-makkah-madinah-car'), slotId: slot.id, quantity: 2 }).expect(400);
  });

  it('disputes go to admin, who can refund part', async () => {
    const { token, bookingId } = await bookAndPay(PHONES.ahmed, 'svc-photo-group');
    const owner = await t.login('+966500000013');
    await t.as(owner).post(`/v1/provider/bookings/${bookingId}/accept`).expect(200);
    await t.as(token).post(`/v1/bookings/${bookingId}/dispute`, { reason: 'photographer late' }).expect(200);
    const admin = await t.login(PHONES.adminSupport);
    const res = await t.as(admin).post(`/v1/admin/bookings/${bookingId}/resolve`, { outcome: 'refund', amountHalalas: 10000, note: 'late 1 hour' }).expect(200);
    expect(res.body.status).toBe('refunded');
    const [p] = await t.db.select().from(payments).where(eq(payments.bookingId, bookingId));
    expect(p).toMatchObject({ status: 'partially_refunded', refundedHalalas: 10000 });
  });

  it('onboards a new provider: apply, admin approves, lists a service, adds staff', async () => {
    const phone = '+966555000111';
    const token = await t.login(phone);
    const applied = await t.as(token)
      .post('/v1/providers', {
        type: 'company',
        kind: 'services',
        name: { en: 'New Photo Co.', ar: 'شركة التصوير الجديدة' },
        crNumber: '4030999999',
        city: 'makkah',
        iban: 'SA0380000000608010167519',
        documents: [{ kind: 'commercial_registration', url: 'upload://cr.pdf' }],
      })
      .expect(201);
    expect(applied.body).toMatchObject({ status: 'pending', ibanLast4: '7519' });
    expect(applied.body.ibanEncrypted).toBeUndefined();
    await t.as(token).post('/v1/providers', { type: 'company', kind: 'services', name: { en: 'x' }, city: 'makkah' }).expect(400); // no CR

    const owner = await t.login(phone); // cached token; role changed in DB
    const svc = await t.as(owner)
      .post('/v1/provider/services', {
        providerId: applied.body.id,
        category: 'photography',
        title: { en: 'Sunrise photos' },
        priceHalalas: 25000,
        priceModel: 'fixed',
        languagesSpoken: ['en'],
        serviceArea: 'makkah',
      })
      .expect(201);
    // not public until approved
    await t.http().get(`/v1/services/${svc.body.id}`).expect(404);

    const adminOps = await t.login(PHONES.adminOps);
    const fin = await t.login(PHONES.adminFinance);
    await t.as(fin).post(`/v1/admin/providers/${applied.body.id}/approve`).expect(403); // ops only
    const pending = await t.as(adminOps).get('/v1/admin/providers?status=pending').expect(200);
    expect(pending.body.items.map((p: { id: string }) => p.id)).toContain(applied.body.id);
    await t.as(adminOps).post(`/v1/admin/providers/${applied.body.id}/approve`, { reason: 'documents checked' }).expect(200);
    await t.as(fin).patch(`/v1/admin/providers/${applied.body.id}/commission`, { commissionRateBps: 1800 }).expect(200);

    const slots = await t.as(owner)
      .post(`/v1/provider/services/${svc.body.id}/slots`, { fromDate: new Date(Date.now() + 86400_000 * 2).toISOString().slice(0, 10), days: 3, hours: [6, 7], capacity: 1 })
      .expect(201);
    expect(slots.body).toEqual({ created: 6, skipped: 0 });
    const again = await t.as(owner)
      .post(`/v1/provider/services/${svc.body.id}/slots`, { fromDate: new Date(Date.now() + 86400_000 * 2).toISOString().slice(0, 10), days: 3, hours: [6, 7], capacity: 1 })
      .expect(201);
    expect(again.body.created).toBe(0);
    await t.http().get(`/v1/services/${svc.body.id}`).expect(200);

    const staff = await t.as(owner).post(`/v1/providers/${applied.body.id}/staff`, { phone: '+966555000222', name: 'Rami', staffRole: 'photographer' }).expect(201);
    expect(staff.body.staffRole).toBe('photographer');
    await t.as(owner).post(`/v1/providers/${applied.body.id}/staff`, { phone: PHONES.ahmed, name: 'x', staffRole: 'driver' }).expect(409);

    await t.as(adminOps).post(`/v1/admin/providers/${applied.body.id}/suspend`, { reason: 'test' }).expect(200);
    await t.http().get(`/v1/services/${svc.body.id}`).expect(404);
  });
});
