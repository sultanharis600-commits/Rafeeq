import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction — services accept either. */
export type Tx = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 10 });
}

export function dbFromPool(pool: Pool): Database {
  return drizzle(pool, { schema });
}
