export type UserRole = 'admin' | 'viewer';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at: string;
}

export type AnprServiceCode = 'C030' | 'C020' | 'C021';
export type PdndEnvironment = 'collaudo' | 'produzione';

export interface PurposeMapEntry {
  serviceCode: AnprServiceCode;
  purposeId: string;
}

/** Vista pubblica della configurazione: nessun segreto in chiaro (write-only su backend). */
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

/** Payload di salvataggio: kid e privateKeyPem sono opzionali in update (write-only). */
export interface SettingsInput {
  clientId: string;
  kid?: string;
  privateKeyPem?: string;
  tokenEndpoint: string;
  clientAssertionAudience: string;
  anprBaseUrl: string;
  environment: PdndEnvironment;
  purposeMap: PurposeMapEntry[];
  ipaCode?: string;
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
  /** Data (YYYY-MM-DD) a cui si riferisce la composizione del nucleo. */
  dataRiferimento: string;
  componenti: ComponenteFamiglia[];
  /** Presente se il soggetto è deceduto: `componenti` è allora il nucleo al giorno prima del decesso. */
  decesso: { dataDecesso: string; erroreNucleoStorico: string | null } | null;
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
  /** true se ANPR segnala il soggetto come deceduto. */
  deceduto: boolean;
  dataDecesso: string | null;
  /** Riferimento operazione ANPR, utile per ticket/assistenza. */
  idOperazioneANPR: string | null;
}
