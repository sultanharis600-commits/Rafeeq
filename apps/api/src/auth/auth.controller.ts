import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { LANGUAGES, type Language } from '@rafeeq/shared';
import { Public } from './auth-user.js';
import { AuthService } from './auth.service.js';

class RequestOtpDto {
  @ApiProperty({ example: '+966500000050' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone: string;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: Language;
}

class VerifyOtpDto {
  @ApiProperty({ example: '+966500000050' })
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;

  @ApiPropertyOptional({ description: 'Used only when the account is new' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: Language;
}

class QuickLoginDto {
  @ApiProperty({ example: '+966500000050', description: 'Phone number (international format) or email' })
  @IsString()
  @MaxLength(120)
  identifier: string;

  @ApiPropertyOptional({ description: 'Used only when the account is new' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: Language;
}

@ApiTags('auth')
@Controller('auth')
@Public()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Send a 6-digit code by SMS. In demo mode the response includes the test code and no SMS is sent. */
  @Post('otp/request')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a login code' })
  request(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone, dto.language);
  }

  /** Exchange the code for a bearer token. Creates a pilgrim account on first login. */
  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with the code' })
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  /**
   * TESTING ONLY: log in with a phone number or email and no code. Refused unless
   * QUICK_LOGIN is on (which needs DEMO_MODE). Creates a pilgrim account on first login.
   */
  @Post('quick-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in without a code (testing only)' })
  quick(@Body() dto: QuickLoginDto) {
    return this.auth.quickLogin(dto);
  }
}
