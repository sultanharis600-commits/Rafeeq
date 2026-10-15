import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { InjectDb } from '../db/database.module.js';
import type { Env } from '../config/env.js';
import { Public } from '../auth/auth-user.js';

class HealthDto {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  demoMode: boolean;
  time: string;
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /** Liveness and database check. `demoMode` is true until the compliance checklist is done. */
  @Get()
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<HealthDto> {
    let database: HealthDto['database'] = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      demoMode: this.config.get('DEMO_MODE', { infer: true }),
      time: new Date().toISOString(),
    };
  }
}
