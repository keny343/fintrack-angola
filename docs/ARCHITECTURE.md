# Architecture — FinTrack Angola

## Overview

Monorepo with a TypeScript SPA and a TypeScript REST API sharing a PostgreSQL database.

```text
frontend/   Vite + React Router + Recharts
backend/    Express + pg + Zod + Vitest
docs/
docker-compose.yml   Postgres 16
```

## Request flow

1. Browser calls `VITE_API_URL` with `credentials: 'include'`.
2. API authenticates via httpOnly cookie `token` (JWT) or `Authorization: Bearer`.
3. All finance queries are scoped by `user_id`.
4. Mutations write `audit_events` (best-effort).

## Money model

All amounts are **`amount_cents` integers** (1 Kz = 100 centavos). Formatting happens at the edges (`formatAOA`).

## Domain modules

- `backend/src/domain/money.ts` — pure helpers (tested)
- `backend/src/routes/*` — HTTP + authorization
- `backend/src/db/*` — pool, schema, seed

## Why PostgreSQL

Differentiates this project from Mara/SIGDoc (MySQL) and supports clean date/`to_char` aggregations for monthly dashboards.
