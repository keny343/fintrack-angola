import { query } from '../db/pool.js';
import { normaliseName, parseCsv, parseDateInput, parseTypeInput } from '../domain/csv.js';
import { categoryMatchesType, parseAOAToCents } from '../domain/money.js';

/** A file this large is a mistake, not a month of spending. */
export const MAX_IMPORT_ROWS = 1000;

export type ImportIssue = { line: number; message: string };

export type PreparedTransaction = {
  line: number;
  accountId: number;
  categoryId: number;
  type: 'income' | 'expense';
  amountCents: number;
  occurredOn: string;
  notes: string | null;
  categoryName: string;
  accountName: string;
};

export type ImportReport = {
  total: number;
  valid: number;
  issues: ImportIssue[];
  rows: PreparedTransaction[];
};

const REQUIRED_HEADERS = ['data', 'tipo', 'categoria', 'valor'] as const;

type CategoryRow = { id: number; name: string; kind: 'income' | 'expense' | 'both' };
type AccountRow = { id: number; name: string };

function columnIndexes(header: string[]): Record<string, number> {
  const aliases: Record<string, string[]> = {
    data: ['data', 'date', 'data_do_movimento'],
    tipo: ['tipo', 'type'],
    categoria: ['categoria', 'category'],
    conta: ['conta', 'account'],
    valor: ['valor', 'amount', 'montante'],
    notas: ['notas', 'nota', 'notes', 'descricao', 'description'],
  };
  const found: Record<string, number> = {};
  for (const [key, names] of Object.entries(aliases)) {
    const index = header.findIndex((h) => names.includes(h));
    if (index !== -1) found[key] = index;
  }
  return found;
}

/**
 * Validates a CSV against the user's own accounts and categories. Nothing is
 * written here: the caller decides whether to commit, so a file with a single
 * bad line never lands half-imported.
 */
export async function prepareImport(userId: number, csvText: string): Promise<ImportReport> {
  const parsed = parseCsv(csvText);
  const columns = columnIndexes(parsed.header);

  const missing = REQUIRED_HEADERS.filter((name) => columns[name] === undefined);
  if (missing.length) {
    throw new Error(`Faltam colunas obrigatórias: ${missing.join(', ')}.`);
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`O ficheiro tem mais de ${MAX_IMPORT_ROWS} linhas. Divide-o em partes.`);
  }

  const [categories, accounts] = await Promise.all([
    query<CategoryRow>(
      `SELECT id, name, kind FROM categories WHERE user_id IS NULL OR user_id = $1`,
      [userId]
    ),
    query<AccountRow>(`SELECT id, name FROM accounts WHERE user_id = $1 ORDER BY id`, [userId]),
  ]);

  if (!accounts.rows.length) {
    throw new Error('A conta não tem nenhuma carteira para receber os movimentos.');
  }

  const categoryByName = new Map(categories.rows.map((c) => [normaliseName(c.name), c]));
  const accountByName = new Map(accounts.rows.map((a) => [normaliseName(a.name), a]));
  const defaultAccount = accounts.rows[0];

  const issues: ImportIssue[] = [];
  const rows: PreparedTransaction[] = [];

  for (const { line, values } of parsed.rows) {
    const cell = (key: string) => (values[columns[key]] ?? '').trim();
    try {
      const occurredOn = parseDateInput(cell('data'));
      const type = parseTypeInput(cell('tipo'));

      const categoryInput = cell('categoria');
      const category = categoryByName.get(normaliseName(categoryInput));
      if (!category) {
        throw new Error(`Categoria "${categoryInput}" não existe.`);
      }
      if (!categoryMatchesType(category.kind, type)) {
        throw new Error(`A categoria "${category.name}" não aceita este tipo de movimento.`);
      }

      const accountInput = columns.conta === undefined ? '' : cell('conta');
      const account = accountInput ? accountByName.get(normaliseName(accountInput)) : defaultAccount;
      if (!account) {
        throw new Error(`Conta "${accountInput}" não existe.`);
      }

      const amountCents = parseAOAToCents(cell('valor'));
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error('O valor tem de ser maior do que zero.');
      }

      const notes = columns.notas === undefined ? '' : cell('notas');

      rows.push({
        line,
        accountId: account.id,
        categoryId: category.id,
        type,
        amountCents,
        occurredOn,
        notes: notes ? notes.slice(0, 500) : null,
        categoryName: category.name,
        accountName: account.name,
      });
    } catch (err) {
      issues.push({ line, message: (err as Error).message });
    }
  }

  return { total: parsed.rows.length, valid: rows.length, issues, rows };
}

/**
 * Inserts the prepared rows as one statement, so the import either lands whole
 * or not at all without needing a transaction across pooled connections.
 */
export async function commitImport(
  userId: number,
  rows: PreparedTransaction[]
): Promise<{ imported: number }> {
  if (!rows.length) return { imported: 0 };

  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const base = params.length;
    params.push(
      userId,
      row.accountId,
      row.categoryId,
      row.type,
      row.amountCents,
      row.occurredOn,
      row.notes
    );
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`;
  });

  const result = await query<{ id: number }>(
    `INSERT INTO transactions
       (user_id, account_id, category_id, type, amount_cents, occurred_on, notes)
     VALUES ${tuples.join(',')}
     RETURNING id`,
    params
  );

  return { imported: result.rows.length };
}
