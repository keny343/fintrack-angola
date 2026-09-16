import { pool, query } from './pool.js';

/** System categories (user_id NULL) — Angola-relevant defaults. */
const SYSTEM_CATEGORIES: Array<{ name: string; kind: 'income' | 'expense' | 'both' }> = [
  { name: 'Salário', kind: 'income' },
  { name: 'Freelance', kind: 'income' },
  { name: 'Renda', kind: 'income' },
  { name: 'Outras receitas', kind: 'income' },
  { name: 'Alimentação', kind: 'expense' },
  { name: 'Transporte', kind: 'expense' },
  { name: 'Habitação', kind: 'expense' },
  { name: 'Educação / Propinas', kind: 'expense' },
  { name: 'Saúde', kind: 'expense' },
  { name: 'Telecomunicações', kind: 'expense' },
  { name: 'Energia', kind: 'expense' },
  { name: 'Água', kind: 'expense' },
  { name: 'Entretenimento', kind: 'expense' },
  { name: 'Transferências', kind: 'expense' },
  { name: 'Outras despesas', kind: 'expense' },
];

async function seed() {
  for (const c of SYSTEM_CATEGORIES) {
    await query(
      `INSERT INTO categories (user_id, name, kind, is_system)
       SELECT NULL, $1, $2, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM categories WHERE user_id IS NULL AND name = $1 AND kind = $2
       )`,
      [c.name, c.kind]
    );
  }
  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories.`);
  await pool.end();
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
