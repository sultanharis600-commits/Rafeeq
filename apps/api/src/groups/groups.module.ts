import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDate, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ADMIN, CurrentUser, Public, Roles, type AuthUser } from '../auth/auth-user.js';
import type { Env } from '../config/env.js';
import { GroupsService } from './groups.service.js';

class CreateGroupDto {
  @ApiProperty() @IsString() @MaxLength(60) name: string;
}
class JoinDto {
  @ApiProperty({ example: 'WJY-4821' }) @Matches(/^[A-Za-z]{3}-\d{4}$/) joinCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) relation?: string;
}
class UpdateMemberDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) relation?: string;
  @ApiPropertyOptional({ nullable: true, description: 'e.g. "AirTag · Ibu Siti"' }) @IsOptional() @IsString() @MaxLength(60) trackerTag?: string | null;
}
class LeaderDto {
  @ApiProperty() @IsUUID() userId: string;
}
class PointDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10000) accuracyM?: number;
  @ApiProperty() @Type(() => Date) @IsDate() recordedAt: Date;
  @ApiPropertyOptional({ enum: ['gps', 'tag'] }) @IsOptional() @IsIn(['gps', 'tag']) source?: 'gps' | 'tag';
}
class PointsDto {
  @ApiProperty({ type: [PointDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => PointDto) points: PointDto[];
}
class LostDto {
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) accuracyM?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) message?: string;
}
class AlertStatusDto {
  @ApiProperty({ enum: ['acknowledged', 'resolved'] }) @IsIn(['acknowledged', 'resolved']) status: 'acknowledged' | 'resolved';
}
class InboundSmsDto {
  @ApiProperty() @Matches(/^\+[1-9]\d{7,14}$/) from: string;
  @ApiProperty() @IsString() @MaxLength(640) body: string;
}
class RevealDto {
  @ApiProperty({ description: 'Why the location is needed, e.g. which family asked for help' }) @IsString() @MaxLength(500) reason: string;
}

@ApiTags('groups')
@ApiBearerAuth()
@Controller()
export class GroupsController {
  constructor(@Inject(GroupsService) private readonly groups: GroupsService) {}

  @Post('groups')
  @Roles('pilgrim')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user, dto.name);
  }

  @Post('groups/join')
  @Roles('pilgrim')
  @HttpCode(200)
  join(@CurrentUser() user: AuthUser, @Body() dto: JoinDto) {
    return this.groups.join(user, dto.joinCode, dto.relation);
  }

  @Get('groups')
  @Roles('pilgrim')
  mine(@CurrentUser() user: AuthUser) {
    return this.groups.mine(user);
  }

  @Get('groups/:id')
  @Roles('pilgrim')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.groups.get(user, id);
  }

  @Patch('groups/:id/members/me')
  @Roles('pilgrim')
  updateMe(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMemberDto) {
    return this.groups.updateMe(user, id, dto);
  }

  @Post('groups/:id/leader')
  @Roles('pilgrim')
  @HttpCode(200)
  leader(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LeaderDto) {
    return this.groups.setLeader(user, id, dto.userId);
  }

  @Delete('groups/:id/members/:userId')
  @Roles('pilgrim')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.groups.leave(user, id, userId);
  }

  /** Today's and the next two days' Bluetooth IDs to advertise (rotating, no personal data). */
  @Get('me/ble-ids')
  bleIds(@CurrentUser() user: AuthUser) {
    return this.groups.bleIds(user.id);
  }

  /** Background location, batched. Needs consent (PATCH /me locationSharing) and a group. */
  @Post('locations')
  @Roles('pilgrim')
  @HttpCode(200)
  points(@CurrentUser() user: AuthUser, @Body() dto: PointsDto) {
    return this.groups.addPoints(user, dto.points);
  }

  @Post('lost-alerts')
  @Roles('pilgrim')
  @ApiOperation({ summary: "I'm lost" })
  lost(@CurrentUser() user: AuthUser, @Body() dto: LostDto) {
    return this.groups.raiseAlert(user.id, { ...dto, channel: 'app' });
  }

  @Get('lost-alerts')
  @Roles('pilgrim')
  alerts(@CurrentUser() user: AuthUser) {
    return this.groups.alertsForMe(user);
  }

  @Patch('lost-alerts/:id')
  alertStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AlertStatusDto) {
    return this.groups.setAlertStatus(user, id, dto.status);
  }

  /** Webhook for the SMS provider (inbound "RFQ LOST lat,lng" messages). */
  @Public()
  @Post('sms/inbound')
  @HttpCode(200)
  inbound(@Headers('x-rafeeq-sms-secret') secret: string | undefined, @Body() dto: InboundSmsDto) {
    this.groups.assertSmsSecret(secret);
    return this.groups.inboundSms(dto.from, dto.body);
  }

  @Get('admin/lost-alerts')
  @Roles(...ADMIN)
  adminAlerts() {
    return this.groups.adminAlerts();
  }

  /** Location of a lost person, only with a reason; every view is logged. */
  @Post('admin/lost-alerts/:id/location')
  @Roles('admin_ops', 'admin_support')
  @HttpCode(200)
  reveal(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevealDto) {
    return this.groups.adminRevealLocation(user, id, dto.reason);
  }
}

@Injectable()
export class GroupsJobs {
  constructor(
    @Inject(GroupsService) private readonly groups: GroupsService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Riyadh' })
  async purge() {
    if (this.config.get('JOBS_ENABLED', { infer: true })) await this.groups.purgeOldLocations();
  }
}

@Module({ controllers: [GroupsController], providers: [GroupsService, GroupsJobs], exports: [GroupsService] })
export class GroupsModule {}
