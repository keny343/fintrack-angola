import { closePool, query } from './pool.js';
import { SCHEMA_SQL } from './schema.js';

async function migrate() {
  await query(SCHEMA_SQL);
  console.log('Schema applied.');
  await closePool();
}

migrate().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
