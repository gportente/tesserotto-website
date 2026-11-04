#!/usr/bin/env bash
# Avvia l'immagine e controlla le pagine che l'app Android si aspetta.
# Uso: scripts/smoke-test.sh <immagine>
set -euo pipefail

image=${1:?uso: $0 <immagine>}
cid=$(docker run -d -p 127.0.0.1::80 "$image")
trap 'docker rm -f "$cid" >/dev/null' EXIT
port=$(docker port "$cid" 80/tcp | head -n1 | awk -F: '{print $NF}')
base="http://127.0.0.1:$port"

for _ in $(seq 1 20); do
  curl -fs -o /dev/null "$base/healthz" && break
  sleep 0.5
done

fail=0
check() { # percorso, stato atteso, content-type atteso, testo atteso nel corpo
  local path=$1 status=$2 ctype=${3:-} text=${4:-} out got ok=1
  out=$(mktemp)
  got=$(curl -s -o "$out" -w '%{http_code} %{content_type}' "$base$path")
  [[ "${got%% *}" == "$status" ]] || ok=0
  [[ -z "$ctype" || "${got#* }" == "$ctype"* ]] || ok=0
  [[ -z "$text" ]] || grep -qF -- "$text" "$out" || ok=0
  rm -f "$out"
  if (( ok )); then echo "ok  $path -> $got"; else echo "KO  $path -> $got"; fail=1; fi
}

check /                                   200 text/html        "Tesserotto"
check /import/eyJuYW1lIjoiVGVzdCJ9         200 text/html        "Importa Tessera"
check /.well-known/assetlinks.json         200 application/json "com.gportente.tesserotto"
check /healthz                             200 text/plain       "ok"
check /non-esiste                          404

if curl -fs "$base/.well-known/assetlinks.json" | jq -e 'type == "array" and length > 0' >/dev/null; then
  echo "ok  assetlinks.json è un array JSON valido"
else
  echo "KO  assetlinks.json non è un array JSON valido"; fail=1
fi

exit $fail
