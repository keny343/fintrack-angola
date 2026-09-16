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

## Production

| Layer | Where | Config |
|-------|-------|--------|
| Frontend | Vercel, root directory `frontend` | [`frontend/vercel.json`](../frontend/vercel.json) |
| API | Render web service, root directory `backend` | [`render.yaml`](../render.yaml) |
| Database | Render PostgreSQL, same region as the API | `render.yaml` |

### Why the frontend proxies the API

`frontend/vercel.json` rewrites `/api/*` to the Render service instead of the browser calling
`onrender.com` directly. The session lives in an httpOnly cookie, and a cookie set by another
domain is a third-party cookie: Safari and Firefox block those by default, so login would fail for
a good share of visitors. Proxying keeps the cookie first-party, `SameSite=Lax` stays valid, and
CORS stops being involved at all.

The production build therefore calls the API on its own origin — `VITE_API_URL` is only needed to
point somewhere else. If you do point the browser straight at the API domain, you must also set
`COOKIE_SAMESITE=none` on the API and accept the browser restrictions above.

### Deploying the API (Render)

`render.yaml` is a Blueprint: it declares the free PostgreSQL instance and the web service, wires
`DATABASE_URL` from the database, and generates `JWT_SECRET` on Render so the secret never lives in
the repo. Open
[dashboard.render.com/blueprint/new](https://dashboard.render.com/blueprint/new?repo=https://github.com/keny343/fintrack-angola),
apply it, then set `FRONTEND_URL` to the Vercel origin.

The schema is applied by the service itself on boot (`SCHEMA_SQL` plus the system categories), both
idempotent, so there is no migration step in the deploy pipeline.

### Deploying the frontend (Vercel)

Import the repository, set the root directory to `frontend`, and keep the detected Vite settings
(`npm run build`, output `dist`). No environment variables are required. If the Render service ends
up on a different hostname than `fintrack-angola-api.onrender.com`, update the rewrite destination
in `frontend/vercel.json`.

### Free plan limits worth knowing

- The free web service sleeps after 15 minutes without traffic; the next request pays roughly a
  minute of cold start, and the Vercel proxy may time it out. Reload once and it answers.
- A free Render PostgreSQL instance expires 30 days after creation and the data goes with it.
- The filesystem is ephemeral. Nothing in the app writes to disk, so this costs nothing here.

## Health checks

Probe `GET /health` on the API service — that is the path Render uses.
