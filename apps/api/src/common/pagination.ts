import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Keep API responses small: every list is paginated (AI_RULES.md). */
export class PageQuery {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export type Page<T> = { items: T[]; limit: number; offset: number; hasMore: boolean };

/** Fetch limit+1 rows and trim, so we know if there is a next page without counting. */
export function toPage<T>(rows: T[], q: PageQuery): Page<T> {
  return { items: rows.slice(0, q.limit), limit: q.limit, offset: q.offset, hasMore: rows.length > q.limit };
}
