import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { BookingsService } from './bookings.service.js';

@Injectable()
export class BookingsJobs {
  private readonly log = new Logger('BookingsJobs');
  constructor(
    @Inject(BookingsService) private readonly bookings: BookingsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  private get enabled() {
    return this.config.get('JOBS_ENABLED', { infer: true });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async everyMinute() {
    if (!this.enabled) return;
    const holds = await this.bookings.expireHolds();
    const timeouts = await this.bookings.expireUnaccepted();
    if (holds || timeouts) this.log.log(`released ${holds} expired hold(s), declined ${timeouts} unanswered booking(s)`);
  }
}
