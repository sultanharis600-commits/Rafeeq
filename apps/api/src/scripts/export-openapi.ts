/**
 * Write openapi.json without starting the server. The Flutter app generates its
 * API client from this file, so mobile and backend never drift apart.
 *   npm run openapi -w apps/api
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { buildOpenApi, configureApp } from '../setup.js';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false });
  configureApp(app);
  const out = resolve(import.meta.dirname, '../../openapi.json');
  writeFileSync(out, JSON.stringify(buildOpenApi(app), null, 2) + '\n');
  await app.close();
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
