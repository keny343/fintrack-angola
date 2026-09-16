# Deployment — FinTrack Angola

## Local

1. `cp .env.example .env`
2. `docker compose up -d`
3. `cd backend && npm install && npm run dev`
4. `cd frontend && npm install && npm run dev`

The backend applies `SCHEMA_SQL` and seeds the system categories on boot, so there is no
separate migration step.

### Without Docker (native PostgreSQL)

Create the role and database once, then point `DATABASE_URL` at it:

```bash
psql -U postgres -c "CREATE ROLE fintrack WITH LOGIN PASSWORD 'fintrack_dev';"
psql -U postgres -c "CREATE DATABASE fintrack OWNER fintrack;"
```

Then in `.env`:

```
DATABASE_URL=postgresql://fintrack:fintrack_dev@localhost:5432/fintrack
```

On Windows, `psql` lives in `C:\Program Files\PostgreSQL\<version>\bin`; add it to `PATH` or call
it with the full path.

## Suggested production topology (not wired yet)

| Layer | Option |
|-------|--------|
| Frontend | Vercel |
| Backend | Render / Fly.io |
| Database | Managed PostgreSQL (Aiven, Neon, Railway) |

Set:

- `DATABASE_URL`
- `JWT_SECRET` (≥32 chars)
- `FRONTEND_URL` (exact origin)
- `COOKIE_SECURE=true`
- `NODE_ENV=production`
- `VITE_API_URL` (API public origin) at build time

## Health checks

Probe `GET /health` on the API service.
