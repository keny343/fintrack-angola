/**
 * CSV helpers for importing and exporting transactions.
 *
 * Angolan spreadsheets follow the pt convention: comma as the decimal mark, so
 * the field separator has to be the semicolon. Files exported elsewhere still
 * arrive comma-separated, so the delimiter is detected per file instead of
 * assumed.
 */

export type ParsedCsv = {
  delimiter: string;
  header: string[];
  /** Data rows paired with their 1-based line number in the original file. */
  rows: Array<{ line: number; values: string[] }>;
};

const BOM = '\uFEFF';

export function detectDelimiter(headerLine: string): string {
  let semicolons = 0;
  let commas = 0;
  let tabs = 0;
  let inQuotes = false;
  for (const char of headerLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (inQuotes) continue;
    else if (char === ';') semicolons++;
    else if (char === ',') commas++;
    else if (char === '\t') tabs++;
  }
  if (tabs > semicolons && tabs > commas) return '\t';
  return commas > semicolons ? ',' : ';';
}

/** Splits one CSV line, honouring quoted fields and doubled quotes. */
function splitLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function parseCsv(text: string): ParsedCsv {
  const clean = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const lines = clean.split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex === -1) throw new Error('O ficheiro está vazio.');

  const delimiter = detectDelimiter(lines[headerIndex]);
  const header = splitLine(lines[headerIndex], delimiter).map(normaliseHeader);
  const rows: ParsedCsv['rows'] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    rows.push({ line: i + 1, values: splitLine(lines[i], delimiter) });
  }

  return { delimiter, header, rows };
}

export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Header names are matched without accents, case or surrounding noise. */
export function normaliseHeader(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Category and account names are matched the same way, minus the underscores. */
export function normaliseName(name: string): string {
  return stripAccents(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_AO = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

export function parseDateInput(value: string): string {
  const raw = value.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = DATE_ISO.exec(raw);
  const ao = DATE_AO.exec(raw);
  if (iso) {
    [, year, month, day] = [0, Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (ao) {
    [, day, month, year] = [0, Number(ao[1]), Number(ao[2]), Number(ao[3])];
  } else {
    throw new Error('Data inválida. Usa dd/mm/aaaa ou aaaa-mm-dd.');
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Data inexistente no calendário.');
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseTypeInput(value: string): 'income' | 'expense' {
  const normalised = normaliseName(value);
  if (['receita', 'receitas', 'income', 'entrada', 'credito'].includes(normalised)) return 'income';
  if (['despesa', 'despesas', 'expense', 'saida', 'debito'].includes(normalised)) return 'expense';
  throw new Error('Tipo inválido. Usa "receita" ou "despesa".');
}

/** Amount as written in a pt spreadsheet: 150000,50 (never 150000.50). */
export function formatCentsForCsv(amountCents: number): string {
  const sign = amountCents < 0 ? '-' : '';
  const abs = Math.abs(amountCents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

function escapeField(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) || value.includes('"') || /[\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Serialises rows to CSV. The BOM is what makes Excel read accented category
 * names correctly instead of showing "Habita??o".
 */
export function toCsv(
  header: string[],
  rows: string[][],
  { delimiter = ';', bom = true }: { delimiter?: string; bom?: boolean } = {}
): string {
  const lines = [header, ...rows].map((row) =>
    row.map((field) => escapeField(field ?? '', delimiter)).join(delimiter)
  );
  return `${bom ? BOM : ''}${lines.join('\r\n')}\r\n`;
}
