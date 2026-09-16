# FinTrack Angola

**Personal finance in Kwanza (AOA/Kz)** — portfolio Full Stack app.

React · TypeScript · Vite · Express · PostgreSQL · Docker · Vitest · GitHub Actions

> Status: **local MVP** (auth, accounts, categories, transactions, budgets, dashboard, reports). Not a live production deploy yet.

## Problem

Managing salary, rent, transport, and day-to-day expenses in Angola often lives in spreadsheets or chat notes. That makes monthly budgets and category trends hard to see in **Kz**.

## Solution

FinTrack Angola is a role-of-one personal finance app that:

- Stores money as **integer centavos** (no floating-point drift)
- Uses **AOA formatting** and **dd/mm/yyyy** dates
- Ships Angola-relevant **system categories** (salário, propinas, energia, água…)
- Shows **dashboard KPIs**, **budgets vs spent**, and **category reports**

## Architecture

```text
React (Vite) ──credentials/cookies──▶ Express API ──▶ PostgreSQL
```

Details: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

## Features (MVP)

| Area | What works |
|------|------------|
| Auth | Register, login, logout, httpOnly JWT cookie |
| Accounts | Default Numerário + Conta bancária |
| Categories | System seed + custom |
| Transactions | Income/expense create, filter, delete |
| Budgets | Monthly limit per category + progress |
| Dashboard | Balance, month income/expense, chart, recent activity |
| Reports | Totals by category for a date range |
| Goals | Savings targets with contributions, required monthly pace, on-track status |

## Quick start

```bash
# 1) Env
cp .env.example .env

# 2) Database (Docker, or a native PostgreSQL on 5432 — see docs/DEPLOYMENT.md)
docker compose up -d

# 3) Backend
cd backend
npm install
npm run dev          # http://localhost:4000  (auto-migrates + seeds categories)

# 4) Frontend (other terminal)
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Health: `GET http://localhost:4000/health`

## Tests

```bash
cd backend && npm test     # domain + API integration (PGlite, no Docker needed)
cd frontend && npm test
```

API tests boot **PGlite** (Postgres in WebAssembly) in-process, apply the real schema, and cover
auth, validation, budget math, and **per-user data isolation**. Details:
[`docs/TESTING.md`](./docs/TESTING.md).

## Security notes

Helmet, CORS allowlist, rate limits on auth/API, bcrypt passwords, parameterized SQL, httpOnly cookies.  
See [`docs/SECURITY.md`](./docs/SECURITY.md).

## Roadmap

- [x] Savings goals
- [ ] Recurring transactions
- [ ] CSV import/export
- [ ] Live deploy (Vercel + Render)
- [ ] Optional AI insights layer (deterministic metrics first)

## Author

**Adnírcio Inocêncio** — [keny343](https://github.com/keny343)

Licensed for portfolio demonstration. Do not commit secrets.
