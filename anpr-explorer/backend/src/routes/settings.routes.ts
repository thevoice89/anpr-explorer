import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { getSettingsPublicView, saveSettings, settingsInputSchema } from '../services/settings.service';
import { clearVoucherCache } from '../services/voucherCache.service';
import { requestVoucher } from '../services/pdnd.service';
import type { AnprServiceCode } from '../types';

const router = Router();

router.use(requireAuth);

const ANPR_SERVICE_CODES: AnprServiceCode[] = ['C030', 'C020', 'C021'];

/** GET: vista pubblica, nessun segreto in chiaro (write-only). */
router.get('/', (_req, res) => {
  res.json(getSettingsPublicView());
});

/** PUT: crea/aggiorna la configurazione. Se privateKeyPem è omesso, la chiave esistente resta invariata. */
router.put('/', (req, res, next) => {
  try {
    const input = settingsInputSchema.parse(req.body);
    saveSettings(input);
    clearVoucherCache(); // la configurazione (client/chiave) può essere cambiata: invalida i voucher in cache
    res.json(getSettingsPublicView());
  } catch (err) {
    next(err);
  }
});

const testSchema = z.object({
  serviceCode: z.enum(ANPR_SERVICE_CODES as [AnprServiceCode, ...AnprServiceCode[]]),
});

/** Verifica end-to-end: prova a ottenere un voucher reale da PDND senza mai restituirlo al client. */
router.post('/test', async (req, res, next) => {
  try {
    const { serviceCode } = testSchema.parse(req.body);
    await requestVoucher(serviceCode);
    res.json({ ok: true, message: 'Voucher ottenuto correttamente da PDND' });
  } catch (err) {
    next(err);
  }
});

export default router;
