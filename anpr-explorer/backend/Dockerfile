FROM node:20-alpine AS build
WORKDIR /app

# Strumenti di compilazione necessari per il modulo nativo better-sqlite3.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# CA radice "Sogei Certification Authority Test" (privata, non in alcun trust store
# pubblico): necessaria perché Node si fidi del certificato TLS di
# modipa-val.anpr.interno.it (ambiente di Collaudo ANPR). Verificare/aggiornare se
# l'host di Produzione (modipa.anpr.interno.it) usa una CA diversa.
ENV NODE_EXTRA_CA_CERTS=/app/certs/sogei-test-ca.pem
COPY certs ./certs

# Si copia node_modules già compilato dallo stage di build (stessa libc),
# evitando di dover ricompilare il modulo nativo nello stage finale.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

RUN mkdir -p /app/data

EXPOSE 4000
CMD ["node", "dist/server.js"]
