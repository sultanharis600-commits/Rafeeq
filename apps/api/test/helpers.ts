import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import type { Database } from '../src/db/client.js';
import { DB } from '../src/db/database.module.js';
import { seedDemo, sid } from '../src/db/seed/seed.js';
import { configureApp } from '../src/setup.js';

export { sid };

/** Phones of the demo accounts (docs/demo-accounts.md). */
export const PHONES = {
  ahmed: '+966500000050',
  fatima: '+966500000051',
  mehmet: '+966500000052',
  aisyah: '+966500000053',
  sarah: '+966500000054',
  abdullah: '+966500000055',
  siti: '+966500000056',
  imran: '+966500000060',
  transportOwner: '+966500000010',
  luggageOwner: '+966500000014',
  careOwner: '+966500000015',
  datesOwner: '+966500000018',
  giftsOwner: '+966500000019',
  madinahGuideOwner: '+966500000017',
  khalid: '+966500000030',
  saeed: '+966500000033',
  hamza: '+966500000035',
  adminOps: '+966500000001',
  adminFinance: '+966500000002',
  adminSupport: '+966500000003',
} as const;

export type TestApp = {
  app: INestApplication;
  db: Database;
  http: () => ReturnType<typeof request>;
  login: (phone: string) => Promise<string>;
  as: (token: string) => {
    get: (url: string) => request.Test;
    post: (url: string, body?: object) => request.Test;
    upload: (url: string, file: Buffer, name: string) => request.Test;
    patch: (url: string, body?: object) => request.Test;
    del: (url: string) => request.Test;
  };
  close: () => Promise<void>;
};

/** Boot the API against the test database with fresh sample data. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const db = app.get<Database>(DB);
  await seedDemo(db, { force: true }); // the test database is disposable

  const http = () => request(app.getHttpServer());
  const tokens = new Map<string, string>();
  const login = async (phone: string) => {
    const cached = tokens.get(phone);
    if (cached) return cached;
    await http().post('/v1/auth/otp/request').send({ phone }).expect(200);
    const res = await http().post('/v1/auth/otp/verify').send({ phone, code: '123456' }).expect(200);
    tokens.set(phone, res.body.token);
    return res.body.token as string;
  };
  const as = (token: string) => ({
    get: (url: string) => http().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body: object = {}) => http().post(url).set('Authorization', `Bearer ${token}`).send(body),
    upload: (url: string, file: Buffer, name: string) => http().post(url).set('Authorization', `Bearer ${token}`).attach('file', file, name),
    patch: (url: string, body: object = {}) => http().patch(url).set('Authorization', `Bearer ${token}`).send(body),
    del: (url: string) => http().delete(url).set('Authorization', `Bearer ${token}`),
  });
  return { app, db, http, login, as, close: () => app.close() };
}
