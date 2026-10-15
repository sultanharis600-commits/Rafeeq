/** Apply SQL migrations from ./drizzle. Run with `npm run db:migrate`. */
import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool, dbFromPool } from './client.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = createPool(url);
  try {
    await migrate(dbFromPool(pool), { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
