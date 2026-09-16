import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

export type AuthUser = { id: number; email: string; name: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 chars)');
  }
  return s;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, jwtSecret(), {
    expiresIn: '7d',
  });
}

export function cookieOptions() {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  // In production the frontend proxies /api through its own domain, so the
  // session cookie is first-party and 'lax' holds. Pointing the browser
  // straight at the API on another domain needs 'none', which Safari and
  // Firefox then block by default — see docs/DEPLOYMENT.md.
  const sameSite = process.env.COOKIE_SAMESITE === 'none' ? ('none' as const) : ('lax' as const);
  return {
    httpOnly: true,
    sameSite,
    secure: sameSite === 'none' ? true : secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export type SessionResult = { user: AuthUser } | { user: null; reason: 'missing' | 'invalid' };

/**
 * Reads the session without deciding what its absence means. Protected routes
 * turn a missing session into a 401; the session probe reports it as a fact.
 */
export async function resolveSession(req: Request): Promise<SessionResult> {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token = (req.cookies?.token as string | undefined) || bearer;
  if (!token) {
    return { user: null, reason: 'missing' };
  }
  try {
    const decoded = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId)) {
      return { user: null, reason: 'invalid' };
    }
    const result = await query<AuthUser>('SELECT id, email, name FROM users WHERE id = $1', [
      userId,
    ]);
    const user = result.rows[0];
    return user ? { user } : { user: null, reason: 'invalid' };
  } catch {
    return { user: null, reason: 'invalid' };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await resolveSession(req);
  if (!session.user) {
    const error =
      session.reason === 'missing' ? 'Sessão não iniciada.' : 'Sessão inválida ou expirada.';
    return res.status(401).json({ error });
  }
  req.user = session.user;
  next();
}

export async function audit(userId: number | null, action: string, meta?: unknown) {
  try {
    await query('INSERT INTO audit_events (user_id, action, meta) VALUES ($1, $2, $3)', [
      userId,
      action,
      meta ? JSON.stringify(meta) : null,
    ]);
  } catch {
    // best-effort
  }
}
