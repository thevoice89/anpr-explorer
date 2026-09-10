import { Router } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const rows = db
    .prepare(
      `SELECT id, timestamp, operatore, servizio, modalita, motivazione, esito,
              dettaglio_errore as dettaglioErrore, cf_mascherato as cfMascherato
       FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )
    .all(limit, offset);

  const total = (db.prepare('SELECT COUNT(*) as n FROM audit_log').get() as { n: number }).n;

  res.json({ rows, total, page, limit });
});

export default router;
