import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { env, isProduction } from './config/env';
import authRoutes from './routes/auth.routes';
import settingsRoutes from './routes/settings.routes';
import anprRoutes from './routes/anpr.routes';
import usersRoutes from './routes/users.routes';
import auditRoutes from './routes/audit.routes';
import { errorMiddleware } from './middleware/error.middleware';

export const app = express();

// Necessario dietro reverse proxy (nginx/traefik) perché i cookie "secure" funzionino correttamente.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '100kb' }));

app.use(
  session({
    name: 'connect.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8, // 8 ore
    },
  })
);

// Rate limit generale su tutte le API.
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Rate limit più severo sul login, per mitigare attacchi a forza bruta.
app.use(
  '/api/login',
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/anpr', anprRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);

app.use(errorMiddleware);
