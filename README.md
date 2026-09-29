# ANPR Explorer

Applicazione web per gli **enti fruitori della PDND** (Piattaforma Digitale Nazionale Dati)
che permette agli operatori di consultare l'**Anagrafe Nazionale della Popolazione Residente
(ANPR)** in modo controllato: solo i dati necessari, ogni ricerca motivata e tracciata, nessun
segreto esposto al browser.

Nasce per gli uffici comunali che devono accertare la residenza o lo stato di famiglia di una
persona per una pratica, senza passare dal portale ANPR e senza sviluppare da zero
l'integrazione con la PDND e con i pattern di sicurezza ModI richiesti da ANPR.

## Funzionalità

- **Consultazione residenza.** Dal codice fiscale ottiene l'identificativo unico ANPR
  (e-service C030) e poi la residenza (C020). Mostra solo i campi di residenza, più l'eventuale
  dato di decesso.
- **Stato di famiglia** (C021). Composizione del nucleo familiare. Per una persona deceduta
  mostra il nucleo al giorno precedente il decesso, e da lì si può aprire lo stato di famiglia
  attuale dei superstiti.
- **Motivazione obbligatoria.** Ogni ricerca richiede una motivazione o un numero di pratica,
  che finisce nel registro degli accessi.
- **Registro degli accessi (audit).** Per ogni ricerca registra operatore, servizio,
  motivazione ed esito. Il codice fiscale è salvato mascherato. I dati restituiti da ANPR non
  vengono mai registrati.
- **Utenti e ruoli.** Amministratori (configurazione, utenti, registro) e operatori (solo
  consultazione).
- **Configurazione PDND da interfaccia.** `client_id`, `kid`, chiave privata, endpoint e
  finalità si inseriscono dal pannello Impostazioni e vengono salvati cifrati. Un pulsante
  **Test** verifica per ogni servizio che il voucher venga emesso.
- **Collaudo e produzione.** Si passa da un ambiente all'altro cambiando le impostazioni,
  senza toccare il codice.

## Come funziona

```
Browser (React)  ──►  Backend (Node.js/Express)  ──►  PDND: token endpoint  →  voucher
     nessun segreto        │  firma client assertion (RS256)
                           │  firma Agid-JWT-Signature / Agid-JWT-TrackingEvidence (ModI)
                           └──►  ANPR (GovWay del Ministero dell'Interno): C030, C020, C021
```

- **Backend**: Node.js 20, TypeScript, Express, SQLite. Firma la *client assertion*, ottiene
  il voucher dalla PDND (con cache), aggiunge gli header ModI richiesti da ANPR
  (`INTEGRITY_REST_02`, `AUDIT_REST_02`), chiama gli e-service e riduce la risposta ai soli
  campi necessari. Chiave privata e segreti vivono solo qui, cifrati a riposo (AES-256-GCM).
- **Frontend**: React 18, TypeScript, Vite, Bootstrap Italia. Interfaccia di consultazione,
  registro accessi, utenti e impostazioni. Non riceve mai chiavi, assertion o voucher.

---

## 1. Ottenere l'accesso ad ANPR sulla PDND

Serve un ente **aderente alla PDND Interoperabilità**. Tutti i passi si fanno dal back-office
PDND: in produzione dall'Area Riservata PagoPA (prodotto *Interoperabilità*), in collaudo da
`selfcare.uat.interop.pagopa.it`. **Conviene completare tutto prima in collaudo** e poi
ripetere in produzione: sono due ambienti separati, con client, chiavi e finalità diversi.

Prima di iniziare, coinvolgi il **DPO**: l'app tratta dati anagrafici. La finalità PDND
richiede una base giuridica e un'analisi del rischio, e il trattamento va inserito nel
registro dei trattamenti.

### 1.1 Adesione e ruoli

L'adesione alla PDND la fa il legale rappresentante dell'ente (o un delegato) con SPID o CIE.
Per i passi successivi servono utenti con il ruolo di **Amministratore** o **Operatore API**
(creano fruizioni, finalità e client). Per caricare le chiavi serve anche l'**Operatore di
sicurezza**.

### 1.2 Richiedere la fruizione degli e-service ANPR

1. Apri il **Catalogo e-service** e filtra per erogatore **Ministero dell'Interno**, oppure
   cerca per nome il codice del servizio (es. `C030`).
2. ANPR non è un unico e-service: ce n'è uno per ogni caso d'uso. Questa app ne usa tre:

   | E-service | A cosa serve |
   |---|---|
   | `C030-servizioAccertamentoIdUnicoNazionale` | Dal codice fiscale all'identificativo unico ANPR (passo preliminare obbligatorio) |
   | `C020-servizioAccertamentoResidenza` | Residenza, con l'eventuale dato di decesso |
   | `C021-servizioAccertamentoStatoFamiglia` | Stato di famiglia |

3. Quasi ogni servizio ha due varianti. Se il tuo ente rientra nei requisiti (i Comuni sì,
   per la circolare DAIT n. 73/2023), scegli quella **`-approvazione_automatica`**: si
   attiva subito. L'altra resta in attesa di approvazione manuale del Ministero.
   Nella scheda di ogni e-service, alla sezione *Soglie e attributi*, trovi gli attributi
   richiesti e le soglie di chiamate al giorno.
4. Nella scheda premi **Richiedi fruizione** e ripeti per ciascun e-service.
5. Dalla scheda scarica anche la **specifica OpenAPI** e, per il collaudo, il file dei
   **casi di test** con i soggetti fittizi da usare.

> **Da evitare:** `ANPR-Certificazione` è riservato a Notariato e Poste Italiane.
> `C033-servizioAccertamentoResidenzaSenzaDecesso` non è utilizzabile da un Comune: non ha la
> variante ad approvazione automatica e richiede un attributo del Ministero delle
> infrastrutture. Per la residenza si usa C020.

### 1.3 Creare le finalità

Una finalità è legata a un solo e-service, quindi ne servono **tre** (C030, C020, C021).
Per ciascuna:

1. **Le tue finalità → Crea nuova finalità**, scegli l'e-service.
2. Compila nome, descrizione e base giuridica, poi l'**analisi del rischio** (questionario
   sul trattamento dei dati).
3. Indica la **stima di carico** (chiamate al giorno previste): sopra la soglia dell'e-service
   serve l'approvazione dell'erogatore.
4. Pubblica la finalità e annota il **`purposeId`** (UUID).

### 1.4 Creare il client e caricare la chiave pubblica

1. **I tuoi client → Crea nuovo client**, di tipo **API/e-service** (machine-to-machine).
2. **Associa al client le tre finalità** create al passo 1.3.
3. Annota il **`client_id`** (UUID).
4. Genera la coppia di chiavi. La chiave privata non va mai caricata sulla PDND e non va
   mai committata:

   ```bash
   openssl genrsa -out private.pem 2048
   openssl rsa -in private.pem -pubout -out public.pem
   ```

5. Nel client, **Chiavi pubbliche → Aggiungi**, incolla `public.pem` e annota il **`kid`**
   che la PDND assegna alla chiave.

### 1.5 Parametri da inserire nell'app

| Parametro | Dove si trova | Collaudo | Produzione |
|---|---|---|---|
| `client_id` | Dettaglio del client | | |
| `kid` | Client → Chiavi pubbliche | | |
| Chiave privata | Il tuo `private.pem` | | |
| `purposeId` (uno per C030, C020, C021) | Dettaglio di ogni finalità | | |
| Token endpoint | Pagina del client nel back-office | `https://auth.uat.interop.pagopa.it/token.oauth2` | `https://auth.interop.pagopa.it/token.oauth2` |
| Audience della client assertion | Pagina del client nel back-office | `auth.uat.interop.pagopa.it/client-assertion` | `auth.interop.pagopa.it/client-assertion` |
| Base URL ANPR (solo prefisso, senza slash finale) | Scheda e-service → *Server URL* | `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND` | `https://modipa.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND` |
| Codice IPA dell'ente | IndicePA (es. `c_xxxx`) | | |

I valori degli endpoint sono quelli verificati al momento della scrittura. **Ricontrollali
sempre nel back-office e nella scheda dell'e-service**, perché possono cambiare nel tempo.

> **Suggerimento:** nella pagina di ogni client il back-office ha il pulsante **«Simula
> l'ottenimento del voucher»**. Prova l'intera catena (client assertion → voucher) senza
> scrivere codice e porta allo strumento **«Debug client assertion»**, che restituisce un
> esito dettagliato. È il modo più rapido per verificare `client_id`, `kid` e chiave prima
> di configurare l'app.
Il codice IPA finisce nell'header di tracciamento richiesto da ANPR (`userLocation`, al
massimo 20 caratteri).

---

## 2. Installazione

Requisiti: **Docker** con Docker Compose (consigliato), oppure **Node.js ≥ 20** e npm.
Serve anche **OpenSSL** per generare i segreti.

### 2.1 Configurazione del backend

```bash
git clone <url-della-repo> anpr-explorer
cd anpr-explorer/anpr-explorer
cp backend/.env.example backend/.env
```

Genera i segreti e inseriscili in `backend/.env`:

```bash
openssl rand -base64 32    # APP_ENCRYPTION_KEY: cifra i segreti PDND nel database
openssl rand -base64 48    # SESSION_SECRET
```

Per la password dell'amministratore serve l'hash argon2id:

```bash
cd backend && npm install
node -e "require('argon2').hash('LaTuaPasswordSicura').then(console.log)"
```

Incollalo in `ADMIN_PASSWORD_HASH`. **Se usi Docker, raddoppia ogni `$` dell'hash**
(`$$argon2id$$v=19$$m=...`): Docker Compose interpreta i `$` anche nei file `env_file` e,
senza raddoppio, corrompe l'hash senza segnalare errori, e il login fallisce. Dopo l'avvio
puoi verificarlo con `docker exec <container-backend> printenv ADMIN_PASSWORD_HASH`.

I parametri PDND **non** vanno nel `.env`: si inseriscono dall'interfaccia (vedi §3).

### 2.2 Certificato della CA di collaudo ANPR

Il Dockerfile del backend copia la cartella `backend/certs`, che quindi **deve esistere**
(anche vuota), altrimenti la build fallisce:

```bash
mkdir -p backend/certs
```

In **collaudo**, il server ANPR (`modipa-val.anpr.interno.it`) usa un certificato emesso dalla
CA privata *Sogei Certification Authority Test*, che non è tra quelle riconosciute di default.
Salva il certificato root di quella CA in `backend/certs/sogei-test-ca.pem`: il container lo
aggiunge alle CA fidate tramite `NODE_EXTRA_CA_CERTS`. Senza, le chiamate in collaudo
falliscono con un errore TLS. I file `.pem` sono esclusi da git.

### 2.3 Avvio con Docker

```bash
docker compose up -d --build
```

- Interfaccia: `http://localhost:5173`
- API: `http://localhost:4000`

Il database SQLite (utenti, impostazioni cifrate, registro accessi) sta nel volume
`backend-data`.

**Su un server**, crea accanto a `docker-compose.yml` un file `.env` con gli indirizzi da cui
l'app sarà raggiunta. `VITE_API_BASE_URL` viene incorporato nel frontend in fase di build:

```bash
CORS_ORIGIN=http://IP_DEL_SERVER:5173
VITE_API_BASE_URL=http://IP_DEL_SERVER:4000/api
```

Per un uso reale, metti l'app dietro un reverse proxy con **HTTPS**.

### 2.4 Sviluppo locale senza Docker

In due terminali separati, dalla cartella `anpr-explorer/anpr-explorer`:

```bash
cd backend && npm install && npm run dev      # API su http://localhost:4000
```

```bash
cd frontend && cp .env.example .env && npm install && npm run dev   # interfaccia su http://localhost:5173
```

---

## 3. Primo avvio

1. Apri l'interfaccia ed entra con l'utente amministratore (`ADMIN_USERNAME` e la password
   di cui hai generato l'hash).
2. Vai in **Impostazioni** e inserisci i parametri del §1.5: ambiente (Collaudo o
   Produzione), `client_id`, `kid`, chiave privata (incolla il contenuto di `private.pem`),
   token endpoint, audience, base URL ANPR, codice IPA e i tre `purposeId`.
   I campi segreti sono in sola scrittura: una volta salvati non vengono più mostrati.
3. Premi **Test** accanto a ogni servizio: deve risultare ottenuto il voucher.
4. In collaudo prova una ricerca con un **soggetto fittizio** del file dei casi di test
   (es. `PRVGNN90R10H501Q`, GIOVANNI PROVA). **Non usare mai dati reali in collaudo.**
5. Da **Utenti** crea gli account degli operatori.

## Sicurezza e protezione dei dati

- Chiave privata e firme JWT solo nel backend, mai esposte al frontend.
- Segreti cifrati a riposo (AES-256-GCM) e decifrati solo in memoria al momento della firma.
- Campi segreti in sola scrittura: le API restituiscono solo valori mascherati.
- Sessione con cookie `httpOnly` e `sameSite=strict`. Tutte le API, tranne il login,
  richiedono autenticazione.
- Minimizzazione: il backend restituisce solo i campi necessari alla funzione richiesta.
- Registro accessi con motivazione obbligatoria e codice fiscale mascherato.

## Struttura della repository

```
.
├── anpr-explorer/
│   ├── backend/            # API Express: PDND, firme ModI, chiamate ANPR, audit
│   ├── frontend/           # React + Vite, interfaccia Bootstrap Italia
│   ├── docker-compose.yml
│   └── README.md           # note tecniche per lo sviluppo
└── PDND_ANPR_Explorer_Architettura_e_Guida.md   # guida operativa PDND e architettura
```

Per approfondire il flusso PDND, i pattern ModI e le scelte architetturali, vedi
[PDND_ANPR_Explorer_Architettura_e_Guida.md](PDND_ANPR_Explorer_Architettura_e_Guida.md).

## Riferimenti

- [PDND Interoperabilità: documentazione per sviluppatori](https://developer.pagopa.it/pdnd-interoperabilita)
- [ANPR: documentazione tecnica](https://www.anpr.interno.it/)
- Linee Guida AgID sull'interoperabilità tecnica delle PA, allegato 2 *Pattern di sicurezza*
  (`INTEGRITY_REST_02`, `AUDIT_REST_02`)
