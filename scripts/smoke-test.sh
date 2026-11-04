#!/usr/bin/env bash
# Avvia l'immagine e controlla le pagine che l'app Android si aspetta,
# gli asset che le pagine usano e gli header di sicurezza.
# Uso: scripts/smoke-test.sh <immagine>
set -euo pipefail

image=${1:?uso: $0 <immagine>}
here=$(cd "$(dirname "$0")/.." && pwd)
cid=$(docker run -d -p 127.0.0.1::80 "$image")
trap 'docker rm -f "$cid" >/dev/null' EXIT
port=$(docker port "$cid" 80/tcp | head -n1 | awk -F: '{print $NF}')
base="http://127.0.0.1:$port"

for _ in $(seq 1 20); do
  curl -fs -o /dev/null "$base/healthz" && break
  sleep 0.5
done

fail=0
report() { # esito (0/1), descrizione
  if (( $1 )); then echo "ok  $2"; else echo "KO  $2"; fail=1; fi
}

check() { # percorso, stato atteso, content-type atteso, testo atteso nel corpo
  local path=$1 status=$2 ctype=${3:-} text=${4:-} out got ok=1
  out=$(mktemp)
  got=$(curl -s -o "$out" -w '%{http_code} %{content_type}' "$base$path")
  [[ "${got%% *}" == "$status" ]] || ok=0
  [[ -z "$ctype" || "${got#* }" == "$ctype"* ]] || ok=0
  [[ -z "$text" ]] || grep -qF -- "$text" "$out" || ok=0
  rm -f "$out"
  report $ok "$path -> $got"
}

header() { # percorso, nome header, valore atteso (sottostringa)
  local path=$1 name=$2 want=$3 got
  got=$(curl -s -o /dev/null -D - "$base$path" | tr -d '\r' | grep -i "^$name:" | head -n1 || true)
  [[ "$got" == *"$want"* ]] && report 1 "$path $name" || report 0 "$path $name: '${got:-assente}'"
}

# Link reale generato dall'app (formato v1) e link vecchio in JSON
v1=/import/AQcNTWVyY2F0byBWZXJkZRpTdXBlcm1lcmNhdG8gwrcgQ2FydGEgUGnDuQ04MDAxMjM0NTY3ODk3AP9Oi18

check /                                   200 text/html        "Le tessere fedeltà, senza account"
check "$v1"                               200 text/html        "Importa Tessera"
check /import/eyJuYW1lIjoiVGVzdCJ9         200 text/html        "Importa Tessera"
check /.well-known/assetlinks.json         200 application/json "com.gportente.tesserotto"
check /healthz                             200 text/plain       "ok"
check /robots.txt                          200 text/plain       "Disallow: /import/"
check /non-esiste                          404 text/html        "Questa pagina non esiste"
check /import/                             404

check /assets/css/site.css                 200 text/css
check /assets/js/card-link.js              200 application/javascript "app.gabrieleportente.it"
check /assets/fonts/fraunces-latin-wght-normal.woff2 200 font/woff2
check /assets/media/cassa.mp4              200 video/mp4
check /assets/media/home.webp              200 image/webp
check /favicon.svg                         200 image/svg+xml

header /                Content-Security-Policy "default-src 'none'"
header /                X-Content-Type-Options  "nosniff"
header "$v1"            X-Robots-Tag            "noindex"
header "$v1"            Content-Security-Policy "script-src 'self'"
header /assets/css/site.css Content-Security-Policy "default-src 'none'"
header /assets/fonts/manrope-latin-wght-normal.woff2 Cache-Control "immutable"

if curl -fs "$base/.well-known/assetlinks.json" | jq -e 'type == "array" and length > 0' >/dev/null; then
  report 1 "assetlinks.json è un array JSON valido"
else
  report 0 "assetlinks.json non è un array JSON valido"
fi

# Ogni risorsa locale citata dalle pagine (src, href, poster) deve rispondere 200.
missing=0
while read -r ref; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$base$ref")
  if [[ "$code" != 200 ]]; then echo "KO  $ref -> $code"; missing=1; fi
done < <(grep -hoE '(src|href|poster)="/[^"#]*"' "$here"/public/*.html | sed -E 's/^[a-z]+="//; s/"$//' | sort -u)
report $(( ! missing )) "risorse citate dalle pagine"

exit $fail
