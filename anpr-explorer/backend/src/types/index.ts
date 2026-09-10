/**
 * Codici dei servizi (e-service) ANPR supportati dall'applicazione.
 * Verificati live sul Catalogo PDND (Collaudo) il 22/06/2026 per il Comune di
 * Trezzo Sull'Adda: C030 e C020 hanno l'attributo "Comuni e loro Consorzi e
 * Associazioni" tra quelli richiesti; C008 ha "Pubbliche Amministrazioni".
 * NB: C033 (servizioAccertamentoResidenzaSenzaDecesso) NON è utilizzabile da
 * un Comune — la sua unica variante richiede l'attributo "Ministero delle
 * infrastrutture e dei trasporti". Per i dati di residenza si usa C020.
 */
export type UserRole = 'admin' | 'viewer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

export type AnprServiceCode = 'C030' | 'C020' | 'C021';

export interface PurposeMapEntry {
  serviceCode: AnprServiceCode;
  purposeId: string;
}

export type PdndEnvironment = 'collaudo' | 'produzione';

/**
 * Configurazione PDND così come persistita (in chiaro, lato applicativo).
 * La chiave privata qui è già DECIFRATA: questo tipo non deve mai
 * essere serializzato/loggato/restituito da una rotta HTTP.
 */
export interface PdndSettingsPlain {
  clientId: string;
  kid: string;
  privateKeyPem: string;
  tokenEndpoint: string;
  clientAssertionAudience: string;
  anprBaseUrl: string;
  environment: PdndEnvironment;
  purposeMap: PurposeMapEntry[];
  /** Codice IPA del Comune (es. c_l219) — usato come userLocation nel TrackingEvidence ModI (max 20 char). */
  ipaCode: string;
}

/** Vista pubblica (write-only sui segreti) restituita dalle API di lettura. */
export interface PdndSettingsPublicView {
  configured: boolean;
  hasPrivateKey: boolean;
  clientId: string | null;
  kidMasked: string | null;
  tokenEndpoint: string | null;
  clientAssertionAudience: string | null;
  anprBaseUrl: string | null;
  environment: PdndEnvironment | null;
  purposeMap: PurposeMapEntry[];
  ipaCode: string | null;
}

export interface VoucherResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
}

export interface CachedVoucher {
  token: string;
  expiresAtEpochMs: number;
}

export interface ConsultaResidenzaRequest {
  codiceFiscale: string;
  motivazione: string;
}

export interface ResidenzaStorica {
  comune: string;
  indirizzo: string;
  dataDecorrenza: string | null;
  dataFine: string | null;
}

export interface ConsultaResidenzaResponse {
  idANPR: string;
  codiceFiscale: string;
  cognome: string;
  nome: string;
  dataNascita: string | null;
  sesso: string | null;
  comuneNascita: string;
  /** true se il soggetto è iscritto AIRE (residente all'estero) */
  isAIRE: boolean;
  /** Stato estero di residenza AIRE (es. "GERMANIA"), null se residente in Italia */
  statoEstero: string | null;
  comune: string;
  indirizzo: string;
  dataDecorrenza: string | null;
  storicoResidenze: ResidenzaStorica[];
  /** true se ANPR segnala il soggetto come deceduto (vedi infoSoggettoEnte, chiave "Data decesso"). */
  deceduto: boolean;
  dataDecesso: string | null;
  /** Riferimento operazione ANPR (idOperazioneANPR), utile per ticket/assistenza. */
  idOperazioneANPR: string | null;
}

export interface ComponenteFamiglia {
  codiceFiscale: string;
  idANPR: string;
  cognome: string;
  nome: string;
  dataNascita: string | null;
  sesso: string | null;
  comuneNascita: string;
  legame: string;
  deceduto: boolean;
  dataDecesso: string | null;
}

export interface StatoFamigliaResponse {
  idANPR: string;
  codiceFiscale: string;
  componenti: ComponenteFamiglia[];
}

export interface AuditLogEntry {
  id?: number;
  timestamp: string;
  operatore: string;
  servizio: AnprServiceCode | 'LOGIN';
  modalita: string | null;
  motivazione: string | null;
  esito: 'OK' | 'ERRORE';
  dettaglioErrore: string | null;
  /** Codice fiscale offuscato (solo ultime 4 cifre) per correlazione senza esporre il dato. */
  cfMascherato: string | null;
}

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
    username?: string;
    role?: UserRole;
  }
}
