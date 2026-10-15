import { Module } from '@nestjs/common';
import { PayoutsController } from './payouts.controller.js';
import { PayoutsJobs } from './payouts.jobs.js';
import { PayoutsService } from './payouts.service.js';

@Module({ controllers: [PayoutsController], providers: [PayoutsService, PayoutsJobs], exports: [PayoutsService] })
export class PayoutsModule {}
