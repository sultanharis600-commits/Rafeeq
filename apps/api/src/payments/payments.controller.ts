import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { ADMIN, CurrentUser, Roles, type AuthUser } from '../auth/auth-user.js';
import { badRequest } from '../common/errors.js';
import { PageQuery } from '../common/pagination.js';
import { PAYMENT_METHODS, type PaymentMethod } from './gateway.js';
import { PaymentsService } from './payments.service.js';

class CheckoutDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS) method: PaymentMethod;
}

class SandboxCompleteDto {
  @ApiProperty({ example: '4111 1111 1111 1111', description: 'Sandbox test card' }) @Matches(/^[\d ]{12,23}$/) cardNumber: string;
}

class AdminPaymentsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['initiated', 'succeeded', 'failed', 'refunded', 'partially_refunded'] })
  @IsOptional()
  @IsIn(['initiated', 'succeeded', 'failed', 'refunded', 'partially_refunded'])
  status?: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}

  /** Start paying for one booking or one order (card, mada, Apple Pay, STC Pay). */
  @Post('payments/checkout')
  @Roles('pilgrim')
  @HttpCode(200)
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    if (Boolean(dto.bookingId) === Boolean(dto.orderId)) throw badRequest('payment.one_target', 'Pass exactly one of bookingId or orderId');
    return this.payments.checkout(user, dto.bookingId ? { bookingId: dto.bookingId } : { orderId: dto.orderId! }, dto.method);
  }

  /** Demo mode only: pay with a sandbox test card. 4111 1111 1111 1111 succeeds, 4000 0000 0000 0002 is declined. */
  @Post('payments/:id/sandbox/complete')
  @Roles('pilgrim')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete a sandbox payment (demo mode)' })
  sandbox(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SandboxCompleteDto) {
    return this.payments.sandboxComplete(user, id, dto.cardNumber);
  }

  @Get('admin/payments')
  @Roles(...ADMIN)
  list(@Query() q: AdminPaymentsQuery) {
    return this.payments.adminList(q);
  }
}
