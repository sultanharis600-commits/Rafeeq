import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CITIES, PROVIDER_STATUSES, type ProviderStatus } from '@rafeeq/shared';
import { ADMIN, CurrentUser, Public, Roles, type AuthUser } from '../auth/auth-user.js';
import { LongTranslatedDto, ReasonDto, TranslatedDto } from '../common/dto.js';
import { PageQuery } from '../common/pagination.js';
import { ProvidersService } from './providers.service.js';

class DocumentDto {
  @ApiProperty({ example: 'commercial_registration' }) @IsString() @MaxLength(60) kind: string;
  @ApiProperty({ description: 'Storage reference returned by the upload endpoint' }) @IsString() @MaxLength(500) url: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() verified = false;
}

class ApplyDto {
  @ApiProperty({ enum: ['company', 'individual'] }) @IsIn(['company', 'individual']) type: 'company' | 'individual';
  @ApiProperty({ enum: ['services', 'shop'] }) @IsIn(['services', 'shop']) kind: 'services' | 'shop';
  @ApiProperty({ type: TranslatedDto }) @ValidateNested() @Type(() => TranslatedDto) name: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{10}$/) crNumber?: string;
  @ApiProperty({ enum: CITIES }) @IsIn(CITIES) city: 'makkah' | 'madinah';
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @ApiPropertyOptional({ example: 'SA0380000000608010167519' }) @IsOptional() @IsString() iban?: string;
  @ApiPropertyOptional({ type: [DocumentDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentDto) documents?: DocumentDto[];
}

class UpdateProviderDto {
  @ApiPropertyOptional({ type: TranslatedDto }) @IsOptional() @ValidateNested() @Type(() => TranslatedDto) name?: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() iban?: string;
  @ApiPropertyOptional({ type: [DocumentDto] }) @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => DocumentDto) documents?: DocumentDto[];
}

class AddStaffDto {
  @ApiProperty() @Matches(/^\+[1-9]\d{7,14}$/) phone: string;
  @ApiProperty() @IsString() @MaxLength(80) name: string;
  @ApiProperty({ enum: ['driver', 'guide', 'photographer', 'luggage', 'assistant'] })
  @IsIn(['driver', 'guide', 'photographer', 'luggage', 'assistant'])
  staffRole: 'driver' | 'guide' | 'photographer' | 'luggage' | 'assistant';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) vehicle?: string;
}

class AdminProvidersQuery extends PageQuery {
  @ApiPropertyOptional({ enum: PROVIDER_STATUSES }) @IsOptional() @IsIn(PROVIDER_STATUSES) status?: ProviderStatus;
  @ApiPropertyOptional({ enum: ['services', 'shop'] }) @IsOptional() @IsIn(['services', 'shop']) kind?: 'services' | 'shop';
}

class CommissionDto {
  @ApiProperty({ description: 'Basis points: 1500 = 15%', minimum: 0, maximum: 3000 })
  @IsInt()
  @Min(0)
  @Max(3000)
  commissionRateBps: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Type(() => Date) @IsDate() commissionFreeUntil?: Date | null;
}

@ApiTags('providers')
@ApiBearerAuth()
@Controller()
export class ProvidersController {
  constructor(@Inject(ProvidersService) private readonly providers: ProvidersService) {}

  @Post('providers')
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplyDto) {
    return this.providers.apply(user, dto);
  }

  @Get('providers/mine')
  @Roles('provider_owner')
  mine(@CurrentUser() user: AuthUser) {
    return this.providers.mine(user);
  }

  @Public()
  @Get('providers/:id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.providers.publicProfile(id);
  }

  @Patch('providers/:id')
  @Roles('provider_owner', ...ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProviderDto) {
    return this.providers.update(user, id, dto);
  }

  @Get('providers/:id/staff')
  @Roles('provider_owner', ...ADMIN)
  staff(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.providers.listStaff(user, id);
  }

  @Post('providers/:id/staff')
  @Roles('provider_owner')
  addStaff(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddStaffDto) {
    return this.providers.addStaff(user, id, dto);
  }

  @Delete('providers/:id/staff/:staffId')
  @Roles('provider_owner')
  @HttpCode(204)
  async removeStaff(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ) {
    await this.providers.deactivateStaff(user, id, staffId);
  }

  // ───────────── admin ─────────────

  @Get('admin/providers')
  @Roles(...ADMIN)
  adminList(@Query() q: AdminProvidersQuery) {
    return this.providers.adminList(q);
  }

  @Post('admin/providers/:id/approve')
  @Roles('admin_ops')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.providers.setStatus(user, id, 'approved', dto.reason);
  }

  @Post('admin/providers/:id/reject')
  @Roles('admin_ops')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.providers.setStatus(user, id, 'rejected', dto.reason);
  }

  @Post('admin/providers/:id/suspend')
  @Roles('admin_ops')
  @HttpCode(200)
  suspend(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.providers.setStatus(user, id, 'suspended', dto.reason);
  }

  @Post('admin/providers/:id/reinstate')
  @Roles('admin_ops')
  @HttpCode(200)
  reinstate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.providers.setStatus(user, id, 'approved', dto.reason);
  }

  @Patch('admin/providers/:id/commission')
  @Roles('admin_finance', 'admin_ops')
  commission(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommissionDto) {
    return this.providers.setCommission(user, id, dto);
  }
}
