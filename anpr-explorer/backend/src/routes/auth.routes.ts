import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth } from '../middleware/auth.middleware';
import { log } from '../services/audit.service';
import type { UserRole } from '../types';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
}

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = db
      .prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;

    const isValid = user
      ? await argon2.verify(user.password_hash, password).catch(() => false)
      : false;

    if (!user || !isValid) {
      log({
        operatore: username,
        servizio: 'LOGIN',
        modalita: null,
        motivazione: null,
        esito: 'ERRORE',
        dettaglioErrore: 'Credenziali non valide',
        cfMascherato: null,
      });
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }

    req.session.regenerate((err) => {
      if (err) { next(err); return; }
      req.session.isAuthenticated = true;
      req.session.username = user.username;
      req.session.role = user.role;

      log({
        operatore: user.username,
        servizio: 'LOGIN',
        modalita: null,
        motivazione: null,
        esito: 'OK',
        dettaglioErrore: null,
        cfMascherato: null,
      });

      res.json({ username: user.username, role: user.role });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) { next(err); return; }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.session.username, role: req.session.role });
});

export default router;
