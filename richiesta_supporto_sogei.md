**A:** Assistenza.anpr@pec.sogei.it
**Oggetto:** Richiesta supporto tecnico — Errore "InteroperabilityInvalidRequest" su e-service C030/C020/C008 (Comune di Trezzo Sull'Adda) — struttura header Agid-JWT-Signature

Buongiorno,

siamo il Comune di Trezzo Sull'Adda, ente Fruitore PDND, e stiamo integrando i seguenti e-service ANPR in ambiente di Collaudo:

- C030-servizioAccertamentoIdUnicoNazionale-approvazione_automatica
- C020-servizioAccertamentoResidenza-approvazione_automatica
- C008-servizioVerificaDichResidenza-approvazione_automatica

**Stato della configurazione (confermato funzionante):**
- Richieste di fruizione, finalità e analisi del rischio attive per tutti e tre gli e-service
- Client e chiave pubblica (RSA 2048) correttamente registrati su PDND
- Voucher ottenuto correttamente dal server di autorizzazione PDND (`https://auth.uat.interop.pagopa.it/token.oauth2`), validato sia tramite il tool "Debug client assertion" del back-office PDND sia tramite il nostro backend
- Connessione TLS verso `modipa-val.anpr.interno.it` funzionante (abbiamo correttamente registrato la CA "Sogei Certification Authority Test")

**Problema:**
Una chiamata `POST` a `https://modipa-val.anpr.interno.it/govway/rest/in/MinInternoPortaANPR-PDND/C030-servizioAccertamentoIdUnicoNazionale/v1/anpr-service-e002`, con voucher Bearer valido e header `Agid-JWT-Signature` costruito secondo il pattern ModI INTEGRITY_REST_02 (come descritto nelle Linee Guida AGID sull'interoperabilità tecnica delle PA, Allegato 2 "Pattern di sicurezza", §5.3), viene rifiutata dal gateway GovWay con:

```json
{
  "type": "https://govway.org/handling-errors/400/InteroperabilityInvalidRequest.html",
  "title": "InteroperabilityInvalidRequest",
  "status": 400,
  "detail": "Received request is not conform to the required interoperability profile"
}
```

govway_id di riferimento (richieste distinte, stesso errore):
- `60819f05-6e5c-11f1-b0c3-005056ae1884`
- `ecfce820-6e5c-11f1-b0c3-005056ae1884`

**Struttura implementata per Agid-JWT-Signature** (seguendo l'esempio numerico §5.3.3 delle Linee Guida AGID):
- Header HTTP `Digest: SHA-256=<base64(sha256(body))>` (RFC 3230), inviato insieme a `Agid-JWT-Signature`
- JOSE Header: `{"alg": "RS256", "typ": "JWT", "kid": "<kid registrato su PDND>"}`
- Payload: `{"aud": "<URL completo dell'endpoint>", "iat", "nbf", "exp", "sub": "<client_id>", "iss": "<client_id>", "jti": "<uuid>", "signed_headers": [{"digest": "SHA-256=..."}, {"content-type": "application/json"}]}`

**Richiesta:**
Potreste confermare se la struttura sopra è corretta per gli e-service ANPR specifici, oppure indicarci eventuali differenze rispetto all'esempio generico delle Linee Guida AGID (es. claim aggiuntivi richiesti, formato diverso di `signed_headers`, o requisiti specifici di GovWay non documentati nella specifica OpenAPI dell'e-service)? Un esempio concreto di richiesta valida (anche con dati fittizi) sarebbe estremamente utile.

Restiamo a disposizione per fornire ulteriori dettagli tecnici (es. log completi, JWT decodificato) se utile alla diagnosi.

Cordiali saluti,
[Nome e recapiti del referente tecnico — Comune di Trezzo Sull'Adda]
