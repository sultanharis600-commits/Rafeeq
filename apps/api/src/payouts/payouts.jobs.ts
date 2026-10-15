import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { PayoutsService } from './payouts.service.js';

@Injectable()
export class PayoutsJobs {
  constructor(
    @Inject(PayoutsService) private readonly payouts: PayoutsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** Mondays 03:00 Saudi time: last week's payouts. */
  @Cron('0 3 * * 1', { timeZone: 'Asia/Riyadh' })
  async weekly() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) await this.payouts.run();
  }

  /** Every day 04:00 Saudi time: reconciliation. */
  @Cron('0 4 * * *', { timeZone: 'Asia/Riyadh' })
  async daily() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) await this.payouts.reconcile();
  }
}
