import { query } from './pool.js';

/** System categories (user_id NULL) — Angola-relevant defaults. */
export const SYSTEM_CATEGORIES: Array<{ name: string; kind: 'income' | 'expense' }> = [
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

export async function seedSystemCategories(): Promise<number> {
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
  return SYSTEM_CATEGORIES.length;
}
