import { PGlite } from '@electric-sql/pglite';
import { setQueryExecutor } from '../db/pool.js';
import { SCHEMA_SQL } from '../db/schema.js';
import { seedSystemCategories } from '../db/systemCategories.js';

/**
 * Boots an in-process Postgres (PGlite) with the real schema and system
 * categories, and routes the app's SQL through it. No Docker or server needed.
 */
export async function startTestDb() {
  // Keep DATE columns as 'YYYY-MM-DD' strings, matching the parser the pg
  // driver uses in production (see db/pool.ts).
  const db = new PGlite({ parsers: { 1082: (value: string) => value } });
  await db.exec(SCHEMA_SQL);

  setQueryExecutor(async (text, params) => {
    const result = await db.query(text, (params ?? []) as unknown[]);
    const rows = result.rows as unknown[];
    return {
      rows: rows as never,
      rowCount: result.affectedRows ?? rows.length,
    };
  });

  await seedSystemCategories();

  return {
    async stop() {
      setQueryExecutor(null);
      await db.close();
    },
  };
}
