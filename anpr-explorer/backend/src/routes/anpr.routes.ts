import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { consultaResidenza, consultaStatoFamiglia } from '../services/anpr.service';
import { log, maskCodiceFiscale } from '../services/audit.service';

const router = Router();

router.use(requireAuth);

// Formato standard del Codice Fiscale italiano: 16 caratteri alfanumerici.
const CF_REGEX = /^[A-Za-z0-9]{16}$/;

const consultaSchema = z.object({
  codiceFiscale: z.string().regex(CF_REGEX, 'Codice fiscale non valido'),
  motivazione: z.string().min(3, 'Motivazione/numero pratica obbligatori'),
});

/** Modalità "Consultazione residenza" (C030 → C020): restituisce solo i campi di residenza. */
router.post('/consulta', async (req, res, next) => {
  const operatore = req.session.username ?? 'sconosciuto';
  const parsed = consultaSchema.safeParse(req.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const { codiceFiscale, motivazione } = parsed.data;

  try {
    const result = await consultaResidenza(codiceFiscale, motivazione, operatore);

    log({
      operatore,
      servizio: 'C020',
      modalita: 'consultazione',
      motivazione,
      esito: 'OK',
      dettaglioErrore: null,
      cfMascherato: maskCodiceFiscale(codiceFiscale),
    });

    res.json(result);
  } catch (err) {
    log({
      operatore,
      servizio: 'C020',
      modalita: 'consultazione',
      motivazione,
      esito: 'ERRORE',
      dettaglioErrore: err instanceof Error ? err.message : 'errore sconosciuto',
      cfMascherato: maskCodiceFiscale(codiceFiscale),
    });
    next(err);
  }
});

const statoFamigliaSchema = z.object({
  codiceFiscale: z.string().regex(CF_REGEX, 'Codice fiscale non valido'),
  motivazione: z.string().min(3, 'Motivazione/numero pratica obbligatori'),
});

/** C021: stato di famiglia / nucleo familiare. */
router.post('/stato-famiglia', async (req, res, next) => {
  const operatore = req.session.username ?? 'sconosciuto';
  const parsed = statoFamigliaSchema.safeParse(req.body);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const { codiceFiscale, motivazione } = parsed.data;

  try {
    const result = await consultaStatoFamiglia(codiceFiscale, motivazione, operatore);

    log({
      operatore,
      servizio: 'C021',
      // Per un deceduto è stata fatta anche la C021 storica al giorno prima del decesso.
      modalita: result.decesso ? 'stato-famiglia-decesso' : 'stato-famiglia',
      motivazione,
      esito: 'OK',
      dettaglioErrore: null,
      cfMascherato: maskCodiceFiscale(codiceFiscale),
    });

    res.json(result);
  } catch (err) {
    log({
      operatore,
      servizio: 'C021',
      modalita: 'stato-famiglia',
      motivazione,
      esito: 'ERRORE',
      dettaglioErrore: err instanceof Error ? err.message : 'errore sconosciuto',
      cfMascherato: maskCodiceFiscale(codiceFiscale),
    });
    next(err);
  }
});

export default router;
