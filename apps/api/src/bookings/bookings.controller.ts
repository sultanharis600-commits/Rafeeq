import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BOOKING_STATUSES, LANGUAGES, type BookingStatus, type Language } from '@rafeeq/shared';
import { ADMIN, CurrentUser, Roles, type AuthUser } from '../auth/auth-user.js';
import { ReasonDto } from '../common/dto.js';
import { PageQuery } from '../common/pagination.js';
import { BookingsService } from './bookings.service.js';

class PointDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) label?: string;
}

class CreateBookingDto {
  @ApiProperty() @IsUUID() serviceId: string;
  @ApiProperty() @IsUUID() slotId: string;
  @ApiPropertyOptional({ description: 'Hours, bags, people or tags depending on the price model', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @Matches(/^[a-z0-9_]{1,40}$/, { each: true }) options?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) meetingPoint?: string;
  @ApiPropertyOptional({ type: PointDto }) @IsOptional() @ValidateNested() @Type(() => PointDto) pickup?: PointDto;
  @ApiPropertyOptional({ type: PointDto }) @IsOptional() @ValidateNested() @Type(() => PointDto) dropoff?: PointDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class MyBookingsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['upcoming', 'past', 'all'] }) @IsOptional() @IsIn(['upcoming', 'past', 'all']) scope?: 'upcoming' | 'past' | 'all';
}

class ProviderBookingsQuery extends PageQuery {
  @ApiProperty() @IsUUID() providerId: string;
  @ApiPropertyOptional({ enum: BOOKING_STATUSES }) @IsOptional() @IsIn(BOOKING_STATUSES) status?: BookingStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}

class AdminBookingsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: BOOKING_STATUSES }) @IsOptional() @IsIn(BOOKING_STATUSES) status?: BookingStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() providerId?: string;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}

class LangQuery {
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}

class JobsQuery {
  @ApiPropertyOptional({ example: '2026-10-14', description: 'Saudi date; default today' }) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
}

class AssignDto {
  @ApiProperty() @IsUUID() staffId: string;
}

class RequiredReasonDto {
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

class LocationDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}

class ResolveDto {
  @ApiProperty({ enum: ['complete', 'refund'] }) @IsIn(['complete', 'refund']) outcome: 'complete' | 'refund';
  @ApiPropertyOptional({ description: 'Partial refund in halalas; default full' }) @IsOptional() @IsInt() @Min(1) amountHalalas?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class RefundDto {
  @ApiProperty() @IsInt() @Min(1) amountHalalas: number;
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

@ApiTags('bookings')
@ApiBearerAuth()
@Controller()
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}

  /** Book a slot. Capacity is held for 10 minutes while the pilgrim pays. */
  @Post('bookings')
  @Roles('pilgrim')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Get('bookings')
  @Roles('pilgrim')
  mine(@CurrentUser() user: AuthUser, @Query() q: MyBookingsQuery) {
    return this.bookings.listMine(user, q);
  }

  @Get('bookings/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: LangQuery) {
    return this.bookings.get(user, id, q.lang);
  }

  /** Cancel. The refund follows the service's cancellation policy (shown in `cancel` on the booking). */
  @Post('bookings/:id/cancel')
  @Roles('pilgrim')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.bookings.cancel(user, id, dto.reason);
  }

  @Post('bookings/:id/dispute')
  @Roles('pilgrim')
  @HttpCode(200)
  dispute(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequiredReasonDto) {
    return this.bookings.dispute(user, id, dto.reason);
  }

  @Get('bookings/:id/alternatives')
  @Roles('pilgrim')
  @ApiOperation({ summary: 'Similar services from other providers, after a decline' })
  alternatives(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.alternatives(user, id);
  }

  // ───────────── provider ─────────────

  @Get('provider/bookings')
  @Roles('provider_owner', ...ADMIN)
  providerList(@CurrentUser() user: AuthUser, @Query() q: ProviderBookingsQuery) {
    return this.bookings.listForProvider(user, q);
  }

  @Post('provider/bookings/:id/accept')
  @Roles('provider_owner')
  @HttpCode(200)
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.accept(user, id);
  }

  @Post('provider/bookings/:id/decline')
  @Roles('provider_owner')
  @HttpCode(200)
  async decline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequiredReasonDto) {
    await this.bookings.decline(user, id, dto.reason);
    return this.bookings.get(user, id);
  }

  @Post('provider/bookings/:id/cancel')
  @Roles('provider_owner')
  @HttpCode(200)
  providerCancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RequiredReasonDto) {
    return this.bookings.providerCancel(user, id, dto.reason);
  }

  @Post('provider/bookings/:id/assign')
  @Roles('provider_owner')
  @HttpCode(200)
  assign(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignDto) {
    return this.bookings.assign(user, id, dto.staffId);
  }

  // ───────────── staff ─────────────

  @Get('staff/jobs')
  @Roles('staff')
  jobs(@CurrentUser() user: AuthUser, @Query() q: JobsQuery) {
    return this.bookings.staffJobs(user, q.date);
  }

  @Post('staff/bookings/:id/start')
  @Roles('staff', 'provider_owner')
  @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.start(user, id);
  }

  @Post('staff/bookings/:id/complete')
  @Roles('staff', 'provider_owner')
  @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.complete(user, id);
  }

  @Post('staff/bookings/:id/location')
  @Roles('staff')
  @HttpCode(200)
  location(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LocationDto) {
    return this.bookings.shareLocation(user, id, dto);
  }

  // ───────────── admin ─────────────

  @Get('admin/bookings')
  @Roles(...ADMIN)
  adminList(@Query() q: AdminBookingsQuery) {
    return this.bookings.adminList(q);
  }

  @Post('admin/bookings/:id/resolve')
  @Roles('admin_support', 'admin_ops')
  @HttpCode(200)
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDto) {
    return this.bookings.resolveDispute(user, id, dto.outcome, dto.amountHalalas, dto.note);
  }

  @Post('admin/bookings/:id/refund')
  @Roles('admin_finance', 'admin_support')
  @HttpCode(200)
  refund(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundDto) {
    return this.bookings.adminRefund(user, id, dto.amountHalalas, dto.reason);
  }
}
