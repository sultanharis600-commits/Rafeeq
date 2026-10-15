import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CANCELLATION_POLICIES,
  CITIES,
  LANGUAGES,
  PRICE_MODELS,
  SERVICE_CATEGORIES,
  type City,
  type Language,
  type ServiceCategory,
} from '@rafeeq/shared';
import { ADMIN, CurrentUser, Public, Roles, type AuthUser } from '../auth/auth-user.js';
import { LongTranslatedDto, TranslatedDto } from '../common/dto.js';
import { PageQuery } from '../common/pagination.js';
import { CatalogueService } from './catalogue.service.js';

class SearchQueryDto extends PageQuery {
  @ApiPropertyOptional({ enum: SERVICE_CATEGORIES }) @IsOptional() @IsIn(SERVICE_CATEGORIES) category?: ServiceCategory;
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
  @ApiPropertyOptional({ enum: LANGUAGES, description: 'Language the provider speaks' }) @IsOptional() @IsIn(LANGUAGES) language?: Language;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPriceHalalas?: number;
  @ApiPropertyOptional({ enum: ['rating', 'price_asc', 'price_desc'] }) @IsOptional() @IsIn(['rating', 'price_asc', 'price_desc']) sort?: 'rating' | 'price_asc' | 'price_desc';
  @ApiPropertyOptional({ enum: LANGUAGES, description: 'Language of the response text' }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}

class LangQuery {
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}

class CityQuery {
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
}

class RangeQuery {
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

class ProviderIdQuery {
  @ApiProperty() @IsUUID() providerId: string;
}

class OptionDto {
  @ApiProperty() @Matches(/^[a-z0-9_]{1,40}$/) key: string;
  @ApiProperty({ type: TranslatedDto }) @ValidateNested() @Type(() => TranslatedDto) title: TranslatedDto;
  @ApiProperty() @IsInt() @Min(0) priceHalalas: number;
}

class ServiceFieldsDto {
  @ApiPropertyOptional({ type: TranslatedDto }) @IsOptional() @ValidateNested() @Type(() => TranslatedDto) title?: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiPropertyOptional({ description: 'Price in halalas (35000 = 350.00 SAR)' }) @IsOptional() @IsInt() @Min(100) @Max(10_000_000) priceHalalas?: number;
  @ApiPropertyOptional({ enum: PRICE_MODELS }) @IsOptional() @IsIn(PRICE_MODELS) priceModel?: (typeof PRICE_MODELS)[number];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(43200) durationMinutes?: number;
  @ApiPropertyOptional({ type: [OptionDto] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => OptionDto) options?: OptionDto[];
  @ApiPropertyOptional({ enum: LANGUAGES, isArray: true }) @IsOptional() @IsArray() @IsIn(LANGUAGES, { each: true }) languagesSpoken?: Language[];
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) serviceArea?: City;
  @ApiPropertyOptional({ enum: CANCELLATION_POLICIES }) @IsOptional() @IsIn(CANCELLATION_POLICIES) cancellationPolicy?: (typeof CANCELLATION_POLICIES)[number];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

class CreateServiceDto {
  @ApiProperty() @IsUUID() providerId: string;
  @ApiProperty({ enum: SERVICE_CATEGORIES }) @IsIn(SERVICE_CATEGORIES) category: ServiceCategory;
  @ApiProperty({ type: TranslatedDto }) @ValidateNested() @Type(() => TranslatedDto) title: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiProperty({ description: 'Price in halalas (35000 = 350.00 SAR)' }) @IsInt() @Min(100) @Max(10_000_000) priceHalalas: number;
  @ApiProperty({ enum: PRICE_MODELS }) @IsIn(PRICE_MODELS) priceModel: (typeof PRICE_MODELS)[number];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(43200) durationMinutes?: number;
  @ApiPropertyOptional({ type: [OptionDto] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => OptionDto) options?: OptionDto[];
  @ApiProperty({ enum: LANGUAGES, isArray: true }) @IsArray() @ArrayMinSize(1) @IsIn(LANGUAGES, { each: true }) languagesSpoken: Language[];
  @ApiProperty({ enum: CITIES }) @IsIn(CITIES) serviceArea: City;
  @ApiPropertyOptional({ enum: CANCELLATION_POLICIES }) @IsOptional() @IsIn(CANCELLATION_POLICIES) cancellationPolicy?: (typeof CANCELLATION_POLICIES)[number];
}

class GenerateSlotsDto {
  @ApiProperty({ example: '2026-10-20', description: 'First day, Saudi date' }) @Matches(/^\d{4}-\d{2}-\d{2}$/) fromDate: string;
  @ApiProperty({ minimum: 1, maximum: 60 }) @IsInt() @Min(1) @Max(60) days: number;
  @ApiProperty({ example: [6, 10, 14], description: 'Start hours, Saudi time' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(24)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(23, { each: true })
  hours: number[];
  @ApiProperty() @IsInt() @Min(1) @Max(1000) capacity: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(1440) durationMinutes?: number;
}

class UpdateSlotDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1000) capacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() blocked?: boolean;
}

@ApiTags('catalogue')
@ApiBearerAuth()
@Controller()
export class CatalogueController {
  constructor(@Inject(CatalogueService) private readonly catalogue: CatalogueService) {}

  @Public()
  @Get('categories')
  categories(@Query() q: CityQuery) {
    return this.catalogue.categories(q.city);
  }

  /** Search services. Text comes back in `lang`, else the user's language, else English. */
  @Public()
  @Get('services')
  search(@Query() q: SearchQueryDto, @CurrentUser() user?: AuthUser) {
    return this.catalogue.search(q, user);
  }

  @Public()
  @Get('services/:id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Query() q: LangQuery, @CurrentUser() user?: AuthUser) {
    return this.catalogue.detail(id, q.lang ?? user?.language ?? 'en');
  }

  @Public()
  @Get('services/:id/slots')
  slots(@Param('id', ParseUUIDPipe) id: string, @Query() q: RangeQuery) {
    const from = q.from ?? new Date();
    const to = q.to ?? new Date(from.getTime() + 14 * 24 * 3600_000);
    return this.catalogue.availableSlots(id, from, to);
  }

  // ───────────── provider ─────────────

  @Get('provider/services')
  @Roles('provider_owner', ...ADMIN)
  providerList(@CurrentUser() user: AuthUser, @Query() q: ProviderIdQuery) {
    return this.catalogue.listForProvider(user, q.providerId);
  }

  @Post('provider/services')
  @Roles('provider_owner')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) {
    return this.catalogue.create(user, dto);
  }

  @Patch('provider/services/:id')
  @Roles('provider_owner', ...ADMIN)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ServiceFieldsDto) {
    return this.catalogue.update(user, id, dto);
  }

  @Get('provider/services/:id/slots')
  @Roles('provider_owner', ...ADMIN)
  providerSlots(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: RangeQuery) {
    const from = q.from ?? new Date(Date.now() - 24 * 3600_000);
    const to = q.to ?? new Date(from.getTime() + 15 * 24 * 3600_000);
    return this.catalogue.providerSlots(user, id, from, to);
  }

  @Post('provider/services/:id/slots')
  @Roles('provider_owner')
  generate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: GenerateSlotsDto) {
    return this.catalogue.generateSlots(user, id, dto);
  }

  @Patch('provider/slots/:id')
  @Roles('provider_owner')
  updateSlot(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSlotDto) {
    return this.catalogue.updateSlot(user, id, dto);
  }
}
