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
