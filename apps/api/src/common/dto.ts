import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Text in up to six languages; English is required (AI_RULES.md). */
export class TranslatedDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) en: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) ar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) ur?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) ms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) tr?: string;
}

export class LongTranslatedDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) en: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) ar?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) ur?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) ms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) tr?: string;
}

export class ReasonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
