import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Env } from './config/env.js';

/** Shared app setup, used by main.ts, the e2e tests and the OpenAPI export. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.setGlobalPrefix('v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('Rafeeq API')
    .setDescription(
      'Marketplace for pilgrim services and gifts. Money is integer halalas (1 SAR = 100). Times are UTC.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, doc);
}
