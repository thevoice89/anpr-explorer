# Analisi tecnica — ANPR Explorer / Integrazione PDND
## Documento per revisione esterna — Comune di Trezzo Sull'Adda

---

## 1. Contesto del progetto

Applicazione web ("ANPR Explorer") che permette agli operatori comunali (Ufficio Tributi e Messo Comunale) di interrogare i dati di residenza tramite la **Piattaforma Digitale Nazionale Dati (PDND)** di PagoPA, accedendo ai seguenti e-service del Ministero dell'Interno (erogatore: ANPR — Anagrafe Nazionale della Popolazione Residente, gestita da Sogei).

**Stack tecnico:**
- Backend: Node.js 20 + TypeScript + Express, libreria `jose` per JWT/JWS, `axios` per HTTP, `better-sqlite3` per DB locale
- Frontend: React + Vite + Bootstrap Italia (design system PA italiana)
- Deployment: Docker Compose su host LAN `192.168.2.22`

---

## 2. E-service PDND utilizzati

Tutti in ambiente di **Collaudo** (non produzione). Fruizione attiva, finalità approvate.

| Codice | Nome e-service (catalogo PDND) | Server Collaudo | Operazione |
|--------|-------------------------------|-----------------|------------|
| C030 | `C030-servizioAccertamentoIdUnicoNazionale-approvazione_automatica` | `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C030-servizioAccertamentoIdUnicoNazionale/v1` | `POST /anpr-service-e002` |
| C008 | `C008-servizioVerificaDichResidenza-approvazione_automatica` | `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C008-servizioVerificaDichResidenza/v1` | `POST /anpr-service-e002` |
| C020 | `C020-servizioAccertamentoResidenza-approvazione_automatica` | `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C020-servizioAccertamentoResidenza/v1` | `POST /anpr-service-e002` |

Flusso applicativo: C030 (CF → ID ANPR) → C020 (residenza completa) oppure C008 (verifica residenza dichiarata, risposta Sì/No).

---

## 3. Pattern di sicurezza dichiarati dalle specifiche OpenAPI

Ogni e-service dichiara nel campo `description` e nei `securitySchemes` i seguenti pattern ModI:

- `[AUDIT_REST_02]` Inoltro dati tracciati nel dominio del Fruitore REST con correlazione
- `[BLOCK_REST]` Blocking REST
- `[INTEGRITY_REST_02]` Integrità del payload messaggio REST in PDND

**Header di sicurezza richiesti a livello di singola operazione** (blocco `security` a livello root delle 3 spec):

| E-service | bearerAuth | Agid-JWT-Signature | Agid-JWT-TrackingEvidence |
|-----------|-----------|-------------------|--------------------------|
| C030 | ✓ | ✓ | — (non elencato nel blocco security root) |
| C008 | ✓ | ✓ | — (non elencato nel blocco security root) |
| C020 | ✓ | ✓ | ✓ |

---

## 4. Flusso di autenticazione PDND (funzionante — confermato)

**Endpoint token:** `https://auth.uat.interop.pagopa.it/token.oauth2`

**Meccanismo:** OAuth2 `client_credentials` con `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer` (RFC 7521).

**Client Assertion (JWT firmato RS256, JOSE Header: `{alg: "RS256", kid: "<kid>", typ: "JWT"}`):**
```json
{
  "iss": "<client_id>",
  "sub": "<client_id>",
  "aud": "auth.uat.interop.pagopa.it/client-assertion",
  "jti": "<uuid>",
  "iat": <timestamp>,
  "exp": <timestamp + 600>,
  "purposeId": "<uuid della finalità per il servizio specifico>"
}
```

**Parametri reali in uso:**
- `client_id`: `c9b73ff4-e203-4580-911b-689514d350c2`
- `kid`: `nIR_Avt40UtNCWZcZtt3TsI0xSv_dE50ueNfGj999bs`
- `purposeId` C030: `ffe23164-4b19-4ac4-8ee3-2a259dc2b81e`
- `purposeId` C020: `18758e0e-e8c5-4115-8e2e-2e8f34849841`
- `purposeId` C008: `8011b6a4-b5fd-41ac-8123-1d57a80fe8b1`

Il voucher viene ottenuto con successo, validato anche tramite il tool "Debug client assertion" del back-office PDND. Questo step **non è il problema**.

---

## 5. Problema attuale — `InteroperabilityInvalidRequest`

**Stato TLS:** risolto. `modipa-val.anpr.interno.it` usa un certificato emesso dalla CA privata "Sogei Certification Authority Test" (non in alcun trust store pubblico). Aggiunto il certificato root CA in `backend/certs/sogei-test-ca.pem` e configurato `NODE_EXTRA_CA_CERTS` nel container Docker. La connessione TLS funziona.

**Errore attuale:** ogni chiamata `POST /anpr-service-e002` (testata su C030) viene rifiutata dal gateway **GovWay** (il reverse proxy ModI davanti ad ANPR) con:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://govway.org/handling-errors/400/InteroperabilityInvalidRequest.html",
  "title": "InteroperabilityInvalidRequest",
  "status": 400,
  "detail": "Received request is not conform to the required interoperability profile",
  "govway_id": "60819f05-6e5c-11f1-b0c3-005056ae1884"
}
```

Altri `govway_id` osservati (stessa tipologia di errore): `ecfce820-6e5c-11f1-b0c3-005056ae1884`

Il gateway valida la conformità al profilo ModI **prima** di inoltrare la richiesta all'applicazione ANPR. Il Bearer token viene accettato (non è un errore 401/403). Il problema è nell'header `Agid-JWT-Signature`.

---

## 6. Implementazione corrente di `Agid-JWT-Signature`

Basata sulle **"Linee Guida sull'interoperabilità tecnica delle Pubbliche Amministrazioni — Allegato 2: Pattern di sicurezza"** (AGID, luglio 2024), sezione **5.3 "[INTEGRITY_REST_02] Integrità del payload delle request REST in PDND"**, incluso l'esempio numerico §5.3.3.

### Richiesta HTTP inviata

```http
POST https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C030-servizioAccertamentoIdUnicoNazionale/v1/anpr-service-e002 HTTP/1.1
Authorization: Bearer <voucher PDND>
Content-Type: application/json
Digest: SHA-256=<base64(sha256(body_serializzato))>
Agid-JWT-Signature: <JWS Compact Serialization>
```

### Struttura del JWS in `Agid-JWT-Signature`

**JOSE Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "nIR_Avt40UtNCWZcZtt3TsI0xSv_dE50ueNfGj999bs"
}
```

**Payload:**
```json
{
  "aud": "https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C030-servizioAccertamentoIdUnicoNazionale/v1/anpr-service-e002",
  "sub": "c9b73ff4-e203-4580-911b-689514d350c2",
  "iss": "c9b73ff4-e203-4580-911b-689514d350c2",
  "jti": "<uuid casuale>",
  "iat": <unix timestamp>,
  "nbf": <unix timestamp>,
  "exp": <unix timestamp + 300>,
  "signed_headers": [
    { "digest": "SHA-256=<stesso valore dell'header HTTP Digest>" },
    { "content-type": "application/json" }
  ]
}
```

**Note sull'implementazione:**
- Il body viene serializzato con `JSON.stringify()` **una sola volta** e lo stesso identico bytes va sia nel calcolo del `Digest` sia nel body HTTP (axios riceve una stringa già serializzata, non un oggetto da riserializzare)
- La firma è RS256 con la chiave privata RSA 2048 il cui `kid` è registrato su PDND
- I nomi degli header in `signed_headers` sono in minuscolo (come da esempio §5.3.3 delle Linee Guida)

### Corpo della richiesta ANPR (esempio C030)

```json
{
  "idOperazioneClient": "1782147770366",
  "criteriRicerca": {
    "codiceFiscale": "PRVGNN90R10H501Q"
  },
  "datiRichiesta": {
    "dataRiferimentoRichiesta": "2026-06-22",
    "motivoRichiesta": "Test integrazione ANPR Explorer",
    "casoUso": "C030"
  }
}
```

---

## 7. Codice sorgente rilevante

File: `anpr-explorer/backend/src/services/anpr.service.ts`

```typescript
function computeDigestHeader(bodyString: string): string {
  const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
  return `SHA-256=${hash}`;
}

async function buildIntegritySignature(requestUrl: string, digestHeaderValue: string): Promise<string> {
  const settings = getSettingsPlain();
  const alg = detectAlgorithmFromPem(settings.privateKeyPem); // => 'RS256'
  const privateKey = await importPKCS8(settings.privateKeyPem, alg);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    aud: requestUrl,
    sub: settings.clientId,
    signed_headers: [
      { digest: digestHeaderValue },
      { 'content-type': 'application/json' },
    ],
  })
    .setProtectedHeader({ alg, kid: settings.kid, typ: 'JWT' })
    .setIssuer(settings.clientId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

async function callE002(serviceCode, body, userID) {
  const url = `${settings.anprBaseUrl}${ANPR_SERVICE_PATHS[serviceCode]}`;
  const bodyString = JSON.stringify(body);
  const digestHeaderValue = computeDigestHeader(bodyString);

  const headers = {
    Authorization: `Bearer ${voucher}`,
    'Content-Type': 'application/json',
    Digest: digestHeaderValue,
    'Agid-JWT-Signature': await buildIntegritySignature(url, digestHeaderValue),
  };
  // Per C020 aggiunge anche Agid-JWT-TrackingEvidence (non implementato correttamente ancora)

  return axios.post(url, bodyString, { headers, timeout: 15_000 });
}
```

---

## 8. Fonti consultate

### Specifiche OpenAPI degli e-service (scaricate dal catalogo PDND)
- `Specifica API.yaml` — C030 servizioAccertamentoIdUnicoNazionale v1.0.0
- `Specifica API_C020-servizioAccertamentoResidenza-approvazione_automatica_Ministero dell'Interno_v8.yaml` — C020 v8
- `C008-servizioVerificaDichResidenza.yaml.yaml` — C008 v1.0.0

### Documentazione AGID ufficiale
- **[Linee Guida PA All2 Pattern sicurezza (PDF)](https://www.agid.gov.it/sites/agid/files/2024-07/Linee_guida_interoperabilit%C3%A0PA_All2_Pattern_sicurezza.pdf)** — 63 pagine, luglio 2024. Contiene la specifica completa di INTEGRITY_REST_02 (§5.3) e AUDIT_REST_02 (§6.2) con esempio numerico.
- [Linee Guida PA All3 Profili di interoperabilità (PDF)](https://www.agid.gov.it/sites/agid/files/2024-07/Linee_guida_interoperabilit%C3%A0PA_All3_Profili_di_interoperabilit%C3%A0.pdf)

### Documentazione GovWay (gateway che genera l'errore)
- [Profilo ModI — Sicurezza Messaggio](https://govway.org/documentazione/console/profiloModIPA/sicurezzaMessaggio.html)
- [INTEGRITY_REST_02 con PDND — indice](https://govway.org/documentazione/console/profiloModIPA/messaggio/idar03/pdnd/index.html)
- [INTEGRITY_REST_02 con PDND — configurazione fruizione](https://govway.org/documentazione/console/profiloModIPA/messaggio/idar03/pdnd/pdnd_fruizione.html)
- [Payload Claims del token JWT](https://govway.org/documentazione/console/profiloModIPA/messaggio/avanzata/claims.html)
- [Request Digest (PROFILE_NON_REPUDIATION_01)](https://govway.org/documentazione/console/profiloModIPA/messaggio/requestDigest.html)

---

## 9. Ciò che è stato tentato (e non ha funzionato)

Tutte le varianti sotto producono lo stesso identico errore `InteroperabilityInvalidRequest`:

1. **Struttura iniziale errata**: claim `{"digest": {"alg": "SHA256", "value": "..."}}` senza header HTTP `Digest` separato → rimosso
2. **Struttura da spec AGID §5.3.3**: header `Digest` + `signed_headers` array con lowercase → ancora errore
3. **Aggiunta di `sub`/`iss`/`jti`**: aggiunti come da §5.3.2 "claim secondo la logica del servizio" → ancora errore
4. **Test senza `nbf`**: rimosso il claim opzionale `nbf` → stesso errore

---

## 10. Domande aperte per l'analisi

1. **La struttura del `signed_headers` è corretta?** L'esempio §5.3.3 delle Linee Guida AGID mostra:
   ```json
   "signed_headers": [
     {"digest": "SHA-256=cFfTOCesrWTLVzxn8fmHl4AcrUs40Lv5D275FmAZ96E="},
     {"content-type": "application/json"}
   ]
   ```
   Questo è un array di oggetti con chiave=nome header in minuscolo, valore=valore dell'header. È corretta questa interpretazione, o `signed_headers` dovrebbe essere in un formato diverso (es. array di stringhe, oggetto unico, o diversa struttura)?

2. **`aud` deve essere l'URL completo con `/anpr-service-e002`?** Oppure il base URL dell'e-service senza l'operazione (es. solo fino a `/v1`)?

3. **`Agid-JWT-TrackingEvidence` è richiesto anche per C030?** La specifica OpenAPI di C030 non lo elenca nel blocco `security` root, ma la descrizione del servizio menziona il pattern `[AUDIT_REST_02]`. GovWay potrebbe comunque richiederlo?

4. **Il campo `Digest` HTTP (RFC 3230) deve usare la sintassi `SHA-256=...` oppure `sha-256=...` (minuscolo)?** RFC 3230 non specifica case per l'algoritmo.

5. **L'implementazione di GovWay per ANPR ha requisiti aggiuntivi rispetto all'esempio generico delle Linee Guida AGID?** Ad esempio, il claim `client_id` (menzionato nella pagina claims GovWay come "identificativo dell'applicazione client"), oppure un claim `purposeId` nella firma (diverso da quello già presente nel voucher PDND)?

6. **AUDIT_REST_02 per C020 ha una dipendenza con il token request PDND?** La specifica AGID §6.2 indica che il digest del JWS di audit deve essere inserito nella client assertion inviata a PDND per ottenere il voucher. Il nostro backend non fa questo: ottiene il voucher normalmente, poi costruisce il JWS di audit separatamente. È questo a causare la validazione fallita anche per C020?

---

## 11. Variabili di ambiente (non sensibili) e configurazione attiva

```
NODE_ENV=production
NODE_EXTRA_CA_CERTS=/app/certs/sogei-test-ca.pem
PDND token endpoint: https://auth.uat.interop.pagopa.it/token.oauth2
PDND audience client assertion: auth.uat.interop.pagopa.it/client-assertion
ANPR base URL: https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND
```

---

## 12. Stato complessivo del progetto

| Componente | Stato |
|---|---|
| Docker Compose + container | ✅ in esecuzione su 192.168.2.22 |
| Autenticazione admin (argon2id) | ✅ funzionante |
| PDND client assertion + voucher | ✅ funzionante (confermato live) |
| TLS verso ANPR Collaudo | ✅ risolto (CA Sogei registrata) |
| Body request ANPR (schema JSON) | ✅ conforme alle spec OpenAPI |
| `Digest` HTTP header (RFC 3230) | ✅ implementato |
| `Agid-JWT-Signature` JOSE Header | ✅ alg/typ/kid corretti |
| `Agid-JWT-Signature` claims aud/signed_headers | ⚠️ implementato da spec AGID, ma rifiutato da GovWay |
| `Agid-JWT-TrackingEvidence` (C020) | ⚠️ implementato parzialmente (mancano dnonce, purposeId nel JWS, e il digest nel token request PDND) |
| Test end-to-end con soggetto fittizio | ❌ bloccato dall'errore sopra |
