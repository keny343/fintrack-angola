# API — FinTrack Angola

Base URL: `http://localhost:4000`

## Health

- `GET /health` → `{ status: "ok" }`

## Auth

- `POST /api/auth/register` `{ name, email, password }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Sets httpOnly cookie `token`.

## Finance (auth required)

- `GET /api/accounts`
- `GET /api/categories`
- `POST /api/categories` `{ name, kind }`
- `GET /api/transactions?from&to&type&category_id`
- `POST /api/transactions` `{ account_id, category_id, type, amount_cents, occurred_on, notes? }`
- `DELETE /api/transactions/:id`
- `GET /api/budgets?year_month=YYYY-MM`
- `PUT /api/budgets` `{ category_id, year_month, limit_cents }`
- `GET /api/dashboard?year_month=YYYY-MM`
- `GET /api/reports/by-category?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Insights (auth required)

- `GET /api/insights?year_month=YYYY-MM` → `{ year_month, metrics, insights }`

`metrics` holds the month read in numbers: income, expense, net, saving rate, the change against
the previous month, the fixed bills not yet charged, and the largest expense category with its
share. `insights` is the same data turned into at most six sentences, each with an `id`, a
`severity` (`risk` | `warn` | `info` | `good`), the text, and the `facts` behind it.

What it looks at: a negative month or the share of income kept, budgets already broken and budgets
above 80% of the limit, categories that grew at least 40% **and** at least 10.000 Kz against last
month, recurring expenses still due before month end against what is left, goals flagged
`em_risco`, and a single category taking 40% or more of the month.

Every figure is computed in SQL and in
[`backend/src/domain/insights.ts`](../backend/src/domain/insights.ts), which is a pure function over
those numbers — no estimates, no rounding before a comparison. If a language model is plugged in
later to phrase these differently, `facts` is the only thing it is allowed to talk about.

## CSV import and export (auth required)

- `GET /api/transactions/export?from&to&type&category_id` → `text/csv` attachment with the same
  filters as the transaction list
- `POST /api/transactions/import` `{ csv, dry_run? }` → `{ total, valid, imported, issues, max_rows }`

The export writes `Data;Tipo;Categoria;Conta;Valor (Kz);Notas`, semicolon-separated with a decimal
comma and a UTF-8 BOM, which is what Excel needs to read `Habitação` correctly. An exported file is
a valid import file.

The import accepts up to 1000 rows. `Data`, `Tipo`, `Categoria` and `Valor` are required; `Conta`
(defaults to the user's first account) and `Notas` are optional. Column names are matched without
accents or case, dates in `dd/mm/aaaa` or `aaaa-mm-dd`, and amounts as written in a pt spreadsheet
(`25.000,50`). The delimiter is detected per file, so comma-separated exports from other tools work
too.

Validation runs against the caller's own accounts and categories. If any line fails, the response is
`422` with the line number and reason for each problem and **nothing is written** — a half-imported
month is worse than none. `dry_run: true` returns the same report without importing, which is what
the UI shows before asking for confirmation.

## Recurring transactions (auth required)

- `GET /api/recurring` → rules with `next_occurrence`, `last_run_on`, `active`
- `POST /api/recurring` `{ name, account_id, category_id, type, amount_cents, day_of_month, start_date, end_date? }`
- `PATCH /api/recurring/:id` `{ active }` — pause or resume a rule
- `DELETE /api/recurring/:id` — already generated transactions are kept (`recurring_id` becomes null)
- `POST /api/recurring/run` → `{ created }` materializes anything still due

Rules fire monthly on `day_of_month`, clamped to the last day of shorter months (31 → 28/29/30),
so no month is skipped. Catch-up also runs automatically on login, and is idempotent thanks to a
unique index on `(recurring_id, occurred_on)`.

## Goals (auth required)

- `GET /api/goals` → each goal includes `saved_cents`, `percent`, `remainingCents`,
  `monthsRemaining`, `requiredMonthlyCents`, `pace_cents` and `status`
  (`atingido` | `em_dia` | `em_risco` | `sem_prazo`)
- `POST /api/goals` `{ name, target_cents, deadline? }`
- `POST /api/goals/:id/contributions` `{ amount_cents, occurred_on, notes? }`
- `DELETE /api/goals/:id`

`requiredMonthlyCents` is the amount still missing divided by the whole calendar months
left until the deadline. A goal is `em_risco` when the deadline is due/past with money
missing, or when the observed monthly pace is below what is required.

Amounts are always integer **centavos**.
