import { Body, Controller, Get, HttpCode, Inject, Module, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LANGUAGES, ORDER_STATUSES, PRODUCT_SECTIONS, type Language, type OrderStatus, type ProductSection } from '@rafeeq/shared';
import { ADMIN, CurrentUser, Public, Roles, type AuthUser } from '../auth/auth-user.js';
import { LongTranslatedDto, TranslatedDto } from '../common/dto.js';
import { badRequest } from '../common/errors.js';
import { PageQuery } from '../common/pagination.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ShopService, type DeliveryInput } from './shop.service.js';

class ProductsQuery extends PageQuery {
  @ApiPropertyOptional({ enum: PRODUCT_SECTIONS }) @IsOptional() @IsIn(PRODUCT_SECTIONS) section?: ProductSection;
  @ApiPropertyOptional() @IsOptional() @IsUUID() shopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional({ description: 'Only products that can ship to this country' }) @IsOptional() @IsISO31661Alpha2() country?: string;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class LangQuery {
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class CartItemDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(50) quantity: number;
}
class DeliveryDto {
  @ApiProperty({ enum: ['hotel', 'international'] }) @IsIn(['hotel', 'international']) deliveryType: 'hotel' | 'international';
  @ApiPropertyOptional({ description: 'Hotel room number' }) @IsOptional() @IsString() @MaxLength(20) room?: string;
  @ApiPropertyOptional({ example: 'ID' }) @IsOptional() @IsISO31661Alpha2() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postcode?: string;
}
class QuoteDto {
  @ApiProperty({ type: [CartItemDto] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CartItemDto) items: CartItemDto[];
  @ApiProperty({ type: DeliveryDto }) @ValidateNested() @Type(() => DeliveryDto) delivery: DeliveryDto;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() giftWrap?: boolean;
}
class CreateOrderDto extends QuoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) giftMessage?: string;
}
class ShopQuery extends PageQuery {
  @ApiProperty() @IsUUID() shopId: string;
  @ApiPropertyOptional({ enum: ORDER_STATUSES }) @IsOptional() @IsIn(ORDER_STATUSES) status?: OrderStatus;
}
class ShopIdQuery {
  @ApiProperty() @IsUUID() shopId: string;
}
class AdminOrdersQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ORDER_STATUSES }) @IsOptional() @IsIn(ORDER_STATUSES) status?: OrderStatus;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) lang?: Language;
}
class ProductFieldsDto {
  @ApiPropertyOptional({ enum: PRODUCT_SECTIONS }) @IsOptional() @IsIn(PRODUCT_SECTIONS) section?: ProductSection;
  @ApiPropertyOptional({ type: TranslatedDto }) @IsOptional() @ValidateNested() @Type(() => TranslatedDto) title?: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(100) @Max(10_000_000) priceHalalas?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000) stock?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10_000) lowStockAlert?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(30_000) weightGrams?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFood?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() shipsAbroad?: boolean;
  @ApiPropertyOptional({ type: [String], description: 'Empty = any country the courier serves' }) @IsOptional() @IsArray() @IsISO31661Alpha2({ each: true }) shipsToCountries?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
class CreateProductDto {
  @ApiProperty() @IsUUID() shopId: string;
  @ApiProperty({ enum: PRODUCT_SECTIONS }) @IsIn(PRODUCT_SECTIONS) section: ProductSection;
  @ApiProperty({ type: TranslatedDto }) @ValidateNested() @Type(() => TranslatedDto) title: TranslatedDto;
  @ApiPropertyOptional({ type: LongTranslatedDto }) @IsOptional() @ValidateNested() @Type(() => LongTranslatedDto) description?: LongTranslatedDto;
  @ApiProperty() @IsInt() @Min(100) @Max(10_000_000) priceHalalas: number;
  @ApiProperty() @IsInt() @Min(0) @Max(100_000) stock: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10_000) lowStockAlert?: number;
  @ApiProperty() @IsInt() @Min(1) @Max(30_000) weightGrams: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFood?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() shipsAbroad?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsISO31661Alpha2({ each: true }) shipsToCountries?: string[];
}
class ShipDto {
  @ApiProperty() @IsString() @MaxLength(60) courier: string;
  @ApiProperty() @IsString() @MaxLength(60) trackingNumber: string;
}
class ReasonDto {
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

function toDelivery(d: DeliveryDto): DeliveryInput {
  if (d.deliveryType === 'hotel') return { deliveryType: 'hotel', room: d.room };
  if (!d.country || !d.line1 || !d.city) throw badRequest('order.address_required', 'Country, address and city are needed for shipping');
  return { deliveryType: 'international', country: d.country, line1: d.line1, city: d.city, postcode: d.postcode };
}

@ApiTags('shop')
@ApiBearerAuth()
@ApiExtraModels(DeliveryDto)
@Controller()
export class ShopController {
  constructor(@Inject(ShopService) private readonly shop: ShopService) {}

  @Public()
  @Get('products')
  list(@Query() q: ProductsQuery, @CurrentUser() user?: AuthUser) {
    return this.shop.list({ ...q, lang: q.lang ?? user?.language });
  }

  @Public()
  @Get('products/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Query() q: LangQuery, @CurrentUser() user?: AuthUser) {
    return this.shop.get(id, q.lang ?? user?.language ?? 'en');
  }

  /** Price the cart with delivery before paying. */
  @Post('orders/quote')
  @Roles('pilgrim')
  @HttpCode(200)
  quote(@CurrentUser() user: AuthUser, @Body() dto: QuoteDto) {
    return this.shop.quote(user, dto.items, toDelivery(dto.delivery), dto.giftWrap);
  }

  @Post('orders')
  @Roles('pilgrim')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.shop.createOrder(user, { items: dto.items, delivery: toDelivery(dto.delivery), giftWrap: dto.giftWrap, giftMessage: dto.giftMessage });
  }

  @Get('orders')
  @Roles('pilgrim')
  mine(@CurrentUser() user: AuthUser, @Query() q: PageQuery) {
    return this.shop.myOrders(user, q);
  }

  @Get('orders/:id')
  order(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query() q: LangQuery) {
    return this.shop.getOrder(user, id, q.lang);
  }

  @Post('orders/:id/cancel')
  @Roles('pilgrim')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.shop.cancel(user, id);
  }

  // ───────────── shop owner ─────────────

  @Get('provider/products')
  @Roles('provider_owner', ...ADMIN)
  products(@CurrentUser() user: AuthUser, @Query() q: ShopIdQuery) {
    return this.shop.shopProducts(user, q.shopId);
  }

  @Get('provider/products/low-stock')
  @Roles('provider_owner')
  lowStock(@CurrentUser() user: AuthUser, @Query() q: ShopIdQuery) {
    return this.shop.lowStock(user, q.shopId);
  }

  @Post('provider/products')
  @Roles('provider_owner')
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.shop.createProduct(user, dto);
  }

  @Patch('provider/products/:id')
  @Roles('provider_owner', ...ADMIN)
  updateProduct(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProductFieldsDto) {
    return this.shop.updateProduct(user, id, dto);
  }

  @Get('provider/orders')
  @Roles('provider_owner', ...ADMIN)
  shopOrders(@CurrentUser() user: AuthUser, @Query() q: ShopQuery) {
    return this.shop.shopOrders(user, q);
  }

  @Post('provider/orders/:id/pack')
  @Roles('provider_owner')
  @HttpCode(200)
  pack(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.shop.advance(user, id, 'packed');
  }

  @Post('provider/orders/:id/out-for-delivery')
  @Roles('provider_owner')
  @HttpCode(200)
  out(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.shop.advance(user, id, 'out_for_delivery');
  }

  @Post('provider/orders/:id/ship')
  @Roles('provider_owner')
  @HttpCode(200)
  ship(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ShipDto) {
    return this.shop.advance(user, id, 'shipped', dto);
  }

  @Post('provider/orders/:id/deliver')
  @Roles('provider_owner')
  @HttpCode(200)
  deliver(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.shop.advance(user, id, 'delivered');
  }

  @Post('provider/orders/:id/cancel')
  @Roles('provider_owner')
  @HttpCode(200)
  shopCancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.shop.shopCancel(user, id, dto.reason);
  }

  @Get('admin/orders')
  @Roles(...ADMIN)
  adminOrders(@Query() q: AdminOrdersQuery) {
    return this.shop.adminOrders(q);
  }
}

@Module({ imports: [PaymentsModule], controllers: [ShopController], providers: [ShopService] })
export class ShopModule {}
