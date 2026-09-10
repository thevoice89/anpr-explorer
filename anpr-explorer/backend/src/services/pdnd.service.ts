import crypto from 'node:crypto';
import axios from 'axios';
import { SignJWT, importPKCS8 } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { getPurposeId, getSettingsPlain } from './settings.service';
import type { AnprServiceCode, VoucherResponse } from '../types';

type SupportedAlg = 'RS256' | 'ES256';

/**
 * Digest del JWS di Agid-JWT-TrackingEvidence da legare alla Client Assertion
 * quando il voucher veicola informazioni aggiuntive (pattern di Audit PDND).
 * Formato richiesto dal Manuale Operativo PDND: { alg: "SHA256", value: <hex> }.
 */
export interface TokenDigest {
  alg: 'SHA256';
  value: string; // SHA-256 del JWS, esadecimale a 64 caratteri
}

/** Deduce l'algoritmo di firma dal tipo di chiave privata caricata (RSA -> RS256, EC -> ES256). */
function detectAlgorithm(privateKeyPem: string): SupportedAlg {
  const keyObject = crypto.createPrivateKey(privateKeyPem);
  if (keyObject.asymmetricKeyType === 'rsa') return 'RS256';
  if (keyObject.asymmetricKeyType === 'ec') return 'ES256';
  throw new Error(
    `Tipo di chiave privata non supportato (${keyObject.asymmetricKeyType}). Usare RSA 2048+ o EC P-256.`
  );
}

/**
 * Costruisce e firma la Client Assertion JWT richiesta da PDND per autenticare
 * il client in fase di richiesta voucher (OAuth2 client_credentials + RFC 7521/7523).
 * La chiave privata viene usata solo in memoria, mai esposta o loggata.
 */
export async function buildClientAssertion(
  serviceCode: AnprServiceCode,
  digest?: TokenDigest
): Promise<string> {
  const settings = getSettingsPlain();
  if (!settings) {
    throw new Error('Configurazione PDND mancante: completare la sezione Impostazioni');
  }

  const purposeId = getPurposeId(serviceCode);
  const alg = detectAlgorithm(settings.privateKeyPem);
  const privateKey = await importPKCS8(settings.privateKeyPem, alg);

  const now = Math.floor(Date.now() / 1000);

  // claim `digest`: lega il JWS di Agid-JWT-TrackingEvidence a questa richiesta voucher
  // (Manuale Operativo PDND, "Voucher con informazioni aggiuntive"). PDND verifica che
  // l'hash dell'header inviato a runtime coincida con value.
  return new SignJWT({ purposeId, ...(digest ? { digest } : {}) })
    .setProtectedHeader({ alg, kid: settings.kid, typ: 'JWT' })
    .setIssuer(settings.clientId)
    .setSubject(settings.clientId)
    .setAudience(settings.clientAssertionAudience)
    .setJti(uuidv4())
    .setIssuedAt(now)
    .setExpirationTime(now + 600) // 10 minuti, in linea con le indicazioni PDND
    .sign(privateKey);
}

/**
 * Richiede un voucher (access token) al server di autorizzazione PDND.
 * Body in application/x-www-form-urlencoded come da specifica OAuth2 client_credentials.
 */
export async function requestVoucher(
  serviceCode: AnprServiceCode,
  digest?: TokenDigest
): Promise<VoucherResponse> {
  const settings = getSettingsPlain();
  if (!settings) {
    throw new Error('Configurazione PDND mancante: completare la sezione Impostazioni');
  }

  const clientAssertion = await buildClientAssertion(serviceCode, digest);

  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_assertion: clientAssertion,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    grant_type: 'client_credentials',
  });

  try {
    const response = await axios.post<VoucherResponse>(settings.tokenEndpoint, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10_000,
    });

    return response.data;
  } catch (err) {
    // Decora l'errore del token endpoint PDND col dettaglio applicativo (es. codice
    // 015-0008 e correlationId), altrimenti axios riporta solo "status code 4xx".
    if (axios.isAxiosError(err) && err.response?.data) {
      const data = err.response.data as {
        detail?: string;
        errors?: Array<{ code?: string; detail?: string }>;
        correlationId?: string;
      };
      const first = data.errors?.[0];
      const base =
        [first?.code, first?.detail].filter(Boolean).join(' ') ||
        data.detail ||
        `Errore voucher PDND: HTTP ${err.response.status}`;
      throw new Error(
        data.correlationId ? `${base} (correlationId: ${data.correlationId})` : base
      );
    }
    throw err;
  }
}
