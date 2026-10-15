import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestApp, PHONES, type TestApp } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('document uploads', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('stores encrypted, lets only the owner and admins read it, and checks the file type', async () => {
    const owner = await t.login('+966555777000');
    const up = await t.as(owner).upload('/v1/uploads', PDF, 'cr.pdf').expect(201);
    expect(up.body.ref).toMatch(/^upload:\/\//);
    expect(up.body.contentType).toBe('application/pdf');

    const onDisk = readdirSync(resolve('./uploads')).find((f) => f.startsWith(up.body.id));
    expect(readFileSync(resolve('./uploads', onDisk!)).includes(Buffer.from('%PDF'))).toBe(false); // encrypted

    const back = await t.as(owner).get(`/v1/uploads/${up.body.id}`).buffer(true).expect(200);
    expect(Buffer.from(back.body).equals(PDF)).toBe(true);
    const admin = await t.login(PHONES.adminOps);
    await t.as(admin).get(`/v1/uploads/${up.body.id}`).expect(200);
    const other = await t.login(PHONES.ahmed);
    await t.as(other).get(`/v1/uploads/${up.body.id}`).expect(404);

    const fake = await t.as(owner).upload('/v1/uploads', Buffer.from('MZ not a pdf'), 'cr.pdf').expect(415);
    expect(fake.body.code).toBe('upload.bad_type');
    const big = await t.as(owner).upload('/v1/uploads', Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]), 'big.pdf');
    expect([413]).toContain(big.status);
  });
});
