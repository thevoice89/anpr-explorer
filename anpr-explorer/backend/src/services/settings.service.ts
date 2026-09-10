import { z } from 'zod';
import { db } from '../db';
import { decrypt, encrypt } from './crypto.service';
import type {
  AnprServiceCode,
  PdndEnvironment,
  PdndSettingsPlain,
  PdndSettingsPublicView,
  PurposeMapEntry,
} from '../types';

const ANPR_SERVICE_CODES: AnprServiceCode[] = ['C030', 'C020', 'C021'];

export const settingsInputSchema = z.object({
  clientId: z.string().uuid('client_id deve essere un UUID valido'),
  // kid è mostrato mascherato in lettura: opzionale in update per non forzare a riscriverlo ogni volta.
  kid: z.string().min(1).optional(),
  // Campo write-only: opzionale in update se non si vuole sostituire la chiave esistente.
  privateKeyPem: z.string().min(1).optional(),
  tokenEndpoint: z.string().url('tokenEndpoint deve essere un URL valido'),
  clientAssertionAudience: z.string().min(1, 'audience obbligatoria'),
  anprBaseUrl: z.string().url('anprBaseUrl deve essere un URL valido'),
  environment: z.enum(['collaudo', 'produzione']),
  purposeMap: z
    .array(
      z.object({
        serviceCode: z.enum(ANPR_SERVICE_CODES as [AnprServiceCode, ...AnprServiceCode[]]),
        purposeId: z.string().uuid('purposeId deve essere un UUID valido'),
      })
    )
    .default([]),
  /** Codice IPA del Comune (es. c_l219) — max 20 char, limite GovWay su userLocation. */
  ipaCode: z.string().max(20, 'ipaCode deve essere ≤ 20 caratteri').default(''),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;

interface SettingsRow {
  id: number;
  client_id: string | null;
  kid: string | null;
  private_key_encrypted: string | null;
  token_endpoint: string | null;
  client_assertion_audience: string | null;
  anpr_base_url: string | null;
  environment: PdndEnvironment | null;
  ipa_code: string | null;
}

function readRow(): SettingsRow | undefined {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
}

function readPurposeMap(): PurposeMapEntry[] {
  const rows = db
    .prepare('SELECT service_code as serviceCode, purpose_id as purposeId FROM purpose_map')
    .all() as PurposeMapEntry[];
  return rows;
}

/** Restituisce la configurazione PDND in chiaro (chiave privata decifrata). USO ESCLUSIVO BACKEND. */
export function getSettingsPlain(): PdndSettingsPlain | null {
  const row = readRow();
  if (!row || !row.client_id || !row.private_key_encrypted) {
    return null;
  }

  return {
    clientId: row.client_id,
    kid: row.kid ?? '',
    privateKeyPem: decrypt(row.private_key_encrypted),
    tokenEndpoint: row.token_endpoint ?? '',
    clientAssertionAudience: row.client_assertion_audience ?? '',
    anprBaseUrl: row.anpr_base_url ?? '',
    environment: row.environment ?? 'collaudo',
    purposeMap: readPurposeMap(),
    ipaCode: row.ipa_code ?? '',
  };
}

/** Vista pubblica: nessun segreto in chiaro, mai. */
export function getSettingsPublicView(): PdndSettingsPublicView {
  const row = readRow();
  const purposeMap = readPurposeMap();

  if (!row || !row.client_id) {
    return {
      configured: false,
      hasPrivateKey: false,
      clientId: null,
      kidMasked: null,
      tokenEndpoint: null,
      clientAssertionAudience: null,
      anprBaseUrl: null,
      environment: null,
      purposeMap,
      ipaCode: null,
    };
  }

  const hasPrivateKey = !!row.private_key_encrypted;

  return {
    configured: hasPrivateKey && !!row.token_endpoint && !!row.anpr_base_url,
    hasPrivateKey,
    clientId: row.client_id,
    kidMasked: maskKid(row.kid),
    tokenEndpoint: row.token_endpoint,
    clientAssertionAudience: row.client_assertion_audience,
    anprBaseUrl: row.anpr_base_url,
    environment: row.environment,
    purposeMap,
    ipaCode: row.ipa_code,
  };
}

function maskKid(kid: string | null): string | null {
  if (!kid) return null;
  if (kid.length <= 4) return '••••';
  return `••••${kid.slice(-4)}`;
}

/**
 * Salva/aggiorna la configurazione. Campi write-only (privateKeyPem, kid) sono opzionali
 * in update: se omessi vengono mantenuti i valori già salvati.
 */
export function saveSettings(input: SettingsInput): void {
  const existing = readRow();
  const encryptedKey = input.privateKeyPem
    ? encrypt(input.privateKeyPem)
    : existing?.private_key_encrypted ?? null;

  if (!encryptedKey) {
    throw new Error('Chiave privata mancante: obbligatoria alla prima configurazione');
  }

  const kid = input.kid ?? existing?.kid ?? null;
  if (!kid) {
    throw new Error('kid mancante: obbligatorio alla prima configurazione');
  }

  const upsert = db.prepare(`
    INSERT INTO settings (
      id, client_id, kid, private_key_encrypted, token_endpoint,
      client_assertion_audience, anpr_base_url, environment, ipa_code, updated_at
    ) VALUES (1, @clientId, @kid, @privateKeyEncrypted, @tokenEndpoint,
      @clientAssertionAudience, @anprBaseUrl, @environment, @ipaCode, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      client_id = excluded.client_id,
      kid = excluded.kid,
      private_key_encrypted = excluded.private_key_encrypted,
      token_endpoint = excluded.token_endpoint,
      client_assertion_audience = excluded.client_assertion_audience,
      anpr_base_url = excluded.anpr_base_url,
      environment = excluded.environment,
      ipa_code = excluded.ipa_code,
      updated_at = datetime('now')
  `);

  const transaction = db.transaction(() => {
    upsert.run({
      clientId: input.clientId,
      kid,
      privateKeyEncrypted: encryptedKey,
      tokenEndpoint: input.tokenEndpoint,
      clientAssertionAudience: input.clientAssertionAudience,
      anprBaseUrl: input.anprBaseUrl,
      environment: input.environment,
      ipaCode: input.ipaCode ?? '',
    });

    db.prepare('DELETE FROM purpose_map').run();
    const insertPurpose = db.prepare(
      'INSERT INTO purpose_map (service_code, purpose_id) VALUES (?, ?)'
    );
    for (const entry of input.purposeMap) {
      insertPurpose.run(entry.serviceCode, entry.purposeId);
    }
  });

  transaction();
}

export function getPurposeId(serviceCode: AnprServiceCode): string {
  const row = db
    .prepare('SELECT purpose_id as purposeId FROM purpose_map WHERE service_code = ?')
    .get(serviceCode) as { purposeId: string } | undefined;

  if (!row) {
    throw new Error(
      `Nessun purposeId configurato per il servizio ${serviceCode}. Configuralo in Impostazioni.`
    );
  }
  return row.purposeId;
}
