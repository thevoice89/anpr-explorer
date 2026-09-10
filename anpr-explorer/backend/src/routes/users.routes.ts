import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { db } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';
import type { UserRole } from '../types';

const router = Router();
router.use(requireAdmin);

interface UserRow {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

router.get('/', (_req, res) => {
  const users = db
    .prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC')
    .all() as UserRow[];
  res.json(users);
});

const createSchema = z.object({
  username: z.string().min(2).max(64),
  password: z.string().min(8, 'La password deve avere almeno 8 caratteri'),
  role: z.enum(['admin', 'viewer']),
});

router.post('/', async (req, res, next) => {
  try {
    const { username, password, role } = createSchema.parse(req.body);
    const hash = await argon2.hash(password);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, hash, role);
    const user = db
      .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid) as UserRow;
    res.status(201).json(user);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      res.status(409).json({ error: 'Username già esistente' });
      return;
    }
    next(err);
  }
});

const updateSchema = z.object({
  role: z.enum(['admin', 'viewer']).optional(),
  password: z.string().min(8).optional(),
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { role, password } = updateSchema.parse(req.body);

    if (role) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    }
    if (password) {
      const hash = await argon2.hash(password);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    }

    const user = db
      .prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
    if (!user) { res.status(404).json({ error: 'Utente non trovato' }); return; }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const adminCount = (
    db.prepare("SELECT COUNT(*) as n FROM users WHERE role = 'admin'").get() as { n: number }
  ).n;
  const target = db
    .prepare('SELECT role FROM users WHERE id = ?')
    .get(id) as { role: UserRole } | undefined;

  if (!target) { res.status(404).json({ error: 'Utente non trovato' }); return; }
  if (target.role === 'admin' && adminCount <= 1) {
    res.status(409).json({ error: "Impossibile eliminare l'unico amministratore" });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
