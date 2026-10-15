import { eq } from 'drizzle-orm';
import { bookings, payouts, providers } from '../src/db/schema.js';
import { PayoutsService } from '../src/payouts/payouts.service.js';
import { createTestApp, PHONES, sid, type TestApp } from './helpers.js';

describe('payouts, reconciliation, invoices and reviews', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('sample data reconciles with no mismatches', async () => {
    const fin = await t.login(PHONES.adminFinance);
    const run = await t.as(fin).post('/v1/admin/reconciliation/run').expect(200);
    expect(run.body.mismatches).toEqual([]);
    expect(run.body.checked).toBeGreaterThan(25);
  });

  it('weekly payout: completed bookings and delivered orders minus commission; runs once', async () => {
    // Sample Transport Co. is past its free period with 15% commission.
    await t.db.update(providers).set({ commissionFreeUntil: null }).where(eq(providers.id, sid('sample-transport')));
    // Sample Dates House is an early provider: first 3 months free.
    await t.db.update(providers).set({ commissionFreeUntil: new Date(Date.now() + 30 * 86400_000) }).where(eq(providers.id, sid('sample-dates-house')));
    const svc = t.app.get(PayoutsService);
    const periodEnd = new Date(Date.now() + 60_000); // include everything earned so far
    const res = await svc.run(periodEnd, null);
    expect(res.created).toBeGreaterThan(0);

    const [transport] = await t.db.select().from(payouts).where(eq(payouts.providerId, sid('sample-transport')));
    // b01 (completed, 350 SAR) is the only completed transport booking in the sample data
    expect(transport.grossHalalas).toBe(35000);
    expect(transport.commissionHalalas).toBe(5250);
    expect(transport.netHalalas).toBe(29750);
    const [b01] = await t.db.select().from(bookings).where(eq(bookings.id, sid('b01')));
    expect(b01).toMatchObject({ status: 'paid_out', payoutId: transport.id });

    const again = await svc.run(periodEnd, null);
    expect(again.created).toBe(0);

    // Dates House: delivered orders o03 + o08 (835 SAR), in its free period → no commission
    const [dates] = await t.db.select().from(payouts).where(eq(payouts.providerId, sid('sample-dates-house')));
    expect(dates.lines.map((l) => l.kind)).toEqual(['order', 'order']);
    expect(dates.grossHalalas).toBe(83500);
    expect(dates.commissionHalalas).toBe(0);

    const fin = await t.login(PHONES.adminFinance);
    await t.as(fin).post(`/v1/admin/payouts/${transport.id}/approve`).expect(200);
    await t.as(fin).post(`/v1/admin/payouts/${transport.id}/approve`).expect(409);
    const owner = await t.login(PHONES.transportOwner);
    const mine = await t.as(owner).get(`/v1/provider/payouts?providerId=${sid('sample-transport')}`).expect(200);
    expect(mine.body[0].payout.status).toBe('approved');
    await t.as(owner).get(`/v1/provider/payouts?providerId=${sid('sample-dates-house')}`).expect(403);
    const earnings = await t.as(owner).get(`/v1/provider/earnings?providerId=${sid('sample-transport')}`).expect(200);
    expect(earnings.body.paidOut.netHalalas).toBe(29750);

    const rec = await t.as(fin).post('/v1/admin/reconciliation/run').expect(200);
    expect(rec.body.mismatches).toEqual([]);
  });

  it('serves a sample PDF invoice to the pilgrim only', async () => {
    const ahmed = await t.login(PHONES.ahmed);
    const res = await t.as(ahmed).get(`/v1/bookings/${sid('b01')}/invoice.pdf`).buffer(true).expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    const fatima = await t.login(PHONES.fatima);
    await t.as(fatima).get(`/v1/bookings/${sid('b01')}/invoice.pdf`).expect(404);
    await t.as(fatima).get(`/v1/orders/${sid('o08')}/invoice.pdf`).buffer(true).expect(200);
  });

  it('one review per completed booking; provider replies', async () => {
    const abdullah = await t.login(PHONES.abdullah);
    await t.as(abdullah).post('/v1/reviews', { bookingId: sid('b13'), rating: 5 }).expect(409); // sample already has one
    const imran = await t.login(PHONES.imran);
    await t.as(imran).post('/v1/reviews', { bookingId: sid('b16'), rating: 4 }).expect(409); // not completed
    await t.as(imran).post('/v1/reviews', { bookingId: sid('b13'), rating: 4 }).expect(404); // not his
    const sarah = await t.login(PHONES.sarah);
    const r = await t.as(sarah).post('/v1/reviews', { bookingId: sid('b09'), rating: 5, text: 'On time' }).expect(201);
    expect(r.body.language).toBe('en');
    const owner = await t.login('+966500000011');
    await t.as(owner).post(`/v1/provider/reviews/${r.body.id}/reply`, { text: 'Thank you!' }).expect(201);
  });
});

describe('invoice links for the app', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('gives a 10-minute link that opens without login, and cannot be used to log in', async () => {
    const ahmed = await t.login(PHONES.ahmed);
    const link = await t.as(ahmed).post(`/v1/bookings/${sid('b01')}/invoice-link`).expect(200);
    const pdf = await t.http().get(link.body.path).buffer(true).expect(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    const token = link.body.path.split('/').pop();
    await t.http().get('/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
    const fatima = await t.login(PHONES.fatima);
    await t.as(fatima).post(`/v1/bookings/${sid('b01')}/invoice-link`).expect(404);
    await t.as(ahmed).post(`/v1/payments/${sid('b01')}/invoice-link`).expect(404);
  });
});
