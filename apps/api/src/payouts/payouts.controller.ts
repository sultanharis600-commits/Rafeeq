import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import { ADMIN, CurrentUser, Roles, type AuthUser } from '../auth/auth-user.js';
import { PayoutsService } from './payouts.service.js';

class ProviderQuery {
  @ApiProperty() @IsUUID() providerId: string;
}
class OptionalProviderQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() providerId?: string;
}
class RunDto {
  @ApiPropertyOptional({ description: 'End of the payout week (default: last Monday 00:00 Saudi time)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  periodEnd?: Date;
}

@ApiTags('payouts')
@ApiBearerAuth()
@Controller()
export class PayoutsController {
  constructor(@Inject(PayoutsService) private readonly payouts: PayoutsService) {}

  @Get('provider/earnings')
  @Roles('provider_owner', ...ADMIN)
  earnings(@CurrentUser() user: AuthUser, @Query() q: ProviderQuery) {
    return this.payouts.earnings(user, q.providerId);
  }

  @Get('provider/payouts')
  @Roles('provider_owner', ...ADMIN)
  providerPayouts(@CurrentUser() user: AuthUser, @Query() q: ProviderQuery) {
    return this.payouts.list(user, q.providerId);
  }

  @Get('admin/payouts')
  @Roles(...ADMIN)
  adminPayouts(@CurrentUser() user: AuthUser, @Query() q: OptionalProviderQuery) {
    return this.payouts.list(user, q.providerId);
  }

  /** Calculate payouts for a week now (normally a Monday job). */
  @Post('admin/payouts/run')
  @Roles('admin_finance')
  @HttpCode(200)
  run(@CurrentUser() user: AuthUser, @Body() dto: RunDto) {
    return this.payouts.run(dto.periodEnd, user.id);
  }

  @Post('admin/payouts/:id/approve')
  @Roles('admin_finance')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payouts.approve(user, id);
  }

  @Get('admin/reconciliation')
  @Roles('admin_finance', 'admin_ops')
  runs() {
    return this.payouts.reconciliationRuns();
  }

  @Post('admin/reconciliation/run')
  @Roles('admin_finance')
  @HttpCode(200)
  reconcile(@CurrentUser() user: AuthUser) {
    return this.payouts.reconcile(user.id);
  }
}
