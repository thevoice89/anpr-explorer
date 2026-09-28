import crypto from 'node:crypto';
import axios from 'axios';
import { SignJWT, importPKCS8 } from 'jose';
import { getSettingsPlain, getPurposeId } from './settings.service';
import { getVoucher } from './voucherCache.service';
import type { TokenDigest } from './pdnd.service';
import type { AnprServiceCode, ConsultaResidenzaResponse, ResidenzaStorica, StatoFamigliaResponse, ComponenteFamiglia } from '../types';

/**
 * Path di ciascun e-service, confermati dalla specifica OpenAPI scaricata dal catalogo
 * PDND il 22/06/2026 (una per servizio: C030, C008, C020). Ogni e-service espone
 * un'unica operazione POST /anpr-service-e002 sotto un server URL che incorpora il
 * nome del servizio.
 *
 * `anprBaseUrl` (impostazione utente) deve contenere SOLO il prefisso comune, senza
 * slash finale, es. in Collaudo:
 *   https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND
 * in Produzione:
 *   https://modipa.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND
 */
const ANPR_SERVICE_PATHS: Record<AnprServiceCode, string> = {
  C030: '/C030-servizioAccertamentoIdUnicoNazionale/v1/anpr-service-e002',
  C020: '/C020-servizioAccertamentoResidenza/v1/anpr-service-e002',
  C021: '/C021-servizioAccertamentoStatoFamiglia/v1/anpr-service-e002',
};

/**
 * Audience ModI da inserire nel claim `aud` dei JWS Agid-JWT-Signature e
 * Agid-JWT-TrackingEvidence. ATTENZIONE: NON coincide con l'URL di chiamata.
 * Verificato sul back-office PDND (Collaudo, 25/06/2026), l'audience dichiarata
 * dall'e-service differisce dal "Server URL" in due punti:
 *   - usa il segmento `MinInternoPortaANPR` (SENZA il suffisso `-PDND`);
 *   - termina a `/v1` (SENZA l'operazione `/anpr-service-e002`).
 * Es. C030 -> https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR/C030-servizioAccertamentoIdUnicoNazionale/v1
 * Derivata dall'URL base così da restare valida anche in Produzione (host diverso,
 * stessa struttura). Mettere nell'aud l'URL di chiamata fa rifiutare la richiesta da
 * GovWay con "InteroperabilityInvalidRequest".
 */
function buildServiceAudience(baseUrl: string, serviceCode: AnprServiceCode): string {
  const audienceBase = baseUrl.replace('MinInternoPortaANPR-PDND', 'MinInternoPortaANPR');
  const servicePath = ANPR_SERVICE_PATHS[serviceCode].replace('/anpr-service-e002', '');
  return `${audienceBase}${servicePath}`;
}

/**
 * Header di sicurezza dichiarati nel blocco `security` di livello root di ciascuna
 * specifica OpenAPI (non nell'operazione, che mostra solo bearerAuth: gli header
 * aggiuntivi vanno comunque inviati secondo i pattern ModI sottostanti).
 * - Tutti e tre richiedono Agid-JWT-Signature (INTEGRITY_REST_02): inviato sempre.
 * - Solo C020 elenca esplicitamente anche Agid-JWT-TrackingEvidence (AUDIT_REST_02);
 *   le specifiche di C008/C030 non lo richiedono a livello root.
 */
const REQUIRES_TRACKING_EVIDENCE: Record<AnprServiceCode, boolean> = {
  C030: true,
  C020: true,
  C021: true,
};

function detectAlgorithmFromPem(pem: string): 'RS256' | 'ES256' {
  const keyObject = crypto.createPrivateKey(pem);
  if (keyObject.asymmetricKeyType === 'rsa') return 'RS256';
  if (keyObject.asymmetricKeyType === 'ec') return 'ES256';
  throw new Error(`Tipo di chiave privata non supportato (${keyObject.asymmetricKeyType})`);
}

/**
 * Header "Agid-JWT-TrackingEvidence" (pattern ModI AUDIT_REST_02). Claim confermati
 * dalla specifica ANPR: `userID`, `userLocation`, `LoA`.
 * // VERIFICARE: `LoA` (Level of Assurance) ha pieno significato solo se l'operatore
 * si autentica con SPID/CIE; il login admin attuale è username+password, quindi qui
 * si usa un valore placeholder — da rivedere se si introduce SPID per gli operatori.
 */
async function buildTrackingEvidence(
  userID: string,
  audience: string,
  serviceCode: AnprServiceCode
): Promise<string> {
  const settings = getSettingsPlain();
  if (!settings) throw new Error('Configurazione PDND mancante');

  const alg = detectAlgorithmFromPem(settings.privateKeyPem);
  const privateKey = await importPKCS8(settings.privateKeyPem, alg);
  const now = Math.floor(Date.now() / 1000);
  // GovWay produzione applica tolleranza zero su iat: anticipiamo di 5s per coprire
  // micro-sfasamenti di orologio tra il container e i server ANPR/GovWay.
  const iat = now - 5;

  return new SignJWT({
    // Claim standard obbligatori di un JWS ModI: GovWay respinge l'evidence che ne è sprovvista.
    iss: settings.clientId,
    sub: settings.clientId,
    aud: audience,
    jti: crypto.randomUUID(), // anti-replay; cambia a ogni richiesta -> digest sempre diverso
    purposeId: getPurposeId(serviceCode), // richiesto nell'audit assertion ANPR (cfr. GitHub anticorruzione/npa#757)
    userID,
    userLocation: settings.ipaCode || 'c_l411',
    LoA: 'LoA2', // VERIFICARE: livello reale, dipende dal metodo di autenticazione dell'operatore
  })
    .setProtectedHeader({ alg, kid: settings.kid, typ: 'JWT' })
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .setExpirationTime(iat + 300)
    .sign(privateKey);
}

/**
 * Calcola l'header HTTP "Digest" (RFC 3230) del body, come richiesto dal pattern
 * INTEGRITY_REST_02. Stesso valore va sia nell'header HTTP `Digest` sia, firmato,
 * nel claim `signed_headers` di `Agid-JWT-Signature`.
 */
function computeDigestHeader(bodyString: string): string {
  const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
  return `SHA-256=${hash}`;
}

/**
 * Header "Agid-JWT-Signature" (pattern ModI INTEGRITY_REST_02). Struttura confermata
 * dalle "Linee Guida sull'interoperabilità tecnica delle Pubbliche Amministrazioni —
 * Pattern di sicurezza" (AGID, allegato 2), sezione 5.3 "[INTEGRITY_REST_02] Integrità
 * del payload delle request REST in PDND", incluso l'esempio numerico in 5.3.3:
 * - JOSE Header: alg, typ=JWT, kid (identificativo della chiave pubblica su PDND)
 * - claim `aud`: l'AUDIENCE dichiarata dell'e-service (NON l'URL di chiamata) —
 *   cfr. buildServiceAudience: senza `-PDND`, fino a `/v1`
 * - claim `iat`/`nbf`/`exp`: validità del token
 * - claim `signed_headers`: array di oggetti, uno per ciascun header HTTP protetto,
 *   con il nome dell'header IN MINUSCOLO come chiave (es. {"digest": "SHA-256=..."},
 *   {"content-type": "application/json"})
 */
async function buildIntegritySignature(audience: string, digestHeaderValue: string): Promise<string> {
  const settings = getSettingsPlain();
  if (!settings) throw new Error('Configurazione PDND mancante');

  const alg = detectAlgorithmFromPem(settings.privateKeyPem);
  const privateKey = await importPKCS8(settings.privateKeyPem, alg);
  const now = Math.floor(Date.now() / 1000);
  const iat = now - 5;

  return new SignJWT({
    aud: audience,
    sub: settings.clientId,
    signed_headers: [{ digest: digestHeaderValue }, { 'content-type': 'application/json' }],
  })
    .setProtectedHeader({ alg, kid: settings.kid, typ: 'JWT' })
    .setIssuer(settings.clientId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .setExpirationTime(iat + 300)
    .sign(privateKey);
}

/** Forma comune a tutte le richieste E002, confermata dalle 3 specifiche OpenAPI. */
interface DatiRichiestaE002 {
  dataRiferimentoRichiesta: string; // YYYY-MM-DD
  motivoRichiesta: string;
  casoUso: string;
}

/**
 * `dataRiferimento` (YYYY-MM-DD) è la data a cui ANPR riferisce la scheda anagrafica:
 * di default oggi, ma può essere una data passata per accertamenti di tipo storico
 * (documentazione Sogei C021, 20/12/2024).
 */
function buildDatiRichiesta(
  serviceCode: AnprServiceCode,
  motivazione: string,
  dataRiferimento: string = new Date().toISOString().slice(0, 10)
): DatiRichiestaE002 {
  return {
    dataRiferimentoRichiesta: dataRiferimento,
    motivoRichiesta: motivazione,
    casoUso: serviceCode,
  };
}

/** Identificativo univoco di operazione: la specifica C008 lo richiede "numerico e crescente". */
function buildIdOperazioneClient(): string {
  return Date.now().toString();
}

interface E002ErrorItem {
  codiceErroreAnomalia?: string;
  testoErroreAnomalia?: string;
}

interface E002Soggetto {
  identificativi?: { idANPR?: string; codiceFiscale?: string };
  generalita?: {
    cognome?: string;
    nome?: string;
    dataNascita?: string;
    sesso?: string;
    codiceFiscale?: { codFiscale?: string };
    luogoNascita?: { comune?: { nomeComune?: string; siglaProvinciaIstat?: string } };
    // Alias usato in alcuni e-service (C020)
    comuneNascita?: { nomeComune?: string; siglaProvinciaIstat?: string };
    /** "Y"/"N" — flag esplicito, più affidabile dell'euristica basata su residenza/localitaEstera. */
    soggettoAIRE?: string;
  };
  legameSoggetto?: {
    tipoLegame?: string;
    codiceLegame?: string;
    dataDecorrenza?: string;
  };
  residenza?: Array<{
    indirizzo?: {
      cap?: string;
      comune?: { nomeComune?: string; siglaProvinciaIstat?: string };
      toponimo?: { denominazioneToponimo?: string; specie?: string };
      numeroCivico?: { numero?: string };
    };
    dataDecorrenzaResidenza?: string;
    dataFineResidenza?: string;
  }>;
  // Residenza estera per soggetti iscritti AIRE (Italiani Residenti all'Estero).
  // ANPR restituisce questo blocco al posto di `residenza` quando il soggetto è AIRE.
  localitaEstera?: {
    dataDecorrenzaResidenzaEstera?: string;
    nomeStato?: string;
    localita?: string;
    indirizzo?: string;
  };
  // Blocco generico chiave/valore usato da ANPR per informazioni aggiuntive sul
  // soggetto. Verificato live il 30/07/2026: il decesso è segnalato qui con
  // {chiave: "Data decesso", id: "1015", valoreData: "YYYY-MM-DD"} — non esiste
  // un campo dedicato "deceduto"/"dataDecesso" nello schema.
  infoSoggettoEnte?: Array<{ chiave?: string; id?: string; valoreData?: string; valoreTesto?: string }>;
  // Blocco dedicato previsto dallo schema E002 (TipoDatiEvento): non osservato su C020,
  // ma dichiarato nello YAML — letto come alternativa a infoSoggettoEnte.
  datiDecesso?: { dataEvento?: string };
}

/** Estrae la data di decesso (blocco datiDecesso o voce "Data decesso" di infoSoggettoEnte). */
function estraiDataDecesso(soggetto?: E002Soggetto): string | null {
  if (soggetto?.datiDecesso?.dataEvento) return soggetto.datiDecesso.dataEvento;
  const voce = soggetto?.infoSoggettoEnte?.find((v) => /decesso/i.test(v.chiave ?? ''));
  return voce?.valoreData ?? null;
}

interface E002Response {
  idOperazioneANPR?: string;
  listaSoggetti?: { datiSoggetto?: E002Soggetto[] };
  listaAnomalie?: E002ErrorItem[];
  listaErrori?: E002ErrorItem[];
}

/**
 * Invoca l'operazione comune `POST /anpr-service-e002` di un e-service ANPR,
 * applicando gli header di sicurezza richiesti da quel servizio specifico.
 */
async function callE002(
  serviceCode: AnprServiceCode,
  body: Record<string, unknown>,
  userID: string
): Promise<E002Response> {
  const settings = getSettingsPlain();
  if (!settings) {
    throw new Error('Configurazione PDND mancante: completare la sezione Impostazioni');
  }

  const url = `${settings.anprBaseUrl}${ANPR_SERVICE_PATHS[serviceCode]}`;
  // L'audience dei JWS ModI NON è l'URL di chiamata: vedi buildServiceAudience.
  const audience = buildServiceAudience(settings.anprBaseUrl, serviceCode);

  // Serializzato una sola volta: lo stesso identico bytes va sia nel calcolo del
  // Digest sia nel body effettivamente trasmesso (axios non deve riserializzarlo).
  const bodyString = JSON.stringify(body);

  const headers: Record<string, string> = {};

  // Il Tracking Evidence (AUDIT_REST_02) va costruito PRIMA del voucher: il suo digest
  // viene legato alla Client Assertion che richiede il voucher (claim `digest`).
  let trackingToken: string | undefined;
  let digest: TokenDigest | undefined;
  if (REQUIRES_TRACKING_EVIDENCE[serviceCode]) {
    trackingToken = await buildTrackingEvidence(userID, audience, serviceCode);
    // Formato richiesto dal Manuale Operativo PDND: SHA-256 del JWS in esadecimale.
    digest = {
      alg: 'SHA256',
      value: crypto.createHash('sha256').update(trackingToken).digest('hex'),
    };
  }

  // digest è undefined per i servizi senza Audit: in quel caso getVoucher usa la cache.
  const voucher = await getVoucher(serviceCode, digest);

  const digestHeaderValue = computeDigestHeader(bodyString);
  const integrityJwt = await buildIntegritySignature(audience, digestHeaderValue);

  headers.Authorization = `Bearer ${voucher}`;
  headers['Content-Type'] = 'application/json';
  headers.Digest = digestHeaderValue;
  headers['Agid-JWT-Signature'] = integrityJwt;
  if (trackingToken) {
    headers['Agid-JWT-TrackingEvidence'] = trackingToken;
  }

  // Log payload (non firma) di ogni JWT per diagnosi 401
  const decodeJwt = (tok: string) => {
    try { return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); } catch { return null; }
  };
  // eslint-disable-next-line no-console
  console.error('[DEBUG JWT] url:', url);
  // eslint-disable-next-line no-console
  console.error('[DEBUG JWT] audience:', audience);
  // eslint-disable-next-line no-console
  console.error('[DEBUG JWT] voucher payload:', JSON.stringify(decodeJwt(voucher)));
  // eslint-disable-next-line no-console
  console.error('[DEBUG JWT] Agid-JWT-Signature payload:', JSON.stringify(decodeJwt(integrityJwt)));
  if (trackingToken) {
    // eslint-disable-next-line no-console
    console.error('[DEBUG JWT] Agid-JWT-TrackingEvidence payload:', JSON.stringify(decodeJwt(trackingToken)));
  }
  // eslint-disable-next-line no-console
  console.error('[DEBUG JWT] ora server (unix):', Math.floor(Date.now() / 1000));

  try {
    const response = await axios.post<E002Response>(url, bodyString, { headers, timeout: 15_000 });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      // eslint-disable-next-line no-console
      console.error(`[DEBUG] ${serviceCode} HTTP ${err.response.status} — body:`, JSON.stringify(err.response.data));
      // eslint-disable-next-line no-console
      console.error(`[DEBUG] ${serviceCode} headers risposta:`, JSON.stringify(err.response.headers));
      const data = (err.response.data ?? {}) as E002Response & {
        detail?: string;
        title?: string;
        govway_id?: string;
      };
      const errori = data.listaErrori ?? data.listaAnomalie ?? [];
      const codici = errori.map((e) => e.codiceErroreAnomalia).filter(Boolean);
      // EN122: soggetto non in ANPR. Per i cittadini AIRE (iscritti all'estero) C030
      // non restituisce risultati — la ricerca per CF non include il registro AIRE.
      if (serviceCode === 'C030' && codici.includes('EN122')) {
        throw new Error(
          'Soggetto non trovato in ANPR. ' +
          'I cittadini iscritti AIRE (residenti all\'estero) non sono ricercabili tramite il servizio C030: ' +
          'verificare se il soggetto è iscritto AIRE e consultare direttamente il registro comunale.'
        );
      }
      const messaggio = errori.map((e) => e.testoErroreAnomalia).filter(Boolean).join('; ');
      const base = messaggio || data.detail || data.title || `Errore ANPR ${serviceCode}: HTTP ${err.response.status}`;
      throw new Error(data.govway_id ? `${base} (govway_id: ${data.govway_id})` : base);
    }
    throw err;
  }
}

/**
 * C030: risolve il Codice Fiscale nell'ID ANPR (Identificativo Unico Nazionale).
 * Dal 18/04/2024 gli e-service ANPR su PDND richiedono l'ID ANPR come chiave di
 * ricerca al posto del codice fiscale: questo step è quindi obbligatorio prima
 * di qualunque accertamento/consultazione.
 */
export async function resolveIdAnpr(
  codiceFiscale: string,
  motivazione: string,
  operatore: string
): Promise<string> {
  const body = {
    idOperazioneClient: buildIdOperazioneClient(),
    criteriRicerca: { codiceFiscale },
    datiRichiesta: buildDatiRichiesta('C030', motivazione),
  };

  const result = await callE002('C030', body, operatore);
  const idAnpr = result.listaSoggetti?.datiSoggetto?.[0]?.identificativi?.idANPR;

  if (!idAnpr) {
    throw new Error('ID ANPR non trovato per il codice fiscale indicato');
  }
  return idAnpr;
}

/**
 * C020: accertamento residenza - risolve prima l'ID ANPR (C030), poi richiede i dati
 * di residenza. Restituisce dati anagrafici e di residenza del soggetto.
 *
 * NB: C033 (servizioAccertamentoResidenzaSenzaDecesso) NON è usabile da un Comune
 * — richiede l'attributo "Ministero delle infrastrutture e dei trasporti",
 * verificato live il 22/06/2026.
 */
export async function consultaResidenza(
  codiceFiscale: string,
  motivazione: string,
  operatore: string
): Promise<ConsultaResidenzaResponse> {
  const idAnpr = await resolveIdAnpr(codiceFiscale, motivazione, operatore);

  const body = {
    idOperazioneClient: buildIdOperazioneClient(),
    criteriRicerca: { idANPR: idAnpr },
    datiRichiesta: buildDatiRichiesta('C020', motivazione),
  };

  const result = await callE002('C020', body, operatore);
  const soggetto = result.listaSoggetti?.datiSoggetto?.[0];
  const residenza = soggetto?.residenza?.[0];
  const localitaEstera = soggetto?.localitaEstera;
  const generalita = soggetto?.generalita;

  // Flag esplicito quando presente; altrimenti euristica su residenza/localitaEstera.
  const isAIRE = generalita?.soggettoAIRE
    ? generalita.soggettoAIRE === 'Y'
    : !residenza && !!localitaEstera;

  const dataDecesso = estraiDataDecesso(soggetto);

  const tutteLeResidenze = soggetto?.residenza ?? [];
  const storicoResidenze: ResidenzaStorica[] = tutteLeResidenze.slice(1).map((r) => ({
    comune: formatComune(r.indirizzo?.comune),
    indirizzo: formatIndirizzo(r.indirizzo),
    dataDecorrenza: r.dataDecorrenzaResidenza ?? null,
    dataFine: r.dataFineResidenza ?? null,
  }));

  return {
    idANPR: idAnpr,
    codiceFiscale: generalita?.codiceFiscale?.codFiscale ?? soggetto?.identificativi?.codiceFiscale ?? codiceFiscale,
    cognome: generalita?.cognome ?? '',
    nome: generalita?.nome ?? '',
    dataNascita: generalita?.dataNascita ?? null,
    sesso: generalita?.sesso ?? null,
    comuneNascita: formatComune(generalita?.luogoNascita?.comune ?? generalita?.comuneNascita),
    isAIRE,
    statoEstero: localitaEstera?.nomeStato ?? null,
    comune: isAIRE
      ? [localitaEstera?.localita, localitaEstera?.nomeStato].filter(Boolean).join(' — ')
      : formatComune(residenza?.indirizzo?.comune),
    indirizzo: isAIRE ? localitaEstera?.indirizzo ?? '' : formatIndirizzo(residenza?.indirizzo),
    deceduto: !!dataDecesso,
    dataDecesso,
    dataDecorrenza: isAIRE
      ? localitaEstera?.dataDecorrenzaResidenzaEstera ?? null
      : residenza?.dataDecorrenzaResidenza ?? null,
    storicoResidenze,
    idOperazioneANPR: result.idOperazioneANPR ?? null,
  };
}

// Tabella 05 "Relazione di parentela - Famiglia" (docs.italia.it, ANPR, fonte Istat),
// usata quando tipoLegame è 3 (famiglia residente) o 5 (famiglia AIRE).
// NB: 2 = coniuge, l'unione civile ha un codice proprio (28).
const RELAZIONE_PARENTELA: Record<string, string> = {
  '1': 'Intestatario scheda',
  '2': 'Marito / Moglie',
  '3': 'Figlio / Figlia',
  '4': 'Nipote (discendente)',
  '5': 'Pronipote (discendente)',
  '6': 'Padre / Madre',
  '7': 'Nonno / Nonna',
  '8': 'Bisnonno / Bisnonna',
  '9': 'Fratello / Sorella',
  '10': 'Nipote (collaterale)',
  '11': 'Zio / Zia (collaterale)',
  '12': 'Cugino / Cugina',
  '13': 'Altro parente',
  '14': 'Figliastro / Figliastra',
  '15': 'Patrigno / Matrigna',
  '16': 'Genero / Nuora',
  '17': 'Suocero / Suocera',
  '18': 'Cognato / Cognata',
  '19': 'Fratellastro / Sorellastra',
  '20': 'Nipote (affine)',
  '21': 'Zio / Zia (affine)',
  '22': 'Altro affine',
  '23': 'Convivente (vincoli di adozione o affettivi)',
  '24': 'Responsabile della convivenza non affettiva',
  '25': 'Convivente in convivenza non affettiva',
  '26': 'Tutore',
  '28': 'Unito civilmente',
  '80': 'Adottato',
  '81': 'Nipote',
  '99': 'Non definito',
};

// Tabella 06 "Legame - Convivenza", usata quando tipoLegame è 4 (convivenza anagrafica:
// casa di cura, caserma, casa di pena...).
const LEGAME_CONVIVENZA: Record<string, string> = {
  '1': 'Responsabile convivenza',
  '2': 'Membro della convivenza',
  '3': 'Altro',
  '9': 'Ignoto',
};

/**
 * tipoLegame indica il tipo di nucleo (3 famiglia, 4 convivenza, 5 famiglia AIRE),
 * codiceLegame la relazione del componente rispetto all'intestatario della scheda.
 */
function decodeLegame(tipoLegame?: string, codiceLegame?: string): string {
  if (!codiceLegame) return '';
  // ANPR può restituire i codici zero-padded ("02").
  const codice = codiceLegame.replace(/^0+(?=\d)/, '');
  const tabella = tipoLegame === '4' ? LEGAME_CONVIVENZA : RELAZIONE_PARENTELA;
  return tabella[codice] ?? `Codice ${codiceLegame}`;
}

function mapComponente(s: E002Soggetto): ComponenteFamiglia {
  const dataDecesso = estraiDataDecesso(s);
  return {
    codiceFiscale: s.generalita?.codiceFiscale?.codFiscale ?? s.identificativi?.codiceFiscale ?? '',
    idANPR: s.identificativi?.idANPR ?? '',
    cognome: s.generalita?.cognome ?? '',
    nome: s.generalita?.nome ?? '',
    dataNascita: s.generalita?.dataNascita ?? null,
    sesso: s.generalita?.sesso ?? null,
    comuneNascita: formatComune(s.generalita?.luogoNascita?.comune ?? s.generalita?.comuneNascita),
    legame: decodeLegame(s.legameSoggetto?.tipoLegame, s.legameSoggetto?.codiceLegame),
    deceduto: !!dataDecesso,
    dataDecesso,
  };
}

async function richiediStatoFamiglia(
  idAnpr: string,
  motivazione: string,
  operatore: string,
  dataRiferimento?: string
): Promise<E002Soggetto[]> {
  const body = {
    idOperazioneClient: buildIdOperazioneClient(),
    criteriRicerca: { idANPR: idAnpr },
    datiRichiesta: buildDatiRichiesta('C021', motivazione, dataRiferimento),
  };
  const result = await callE002('C021', body, operatore);
  return result.listaSoggetti?.datiSoggetto ?? [];
}

/** Giorno precedente a una data YYYY-MM-DD, in YYYY-MM-DD. */
function giornoPrecedente(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * C021: accertamento stato di famiglia — risolve prima l'ID ANPR (C030), poi
 * richiede il nucleo familiare. Restituisce tutti i componenti con generalità
 * e legame familiare.
 *
 * Se il soggetto risulta deceduto, ANPR restituisce solo le sue generalità e la
 * data di decesso, senza il resto del nucleo. In quel caso si ripete la C021 alla
 * data del giorno precedente il decesso, così da mostrare chi faceva parte della
 * famiglia (coniuge, figli...) al momento del decesso.
 */
export async function consultaStatoFamiglia(
  codiceFiscale: string,
  motivazione: string,
  operatore: string
): Promise<StatoFamigliaResponse> {
  const idAnpr = await resolveIdAnpr(codiceFiscale, motivazione, operatore);
  const oggi = new Date().toISOString().slice(0, 10);

  const soggetti = await richiediStatoFamiglia(idAnpr, motivazione, operatore);
  const principale =
    soggetti.find((s) => s.identificativi?.idANPR === idAnpr) ?? (soggetti.length === 1 ? soggetti[0] : undefined);
  const dataDecesso = estraiDataDecesso(principale);

  if (!principale || !dataDecesso) {
    return {
      idANPR: idAnpr,
      codiceFiscale,
      dataRiferimento: oggi,
      componenti: soggetti.map(mapComponente),
      decesso: null,
    };
  }

  const deceduto = mapComponente(principale);
  const dataRiferimento = giornoPrecedente(dataDecesso);
  try {
    const nucleo = await richiediStatoFamiglia(idAnpr, motivazione, operatore, dataRiferimento);
    // Alla data storica il soggetto era in vita: lo si marca deceduto con il dato attuale.
    const componenti = nucleo.map((s) =>
      s.identificativi?.idANPR === idAnpr ? { ...mapComponente(s), deceduto: true, dataDecesso } : mapComponente(s)
    );
    return {
      idANPR: idAnpr,
      codiceFiscale,
      dataRiferimento,
      componenti: componenti.length > 0 ? componenti : [deceduto],
      decesso: { dataDecesso, erroreNucleoStorico: null },
    };
  } catch (err) {
    // Il nucleo storico è un'integrazione: se ANPR lo rifiuta si mostra comunque il
    // dato attuale (solo il deceduto) segnalando il motivo.
    return {
      idANPR: idAnpr,
      codiceFiscale,
      dataRiferimento: oggi,
      componenti: [deceduto],
      decesso: {
        dataDecesso,
        erroreNucleoStorico: err instanceof Error ? err.message : 'errore sconosciuto',
      },
    };
  }
}

/** Compone una stringa indirizzo leggibile dai campi strutturati restituiti da ANPR. */
function formatIndirizzo(
  indirizzo:
    | {
        cap?: string;
        toponimo?: { denominazioneToponimo?: string; specie?: string };
        numeroCivico?: { numero?: string };
      }
    | undefined
): string {
  if (!indirizzo) return '';
  // specie = tipo toponimo (VIA/PIAZZA/CORSO...): senza, l'indirizzo perde il prefisso.
  const via = [indirizzo.toponimo?.specie, indirizzo.toponimo?.denominazioneToponimo].filter(Boolean).join(' ');
  const civico = indirizzo.numeroCivico?.numero ?? '';
  const viaCivico = [via, civico].filter(Boolean).join(', ');
  return [viaCivico, indirizzo.cap].filter(Boolean).join(' - ');
}

/** Compone "Comune (PR)" quando la provincia è disponibile. */
function formatComune(comune: { nomeComune?: string; siglaProvinciaIstat?: string } | undefined): string {
  if (!comune?.nomeComune) return '';
  return comune.siglaProvinciaIstat ? `${comune.nomeComune} (${comune.siglaProvinciaIstat})` : comune.nomeComune;
}
