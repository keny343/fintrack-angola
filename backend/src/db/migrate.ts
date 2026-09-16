import { pool, query } from './pool.js';
import { SCHEMA_SQL } from './schema.js';

async function migrate() {
  await query(SCHEMA_SQL);
  console.log('Schema applied.');
  await pool.end();
}

migrate().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
