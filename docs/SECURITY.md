# Security — FinTrack Angola

## Controls

| Control | Implementation |
|---------|----------------|
| Password hashing | bcrypt (12 rounds) |
| Sessions | JWT in httpOnly cookie; SameSite=Lax; Secure in production |
| AuthZ | Every finance route uses `requireAuth` + `user_id` filters |
| Validation | Zod on auth/transactions/budgets |
| SQL injection | Parameterized `pg` queries |
| HTTP hardening | Helmet |
| CORS | Allowlist `FRONTEND_URL` with credentials |
| Abuse | Rate limit on login/register and general API |
| Audit | `audit_events` for register/login/tx/budget |

## Secrets

- Only `.env.example` is committed
- `JWT_SECRET` must be set (≥16 chars; use ≥32 in production)
- Never commit real DB passwords or API keys

## Known gaps (honest)

- No email password-reset yet
- No CSRF token for cookie POSTs (SameSite=Lax mitigates common cases; tighten for cross-site deployments)
- No 2FA
