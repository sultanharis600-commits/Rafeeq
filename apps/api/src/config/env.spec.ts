import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('fills development defaults and keeps demo mode on', () => {
    const env = validateEnv({ DATABASE_URL: 'postgresql://x' });
    expect(env.DEMO_MODE).toBe(true);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3001']);
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses a missing or short JWT secret in production', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'x' })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ NODE_ENV: 'production', DATABASE_URL: 'x', JWT_SECRET: 'short' })).toThrow(/32/);
  });

  it('turns quick login on with demo mode, and never without it', () => {
    expect(validateEnv({ DATABASE_URL: 'x' }).QUICK_LOGIN).toBe(true);
    expect(validateEnv({ DATABASE_URL: 'x', QUICK_LOGIN: 'false' }).QUICK_LOGIN).toBe(false);
    expect(validateEnv({ DATABASE_URL: 'x', DEMO_MODE: 'false' }).QUICK_LOGIN).toBe(false);
    expect(() => validateEnv({ DATABASE_URL: 'x', DEMO_MODE: 'false', QUICK_LOGIN: 'true' })).toThrow(/DEMO_MODE/);
  });
});
