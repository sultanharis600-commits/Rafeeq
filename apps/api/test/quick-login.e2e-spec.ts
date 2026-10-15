import { AuthService } from '../src/auth/auth.service.js';
import { createTestApp, PHONES, sid, type TestApp } from './helpers.js';

describe('quick login (testing only, demo mode)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('the app config tells clients to show the single field', async () => {
    const res = await t.http().get('/v1/config').expect(200);
    expect(res.body).toMatchObject({ demoMode: true, quickLogin: true });
  });

  it('logs in a sample account by phone, with spaces, and by email in any case', async () => {
    const byPhone = await t.http().post('/v1/auth/quick-login').send({ identifier: '+966 500 000 050' }).expect(200);
    expect(byPhone.body.user).toMatchObject({ id: sid('pilgrim-ahmed'), role: 'pilgrim' });
    await t.http().get('/v1/me').set('Authorization', `Bearer ${byPhone.body.token}`).expect(200);

    const byEmail = await t.http().post('/v1/auth/quick-login').send({ identifier: 'Admin-Ops@Rafeeq.test' }).expect(200);
    expect(byEmail.body.user.role).toBe('admin_ops');
    expect(byEmail.body.isNew).toBe(false);
  });

  it('creates a pilgrim for a new phone or a new email, once', async () => {
    const phone = await t.http().post('/v1/auth/quick-login').send({ identifier: '+923001234567', name: 'Bilal' }).expect(200);
    expect(phone.body).toMatchObject({ isNew: true, user: { name: 'Bilal', role: 'pilgrim' } });

    const first = await t.http().post('/v1/auth/quick-login').send({ identifier: 'tester@bidec.sa', language: 'ur' }).expect(200);
    expect(first.body).toMatchObject({ isNew: true, user: { name: 'tester', language: 'ur' } });
    const again = await t.http().post('/v1/auth/quick-login').send({ identifier: 'tester@bidec.sa' }).expect(200);
    expect(again.body).toMatchObject({ isNew: false, user: { id: first.body.user.id } });
    const me = await t.http().get('/v1/me').set('Authorization', `Bearer ${again.body.token}`).expect(200);
    expect(me.body.phone).toMatch(/^\+999\d{11}$/);
  });

  it('rejects input that is neither a phone nor an email', async () => {
    const r1 = await t.http().post('/v1/auth/quick-login').send({ identifier: '0500000050' }).expect(400);
    expect(r1.body.code).toBe('auth.invalid_phone');
    const r2 = await t.http().post('/v1/auth/quick-login').send({ identifier: 'not@email' }).expect(400);
    expect(r2.body.code).toBe('auth.invalid_email');
  });

  it('is refused when quick login is off', async () => {
    const auth = t.app.get(AuthService);
    const spy = vi.spyOn(auth, 'quickLoginEnabled', 'get').mockReturnValue(false);
    try {
      const r = await t.http().post('/v1/auth/quick-login').send({ identifier: PHONES.ahmed }).expect(403);
      expect(r.body.code).toBe('auth.quick_login_off');
    } finally {
      spy.mockRestore();
    }
  });
});
