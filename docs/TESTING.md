# Testing — FinTrack Angola

## Strategy

| Layer | Tool | Location |
|-------|------|----------|
| Domain unit | Vitest | `backend/src/domain/*.test.ts` |
| API integration | Vitest + Supertest + PGlite | `backend/src/routes/*.test.ts` |
| Frontend unit | Vitest | `frontend/src/**/*.test.ts` |

```bash
cd backend && npm test
cd frontend && npm test
```

## Integration tests without Docker

The API suite runs against **PGlite** (Postgres compiled to WebAssembly) started inside the test
process. `backend/src/testing/testDb.ts` applies the production `SCHEMA_SQL`, seeds the system
categories, and swaps the SQL executor via `setQueryExecutor` in
[`backend/src/db/pool.ts`](../backend/src/db/pool.ts).

Consequences:

- No Postgres container or running server is required, so CI needs no services.
- The tests exercise real SQL (`to_char` month grouping, `ON CONFLICT` budget upsert, constraints),
  not mocks of the database.

## What is covered

Auth (`src/routes/auth.test.ts`):

- Register creates the user, sets an httpOnly cookie, and provisions the default accounts
- Duplicate email, weak password, and wrong credentials are rejected
- `/api/auth/me` and finance routes return 401 without a session; logout clears it

Finance (`src/routes/api.test.ts`):

- Dashboard aggregates income/expense/balance in centavos
- Category kind must match the transaction type
- Non-positive amounts and malformed dates are rejected
- Budget progress: spent, remaining, and percentage used
- Report totals by category, plus required date params
- **User isolation**: another account cannot list or delete a user's transactions, sees a zero
  balance, cannot post to a foreign account, and cannot see private categories

Recurring transactions (`src/routes/recurring.test.ts`):

- One transaction per due month, and repeated runs create no duplicates
- Day 31 rules land on 28/29/30 in shorter months
- Paused rules generate nothing; `next_occurrence` reflects the paused state
- Deleting a rule keeps the transactions it already generated
- **User isolation**: rules cannot be listed, paused, or deleted by another account

Goals (`src/routes/goals.test.ts`):

- Progress, remaining amount, and required monthly deposit until the deadline
- Fully funded goals report `atingido`; goals without a deadline report `sem_prazo`
- Invalid targets, dates, and contribution amounts are rejected
- **User isolation**: goals, contributions, and deletion are restricted to the owner

Domain (`src/domain/money.test.ts`): centavos validation, AOA formatting, budget progress,
period totals, category/type compatibility.

Domain (`src/domain/goals.test.ts`): calendar-month arithmetic, observed monthly pace,
and the on-track/at-risk decision.

Domain (`src/domain/recurring.test.ts`): day-of-month clamping, due occurrences within the
rule window, and the next scheduled date.

API suites run one file at a time (`fileParallelism: false`) because each boots its own PGlite
engine.

## Quality bar

- Both suites green
- `npm run build` green in `backend/` and `frontend/`
- No secrets in the diff
