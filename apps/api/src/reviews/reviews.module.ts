import { Body, Controller, Get, Inject, Injectable, Module, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { desc, eq } from 'drizzle-orm';
import { ADMIN, CurrentUser, Roles, type AuthUser } from '../auth/auth-user.js';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import { bookings, orders, reviews, services, users } from '../db/schema.js';
import { assertProviderManager } from '../common/access.js';
import { badRequest, conflict, notFound } from '../common/errors.js';

@Injectable()
export class ReviewsService {
  constructor(@InjectDb() private readonly db: Database) {}

  /** One review per completed booking or delivered order, by the pilgrim who paid. */
  async create(user: AuthUser, input: { bookingId?: string; orderId?: string; rating: number; text?: string }) {
    if (Boolean(input.bookingId) === Boolean(input.orderId)) throw badRequest('review.one_target', 'Review one booking or one order');
    let providerId: string;
    let serviceId: string | null = null;
    if (input.bookingId) {
      const [b] = await this.db
        .select({ b: bookings, providerId: services.providerId })
        .from(bookings)
        .innerJoin(services, eq(services.id, bookings.serviceId))
        .where(eq(bookings.id, input.bookingId));
      if (!b || b.b.pilgrimId !== user.id) throw notFound('booking');
      if (!['completed', 'paid_out'].includes(b.b.status)) throw conflict('review.not_finished', 'You can review after the service is completed');
      providerId = b.providerId;
      serviceId = b.b.serviceId;
    } else {
      const [o] = await this.db.select().from(orders).where(eq(orders.id, input.orderId!));
      if (!o || o.pilgrimId !== user.id) throw notFound('order');
      if (o.status !== 'delivered') throw conflict('review.not_finished', 'You can review after delivery');
      providerId = o.shopId;
    }
    const [existing] = await this.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(input.bookingId ? eq(reviews.bookingId, input.bookingId) : eq(reviews.orderId, input.orderId!));
    if (existing) throw conflict('review.exists', 'You already reviewed this');
    const [row] = await this.db
      .insert(reviews)
      .values({
        authorId: user.id,
        bookingId: input.bookingId,
        orderId: input.orderId,
        serviceId,
        providerId,
        rating: input.rating,
        text: input.text?.trim() || null,
        language: user.language,
      })
      .returning();
    return row;
  }

  async forProvider(user: AuthUser, providerId: string) {
    assertProviderManager(user, providerId);
    return this.db
      .select({ review: reviews, author: users.name, serviceTitle: services.title })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .leftJoin(services, eq(services.id, reviews.serviceId))
      .where(eq(reviews.providerId, providerId))
      .orderBy(desc(reviews.createdAt))
      .limit(100);
  }

  async reply(user: AuthUser, id: string, text: string) {
    const [r] = await this.db.select().from(reviews).where(eq(reviews.id, id));
    if (!r) throw notFound('review');
    assertProviderManager(user, r.providerId);
    const [row] = await this.db.update(reviews).set({ reply: text }).where(eq(reviews.id, id)).returning();
    return row;
  }

  async mine(user: AuthUser) {
    return this.db.select().from(reviews).where(eq(reviews.authorId, user.id)).orderBy(desc(reviews.createdAt));
  }
}

class CreateReviewDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) text?: string;
}
class ReplyDto {
  @ApiProperty() @IsString() @MaxLength(1000) text: string;
}
class ProviderQuery {
  @ApiProperty() @IsUUID() providerId: string;
}

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Post('reviews')
  @Roles('pilgrim')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user, dto);
  }

  @Get('reviews/mine')
  @Roles('pilgrim')
  mine(@CurrentUser() user: AuthUser) {
    return this.reviews.mine(user);
  }

  @Get('provider/reviews')
  @Roles('provider_owner', ...ADMIN)
  forProvider(@CurrentUser() user: AuthUser, @Query() q: ProviderQuery) {
    return this.reviews.forProvider(user, q.providerId);
  }

  @Post('provider/reviews/:id/reply')
  @Roles('provider_owner')
  reply(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto) {
    return this.reviews.reply(user, id, dto.text);
  }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
