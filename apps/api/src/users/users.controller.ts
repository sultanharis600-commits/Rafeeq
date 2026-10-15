import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { CITIES, LANGUAGES, LANGUAGES as L, type City, type Language } from '@rafeeq/shared';
import type { Env } from '../config/env.js';
import { CurrentUser, Public, type AuthUser } from '../auth/auth-user.js';
import { UsersService } from './users.service.js';

export const ACCESSIBILITY_NEEDS = ['wheelchair', 'walker', 'hard_of_hearing', 'low_vision', 'blind', 'memory_loss', 'other'] as const;

class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(L) language?: Language;
  @ApiPropertyOptional({ example: 'ID' }) @IsOptional() @IsISO31661Alpha2() nationality?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() accessibilityMode?: boolean;
  @ApiPropertyOptional({ enum: ACCESSIBILITY_NEEDS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(ACCESSIBILITY_NEEDS, { each: true })
  accessibilityNeeds?: string[];
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hotelPlaceId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() travelFrom?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() travelTo?: Date;
  @ApiPropertyOptional({ description: 'Consent to share location with my travel groups' }) @IsOptional() @IsBoolean() locationSharing?: boolean;
}

class EmergencyContactDto {
  @ApiProperty() @IsString() @MaxLength(80) name: string;
  @ApiProperty({ example: '+628000000001' }) @Matches(/^\+[1-9]\d{7,14}$/) phone: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) relation?: string;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** App settings the clients need before login. */
  @Public()
  @Get('config')
  appConfig() {
    return {
      demoMode: this.config.get('DEMO_MODE', { infer: true }),
      /** Clients show one "phone or email" field and skip the code. Testing only. */
      quickLogin: this.config.get('QUICK_LOGIN', { infer: true }),
      languages: LANGUAGES,
      rtlLanguages: ['ar', 'ur'],
      currency: 'SAR',
      displayTimeZone: 'Asia/Riyadh',
      accessibilityNeeds: ACCESSIBILITY_NEEDS,
    };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.profile(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.update(user.id, dto);
  }

  @Get('me/emergency-contacts')
  contacts(@CurrentUser() user: AuthUser) {
    return this.users.contacts(user.id);
  }

  @Post('me/emergency-contacts')
  addContact(@CurrentUser() user: AuthUser, @Body() dto: EmergencyContactDto) {
    return this.users.addContact(user.id, dto);
  }

  @Delete('me/emergency-contacts/:id')
  @HttpCode(204)
  async removeContact(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.users.removeContact(user.id, id);
  }

  /** Download everything Rafeeq holds about you (PDPL). */
  @Get('me/export')
  @ApiOperation({ summary: 'Download my data' })
  export(@CurrentUser() user: AuthUser) {
    return this.users.exportData(user.id);
  }

  /** Delete your account. Locations, contacts and groups are deleted; bookings stay anonymised for invoices. */
  @Delete('me')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete my account' })
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.users.deleteAccount(user.id);
  }
}
