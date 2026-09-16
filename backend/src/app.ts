import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

export function createApp() {
  const app = express();
  // A value pasted into a hosting dashboard often carries a trailing newline or
  // slash. The newline is an illegal header character, so cors() threw on every
  // request and took the health check down with it; the slash never matches the
  // browser's Origin. Both are cheap to absorb here.
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/+$/, '');

  // Behind Render's load balancer the client IP only exists in X-Forwarded-For,
  // and without this the rate limiters would throttle every user as one.
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());

  // Ahead of CORS on purpose: the platform's health check has no origin to
  // negotiate, and must not be able to fail because of a misconfigured one.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    cors({
      origin: frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // The API has no pages; point humans who open it in a browser to the app.
  app.get('/', (_req, res) => {
    res.json({
      service: 'FinTrack Angola API',
      app: frontendUrl,
      health: '/health',
      docs: 'https://github.com/keny343 — docs/API.md',
    });
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas tentativas. Tente mais tarde.' },
  });
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', loginLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiLimiter, apiRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Não encontrado.' });
  });

  // Express answers a malformed JSON body with an HTML error page, which is a
  // surprise for a client that only ever expects JSON from this API.
  app.use((err: Error & { status?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && err.status === 400) {
      return res.status(400).json({ error: 'O corpo do pedido não é JSON válido.' });
    }
    return next(err);
  });

  return app;
}
