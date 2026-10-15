import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsJobs } from './bookings.jobs.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [PaymentsModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsJobs],
  exports: [BookingsService],
})
export class BookingsModule {}
