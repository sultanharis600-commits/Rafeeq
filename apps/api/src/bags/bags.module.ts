import { Body, Controller, Get, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { BAG_HANDOVER_POINT_KEYS, type BagHandoverPoint } from '@rafeeq/shared';
import { ADMIN, CurrentUser, Roles, type AuthUser } from '../auth/auth-user.js';
import type { Env } from '../config/env.js';
import { badRequest } from '../common/errors.js';
import { BagsService } from './bags.service.js';

class ScanDto {
  @ApiProperty({ example: 'RFQ-7Q4K2M' }) @Matches(/^RFQ-[A-Z0-9]{6}$/) tagCode: string;
  @ApiProperty({ enum: BAG_HANDOVER_POINT_KEYS }) @IsIn(BAG_HANDOVER_POINT_KEYS) placeLabel: BagHandoverPoint;
  @ApiPropertyOptional() @IsOptional() @IsUUID() placeId?: string;
  @ApiProperty({ description: 'When the scan happened on the phone (kept when synced later)' }) @Type(() => Date) @IsDate() scannedAt: Date;
  @ApiPropertyOptional({ description: 'Unique id from the phone; makes re-sync safe' }) @IsOptional() @IsString() @MaxLength(64) clientId?: string;
  @ApiPropertyOptional({ description: 'Needed on the first scan of a new tag' }) @IsOptional() @IsUUID() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) label?: string;
}
class ScanBatchDto {
  @ApiProperty({ type: [ScanDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ScanDto) scans: ScanDto[];
}
class CorrectDto {
  @ApiProperty({ enum: BAG_HANDOVER_POINT_KEYS }) @IsIn(BAG_HANDOVER_POINT_KEYS) placeLabel: BagHandoverPoint;
}
class ReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
class ProviderQuery {
  @ApiProperty() @IsUUID() providerId: string;
}
class CasesQuery {
  @ApiPropertyOptional({ enum: ['open', 'resolved'] }) @IsOptional() @IsIn(['open', 'resolved']) status?: 'open' | 'resolved';
}
class ResolveCaseDto {
  @ApiProperty({ enum: ['found', 'lost'] }) @IsIn(['found', 'lost']) outcome: 'found' | 'lost';
  @ApiProperty() @IsString() @MaxLength(500) notes: string;
}
class CheckOverdueDto {
  @ApiPropertyOptional({ description: 'Demo mode only: check as if this many minutes had passed', minimum: 0, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  aheadMinutes?: number;
}
class TagsDto {
  @ApiProperty({ minimum: 1, maximum: 500 }) @IsInt() @Min(1) @Max(500) count: number;
}

@ApiTags('bags')
@ApiBearerAuth()
@Controller()
export class BagsController {
  constructor(
    @Inject(BagsService) private readonly bags: BagsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** Staff scanner: send one or many scans (offline queue). Each result says ok or why not. */
  @Post('staff/bag-scans')
  @Roles('staff', 'provider_owner')
  @HttpCode(200)
  scan(@CurrentUser() user: AuthUser, @Body() dto: ScanBatchDto) {
    return this.bags.scanBatch(user, dto.scans);
  }

  @Post('staff/bag-scans/:id/correct')
  @Roles('staff', 'provider_owner')
  correct(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CorrectDto) {
    return this.bags.correct(user, id, dto.placeLabel);
  }

  @Get('bags')
  @Roles('pilgrim')
  mine(@CurrentUser() user: AuthUser) {
    return this.bags.mine(user);
  }

  @Get('bags/:id')
  timeline(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.bags.timeline(user, id);
  }

  @Post('bags/:id/report-missing')
  @Roles('pilgrim')
  report(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReportDto) {
    return this.bags.reportMissing(user, id, dto.notes);
  }

  @Get('provider/bags')
  @Roles('provider_owner', ...ADMIN)
  forProvider(@CurrentUser() user: AuthUser, @Query() q: ProviderQuery) {
    return this.bags.forProvider(user, q.providerId);
  }

  @Get('admin/lost-bag-cases')
  @Roles(...ADMIN)
  cases(@Query() q: CasesQuery) {
    return this.bags.adminCases(q.status);
  }

  @Post('admin/lost-bag-cases/:id/resolve')
  @Roles('admin_ops', 'admin_support')
  @HttpCode(200)
  resolve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveCaseDto) {
    return this.bags.resolveCase(user, id, dto.outcome, dto.notes);
  }

  /**
   * Run the overdue-bag check now (it also runs every 5 minutes). In demo mode it can
   * check as if time had moved on, so a missed handover can be shown without waiting.
   */
  @Post('admin/bags/check-overdue')
  @Roles('admin_ops')
  @HttpCode(200)
  async checkOverdue(@Body() dto: CheckOverdueDto) {
    const ahead = dto.aheadMinutes ?? 0;
    if (ahead > 0 && !this.config.get('DEMO_MODE', { infer: true })) throw badRequest('bags.demo_only', 'Checking ahead in time is only for demo mode');
    const opened = await this.bags.markOverdue(new Date(Date.now() + ahead * 60_000));
    return { opened };
  }

  /** Generate tag codes to print as QR stickers. */
  @Post('admin/bag-tags')
  @Roles('admin_ops')
  tags(@CurrentUser() user: AuthUser, @Body() dto: TagsDto) {
    return this.bags.generateTags(user, dto.count);
  }

  @Get('admin/bag-tags')
  @Roles('admin_ops')
  unlinked() {
    return this.bags.unlinkedTags();
  }
}

@Injectable()
export class BagsJobs {
  constructor(
    @Inject(BagsService) private readonly bags: BagsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async overdue() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) await this.bags.markOverdue();
  }
}

@Module({ controllers: [BagsController], providers: [BagsService, BagsJobs], exports: [BagsService] })
export class BagsModule {}
