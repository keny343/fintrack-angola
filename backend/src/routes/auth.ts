import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { audit, cookieOptions, requireAuth, signToken } from '../middleware/auth.js';
import { runRecurring } from '../services/recurring.js';

const router = Router();

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(120).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = credSchema.safeParse({ ...req.body, name: req.body.name });
  if (!parsed.success || !parsed.data.name) {
    return res.status(400).json({ error: 'Nome, email e palavra-passe (≥8) são obrigatórios.' });
  }
  const { name, email, password } = parsed.data;
  const existing = await query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Já existe uma conta com este email.' });
  }
  const password_hash = await bcrypt.hash(password, 12);
  const inserted = await query<{ id: number; email: string; name: string }>(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, email, name`,
    [name, email.toLowerCase(), password_hash]
  );
  const user = inserted.rows[0];
  await query(`INSERT INTO accounts (user_id, name, kind) VALUES ($1, 'Numerário', 'cash')`, [
    user.id,
  ]);
  await query(`INSERT INTO accounts (user_id, name, kind) VALUES ($1, 'Conta bancária', 'bank')`, [
    user.id,
  ]);
  const token = signToken(user);
  res.cookie('token', token, cookieOptions());
  await audit(user.id, 'USER_REGISTER');
  return res.status(201).json({ user });
});

router.post('/login', async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Email e palavra-passe inválidos.' });
  }
  const { email, password } = parsed.data;
  const found = await query<{ id: number; email: string; name: string; password_hash: string }>(
    'SELECT id, email, name, password_hash FROM users WHERE lower(email) = lower($1)',
    [email]
  );
  if (!found.rows.length) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  const row = found.rows[0];
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  const user = { id: row.id, email: row.email, name: row.name };
  res.cookie('token', signToken(user), cookieOptions());
  await audit(user.id, 'USER_LOGIN');
  // Catching up on recurring rules must never block a successful login.
  try {
    await runRecurring(user.id);
  } catch (err) {
    console.error('recurring catch-up failed', err);
  }
  return res.json({ user });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

export default router;
