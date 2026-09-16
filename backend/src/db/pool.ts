import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

// DATE columns (OID 1082) must stay as 'YYYY-MM-DD' strings. The default parser
// turns them into JS Dates at local midnight, which shift a day back when the
// API serializes them to UTC (observed in UTC+1: day 5 rendered as day 4).
pg.types.setTypeParser(1082, (value) => value);

export type Row = Record<string, any>;

export type QueryResult<T extends Row = Row> = {
  rows: T[];
  rowCount: number | null;
};

export type QueryExecutor = <T extends Row = Row>(
  text: string,
  params?: unknown[]
) => Promise<QueryResult<T>>;

let executor: QueryExecutor | null = null;
let pool: pg.Pool | null = null;

/** Swap the SQL executor (used by integration tests with an in-process Postgres). */
export function setQueryExecutor(next: QueryExecutor | null): void {
  executor = next;
}

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://fintrack:fintrack_dev@localhost:5432/fintrack',
    });
  }
  return pool;
}

export async function query<T extends Row = Row>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (executor) {
    return executor<T>(text, params);
  }
  const result = await getPool().query(text, params as unknown[]);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
