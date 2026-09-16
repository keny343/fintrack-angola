# Deployment — FinTrack Angola

## Local

1. `cp .env.example .env`
2. `docker compose up -d`
3. `cd backend && npm install && npm run dev`
4. `cd frontend && npm install && npm run dev`

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
