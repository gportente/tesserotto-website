// Decodifica dei link di condivisione di Tesserotto: /import/<payload>
//
// Il formato lo decide lib/services/deep_link_service.dart nel repo dell'app:
// - v1 (attuale): payload binario in Base64URL senza padding
//     0x01 | flags | len nome | nome | len descr | descr
//          | [len codice | codice] (flags & 0x01)
//          | [tipo codice, enum]   (flags & 0x02)
//          | [colore ARGB uint32 big-endian] (flags & 0x04)
// - JSON in Base64 (fallback per campi > 255 byte e link vecchi), con chiavi
//   lunghe (name, description, barcode, barcodeType, colorValue) o brevi (n, d, b, bt, c).
//
// Il modulo non tocca il DOM: lo usano import.js nel browser e i test in Node.

/** Dominio che l'app riconosce (webHost in deep_link_service.dart). */
export const APP_HOST = "app.gabrieleportente.it";
export const APP_PACKAGE = "com.gportente.tesserotto";

// Stesso ordine di _barcodeTypeFromEnum nell'app: l'indice è il valore nel payload.
export const BARCODE_TYPES = [
  "ean13", "upcA", "code128", "qrCode", "ean8", "code39",
  "itf", "pdf417", "codabar", "aztec", "dataMatrix", "code93",
];

export const BARCODE_LABELS = {
  ean13: "EAN-13", upcA: "UPC-A", code128: "Code 128", qrCode: "QR Code",
  ean8: "EAN-8", code39: "Code 39", itf: "ITF", pdf417: "PDF417",
  codabar: "Codabar", aztec: "Aztec", dataMatrix: "Data Matrix", code93: "Code 93",
};

/** Numero di colori in kCardPalette (lib/theme/app_colors.dart). */
export const CARD_PALETTE_SIZE = 10;

const MAX_PAYLOAD_CHARS = 4096;

/** Estrae il payload dal percorso, tutto quello che segue /import/. */
export function payloadFromPath(pathname) {
  const match = /^\/import\/(.+)$/.exec(pathname || "");
  if (!match) return null;
  let raw = match[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return raw.replace(/\/+$/, "") || null;
}

/** Base64 o Base64URL, con o senza padding, in byte. */
export function base64ToBytes(input) {
  const clean = String(input).replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) {
    throw new Error("Base64 non valido");
  }
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

function decodeV1(bytes) {
  let off = 1; // byte di versione
  const need = (n) => {
    if (off + n > bytes.length) throw new Error("Payload troncato");
  };
  const readByte = () => {
    need(1);
    return bytes[off++];
  };
  const readString = () => {
    const len = readByte();
    need(len);
    const value = utf8.decode(bytes.subarray(off, off + len));
    off += len;
    return value;
  };

  const flags = readByte();
  const card = { name: readString(), description: readString() };
  if (flags & 0x01) card.barcode = readString();
  if (flags & 0x02) {
    const type = readByte();
    if (type < BARCODE_TYPES.length) card.barcodeType = BARCODE_TYPES[type];
  }
  if (flags & 0x04) {
    need(4);
    card.colorValue = new DataView(bytes.buffer, bytes.byteOffset + off, 4).getUint32(0, false);
    off += 4;
  }
  return card;
}

function decodeJson(bytes) {
  const data = JSON.parse(utf8.decode(bytes));
  if (!data || typeof data !== "object") throw new Error("JSON non valido");
  const pick = (long, short) => (data[long] !== undefined ? data[long] : data[short]);
  const card = {
    name: pick("name", "n"),
    description: pick("description", "d") ?? "",
  };
  const barcode = pick("barcode", "b");
  const barcodeType = pick("barcodeType", "bt");
  const colorValue = pick("colorValue", "c");
  if (typeof barcode === "string") card.barcode = barcode;
  if (typeof barcodeType === "string") card.barcodeType = barcodeType;
  if (Number.isInteger(colorValue)) card.colorValue = colorValue >>> 0;
  return card;
}

/**
 * Decodifica il payload di un link. Ritorna la tessera
 * { name, description, barcode?, barcodeType?, colorValue? } oppure null.
 */
export function decodeCardPayload(payload) {
  if (!payload || payload.length > MAX_PAYLOAD_CHARS) return null;
  try {
    const bytes = base64ToBytes(payload);
    if (bytes.length === 0) return null;
    const card = bytes[0] === 0x01 ? decodeV1(bytes) : decodeJson(bytes);
    if (typeof card.name !== "string" || card.name.trim() === "") return null;
    if (typeof card.description !== "string") card.description = "";
    return card;
  } catch {
    return null;
  }
}

/** Colore ARGB dell'app in colore CSS; null se assente. */
export function cssColorFromArgb(value) {
  if (!Number.isInteger(value)) return null;
  const v = value >>> 0;
  return `rgb(${(v >>> 16) & 0xff} ${(v >>> 8) & 0xff} ${v & 0xff})`;
}

/** Indice 1..10 della palette, come cardColorFromName nell'app. */
export function paletteIndexFromName(name) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return (sum % CARD_PALETTE_SIZE) + 1;
}

/** URL intent di Android che apre il link direttamente nell'app. */
export function androidIntentUrl(payload, fallbackUrl) {
  let url = `intent://${APP_HOST}/import/${payload}#Intent;scheme=https;package=${APP_PACKAGE};`;
  if (fallbackUrl) url += `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};`;
  return url + "end";
}
