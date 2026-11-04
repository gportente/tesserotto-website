# Tesserotto — sito

Il sito di [Tesserotto](https://github.com/gportente/tesserotto), l'app per le tessere fedeltà, pubblicato su **https://app.gabrieleportente.it**. Contiene la home con le anteprime dell'app, la pagina che apre i link di condivisione e il file di verifica degli App Link Android. È distribuito come immagine nginx su `ghcr.io/gportente/tesserotto-website`.

## Struttura

- `public/`: i file serviti
  - `index.html`: home, con screenshot e registrazioni dell'app
  - `import.html`: pagina dei link `/import/…`; mostra la tessera e apre l'app
  - `404.html`, `robots.txt`, `favicon.*`, `apple-touch-icon.png`
  - `.well-known/assetlinks.json`: verifica degli App Link
  - `assets/css/tokens.css`: colori, font, spazi e raggi, presi da `lib/theme/app_theme.dart` dell'app
  - `assets/css/site.css`: stili delle pagine, usa solo i token
  - `assets/js/card-link.js`: decoder dei link di condivisione (modulo ES, nessun accesso al DOM)
  - `assets/js/import.js`, `assets/js/home.js`: logica delle due pagine
  - `assets/vendor/qrcode.js`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT), per il QR sulla pagina di import da desktop
  - `assets/fonts/`: Fraunces e Manrope, sottoinsieme latino (licenza SIL OFL, testi accanto ai file)
  - `assets/media/`: screenshot (WebP), registrazioni (MP4) e immagine social (`og.png`)
- `nginx/`: configurazione di nginx (instradamento di `/import/…`, cache, header di sicurezza, `/healthz`)
- `scripts/test-card-link.mjs`: test del decoder con link reali generati dall'app
- `scripts/smoke-test.sh`: avvia l'immagine e controlla pagine, asset e header

Il sito non ha dipendenze né build: i file di `public/` sono serviti così come sono. Font, script e immagini arrivano tutti dallo stesso dominio, nessun CDN.

## Contratto con l'app

Il sito e l'app sono pubblicati in tempi diversi, e in giro restano versioni vecchie dell'app: queste cose vanno tenute compatibili.

- **Dominio**: `app.gabrieleportente.it`. Deve coincidere con `webHost` in `lib/services/deep_link_service.dart`, con l'`intent-filter` di `AndroidManifest.xml` e con `APP_HOST` in `public/assets/js/card-link.js`. Il sito risponde a qualunque nome di host: il dominio lo decide il reverse proxy. L'app accetta ancora i link del vecchio dominio `app.auxrideum.ddns.ms`.
- **Link di condivisione**: `https://app.gabrieleportente.it/import/<payload>`. Il formato lo decide `deep_link_service.dart`:
  - **v1** (app 2.x): binario in Base64URL senza padding: `0x01 | flags | nome | descrizione | [codice] | [tipo codice] | [colore ARGB]`
  - **JSON in Base64** per i campi oltre i 255 byte e per i link delle versioni vecchie, con chiavi lunghe (`name`, `description`, …) o brevi (`n`, `d`, `b`, `bt`, `c`)

  `import.html` decodifica entrambi i formati nel browser, senza richieste di rete, e apre l'app con un intent Android che rimanda il payload così com'è. Se l'app non è installata, Chrome segue `S.browser_fallback_url` verso `/#scarica`. Se il formato cambia nell'app, va aggiornato `card-link.js` e vanno aggiunti nuovi link reali a `scripts/test-card-link.mjs`.
- **Ordine dei tipi di codice** (`BARCODE_TYPES` in `card-link.js`): è lo stesso di `_barcodeTypeFromEnum` nell'app. L'indice finisce dentro i link, quindi l'elenco si può solo allungare in coda.
- **App Link**: `/.well-known/assetlinks.json` dichiara il pacchetto `com.gportente.tesserotto` e l'impronta SHA-256 del certificato di firma. Va aggiornato se cambia la chiave di firma o il nome del pacchetto, e deve essere un array JSON valido servito come `application/json`, altrimenti Android non verifica i link.
- **Download**: i pulsanti puntano a `https://github.com/gportente/tesserotto/releases/latest/download/app-release.apk`. Ogni release dell'app deve allegare l'APK con questo nome.

## Aspetto

Lo stile è quello dell'app ("Soft & Warm"): crema caldo, accento terracotta-ambra, Fraunces per i titoli e Manrope per il testo, tema chiaro e scuro secondo il sistema. I valori sono in `tokens.css`, convertiti in OKLCH dalla palette dell'app: se cambia la palette dell'app, vanno aggiornati lì. Unica differenza voluta: i pulsanti pieni usano la variante più scura dell'accento (`accentStrong`), perché il bianco sull'accento normale non raggiunge il contrasto 4.5:1.

### Aggiornare screenshot e registrazioni

Le immagini in `assets/media/` vengono dall'app reale con dati di esempio (nomi di fantasia, codici generati). Per rifarle dopo una release:

- screenshot a 1080×2400, ridotti a 720×1600 in WebP (`quality` 80 circa)
- registrazioni con `adb shell screenrecord`, convertite in H.264 a 480 px di larghezza senza audio, con `-movflags +faststart`, più un poster WebP del primo fotogramma
- stessi nomi di file: la cache del browser per le immagini dura 7 giorni

## Sicurezza e privacy

- Content Security Policy restrittiva (`default-src 'none'`, script, stili, font e media solo da `'self'`): niente script inline, attributi `style` o risorse esterne nelle pagine.
- `/import/…` risponde con `X-Robots-Tag: noindex` ed è escluso in `robots.txt`; la pagina usa `referrer: no-referrer`, così il link con i dati della tessera non finisce nei referrer.
- Nessun cookie, nessuno strumento di statistiche.

## Sviluppo

```sh
npm test                                   # decoder dei link (Node 22 o successivo)
docker build -t tesserotto-website:dev .
scripts/smoke-test.sh tesserotto-website:dev   # richiede curl e jq
```

Per vedere il sito in locale: `docker run --rm -p 8080:80 tesserotto-website:dev` e poi http://localhost:8080. Per provarlo su un telefono o emulatore Android collegato: `adb reverse tcp:8080 tcp:8080`. Il pulsante "Apri in Tesserotto" funziona anche da lì, perché l'intent usa sempre il dominio di produzione.

## Rilascio

1. Modifiche su `main` (la CI esegue test, build e smoke test a ogni push e pull request)
2. `git tag vX.Y.Z && git push origin vX.Y.Z`: la CI pubblica `X.Y.Z`, `X.Y` e `latest`
3. Sul server si aggiorna il tag nel compose dello stack e si fa `docker compose pull && docker compose up -d`

Versioni: patch per testi e correzioni, minor per pagine o funzioni nuove, major se cambia il contratto con l'app.
