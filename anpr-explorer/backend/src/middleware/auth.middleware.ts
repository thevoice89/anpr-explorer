import type { NextFunction, Request, Response } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAuthenticated) {
    next();
    return;
  }
  res.status(401).json({ error: 'Non autenticato' });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.isAuthenticated) {
    res.status(401).json({ error: 'Non autenticato' });
    return;
  }
  if (req.session.role !== 'admin') {
    res.status(403).json({ error: 'Accesso riservato agli amministratori' });
    return;
  }
  next();
}
