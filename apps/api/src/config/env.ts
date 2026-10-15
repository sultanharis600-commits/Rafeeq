/**
 * Environment variables, validated once at startup. Secrets come only from here,
 * never from code (AI_RULES.md).
 */
export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  /** Sandbox payments, test OTP codes, sample data. Must stay on until compliance is done. */
  DEMO_MODE: boolean;
  DEMO_OTP_CODE: string;
  JWT_SECRET: string;
  JWT_TTL: string;
  DATA_ENCRYPTION_KEY?: string;
  CORS_ORIGINS: string[];
  /** Background jobs (hold release, timeouts, overdue bags, payouts). Off in tests. */
  JOBS_ENABLED: boolean;
  /** Public base URL of the web app, used in links inside SMS and push. */
  PUBLIC_WEB_URL: string;
  /** Shared secret the SMS provider sends with inbound messages. */
  SMS_WEBHOOK_SECRET: string;
  /** Where encrypted uploads are stored (a mounted volume in production, object storage later). */
  UPLOAD_DIR: string;
  /** Log in with just a phone number or email, no code. Testing only; needs DEMO_MODE. */
  QUICK_LOGIN: boolean;
}

export function validateEnv(raw: Record<string, unknown>): Env {
  const str = (key: string, fallback?: string): string => {
    const value = raw[key];
    if (typeof value === 'string' && value.length > 0) return value;
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing environment variable ${key}`);
  };

  const nodeEnv = str('NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV must be development, test or production`);
  }
  const demoMode = str('DEMO_MODE', 'true') === 'true';
  const jwtSecret = str('JWT_SECRET', nodeEnv === 'production' ? undefined : 'dev-only-secret-change-me');

  // Quick login (no code) follows demo mode unless set; it can never be on without demo mode.
  const quickLogin = str('QUICK_LOGIN', demoMode ? 'true' : 'false') === 'true';
  if (quickLogin && !demoMode) throw new Error('QUICK_LOGIN needs DEMO_MODE=true: it lets anyone log in as any account');

  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: Number(str('PORT', '3000')),
    DATABASE_URL: str('DATABASE_URL'),
    REDIS_URL: str('REDIS_URL', 'redis://localhost:6379'),
    DEMO_MODE: demoMode,
    DEMO_OTP_CODE: str('DEMO_OTP_CODE', '123456'),
    JWT_SECRET: jwtSecret,
    JWT_TTL: str('JWT_TTL', '7d'),
    DATA_ENCRYPTION_KEY: typeof raw.DATA_ENCRYPTION_KEY === 'string' ? raw.DATA_ENCRYPTION_KEY : undefined,
    CORS_ORIGINS: str('CORS_ORIGINS', 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    JOBS_ENABLED: str('JOBS_ENABLED', nodeEnv === 'test' ? 'false' : 'true') === 'true',
    PUBLIC_WEB_URL: str('PUBLIC_WEB_URL', 'http://localhost:3001'),
    UPLOAD_DIR: str('UPLOAD_DIR', './uploads'),
    SMS_WEBHOOK_SECRET: str('SMS_WEBHOOK_SECRET', nodeEnv === 'production' ? undefined : 'dev-sms-secret'),
    QUICK_LOGIN: quickLogin,
  };
}
