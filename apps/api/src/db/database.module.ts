import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { createPool, dbFromPool, Database } from './client.js';
import type { Env } from '../config/env.js';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

/** Inject the Drizzle database: `constructor(@InjectDb() private readonly db: Database)` */
export const InjectDb = () => Inject(DB);

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => createPool(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => dbFromPool(pool),
    },
    PoolCloser,
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule {}
