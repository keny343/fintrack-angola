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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = (req.cookies?.token as string | undefined) || bearer;
    if (!token) {
      return res.status(401).json({ error: 'Sessão não iniciada.' });
    }
    const decoded = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    const userId = Number(decoded.sub);
    if (!Number.isFinite(userId)) {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }
    const result = await query<{ id: number; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }
    req.user = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
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
