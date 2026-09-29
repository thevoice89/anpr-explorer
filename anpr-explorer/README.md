# ANPR Explorer

Applicazione web per enti **Fruitori PDND** che consente agli operatori di consultare
dati ANPR (accertamento residenza) nel rispetto del principio di minimizzazione del dato.

> ⚠️ **Prima di andare in produzione**: i servizi usati sono **C030** (CF → ID ANPR),
> **C008** (verifica residenza, Sì/No) e **C020** (accertamento residenza — *non* C033,
> verificato live non utilizzabile da un Comune). Il prefisso di path in
> [`backend/src/services/anpr.service.ts`](backend/src/services/anpr.service.ts)
> (`/C0XX-nomeServizio/v1`) è confermato dalle "Specifiche tecniche" del catalogo PDND;
> l'eventuale sotto-percorso/verbo finale resta marcato `// VERIFICARE` sulla specifica
> OpenAPI di ciascun e-service.

## Architettura

- **Backend** (Node.js 20 + TypeScript + Express): firma la *client assertion*, richiede
  il voucher a PDND, chiama gli e-service ANPR, minimizza la risposta. La chiave privata
  e i segreti vivono **solo qui**, cifrati a riposo (AES-256-GCM).
- **Frontend** (React 18 + TypeScript + Vite + Bootstrap Italia): interfaccia di
  consultazione e pannello impostazioni. Non riceve mai chiavi, client assertion o voucher.

## Prerequisiti

- Node.js ≥ 20
- Un'utenza PDND attiva, con client e chiavi configurati (vedi guida operativa nel
  documento `PDND_ANPR_Explorer_Architettura_e_Guida.md`)

## Avvio in locale

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Genera i segreti richiesti dal file `.env`:

```bash
# APP_ENCRYPTION_KEY (chiave di cifratura dei segreti PDND nel DB)
openssl rand -base64 32

# SESSION_SECRET
openssl rand -base64 48

# ADMIN_PASSWORD_HASH (hash argon2id della password admin)
npm install
node -e "require('argon2').hash('LaTuaPasswordSicura').then(console.log)"
```

Incolla i valori generati in `backend/.env`, poi avvia il server in modalità sviluppo:

```bash
npm run dev
```

Il backend parte su `http://localhost:4000`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Il frontend parte su `http://localhost:5173`.

### 3. Primo accesso

1. Apri `http://localhost:5173`, effettua il login con le credenziali admin configurate.
2. Vai in **Impostazioni** e inserisci: `client_id`, `kid`, chiave privata (PEM),
   token endpoint PDND, audience della client assertion, ambiente (Collaudo/Produzione)
   e i `purposeId` per i servizi C030/C008/C020.
   - **Base URL e-service ANPR**: solo il prefisso comune, **senza slash finale e senza
     il nome del servizio** (lo aggiunge il backend). Collaudo:
     `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND` ·
     Produzione: `https://modipa.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND`
     (confermato dalla specifica OpenAPI di ciascun e-service, 22/06/2026).
3. Usa il pulsante **Test** accanto a ciascun servizio per verificare che il voucher
   venga ottenuto correttamente prima di usare l'area di Consultazione.
4. Per il primo test funzionale usa un **soggetto fittizio ufficiale** (mai dati reali
   in Collaudo): es. CF `PRVGNN90R10H501Q` (GIOVANNI PROVA) — elenco completo nel file
   `casi di test C020.xlsx` scaricabile dalla scheda dell'e-service nel catalogo PDND,
   o nella sezione corrispondente di `PDND_ANPR_Explorer_Architettura_e_Guida.md`.

## Esecuzione con Docker

```bash
cp backend/.env.example backend/.env   # e compila i valori come sopra
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## Deploy su un server

Il deploy usa lo stesso `docker-compose.yml`, con un file `.env` **a livello di root** (accanto a `docker-compose.yml`, distinto da `backend/.env`) che valorizza gli URL per l'accesso via LAN:

```bash
# anpr-explorer/.env (solo sull'host di deploy, non committato)
CORS_ORIGIN=http://IP_DEL_SERVER:5173
VITE_API_BASE_URL=http://IP_DEL_SERVER:4000/api
```

Per ridistribuire dopo modifiche al codice:

```bash
tar -czf - --exclude=node_modules --exclude=dist --exclude=backend/data --exclude=backend/keys --exclude=.git anpr-explorer \
  | ssh utente@IP_DEL_SERVER 'tar -xzf - -C ~/anpr-explorer --strip-components=1'
ssh utente@IP_DEL_SERVER 'cd ~/anpr-explorer && docker compose up -d --build'
```

> ⚠️ **Trappola Docker Compose con `ADMIN_PASSWORD_HASH`**: gli hash argon2id contengono `$` (es. `$argon2id$v=19$...`). Compose applica l'**interpolazione delle variabili anche ai file referenziati da `env_file:`**, quindi `$argon2id`, `$v`, `$m` ecc. vengono silenziosamente sostituiti con stringa vuota se non escapati, **corrompendo l'hash senza errori visibili** (solo un warning "variable is not set"). In `backend/.env` ogni `$` letterale va raddoppiato: `$$argon2id$$v=19$$m=65536,t=3,p=4$$...`. Verifica sempre con `docker exec <container> printenv ADMIN_PASSWORD_HASH` dopo il deploy che l'hash coincida con quello generato, altrimenti il login admin fallisce silenziosamente.
>
> La chiave privata PDND (`backend/keys/private.pem`) **non viene mai copiata sull'host di deploy** — va incollata manualmente nell'Area Impostazioni dell'app dopo il primo avvio (si cifra e si salva nel DB SQLite del volume `backend-data`).

## Struttura del progetto

```
anpr-explorer/
├── backend/    # API Express, firma JWT, integrazione PDND/ANPR
├── frontend/   # React + Vite, UI Bootstrap Italia
└── docker-compose.yml
```

## Sicurezza

- Chiave privata e firma JWT: **solo backend**, mai esposte al frontend.
- Segreti cifrati a riposo (AES-256-GCM), decifrati solo in memoria al momento della firma.
- Campi segreti **write-only**: le API di lettura restituiscono solo flag/valori mascherati.
- Sessione via cookie `httpOnly`, `sameSite=strict`; tutte le rotte API (tranne login)
  richiedono autenticazione.
- Log di audit per ogni ricerca (operatore, servizio, motivazione, esito) — il codice
  fiscale è salvato mascherato, i dati anagrafici restituiti da ANPR non vengono mai loggati.
