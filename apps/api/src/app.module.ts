import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { CoreModule } from './core/core.module.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthController } from './health/health.controller.js';
import { UsersModule } from './users/users.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { PayoutsModule } from './payouts/payouts.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { BagsModule } from './bags/bags.module.js';
import { GroupsModule } from './groups/groups.module.js';
import { ShopModule } from './shop/shop.module.js';
import { PlacesModule } from './places/places.module.js';
import { AdminModule } from './admin/admin.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
// Uploads: encrypted provider documents (PDF).

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    // Per-IP limits; per-phone OTP limits live in AuthService. Off in tests, which log in many times.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CoreModule,
    AuthModule,
    UsersModule,
    ProvidersModule,
    CatalogueModule,
    PaymentsModule,
    BookingsModule,
    PayoutsModule,
    ReviewsModule,
    InvoicesModule,
    BagsModule,
    GroupsModule,
    ShopModule,
    PlacesModule,
    AdminModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
