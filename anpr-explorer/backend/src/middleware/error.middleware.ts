import type { NextFunction, Request, Response } from 'express';
import { isAxiosError } from 'axios';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';

/**
 * Middleware di errore centralizzato. Mappa gli errori PDND/ANPR (via axios) in
 * messaggi chiari per l'operatore, senza MAI esporre stack trace, chiavi o token
 * nella risposta HTTP. In sviluppo mostra il messaggio originale per facilitare il debug.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // eslint-disable-next-line no-console
  console.error('[ERROR]', err instanceof Error ? err.message : err);

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Dati non validi', dettagli: err.flatten().fieldErrors });
    return;
  }

  if (isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      res.status(502).json({
        error: 'Voucher PDND non valido o e-service non abilitato per questa finalità',
      });
      return;
    }
    if (status === 404) {
      res.status(404).json({ error: 'Soggetto non trovato in ANPR' });
      return;
    }
    if (status === 429) {
      res.status(429).json({ error: 'Limite di chiamate PDND raggiunto, riprovare più tardi' });
      return;
    }
    res.status(502).json({ error: "Errore nella comunicazione con l'erogatore PDND/ANPR" });
    return;
  }

  const message = err instanceof Error ? err.message : 'Errore interno';
  res.status(500).json({ error: isProduction ? 'Errore interno del server' : message });
}
