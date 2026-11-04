# Tesserotto — sito

Il sito di [Tesserotto](https://github.com/gportente/tesserotto), l'app per le tessere fedeltà: la home, la pagina che apre i link di condivisione e il file di verifica degli App Link Android. È pubblicato come immagine nginx su `ghcr.io/gportente/tesserotto-website`.

## Struttura

- `public/`: i file serviti (`index.html`, `import.html`, `.well-known/assetlinks.json`)
- `nginx/`: configurazione di nginx (instradamento di `/import/…`, header di sicurezza, `/healthz`)
- `scripts/smoke-test.sh`: avvia l'immagine e controlla le pagine; lo usa la CI e si può lanciare in locale

## Contratto con l'app

Il sito e l'app sono pubblicati in tempi diversi, e in giro restano versioni vecchie dell'app: queste cose vanno tenute compatibili.

- **Link di condivisione**: `https://<dominio>/import/<tessera>`, dove `<tessera>` è il JSON della tessera in Base64. Il sito risponde con `import.html`, che legge i dati dall'URL e apre l'app con un intent Android. Il formato lo decide `lib/services/deep_link_service.dart` nel repo dell'app.
- **App Link**: `/.well-known/assetlinks.json` dichiara il pacchetto `com.gportente.tesserotto` e l'impronta SHA-256 del certificato di firma. Va aggiornato se cambia la chiave di firma o il nome del pacchetto, e deve essere un array JSON valido servito come `application/json`, altrimenti Android non verifica i link.
- **Dominio**: deve coincidere con `webHost` in `deep_link_service.dart` e con l'`intent-filter` di `AndroidManifest.xml`. Il sito risponde a qualunque nome di host: il dominio lo decide il reverse proxy.

## Sviluppo

```sh
docker build -t tesserotto-website:dev .
scripts/smoke-test.sh tesserotto-website:dev
```

## Rilascio

1. Modifiche su `main` (la CI fa build e smoke test a ogni push e pull request)
2. `git tag vX.Y.Z && git push origin vX.Y.Z`: la CI pubblica `X.Y.Z`, `X.Y` e `latest`
3. Sul server si aggiorna il tag nel compose dello stack e si fa `docker compose pull && docker compose up -d`

Versioni: patch per testi e correzioni, minor per pagine o funzioni nuove, major se cambia il contratto con l'app.
