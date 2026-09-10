import { db } from '../db';
import type { AuditLogEntry } from '../types';

/**
 * Maschera il codice fiscale per il log: conserva solo le ultime 4 posizioni,
 * sufficienti per correlare un ticket/segnalazione senza esporre il dato completo.
 */
export function maskCodiceFiscale(cf: string): string {
  if (cf.length <= 4) return '*'.repeat(cf.length);
  return `${'*'.repeat(cf.length - 4)}${cf.slice(-4)}`;
}

/** Scrive una riga di audit immutabile. Non logga MAI dati anagrafici restituiti da ANPR. */
export function log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  db.prepare(
    `INSERT INTO audit_log (operatore, servizio, modalita, motivazione, esito, dettaglio_errore, cf_mascherato)
     VALUES (@operatore, @servizio, @modalita, @motivazione, @esito, @dettaglioErrore, @cfMascherato)`
  ).run({
    operatore: entry.operatore,
    servizio: entry.servizio,
    modalita: entry.modalita,
    motivazione: entry.motivazione,
    esito: entry.esito,
    dettaglioErrore: entry.dettaglioErrore,
    cfMascherato: entry.cfMascherato,
  });
}
