import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { closePool, query } from './db/pool.js';
import { SCHEMA_SQL } from './db/schema.js';
import { seedSystemCategories } from './db/systemCategories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const port = Number(process.env.PORT || 4000);

async function boot() {
  await query(SCHEMA_SQL);
  await seedSystemCategories();

  const app = createApp();
  app.listen(port, () => {
    console.log(`FinTrack API on http://localhost:${port}`);
  });
}

boot().catch(async (err) => {
  console.error('Failed to start:', err);
  await closePool();
  process.exit(1);
});
