import { getPurposeId } from './settings.service';
import { requestVoucher, type TokenDigest } from './pdnd.service';
import type { AnprServiceCode, CachedVoucher } from '../types';

/** Cache in memoria del processo: persa al riavvio (comportamento accettabile, il voucher è di breve durata). */
const cache = new Map<string, CachedVoucher>();

/** Margine di sicurezza: rinnova il voucher se mancano meno di 60s alla scadenza dichiarata da PDND. */
const RENEW_MARGIN_MS = 60_000;

/**
 * Restituisce un voucher valido per il servizio indicato, riusando quello in cache
 * se non è prossimo alla scadenza, altrimenti ne richiede uno nuovo a PDND.
 */
export async function getVoucher(serviceCode: AnprServiceCode, digest?: TokenDigest): Promise<string> {
  // Con il pattern di Audit PDND il voucher è legato al JWS del Tracking Evidence
  // tramite il claim `digest`. Poiché l'evidence contiene un jti che cambia a ogni
  // richiesta, il digest cambia sempre: la cache non è riutilizzabile, quindi quando
  // un digest è presente si richiede sempre un voucher fresco.
  if (digest !== undefined) {
    return (await requestVoucher(serviceCode, digest)).access_token;
  }

  const purposeId = getPurposeId(serviceCode);
  const cached = cache.get(purposeId);

  if (cached && cached.expiresAtEpochMs - Date.now() > RENEW_MARGIN_MS) {
    return cached.token;
  }

  const voucher = await requestVoucher(serviceCode);

  cache.set(purposeId, {
    token: voucher.access_token,
    expiresAtEpochMs: Date.now() + voucher.expires_in * 1000,
  });

  return voucher.access_token;
}

/** Da invocare quando la configurazione PDND cambia (nuova chiave/client), per evitare token stantii. */
export function clearVoucherCache(): void {
  cache.clear();
}
