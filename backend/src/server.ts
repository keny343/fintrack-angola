import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { pool, query } from './db/pool.js';
import { SCHEMA_SQL } from './db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const port = Number(process.env.PORT || 4000);

async function boot() {
  await query(SCHEMA_SQL);
  const cats = [
    ['Salário', 'income'],
    ['Freelance', 'income'],
    ['Renda', 'income'],
    ['Outras receitas', 'income'],
    ['Alimentação', 'expense'],
    ['Transporte', 'expense'],
    ['Habitação', 'expense'],
    ['Educação / Propinas', 'expense'],
    ['Saúde', 'expense'],
    ['Telecomunicações', 'expense'],
    ['Energia', 'expense'],
    ['Água', 'expense'],
    ['Entretenimento', 'expense'],
    ['Transferências', 'expense'],
    ['Outras despesas', 'expense'],
  ] as const;
  for (const [name, kind] of cats) {
    await query(
      `INSERT INTO categories (user_id, name, kind, is_system)
       SELECT NULL, $1, $2, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM categories WHERE user_id IS NULL AND name = $1 AND kind = $2
       )`,
      [name, kind]
    );
  }

  const app = createApp();
  app.listen(port, () => {
    console.log(`FinTrack API on http://localhost:${port}`);
  });
}

boot().catch(async (err) => {
  console.error('Failed to start:', err);
  await pool.end();
  process.exit(1);
});
