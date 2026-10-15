import { eq } from 'drizzle-orm';
import { outboxMessages, users } from '../src/db/schema.js';
import { createTestApp, PHONES, type TestApp } from './helpers.js';

describe('auth and profile', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('demo mode: request returns the test code and stores a simulated SMS', async () => {
    const res = await t.http().post('/v1/auth/otp/request').send({ phone: PHONES.ahmed }).expect(200);
    expect(res.body).toEqual({ expiresInSeconds: 300, demoCode: '123456' });
    const msgs = await t.db.select().from(outboxMessages).where(eq(outboxMessages.toAddress, PHONES.ahmed));
    expect(msgs.at(-1)).toMatchObject({ channel: 'sms', status: 'simulated', template: 'auth.otp' });
    // Ahmed's language is Indonesian, so the SMS is in Indonesian
    expect(msgs.at(-1)!.body).toContain('Kode Rafeeq');
  });

  it('rejects bad phones and wrong codes, and locks after 5 wrong codes', async () => {
    await t.http().post('/v1/auth/otp/request').send({ phone: '0500000000' }).expect(400);
    await t.http().post('/v1/auth/otp/request').send({ phone: '+966511111111' }).expect(200);
    for (let i = 0; i < 5; i++) {
      const r = await t.http().post('/v1/auth/otp/verify').send({ phone: '+966511111111', code: '000000' }).expect(400);
      expect(r.body.code).toBe('auth.wrong_code');
    }
    const locked = await t.http().post('/v1/auth/otp/verify').send({ phone: '+966511111111', code: '123456' }).expect(429);
    expect(locked.body.code).toBe('auth.locked');
  });

  it('limits codes per phone per hour', async () => {
    const phone = '+966522222222';
    for (let i = 0; i < 5; i++) await t.http().post('/v1/auth/otp/request').send({ phone }).expect(200);
    const r = await t.http().post('/v1/auth/otp/request').send({ phone }).expect(429);
    expect(r.body.code).toBe('auth.too_many_codes');
  });

  it('creates a pilgrim on first login and the code works once', async () => {
    const phone = '+966533333333';
    await t.http().post('/v1/auth/otp/request').send({ phone }).expect(200);
    const res = await t.http().post('/v1/auth/otp/verify').send({ phone, code: '123456', name: 'Yusuf', language: 'tr' }).expect(200);
    expect(res.body.isNew).toBe(true);
    expect(res.body.user).toMatchObject({ name: 'Yusuf', role: 'pilgrim', language: 'tr' });
    await t.http().post('/v1/auth/otp/verify').send({ phone, code: '123456' }).expect(400);
  });

  it('requires a token, and returns my profile with my hotel', async () => {
    await t.http().get('/v1/me').expect(401);
    const token = await t.login(PHONES.ahmed);
    const me = await t.as(token).get('/v1/me').expect(200);
    expect(me.body).toMatchObject({ name: 'Ahmed Wijaya', language: 'id', role: 'pilgrim' });
    expect(me.body.hotel.name.en).toContain('Ibrahim');
  });

  it('updates profile, validates input, and manages emergency contacts', async () => {
    const token = await t.login(PHONES.fatima);
    await t.as(token).patch('/v1/me', { accessibilityMode: true, accessibilityNeeds: ['walker'] }).expect(200);
    await t.as(token).patch('/v1/me', { language: 'xx' }).expect(400);
    await t.as(token).patch('/v1/me', { role: 'admin_ops' }).expect(400); // not whitelisted
    const c = await t.as(token).post('/v1/me/emergency-contacts', { name: 'Brother', phone: '+923000000001' }).expect(201);
    const list = await t.as(token).get('/v1/me/emergency-contacts').expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toContain(c.body.id);
    await t.as(token).del(`/v1/me/emergency-contacts/${c.body.id}`).expect(204);
  });

  it('exports and deletes my data', async () => {
    const phone = '+966544444444';
    const token = await t.login(phone);
    const exp = await t.as(token).get('/v1/me/export').expect(200);
    expect(exp.body.profile.phone).toBe(phone);
    await t.as(token).del('/v1/me').expect(204);
    const [u] = await t.db.select().from(users).where(eq(users.name, 'Deleted user'));
    expect(u.phone).toMatch(/^deleted:/);
  });

  it('serves public config', async () => {
    const r = await t.http().get('/v1/config').expect(200);
    expect(r.body).toMatchObject({ demoMode: true, currency: 'SAR', rtlLanguages: ['ar', 'ur'] });
  });
});
