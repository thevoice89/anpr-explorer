# PDND Explorer — Documento di Architettura, Guida Operativa e Prompt di Generazione

> **Premessa legale e di compliance (da leggere prima di tutto)**
> L'accesso ai dati ANPR tramite PDND in qualità di **Fruitore** è subordinato a: (a) adesione attiva alla PDND dell'Ente; (b) esistenza di una **base giuridica** e di una **finalità istituzionale** documentata; (c) rispetto del principio di **minimizzazione** (art. 5 GDPR) e di **necessità/proporzionalità**. L'applicazione tratta dati personali anagrafici: vanno coinvolti **DPO** e **registro dei trattamenti**, e va predisposto un **log di audit** degli accessi (chi, quando, quale CF, quale finalità, quale esito). Questo documento è una guida architetturale e operativa: i nomi esatti degli e-service, le versioni delle API e i requisiti di firma vanno **sempre riverificati sulla scheda dell'e-service nel catalogo PDND** e sulle specifiche tecniche pubblicate da ANPR, perché evolvono nel tempo.

---

# STEP 1 — Analisi Strutturale e Guida Operativa

## 1. Guida Operativa PDND per l'Ente Fruitore

### 1.0 Prerequisiti e ruoli

| Requisito | Dettaglio |
|---|---|
| Adesione PDND | L'Ente deve aver completato l'adesione (di norma a cura del Legale Rappresentante via portale, con SPID/CIE). |
| Ruoli back-office | Servono i ruoli **Amministratore** (gestisce client e chiavi) e **Operatore API/Sicurezza**. Chi configura le chiavi deve avere il ruolo abilitato alla gestione dei client. |
| Accreditamento ANPR | Per molti servizi ANPR i Comuni hanno **auto-approvazione** (circolare DAIT n. 73 del 31/05/2023); altri enti hanno auto-approvazione sui servizi di **verifica**. Verificare la propria casistica. |
| Ambienti | Esistono **Collaudo (UAT)** e **Produzione**. Sviluppare e testare **sempre prima in Collaudo**. |

### 1.1 Trovare l'e-service ANPR nel Catalogo

> ✅ **Verificato live il 22/06/2026** sul back-office Collaudo (`selfcare.uat.interop.pagopa.it`), account **Comune di Trezzo Sull'Adda**. La sezione seguente sostituisce la precedente, che conteneva un nome erogatore inventato e codici non confermati.

1. Accedi al **back-office PDND Interoperabilità** (ambiente Collaudo per i test: `selfcare.uat.interop.pagopa.it`).
2. Vai in **Catalogo e-service**.
3. **Non cercare l'erogatore come "Ministero dell'Interno – ANPR"** — quella dicitura composta non esiste nel catalogo. L'erogatore registrato è semplicemente **`Ministero dell'Interno`** (selezionabile dal filtro "Cerca per erogatore"; nel menu compaiono anche varie sotto-direzioni del Ministero, ma gli e-service ANPR sono pubblicati sotto la voce semplice "Ministero dell'Interno").
4. Più rapido: usa **"Cerca per nome"** e digita il codice del servizio che ti serve (es. `C008`, `C020`, `C033`, `C030`).
5. Gli e-service NON sono un'unica scheda "ANPR" — sono **decine di e-service distinti**, uno per ciascun caso d'uso, con nome `C0XX-nomeServizio[-approvazione_automatica]`. Quasi ogni codice ha **due varianti**: quella base (richiede approvazione manuale dell'erogatore) e quella **`-approvazione_automatica`** (attivazione immediata per gli enti che rientrano nei requisiti, es. i Comuni per la circolare DAIT 73/2023). **Scegli sempre la variante `-approvazione_automatica`** se il tuo ente vi rientra, altrimenti la richiesta di fruizione resta in attesa di approvazione manuale da parte del Ministero.

⚠️ **Attenzione a "ANPR-Certificazione"**: è un e-service distinto (erogatore "Ministero dell'Interno", versione 2, "Eroga dati personali: Sì") che **richiede un attributo certificato riservato** — il fruitore deve essere **Consiglio Nazionale del Notariato OPPURE Poste Italiane S.p.A.** Non è utilizzabile da un Comune e non è il servizio che serve per "accertamento/verifica residenza" — è facile confonderlo perché compare per primo cercando "anpr".

#### Tabella codici completa (verificata live, lista integrale del catalogo)

| Codice | Nome tecnico | Funzione | Note |
|---|---|---|---|
| C001 | servizioNotifica | Notifica atti (anche variante "- PagoPa") | |
| C002 | servizioComunicazione | Invio comunicazioni istituzionali | |
| C003 | servizioVerificaDichiarazioneGeneralita | Verifica generalità dichiarate → Sì/No | |
| C004 | servizioVerificaDichiarazioneDecesso | Verifica decesso dichiarato → Sì/No | |
| C005 | servizioVerificaDichiarazioneStatoMatrimonio | Verifica stato matrimonio → Sì/No | |
| C006 | servizioVerificaDichiarazioneCittadinanza | Verifica cittadinanza → Sì/No | |
| C007 | servizioVerificaDichiarazioneEsistenzaVita | Verifica esistenza in vita → Sì/No | Variante dedicata "-assicurazioni"; massivo: `ElabMassivaVerificaDichEsistenzaInVita` |
| **C008** | **servizioVerificaDichiarazioneResidenza** | **Verifica residenza dichiarata → Sì/No** | ⭐ Usare per la modalità "Verifica residenza" (minimizzazione massima) |
| C009 | servizioVerificaDichiarazioneStatoFamiglia | Verifica stato di famiglia → Sì/No | |
| C010 | servizioVerificaDichiarazioneStatoLibero | Verifica stato libero → Sì/No | |
| C011 | servizioVerificaDichiarazioneVedovanza | Verifica vedovanza → Sì/No | |
| C012 | servizioVerificaDichiarazionePaternita | Verifica paternità → Sì/No | |
| C013 | servizioVerificaDichiarazioneMaternita | Verifica maternità → Sì/No | |
| C014 | servizioVerificaDichiarazioneUnioneCivile | Verifica unione civile → Sì/No | |
| C015 | servizioAccertamentoGeneralita | Accertamento generalità complete | |
| C016 | servizioAccertamentoDichDecesso | Accertamento dati di decesso | Massivo: `ElabMassivaAccertamentoDatiDecesso` |
| C017 | servizioAccertamentoMatrimonio | Accertamento matrimonio | |
| C018 | servizioAccertamentoCittadinanza | Accertamento cittadinanza | |
| C019 | servizioAccertamentoEsistenzaVita | Accertamento esistenza in vita | Variante dedicata "-assicurazioni" |
| **C020** | **servizioAccertamentoResidenza** | **Accertamento residenza (con dato di decesso se presente)** | ⭐ Massivo: `ElabMassivaAccertamentoResidenza` |
| C021 | servizioAccertamentoStatoFamiglia | Accertamento stato di famiglia / nucleo | |
| C022 | servizioAccertamentoStatoLibero | Accertamento stato libero | |
| C023 | servizioAccertamentoVedovanza | Accertamento vedovanza | |
| C024 | servizioAccertamentoPaternita | Accertamento paternità | |
| C025 | servizioAccertamentoMaternita | Accertamento maternità | |
| C026 | servizioAccertamentoUnioneCivile | Accertamento unione civile | |
| **C029** | **servizioAccertamentoDatiAnagrafici** | **Accertamento dati anagrafici (servizio generico)** | Esiste anche variante "- clone" e "-Signal" (per Signal Hub) |
| **C030** | **servizioAccertamentoIdUnicoNazionale** | **CF / dati anagrafici → ID ANPR** | ⭐ Step preliminare obbligatorio; massivo: `ElabMassivaAccertIdUnicoNazionale` |
| C031 | servizioVerificaIdUnicoNazionale | Verifica integrità/corrispondenza ID ANPR ↔ dati anagrafici | |
| C032 | servizioAccertamentoElettorale | Accertamento elettorale | |
| C033 | servizioAccertamentoResidenzaSenzaDecesso | Accertamento residenza, SENZA dato di decesso | ⚠️ **Non ha variante `-approvazione_automatica`. L'unica variante esistente richiede l'attributo certificato "Ministero delle infrastrutture e dei trasporti" — non utilizzabile da un Comune.** Esiste anche "-Signal" (Signal Hub). |
| C034 | AccertamentoGenitorialita | Generalità dei minori di un genitore dato in input | |

**Altri e-service Ministero dell'Interno trovati nel catalogo (non pertinenti al caso d'uso "residenza"):** `ANPR-Certificazione` (riservato Notariato/Poste, vedi sopra), `ANPR API INTEGRAZIONE INAD` / `INAD API INTEGRAZIONE ANPR`, `Anpr-Elaborazioni-Massive-dev`, `CIE - Notifica decesso`, `Conferimento Identità Digitali`, `Consultazione Numero Identità Digitali`, `Consultazione Pratiche cambio residenza`, `Cruscotto strumenti digitali deleghe`, `SDG-ANPR-DataService`.

#### Raccomandazione concreta per "ANPR Explorer" (Comune di Trezzo Sull'Adda)

> ✅ Tabella **interamente verificata live** il 22/06/2026 aprendo ogni singola scheda e leggendo la sezione "Soglie e attributi". **`C033` è stato escluso**: non esiste in versione `-approvazione_automatica`, e l'unica variante disponibile richiede l'attributo "Ministero delle infrastrutture e dei trasporti", che il Comune non possiede — non è la scelta corretta per un Comune nonostante il nome suggestivo "Senza Decesso".

| E-service | Soglia/giorno (fruitore / totale) | Attributo richiesto (tra cui) | Stato per questo Comune |
|---|---|---|---|
| `C030-servizioAccertamentoIdUnicoNazionale-approvazione_automatica` | 5.000 / 1.000.000.000 | Comuni e loro Consorzi e Associazioni (✅ posseduto) | **Già richiesta** — pulsante "Visualizza richiesta" |
| `C020-servizioAccertamentoResidenza-approvazione_automatica` | 2.000 / 10.000.000 | Comuni e loro Consorzi e Associazioni (✅ posseduto) | **Già richiesta** — pulsante "Visualizza richiesta" |
| `C008-servizioVerificaDichResidenza-approvazione_automatica` | 100 / 1.000.000 | Gestori di Pubblici Servizi OPPURE Pubbliche Amministrazioni (✅ posseduto) | Non ancora richiesta — pulsante "Richiedi fruizione" |
| `C033-servizioAccertamentoResidenzaSenzaDecesso` | 100 / 100.000 | Ministero delle infrastrutture e dei trasporti (❌ non posseduto) | **Escluso** — non utilizzabile da un Comune |

**Conclusione operativa:**
1. `C030` e `C020` risultano **già attivi/richiesti** su questo account — verificare lo stato esatto cliccando "Visualizza richiesta" (in attesa di approvazione vs. attivo) prima di procedere oltre.
2. Manca solo **`C008`** (modalità "Verifica", Sì/No): cliccare "Richiedi fruizione" sulla sua scheda per attivarlo.
3. Per i "dati di residenza" usare **C020** (non C033): l'app deve quindi gestire la presenza occasionale del dato di decesso nella risposta C020, anche se la finalità è solo "accertamento residenza" — minimizzare a livello applicativo (filtrare il campo in output) anziché a livello di scelta e-service.

### 1.2 Creare la Richiesta di Fruizione

1. Nella scheda dell'e-service, premi **"Iscriviti" / "Richiedi fruizione"**.
2. Si crea un **accordo di fruizione**: lo stato può essere `In attesa di approvazione` o `Attivo` (se l'erogatore prevede auto-approvazione, come spesso per ANPR/Comuni).
3. Ripeti per **ogni e-service** che intendi usare (es. C030 **e** C033 **e** C008).

### 1.3 Definire la Finalità e gestire l'Analisi del Rischio

1. Vai in **Le tue finalità → Crea nuova finalità**.
2. Compila: **nome finalità** (es. *"Accertamento residenza per pratiche di competenza"*), **descrizione**, **base giuridica**.
3. Associa la finalità all'**e-service fruito**.
4. Compila l'**Analisi del Rischio** (questionario obbligatorio sul trattamento): tipologia dati, misure di sicurezza, conservazione, ecc. La finalità diventa attiva solo dopo il completamento.
5. Imposta la **stima di carico** (numero di chiamate previste): determina la *rate limit* assegnata.
6. Al termine ottieni un **`purposeId`** (UUID): **annotalo**, è un parametro chiave per la client assertion.

> Una finalità è legata a uno specifico e-service. Avrai quindi **un `purposeId` per ciascun e-service** che usi (uno per C030, uno per C033, ecc.).

### 1.4 Creare il Client

1. Vai in **I tuoi client → Crea nuovo client** e scegli tipo **"Client API/E-service" (machine-to-machine)**.
2. Dai un nome (es. `anpr-explorer-prod`).
3. **Associa al client le finalità** create al punto 1.3 (un client può avere più finalità).
4. Salvando, ottieni il **`client_id`** (UUID): **annotalo**.

### 1.5 Generare la coppia di chiavi e caricare la chiave pubblica

La firma avviene con crittografia asimmetrica. **La chiave privata non si carica MAI su PDND e non lascia MAI il backend.**

**Genera la coppia in locale (RSA 2048+ o EC P-256):**

```bash
# Opzione A — RSA 2048 (alg RS256)
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Opzione B — EC P-256 (alg ES256, chiavi più corte)
openssl ecparam -name prime256v1 -genkey -noout -out private-ec.pem
openssl ec -in private-ec.pem -pubout -out public-ec.pem
```

**Carica SOLO la chiave pubblica (`public.pem`, formato PEM/SPKI):**

1. Apri il client → sezione **Chiavi pubbliche → Aggiungi chiave**.
2. Incolla il contenuto di `public.pem`.
3. PDND genera e associa un **`kid` (Key ID)**: **annotalo**.

> Conserva `private.pem` in modo sicuro: andrà cifrata e inserita nel backend (Area Impostazioni), **mai** nel frontend, **mai** in chiaro nel repository.

### 1.6 Dove reperire i parametri per il Voucher

Riepilogo dei parametri e dove trovarli:

| Parametro | Dove si trova | Esempio / Note |
|---|---|---|
| `client_id` | Dettaglio del Client | UUID |
| `kid` | Client → Chiavi pubbliche | UUID associato alla chiave |
| Chiave privata | **Locale** (mai su PDND) | PEM, custodita nel backend |
| `purposeId` | Dettaglio della Finalità | UUID, **uno per e-service** |
| **Audience della client assertion** (`aud` per il /token) | Documentazione PDND | **`auth.interop.pagopa.it/client-assertion`** (Prod) |
| **Token endpoint** | Back-office / docs | **`https://auth.interop.pagopa.it/token.oauth2`** (Prod) · `auth.uat.interop.pagopa.it` (Collaudo) — *verifica in back-office* |
| **Audience del voucher** (`aud` del token) | Scheda e-service | La inserisce **PDND** in base alla finalità; tu **non** la imposti. È l'audience dichiarata da ANPR. |
| **Base URL e-service ANPR** | Scheda e-service → "Server URL" | Endpoint REST da chiamare con il voucher come Bearer |
| `alg` | Scelto da te | `RS256` (RSA) o `ES256` (EC) |

#### Parametri reali raccolti per "Anpr Explorer" — Comune di Trezzo Sull'Adda (ambiente Collaudo)

> ✅ Valori verificati live il 22/06/2026. Chiave generata in locale con `openssl genrsa 2048`, salvata in `anpr-explorer/backend/keys/` (esclusa da git via `.gitignore`). **`private.pem` non va mai copiato altrove né incollato in chat/codice.**

| Parametro | Valore |
|---|---|
| `client_id` | `c9b73ff4-e203-4580-911b-689514d350c2` |
| `kid` | `nIR_Avt40UtNCWZcZtt3TsI0xSv_dE50ueNfGj999bs` |
| `alg` | `RS256` (chiave RSA 2048) |
| Chiave privata | `anpr-explorer/backend/keys/private.pem` (locale, non committata) |
| `purposeId` — C030 Accertamento id | `ffe23164-4b19-4ac4-8ee3-2a259dc2b81e` |
| `purposeId` — C020 Accertamento Residenza | `18758e0e-e8c5-4115-8e2e-2e8f34849841` |
| `purposeId` — C008 Verifica Residenza | `8011b6a4-b5fd-41ac-8123-1d57a80fe8b1` |
| Audience e-service C020 (`aud` ANPR, non del voucher) | `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR/C020-servizioAccertamentoResidenza/v1` (ambiente di validazione ANPR collegato a Collaudo PDND) |
| Durata voucher (C020) | 10 minuti (confermato dalla scheda tecnica) |
| **Audience client assertion (Collaudo)** | **`auth.uat.interop.pagopa.it/client-assertion`** — confermato dal tool "Simula l'ottenimento di un voucher". Diverso dalla audience di Produzione (`auth.interop.pagopa.it/client-assertion`). |
| Algoritmo richiesto | **RS256** — il portale conferma esplicitamente: "Si può firmare solo con RS256" (le chiavi EC/ES256 menzionate come opzione B non risultano accettate per le client assertion PDND, almeno in questo ambiente: verificare prima di usare EC in produzione). |

> 💡 **Funzione utile scoperta sul portale**: ogni client ha un pulsante **"Simula l'ottenimento del voucher"** nella sua pagina di gestione — permette di testare l'intera catena (client assertion → token PDND) **direttamente dal back-office, senza scrivere codice**. Da lì si arriva anche a un secondo tool, **"Debug client assertion"** (`/ui/it/tool-sviluppo/debug-voucher`), che inoltra realmente la richiesta al server autorizzativo e restituisce un esito dettagliato.

> ✅ **VALIDATO END-TO-END il 22/06/2026**: generata una client assertion RS256 con `private.pem` locale (claim `kid`, `iss`/`sub`=`client_id`, `aud`=`auth.uat.interop.pagopa.it/client-assertion`, `purposeId` di C030, `jti`/`iat`/`exp`), inoltrata al tool di debug PDND. Esito: **"Questa richiesta è valida, è possibile ottenere un voucher per l'e-service C030-servizioAccertamentoIdUnicoNazionale-approvazione_autom"**, con tutti e 4 i controlli superati (validazione client assertion, recupero chiave pubblica, verifica firma, verifica stati). **L'intera catena di autenticazione PDND per questo Comune è confermata funzionante con dati reali** — la logica di `pdnd.service.ts` descritta più sotto (sezione 2.3) può essere implementata con la certezza che client/chiave/claim sono corretti.

#### Specifica OpenAPI reale di C020 (scaricata dalla scheda e-service, 22/06/2026)

> ✅ Sostituisce ogni precedente ipotesi/placeholder per C020. Scaricabile da: scheda e-service → "Vedi i dettagli tecnici dell'e-service" → allegato "Specifica API_C020-...".

- **Server URL Collaudo**: `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C020-servizioAccertamentoResidenza/v1` (nota il segmento **`-PDND`**, assente nella mia stima precedente)
- **Server URL Produzione**: `https://modipa.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C020-servizioAccertamentoResidenza/v1`
- **Operazione reale**: `POST /anpr-service-e002` (non la radice `/v1` come ipotizzato)
- **Sicurezza dichiarata come OBBLIGATORIA** (non opzionale): `bearerAuth` + `Agid-JWT-Signature` (pattern INTEGRITY_REST_02) + `Agid-JWT-TrackingEvidence` (pattern AUDIT_REST_02)
- **Claim richiesti in `Agid-JWT-TrackingEvidence`**: `userID`, `userLocation`, `LoA` (diversi da quelli placeholder nel codice attuale: `requestId`, `motivazione`)
- **Corpo richiesta** (`RichiestaE002`): `idOperazioneClient` (univoco, es. timestamp), `criteriRicerca` (`codiceFiscale` o `idANPR` o nome/cognome/data nascita), `datiRichiesta` (`dataRiferimentoRichiesta`, `motivoRichiesta`, `casoUso`)
- **Corpo risposta** (`RispostaE002OK`): `idOperazioneANPR`, `listaSoggetti.datiSoggetto[]` con `generalita` (CF, nome, cognome, data/luogo nascita, `idSchedaSoggettoANPR`...), `residenza[]` (indirizzo completo, `dataDecorrenzaResidenza`, eventuale `localitaEstera`), `identificativi.idANPR`, `listaAnomalie[]`

#### Soggetti fittizi ufficiali per il Collaudo (da "casi di test C020.xlsx")

| ID ANPR | Codice Fiscale | Nome Cognome | Note |
|---|---|---|---|
| UK79569LF | PRVGNN90R10H501Q | GIOVANNI PROVA | Caso semplice, consigliato per il primo test |
| JF28000UG | NRECLD90R50H501G | CLAUDIA NERI | Caso semplice |
| AF41450AS | STTSGT90A01H501J | SOGGETTO SETTIMO | |
| EV45959WW | NNOSGT90A01H501I | SOGGETTO NONO | |
| TK44563XB | TTVSGT90A01H501H | SOGGETTO OTTAVO | |
| LB27131ED | NDRCPL01A01H501S | COMPLESSO INDIRIZZO | indirizzo complesso |
| RE03592S1 | NDRMRC02B02H501D | METRICO INDIRIZZO | indirizzo metrico |
| DU58740Y1 | TDSPRM00R10A952C | PRIMO TEDESCO | con indirizzo in altra lingua (BZ) |
| DJ02468WZ | SLVDNN00R50L424L | DONNA SLOVENA | con indirizzo in altra lingua (TS) |
| GS66689VV | TSDSND90R10A952M | SECONDO TEDESCO | con indirizzo in altra lingua (BZ) |

> Elenco completo (13 soggetti) nel file scaricato `casi di test C020.xlsx`. **Mai usare CF/nominativi reali in Collaudo** — il banner PDND lo vieta esplicitamente ("Ambiente di collaudo. Non utilizzare dati reali.").

#### Specifiche OpenAPI reali di C008 e C030 (scaricate il 22/06/2026)

Confermano lo stesso pattern di C020: un'unica operazione `POST /anpr-service-e002`, sicurezza ModI, server URL con prefisso comune `MinInternoPortaANPR-PDND`.

| | C030 (Accertamento ID) | C008 (Verifica residenza) |
|---|---|---|
| Server Collaudo | `.../MinInternoPortaANPR-PDND/C030-servizioAccertamentoIdUnicoNazionale/v1` | `.../MinInternoPortaANPR-PDND/C008-servizioVerificaDichResidenza/v1` |
| Security (root) | `bearerAuth` + `Agid-JWT-Signature` (NO TrackingEvidence) | `bearerAuth` + `Agid-JWT-Signature` (NO TrackingEvidence) |
| Corpo richiesta | `criteriRicerca.codiceFiscale`, `datiRichiesta` | `criteriRicerca.codiceFiscale`, **`verifica.residenza.indirizzo`** (struttura: comune/CAP/toponimo/civico — **non testo libero**), `datiRichiesta` |
| Corpo risposta | `listaSoggetti.datiSoggetto[].identificativi.idANPR` | `listaSoggetti.datiSoggetto[].infoSoggettoEnte[]` con `valore` enum **A/N/S** (significato di "S" non documentato) |

> ⚠️ Solo **C020** richiede esplicitamente `Agid-JWT-TrackingEvidence` nel blocco `security` di root; C008 e C030 no (anche se lo schema di sicurezza è documentato per tutti). Il codice rispetta questa differenza.

> ⚠️ **Gap noto**: la specifica C008 vuole l'indirizzo dichiarato come oggetto strutturato (comune, CAP, via, civico), ma il frontend attuale raccoglie un solo campo di testo libero. Il backend fa un parsing best-effort (tutto nel campo "toponimo"), marcato `// VERIFICARE/TODO` nel codice — andrebbe sostituito con un form strutturato prima di un uso in produzione.

### 1.7 Stato dell'implementazione (aggiornato 22/06/2026)

`anpr.service.ts` è stato riscritto integralmente usando le tre specifiche OpenAPI reali sopra: URL, path `/anpr-service-e002`, corpo richiesta/risposta, e header di sicurezza (Signature sempre, TrackingEvidence solo per C020) sono ora basati su dati confermati, non più su placeholder. Build TypeScript verificata senza errori e ridistribuita su `service@192.168.2.22`.

**Resta da fare prima di un uso reale:**
1. ~~Configurare l'Area Impostazioni dell'app in esecuzione con i parametri reali raccolti~~ — **fatto il 22/06/2026**.
2. Sostituire il campo indirizzo libero di C008 con un form strutturato.
3. Verificare il significato esatto del valore "S" in `TipoInfoValore` (C008) — non documentato nello YAML.
4. **[BLOCCANTE per un test funzionale completo]** Risolvere il formato esatto di `Agid-JWT-Signature` (pattern ModI INTEGRITY_REST_02) — eventualmente contattando `Assistenza.anpr@pec.sogei.it` (vedi sotto).

#### Problema TLS risolto (22/06/2026)

Il primo errore reale ottenuto testando l'app ("Errore nella comunicazione con l'erogatore PDND/ANPR") era un problema TLS: `modipa-val.anpr.interno.it` usa un certificato emesso dalla CA privata **"Sogei Certification Authority Test"**, non presente in alcun trust store pubblico. Risolto aggiungendo la CA root (salvata in `backend/certs/sogei-test-ca.pem`) come CA aggiuntiva fidata via `NODE_EXTRA_CA_CERTS` nel Dockerfile del backend. **Da verificare se l'host di Produzione (`modipa.anpr.interno.it`) usa una CA diversa** (probabilmente sì, essendo l'ambiente reale) quando si passerà a Produzione.

#### Problema aperto: formato di `Agid-JWT-Signature` (pattern ModI INTEGRITY_REST_02)

Con TLS e voucher funzionanti, una chiamata reale a C030 (con il soggetto di test GIOVANNI PROVA) restituisce dal **gateway GovWay** (non da ANPR stesso, l'errore è di conformità all'ingresso):

```json
{
  "type": "https://govway.org/handling-errors/400/InteroperabilityInvalidRequest.html",
  "title": "InteroperabilityInvalidRequest",
  "status": 400,
  "detail": "Received request is not conform to the required interoperability profile",
  "govway_id": "60819f05-6e5c-11f1-b0c3-005056ae1884"
}
```

**Trovata e implementata la specifica ufficiale** (22/06/2026): *"Linee Guida sull'interoperabilità tecnica delle Pubbliche Amministrazioni — Pattern di sicurezza"* (AGID, allegato 2: `Linee_guida_interoperabilità_PA_All2_Pattern_sicurezza.pdf`), sezione 5.3 "[INTEGRITY_REST_02] Integrità del payload delle request REST in PDND", con tanto di esempio numerico completo (§5.3.3). Struttura implementata in `anpr.service.ts`:

- Header HTTP `Digest: SHA-256=<base64(sha256(body))>` (RFC 3230), inviato **in aggiunta** a `Agid-JWT-Signature`
- JOSE Header: `{alg, typ: "JWT", kid}`
- Claim `aud`: l'URL completo dell'endpoint chiamato (non un'audience generica)
- Claim `signed_headers`: `[{"digest": "SHA-256=..."}, {"content-type": "application/json"}]` (nomi header in minuscolo)
- Claim `iat`/`nbf`/`exp`, più `sub`/`iss`=client_id e `jti` (claim "secondo la logica del servizio", aggiunti per coerenza con la client assertion)

**Risultato**: nonostante l'implementazione segua ora fedelmente l'esempio numerico della specifica ufficiale, **l'errore persiste identico** (verificato con due varianti, due `govway_id` diversi: `60819f05-...` e `ecfce820-6e5c-11f1-b0c3-005056ae1884`). Questo suggerisce uno scarto sottile tra l'esempio generico del documento (riferito a un erogatore esemplificativo) e quanto specificamente richiesto dall'implementazione GovWay di ANPR — non risolvibile in modo affidabile per ulteriori tentativi-ed-errori senza visibilità sui log di validazione lato GovWay.

**Stato**: bloccante per un test funzionale end-to-end completo. **Prossimo passo consigliato**: contattare `Assistenza.anpr@pec.sogei.it` citando i `govway_id` sopra, l'e-service (`C030-servizioAccertamentoIdUnicoNazionale-approvazione_automatica`), e chiedendo conferma della struttura esatta attesa per `Agid-JWT-Signature` (eventualmente differenze rispetto all'esempio generico delle Linee Guida AGID).

---

## 2. Architettura del Software

### 2.1 Stack tecnologico raccomandato

| Layer | Tecnologia raccomandata | Motivazione |
|---|---|---|
| **Frontend** | **React + TypeScript + Vite** con **`design-react-kit` (Bootstrap Italia)** | Type-safety; **Bootstrap Italia** è il design system ufficiale AGID → UI conforme PA "gratis". |
| **Backend** | **Node.js + TypeScript + Express** (o Fastify/NestJS) | Stessa lingua del FE; ecosistema crypto maturo. |
| **Libreria JWT/JWS** | **`jose`** | Gestisce RS256/ES256, JWS *compact*, payload detached e i pattern di firma ModI in modo pulito. |
| **HTTP client** | **`axios`** o `undici` | Chiamate a `/token` e all'e-service. |
| **Database** | **SQLite** (MVP) → **PostgreSQL** (produzione/multi-istanza) | Persistenza configurazione cifrata + log di audit. |
| **Cifratura segreti** | **AES-256-GCM** (modulo `crypto` nativo) | *Envelope encryption* della chiave privata a riposo. |
| **Auth applicativa** | Sessione **cookie httpOnly** + password con **argon2id** | Protegge l'Area Impostazioni; predisposto per SSO/SPID futuro. |

> **Alternativa Python:** FastAPI + `authlib`/`PyJWT` + `cryptography` + SQLModel. Ugualmente valida; scegliendo Node si ha un unico linguaggio FE/BE.

### 2.2 Principio architetturale di sicurezza (NON negoziabile)

```
        ┌──────────────────────────┐
        │  FRONTEND (React/Vite)    │   ← NESSUNA chiave, NESSUNA firma qui
        │  - UI ricerca             │
        │  - UI impostazioni        │
        └───────────┬──────────────┘
                    │ HTTPS (cookie sessione httpOnly)
                    ▼
        ┌──────────────────────────────────────────────┐
        │  BACKEND (Node/TS)  — Confine di fiducia       │
        │                                                │
        │  1. Legge config cifrata dal DB                │
        │  2. Decifra la PRIVATE KEY solo in memoria     │
        │  3. Firma la CLIENT ASSERTION (JWT)            │
        │  4. POST /token PDND  → ottiene VOUCHER        │
        │  5. (cache voucher in memoria fino a scadenza) │
        │  6. CF → ID ANPR (C030), poi C008/C033         │
        │  7. Aggiunge header ModI (Agid-JWT-*)          │
        │  8. Filtra/minimizza la risposta               │
        │  9. Scrive AUDIT LOG                           │
        └───────────┬───────────────────┬───────────────┘
                    │                   │
          POST /token.oauth2      GET e-service ANPR
                    ▼                   ▼
        ┌──────────────────┐   ┌──────────────────────┐
        │  PDND Auth Server│   │  ANPR (Min. Interno)  │
        └──────────────────┘   └──────────────────────┘
```

**Regole ferree:**
- La **chiave privata** è cifrata a riposo nel DB (AES-256-GCM) con una **KEK** fornita via *environment variable* / secret manager / OS keystore; viene **decifrata solo in RAM** al momento della firma.
- Il **frontend non vede mai** chiave privata, client assertion, voucher né `client_id`.
- I campi segreti in Impostazioni sono **write-only**: l'API non li ri-espone mai (ritorna solo un flag "configurato ✓").
- **Voucher cache**: riusa il token fino a poco prima della scadenza (`expires_in`, es. 600s) per non sovraccaricare il `/token`.
- **HTTPS obbligatorio**; security headers (`helmet`), rate limiting, CORS ristretto al solo frontend.

### 2.3 Dettaglio del flusso PDND (cosa implementa il backend)

**A) Client Assertion (JWT firmato con la chiave privata)**

```jsonc
// Header
{ "alg": "RS256", "kid": "<KID>", "typ": "JWT" }

// Payload
{
  "iss": "<CLIENT_ID>",
  "sub": "<CLIENT_ID>",
  "aud": "auth.interop.pagopa.it/client-assertion",
  "jti": "<UUID v4 univoco>",
  "iat": 1719000000,
  "exp": 1719000600,
  "purposeId": "<PURPOSE_ID dell'e-service target>"
  // "digest": { "alg": "SHA256", "value": "<hash del JWS aggiuntivo>" }
  //   ↑ presente solo nel flusso "con informazioni aggiuntive" (audit/tracking)
}
```

**B) Richiesta del Voucher** — `POST {tokenEndpoint}` con body `application/x-www-form-urlencoded`:

| Parametro | Valore |
|---|---|
| `client_id` | `<CLIENT_ID>` |
| `client_assertion` | il JWT firmato al punto A |
| `client_assertion_type` | `urn:ietf:params:oauth:client-assertion-type:jwt-bearer` |
| `grant_type` | `client_credentials` |

Risposta: `{ "access_token": "<voucher JWT>", "token_type": "Bearer", "expires_in": 600 }`.

**C) Chiamata all'e-service ANPR** — header:

| Header | Contenuto |
|---|---|
| `Authorization` | `Bearer <voucher>` |
| `Agid-JWT-TrackingEvidence` | JWS con le "informazioni aggiuntive"/tracciatura (pattern **AUDIT_REST**) — tipicamente richiesto da ANPR |
| `Agid-JWT-Signature` | JWS di integrità sul digest del messaggio (pattern **INTEGRITY_REST**) — **se** richiesto dalla scheda dell'e-service |
| `Content-Type` | `application/json` |

> ⚠️ **ANPR adotta pattern di sicurezza ModI oltre al voucher base.** Quali header e quali firme servono per ogni specifico servizio (C008/C033/...) è definito nella **specifica tecnica/OpenAPI dell'e-service** sul catalogo. Implementare leggendo quella scheda: è la fonte autoritativa.

---

## 3. Design delle Funzionalità

### 3.1 Area Consultazione (Frontend)

Due modalità, selezionabili, pensate per la **minimizzazione**:

1. **Verifica residenza (consigliata di default)** — l'operatore inserisce **CF + indirizzo dichiarato**; il backend usa **C008** e restituisce solo **✅ Conforme / ❌ Non conforme**. Nessun dato personale ulteriore viene esposto.
2. **Consultazione residenza** — l'operatore inserisce il **CF**; il backend risolve **CF → ID ANPR (C030)** e poi chiama **C033**, mostrando **solo** i campi di residenza necessari alla finalità selezionata.

Elementi UI:
- Campo **CF** con validazione formato (16 caratteri, pattern CF).
- Selettore **Finalità/Servizio** (obbligatorio, popolato dalle finalità configurate).
- **Motivazione/numero pratica** (per l'audit).
- Risultato in **scheda leggibile**, con badge di stato; pulsante "Nuova ricerca" che **pulisce** i dati dallo schermo.
- Nessun *download massivo*; nessuna persistenza dei dati personali lato client.

### 3.2 Area Impostazioni (protetta)

- **Login amministratore** (password argon2id, sessione httpOnly).
- Form di configurazione con campi: `client_id`, `kid`, **chiave privata** (textarea, write-only), `purposeId` **per ciascun e-service** (tabella mappature `servizio → purposeId`), `tokenEndpoint`, `audience` client-assertion, **base URL e-service**, ambiente (Collaudo/Produzione).
- I segreti si **salvano cifrati**; in lettura l'API ritorna solo `{ configured: true, kidMasked: "…ab12" }`.
- Pulsante **"Test connessione"**: il backend prova a ottenere un voucher in Collaudo e riporta esito senza esporre il token.

### 3.3 Audit & Data Protection (trasversale)

- **Log immutabile** per ogni ricerca: operatore, timestamp, servizio, finalità, CF (valutare *hashing*), motivazione, esito, codice risposta ANPR. **Non** loggare l'intero payload anagrafico.
- **Retention** configurabile e minima; cancellazione automatica.
- Errori PDND/ANPR mappati in messaggi chiari (401/403 voucher, 404 soggetto non trovato, 429 rate limit).

---

# STEP 2 — Prompt per il "Coder Model" (es. Claude Sonnet 4.6)

Copia tutto il blocco compreso tra **`===== INIZIO PROMPT =====`** e **`===== FINE PROMPT =====`** e incollalo nel modello generatore di codice.

===== INIZIO PROMPT =====

**RUOLO:** Sei un senior full-stack engineer esperto di integrazioni sicure con la PDND italiana. Genera un'applicazione production-ready chiamata **ANPR Explorer**: un ente *Fruitore* consulta dati ANPR via PDND. Scrivi codice completo, commentato in italiano, type-safe.

**VINCOLI DI SICUREZZA (NON NEGOZIABILI):**
1. Chiave privata e firma dei JWT **esclusivamente nel backend**. Il frontend non riceve mai chiavi, client assertion, voucher o `client_id`.
2. I segreti si salvano **cifrati AES-256-GCM** nel DB; la KEK arriva da `APP_ENCRYPTION_KEY` (env). Decifratura solo in memoria.
3. Campi segreti **write-only**: le API di lettura non li ri-espongono mai.
4. Tutte le rotte (tranne login) protette da sessione; `helmet`, CORS ristretto, rate limiting, validazione input (`zod`).

**STACK:**
- Backend: Node.js 20 + TypeScript + Express + `jose` (JWT/JWS) + `axios` + `better-sqlite3` + `argon2` + `zod` + `helmet` + `express-session` + `uuid`.
- Frontend: React 18 + TypeScript + Vite + `design-react-kit` (Bootstrap Italia) + `react-router-dom` + `axios`.

**STRUTTURA CARTELLE:**
```
anpr-explorer/
├── backend/
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── db/index.ts                # init SQLite + migrazioni
│   │   ├── services/
│   │   │   ├── crypto.service.ts      # AES-256-GCM encrypt/decrypt
│   │   │   ├── pdnd.service.ts        # build+sign client assertion, get voucher
│   │   │   ├── voucherCache.service.ts# cache voucher per purposeId
│   │   │   ├── anpr.service.ts        # C030→C033 / C008, header ModI
│   │   │   ├── settings.service.ts    # CRUD config cifrata
│   │   │   └── audit.service.ts       # log accessi
│   │   ├── routes/
│   │   │   ├── auth.routes.ts         # POST /login, /logout
│   │   │   ├── settings.routes.ts     # GET/PUT /settings, POST /settings/test
│   │   │   └── anpr.routes.ts         # POST /anpr/verifica, /anpr/consulta
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── types/index.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/client.ts              # axios withCredentials
│   │   ├── api/anpr.ts
│   │   ├── api/settings.ts
│   │   ├── pages/{LoginPage,SearchPage,SettingsPage}.tsx
│   │   ├── components/{ResultCard,ProtectedRoute,Layout}.tsx
│   │   ├── types/index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docker-compose.yml
└── README.md
```

**BACKEND — istruzioni dettagliate:**

1. `crypto.service.ts`: `encrypt(plaintext)` e `decrypt(payload)` con AES-256-GCM, KEK da `APP_ENCRYPTION_KEY` (32 byte, base64); salva `iv:authTag:ciphertext`.

2. `settings.service.ts` + tabella `settings`: campi `client_id`, `kid`, `private_key`(cifrata), `token_endpoint`, `client_assertion_audience`, `anpr_base_url`, `environment`. Tabella `purpose_map(service_code, purpose_id)`. La GET ritorna solo `{ configured: boolean, kidMasked, environment, hasPrivateKey: boolean }`.

3. `pdnd.service.ts`:
   - `buildClientAssertion(purposeId)`: header `{ alg, kid, typ:"JWT" }` (alg dedotto dalla chiave: RSA→RS256, EC→ES256); payload `{ iss:client_id, sub:client_id, aud:client_assertion_audience, jti:uuidv4(), iat:now, exp:now+600, purposeId }`. Firma con `jose` (`SignJWT` + `importPKCS8`).
   - `requestVoucher(purposeId)`: `POST token_endpoint` (form-urlencoded) con `client_id`, `client_assertion`, `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`, `grant_type=client_credentials`. Ritorna `{ access_token, expires_in }`.

4. `voucherCache.service.ts`: cache in memoria `Map<purposeId,{token,exp}>`; rinnova se mancano <60s alla scadenza.

5. `anpr.service.ts`:
   - `resolveIdAnpr(cf)`: chiama **C030** con voucher del purpose di C030.
   - `verificaResidenza(cf, indirizzo)`: chiama **C008** → `{ esito: boolean }`.
   - `consultaResidenza(cf)`: `resolveIdAnpr` poi **C033**, ritorna **solo** i campi di residenza necessari.
   - Aggiungi header `Authorization: Bearer`, e predisponi (con TODO documentato) `Agid-JWT-TrackingEvidence` e, se richiesto dalla scheda e-service, `Agid-JWT-Signature` (JWS di integrità sul digest del body). Lascia le funzioni `buildTrackingEvidence()` / `buildIntegritySignature()` pronte e commentate, indicando che i claim esatti vanno presi dalla specifica ANPR.
   - Body/percorsi degli e-service: usa costanti placeholder con commento "// VERIFICARE su OpenAPI della scheda e-service".

6. `anpr.routes.ts`: `POST /api/anpr/verifica` e `POST /api/anpr/consulta`; validano con `zod` (CF regex), richiamano i service, scrivono `audit.service.log(...)` e ritornano payload **minimizzato**.

7. `auth.routes.ts`: login con utente admin (`ADMIN_PASSWORD_HASH` argon2id), sessione cookie httpOnly+sameSite=strict.

8. `error.middleware.ts`: mappa errori PDND/ANPR (401/403 → "voucher/abilitazione", 404 → "soggetto non trovato", 429 → "limite chiamate"). Non logga mai segreti.

**FRONTEND — istruzioni dettagliate:**
- `api/client.ts`: axios con `withCredentials:true`, baseURL da `VITE_API_BASE_URL`.
- `LoginPage`: form password → `POST /api/login`.
- `SearchPage`: toggle **Verifica** / **Consultazione**; campo CF (validazione), indirizzo (solo in Verifica), select Finalità, campo Motivazione; mostra `ResultCard` (badge Conforme/Non conforme oppure scheda residenza minimizzata); pulsante "Nuova ricerca" che azzera lo stato.
- `SettingsPage` (dietro `ProtectedRoute`): form per i parametri PDND con private key in textarea write-only; mostra stato `configured`; pulsante "Test connessione" → `POST /api/settings/test`.
- Usa componenti Bootstrap Italia (Input, Button, Card, Alert, Toggle).

**FILE `.env.example`:**

`backend/.env.example`:
```
PORT=4000
NODE_ENV=development
SESSION_SECRET=change-me-long-random
APP_ENCRYPTION_KEY=base64-32-bytes-key   # openssl rand -base64 32
ADMIN_PASSWORD_HASH=argon2id-hash-here
CORS_ORIGIN=http://localhost:5173
DB_PATH=./data/anpr-explorer.db
# Valori PDND inseriti via UI Impostazioni (cifrati nel DB), NON qui.
# Per Collaudo: token endpoint su host auth.uat.interop.pagopa.it
```

`frontend/.env.example`:
```
VITE_API_BASE_URL=http://localhost:4000/api
```

**OUTPUT RICHIESTO:** tutti i file sopra con codice completo e funzionante, `README.md` con istruzioni di avvio (backend e frontend), `docker-compose.yml`, e commenti `// VERIFICARE` nei punti che dipendono dalla specifica OpenAPI dell'e-service ANPR. Genera prima il backend, poi il frontend.

===== FINE PROMPT =====

---

## Fonti ufficiali consultate

- [Manuale Operativo PDND – Utilizzare i voucher](https://developer.pagopa.it/pdnd-interoperabilita/guides/pdnd-manuale-operativo/manuale-operativo/utilizzare-i-voucher)
- [Voucher Bearer per le API di un erogatore (con informazioni aggiuntive)](https://developer.pagopa.it/pdnd-interoperabilita/guides/manuale-operativo-pdnd-interoperabilita/tutorial/tutorial-per-il-fruitore/come-richiedere-un-voucher-bearer-per-le-api-di-un-erogatore-con-informazioni-aggiuntive)
- [AGID – Linee guida interoperabilità: voucher di autorizzazione (PDF)](https://www.agid.gov.it/sites/agid/files/2024-07/Linee_guida_interoperabilita_pdnd_All3_voucher_di_autorizzazione.pdf)
- [ANPR – Accesso ai dati](https://www.anagrafenazionale.interno.it/area-tecnica/accesso-ai-dati/)
- [ANPR – Consultazione tramite ID ANPR (Identificativo Unico Nazionale)](https://www.anagrafenazionale.interno.it/anpr/notizie/accesso-ai-dati-anpr-consultazione-tramite-identificativo-unico-nazionale-id-anpr/)

---

## Riepilogo decisioni chiave

- **Stack scelto:** React+TS+Vite (Bootstrap Italia) / Node+TS+Express+`jose` / SQLite→Postgres — chiavi e firma JWT **solo backend**.
- **Vincolo ANPR fondamentale:** ricerca per **ID ANPR**, non CF → il backend risolve **C030 (CF→ID ANPR)** prima di **C033/C008**.
- **Minimizzazione:** modalità *Verifica* (C008, solo Sì/No) come default; *Consultazione* (C033) con campi filtrati.
- **Da riverificare in fase di codice:** percorsi/versioni esatti degli e-service e i pattern di firma ModI (`Agid-JWT-TrackingEvidence` / `Agid-JWT-Signature`) sulla **scheda OpenAPI dell'e-service** nel catalogo PDND.
