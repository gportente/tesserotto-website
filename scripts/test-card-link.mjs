// Test del decoder dei link di condivisione con link reali generati dall'app.
// Uso: node --test scripts/test-card-link.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  androidIntentUrl,
  cssColorFromArgb,
  decodeCardPayload,
  paletteIndexFromName,
  payloadFromPath,
} from "../public/assets/js/card-link.js";

// Copiati dal foglio di condivisione dell'app 2.0.0 (formato v1).
const fromApp = [
  {
    path: "/import/AQcNTWVyY2F0byBWZXJkZRpTdXBlcm1lcmNhdG8gwrcgQ2FydGEgUGnDuQ04MDAxMjM0NTY3ODk3AP9Oi18",
    card: { name: "Mercato Verde", description: "Supermercato · Carta Più", barcode: "8001234567897", barcodeType: "ean13", colorValue: 0xff4e8b5f },
  },
  {
    path: "/import/AQcMQ2FmZsOoIER1b21vFTEwIGNhZmbDqCA9IDEgb21hZ2dpbxpodHRwczovL2V4YW1wbGUuY29tL2MvODgxMgP_elE0",
    card: { name: "Caffè Duomo", description: "10 caffè = 1 omaggio", barcode: "https://example.com/c/8812", barcodeType: "qrCode", colorValue: 0xff7a5134 },
  },
  {
    path: "/import/AQcLT3R0aWNhIElyaXMPQ2xpZW50ZSBwcmVtaXVtDTgwMTIzNDAwMDU1MjQA_4pPng",
    card: { name: "Ottica Iris", description: "Cliente premium", barcode: "8012340005524", barcodeType: "ean13", colorValue: 0xff8a4f9e },
  },
  {
    path: "/import/AQcOQnJpY29sYWdlIENhc2EOQ2x1YiBmYWkgZGEgdGUNODAyMDA0NTAwMTI3NwD_2Yor",
    card: { name: "Bricolage Casa", description: "Club fai da te", barcode: "8020045001277", barcodeType: "ean13", colorValue: 0xffd98a2b },
  },
];

for (const { path, card } of fromApp) {
  test(`v1: ${card.name}`, () => {
    assert.deepEqual(decodeCardPayload(payloadFromPath(path)), card);
  });
}

test("JSON in Base64 con chiavi lunghe (link vecchi)", () => {
  assert.deepEqual(decodeCardPayload("eyJuYW1lIjoiVGVzdCJ9"), { name: "Test", description: "" });
});

test("JSON con chiavi brevi", () => {
  const payload = Buffer.from(JSON.stringify({ n: "Breve", d: "x", b: "123", bt: "code128", c: 4283215696 })).toString("base64url");
  assert.deepEqual(decodeCardPayload(payload), { name: "Breve", description: "x", barcode: "123", barcodeType: "code128", colorValue: 4283215696 });
});

test("Base64 standard con padding e caratteri + /", () => {
  const payload = Buffer.from(JSON.stringify({ name: "Più?>>" })).toString("base64");
  assert.match(payload, /[+/=]/);
  assert.equal(decodeCardPayload(payload).name, "Più?>>");
});

test("link non validi", () => {
  for (const bad of ["", "%%%", "AQ", "AQcN", "e30", "bnVsbA", "eyJuYW1lIjoiIn0", "A".repeat(5000)]) {
    assert.equal(decodeCardPayload(bad), null, bad);
  }
  assert.equal(payloadFromPath("/import/"), null);
  assert.equal(payloadFromPath("/altro/abc"), null);
});

test("colore e palette", () => {
  assert.equal(cssColorFromArgb(0xff4e8b5f), "rgb(78 139 95)");
  assert.equal(cssColorFromArgb(undefined), null);
  assert.equal(paletteIndexFromName(""), 1);
  assert.equal(paletteIndexFromName("A"), (65 % 10) + 1);
});

test("intent Android", () => {
  assert.equal(
    androidIntentUrl("AQcL", "https://app.gabrieleportente.it/#scarica"),
    "intent://app.gabrieleportente.it/import/AQcL#Intent;scheme=https;package=com.gportente.tesserotto;S.browser_fallback_url=https%3A%2F%2Fapp.gabrieleportente.it%2F%23scarica;end",
  );
});
