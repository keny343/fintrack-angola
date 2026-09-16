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
- Finance routes return 401 without a session, including after logout
- `/api/auth/me` answers 200 with a null user when the session is absent or tampered with

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

Insights (`src/routes/insights.test.ts`):

- An empty month is told apart from a month with movements
- Metrics come from the caller's own transactions, budgets of the requested month included
- The month is compared against the previous one
- Only fixed bills still ahead of today count towards what is due
- **User isolation**: another account's numbers never reach the insights

Narration (`src/routes/narration.test.ts`) — the model is a stubbed `fetch`, so the provider's own
HTTP handling is under test too, and no test reaches the network:

- With no key configured the month is still described, from the deterministic summary
- A faithful answer is served as `source: 'model'`, with the model named
- The key travels as a bearer token and `max_tokens` stays capped
- An answer containing a figure nobody computed is **discarded** and reported in `rejected_figures`
- A provider that throws, times out, or answers `429` falls back instead of failing the request
- An empty month never reaches the provider, and a repeated month is served from cache
- Changing the month's numbers invalidates that cache
- **User isolation**: each caller's paragraph describes their own month

CSV import and export (`src/routes/csv.test.ts`):

- A valid file lands the amounts in centavos, including `25.000,50` written the pt way
- Categories match without accents or case, and the account defaults to the user's first one
- A file with bad lines imports **nothing** and reports the line number and reason for each
- `dry_run` returns the same report without writing
- Files missing required columns are rejected before any row is read
- The export carries only the caller's rows and honours the list filters
- **Round trip**: an exported file imports back into another account with identical rows

Domain (`src/domain/csv.test.ts`): delimiter detection, quoted fields with embedded separators and
doubled quotes, BOM and CRLF handling, header normalisation, Angolan and ISO dates (including the
rejection of 31/02), amount formatting with a decimal comma, and CSV escaping on the way out.

Domain (`src/domain/insights.test.ts`): each rule in isolation — saving rate, negative month,
spending without income, budget overruns and near-limit warnings, category jumps (including the
ones ignored for being large in percentage but small in Kwanzas), fixed bills that do or do not fit
in what is left, goals behind pace, category concentration, severity ordering, the six-insight cap,
and percentages written with a comma.

Domain (`src/domain/narration.test.ts`): number extraction from Portuguese text (a year stays whole,
thousands split by space or dot, two numbers across a full stop stay apart), the list of figures an
answer may repeat — centavos excluded — and the check itself accepting a faithful answer while
rejecting invented, rounded and self-computed figures. Also asserts the prompt carries no note,
account name or e-mail, and that the deterministic summary would pass its own check.

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
