import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsObject, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { CITIES, LANGUAGES, PLACE_TYPES, PRODUCT_SECTIONS, type City, type Language, type PlaceType, type ProductSection } from '@rafeeq/shared';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth-user.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { places, providers, walkingRoutes } from '../db/schema.js';
import { audit } from '../common/audit.js';
import { LongTranslatedDto, TranslatedDto } from '../common/dto.js';
import { notFound } from '../common/errors.js';
import { pick } from '../common/translate.js';

/**
 * Places (holy sites, gates, lost-and-found points, hotels, shopping places) and walking
 * routes. The app downloads a whole city as an offline map pack and routes without internet.
 */
@Injectable()
export class PlacesService {
  constructor(@InjectDb() private readonly db: Database) {}

  async list(q: { city?: City; type?: PlaceType; sells?: ProductSection; lang?: Language }) {
    const lang = q.lang ?? 'en';
    const where: SQL[] = [];
    if (q.city) where.push(eq(places.city, q.city));
    if (q.type) where.push(eq(places.type, q.type));
    if (q.sells) where.push(sql`${q.sells} = any(${places.sells})`);
    const rows = await this.db
      .select({ p: places, shopStatus: providers.status })
      .from(places)
      .leftJoin(providers, eq(providers.id, places.shopProviderId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(places.city), asc(places.type));
    return rows.map(({ p, shopStatus }) => ({
      id: p.id,
      type: p.type,
      city: p.city,
      name: pick(p.name, lang),
      description: pick(p.description, lang),
      lat: p.lat,
      lng: p.lng,
      hours: p.hours,
      languages: p.languages,
      priceRange: p.priceRange,
      sells: p.sells,
      // "Shop online" only when the place's shop is live on Rafeeq.
      shopOnline: p.shopProviderId && shopStatus === 'approved' ? { shopId: p.shopProviderId } : null,
    }));
  }

  async get(id: string, lang: Language) {
    const [p] = await this.list({ lang }).then((all) => all.filter((x) => x.id === id));
    if (!p) throw notFound('place');
    return p;
  }

  async routes(q: { city?: City; fromPlaceId?: string; toPlaceId?: string; accessibleOnly?: boolean; lang?: Language }) {
    const where: SQL[] = [];
    if (q.city) where.push(eq(walkingRoutes.city, q.city));
    if (q.fromPlaceId) where.push(eq(walkingRoutes.fromPlaceId, q.fromPlaceId));
    if (q.toPlaceId) where.push(eq(walkingRoutes.toPlaceId, q.toPlaceId));
    if (q.accessibleOnly) where.push(eq(walkingRoutes.accessible, true));
    const rows = await this.db.select().from(walkingRoutes).where(where.length ? and(...where) : undefined);
    const lang = q.lang;
    return rows.map((r) => ({
      ...r,
      steps: lang ? r.steps.map((s) => ({ ...s, text: pick(s.instruction, lang) })) : r.steps,
    }));
  }

  /**
   * Everything the app needs to work offline in one city: places and routes with all
   * six languages. `version` changes whenever the content changes, so the app knows
   * when to download again. Map tiles come from the offline map SDK's own download.
   */
  async mapPack(city: City) {
    const rows = await this.db
      .select({ p: places, shopStatus: providers.status })
      .from(places)
      .leftJoin(providers, eq(providers.id, places.shopProviderId))
      .where(eq(places.city, city))
      .orderBy(asc(places.id));
    // Same rule as the places list: "Shop online" only for shops that are live on Rafeeq.
    const ps = rows.map(({ p, shopStatus }) => ({ ...p, shopProviderId: shopStatus === 'approved' ? p.shopProviderId : null }));
    const rs = await this.db.select().from(walkingRoutes).where(eq(walkingRoutes.city, city)).orderBy(asc(walkingRoutes.id));
    const body = { city, places: ps, routes: rs };
    const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
    const bounds = ps.reduce(
      (b, p) => ({ minLat: Math.min(b.minLat, p.lat), maxLat: Math.max(b.maxLat, p.lat), minLng: Math.min(b.minLng, p.lng), maxLng: Math.max(b.maxLng, p.lng) }),
      { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 },
    );
    return { version, generatedAt: new Date().toISOString(), bounds, ...body };
  }

  async create(admin: AuthUser, input: typeof places.$inferInsert) {
    const [row] = await this.db.insert(places).values(input).returning();
    await audit(this.db, admin.id, 'place.create', { type: 'place', id: row.id });
    return row;
  }

  async update(admin: AuthUser, id: string, patch: Partial<typeof places.$inferInsert>) {
    const [row] = await this.db.update(places).set(patch).where(eq(places.id, id)).returning();
    if (!row) throw notFound('place');
    await audit(this.db, admin.id, 'place.update', { type: 'place', id }, { fields: Object.keys(patch) });
    return row;
  }

  async remove(admin: AuthUser, id: string) {
    const used = await this.db.select({ id: walkingRoutes.id }).from(walkingRoutes).where(sql`${walkingRoutes.fromPlaceId} = ${id} or ${walkingRoutes.toPlaceId} = ${id}`);
    if (used.length) await this.db.delete(walkingRoutes).where(inArray(walkingRoutes.id, used.map((u) => u.id)));
    const res = await this.db.delete(places).where(eq(places.id, id)).returning({ id: places.id });
    if (!res.length) throw notFound('place');
    await audit(this.db, admin.id, 'place.delete', { type: 'place', id });
  }
}

class PlacesQuery {
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
  @ApiPropertyOptional({ enum: PLACE_TYPES }) @IsOptional() @IsIn(PLACE_TYPES) type?: PlaceType;
  @ApiPropertyOptional({ enum: PRODUCT_SECTIONS }) @IsOptional() @IsIn(PRODUCT_SECTIONS) sells?: ProductSection;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class RoutesQuery {
  @ApiPropertyOptional({ enum: CITIES }) @IsOptional() @IsIn(CITIES) city?: City;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromPlaceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toPlaceId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() accessibleOnly?: boolean;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class LangQuery {
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class PlaceDto {
  @ApiProperty({ enum: PLACE_TYPES }) @IsIn(PLACE_TYPES) type: PlaceType;
  @ApiProperty({ enum: CITIES }) @IsIn(CITIES) city: City;
  @ApiProperty({ type: TranslatedDto }) @ValidateNested() @Type(() => TranslatedDto) name: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
  @ApiPropertyOptional({ example: { always: '24h' } }) @IsOptional() @IsObject() hours?: Record<string, string>;
  @ApiPropertyOptional({ enum: LANGUAGES, isArray: true }) @IsOptional() @IsArray() @IsIn(LANGUAGES, { each: true }) languages?: Language[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(3) priceRange?: number;
  @ApiPropertyOptional({ enum: PRODUCT_SECTIONS, isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(PRODUCT_SECTIONS, { each: true }) sells?: ProductSection[];
  @ApiPropertyOptional() @IsOptional() @IsUUID() shopProviderId?: string;
}
class PlacePatchDto {
  @ApiPropertyOptional({ type: TranslatedDto }) @IsOptional() @ValidateNested() @Type(() => TranslatedDto) name?: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() hours?: Record<string, string>;
  @ApiPropertyOptional({ enum: LANGUAGES, isArray: true }) @IsOptional() @IsArray() @IsIn(LANGUAGES, { each: true }) languages?: Language[];
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(3) priceRange?: number;
  @ApiPropertyOptional({ enum: PRODUCT_SECTIONS, isArray: true }) @IsOptional() @IsArray() @IsIn(PRODUCT_SECTIONS, { each: true }) sells?: ProductSection[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID() shopProviderId?: string | null;
}

@ApiTags('places')
@ApiBearerAuth()
@Controller()
export class PlacesController {
  constructor(@Inject(PlacesService) private readonly places: PlacesService) {}

  @Public()
  @Get('places')
  list(@Query() q: PlacesQuery, @CurrentUser() user?: AuthUser) {
    return this.places.list({ ...q, lang: q.lang ?? user?.language });
  }

  @Public()
  @Get('places/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Query() q: LangQuery, @CurrentUser() user?: AuthUser) {
    return this.places.get(id, q.lang ?? user?.language ?? 'en');
  }

  @Public()
  @Get('routes')
  routes(@Query() q: RoutesQuery) {
    return this.places.routes(q);
  }

  @Public()
  @Get('map-packs/:city')
  @ApiOperation({ summary: 'Offline map pack for a city (places + walking routes, all languages)' })
  pack(@Param('city') city: string) {
    if (!(CITIES as readonly string[]).includes(city)) throw notFound('map_pack');
    return this.places.mapPack(city as City);
  }

  @Post('admin/places')
  @Roles('admin_ops')
  create(@CurrentUser() user: AuthUser, @Body() dto: PlaceDto) {
    return this.places.create(user, dto);
  }

  @Patch('admin/places/:id')
  @Roles('admin_ops')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PlacePatchDto) {
    return this.places.update(user, id, dto);
  }

  @Delete('admin/places/:id')
  @Roles('admin_ops')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.places.remove(user, id);
  }
}

@Module({ controllers: [PlacesController], providers: [PlacesService] })
export class PlacesModule {}
