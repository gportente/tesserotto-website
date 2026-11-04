// Pagina /import/<payload>: legge la tessera dal link, la mostra e apre l'app.
// I dati restano nel browser: nessuna richiesta di rete con il contenuto del link.
import {
  BARCODE_LABELS,
  androidIntentUrl,
  cssColorFromArgb,
  decodeCardPayload,
  paletteIndexFromName,
  payloadFromPath,
} from "./card-link.js";

const $ = (selector) => document.querySelector(selector);

function show(view) {
  for (const el of document.querySelectorAll("[data-view]")) {
    el.hidden = el.dataset.view !== view;
  }
}

function renderCard(card) {
  const el = $("[data-card]");
  el.style.setProperty(
    "--card",
    cssColorFromArgb(card.colorValue) ?? `var(--card-${paletteIndexFromName(card.name)})`,
  );

  $("[data-card-name]").textContent = card.name;
  $("[data-card-monogram]").textContent = Array.from(card.name.trim())[0]?.toUpperCase() ?? "";

  const desc = $("[data-card-desc]");
  desc.textContent = card.description;
  desc.hidden = card.description.trim() === "";

  const typeLabel = BARCODE_LABELS[card.barcodeType];
  if (typeLabel) {
    const badge = $("[data-card-type]");
    badge.textContent = typeLabel;
    badge.hidden = false;
  }

  if (card.barcode) {
    $("[data-code-value]").textContent = card.barcode;
    $("[data-code-type]").textContent = typeLabel ?? "Codice";
    $("[data-code-row]").hidden = false;
  }

  document.title = `${card.name} · Importa una tessera · Tesserotto`;
}

function setupAndroid(payload) {
  const actions = $('[data-platform="android"]');
  const button = $("[data-open-app]");
  const label = button.querySelector("[data-label]");
  const hint = $("[data-open-hint]");
  let timer;

  button.href = androidIntentUrl(payload, new URL("/#scarica", location.origin).href);

  const reset = () => {
    clearTimeout(timer);
    button.removeAttribute("data-state");
    button.removeAttribute("aria-busy");
    label.textContent = "Apri in Tesserotto";
  };

  button.addEventListener("click", () => {
    hint.hidden = true;
    button.dataset.state = "loading";
    button.setAttribute("aria-busy", "true");
    label.textContent = "Apertura…";
    // Se l'app si apre la pagina va in background; altrimenti dopo un po' si spiega cosa fare.
    timer = setTimeout(() => {
      reset();
      if (document.visibilityState === "visible") hint.hidden = false;
    }, 2500);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reset();
  });
  window.addEventListener("pageshow", reset);

  actions.hidden = false;
}

function drawQr(svg, text) {
  if (typeof window.qrcode !== "function") return false;
  const qr = window.qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const count = qr.getModuleCount();
  const ns = "http://www.w3.org/2000/svg";
  svg.setAttribute("viewBox", `0 0 ${count} ${count}`);
  svg.setAttribute("shape-rendering", "crispEdges");
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", col);
      rect.setAttribute("y", row);
      rect.setAttribute("width", 1);
      rect.setAttribute("height", 1);
      svg.append(rect);
    }
  }
  return true;
}

function setupOther() {
  const panel = $('[data-platform="other"]');
  const svg = $("[data-qr]");
  if (!drawQr(svg, location.href)) svg.remove();

  const copy = $("[data-copy-link]");
  const label = copy.querySelector("[data-label]");
  if (!navigator.clipboard) {
    copy.remove();
  } else {
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        label.textContent = "Link copiato";
      } catch {
        label.textContent = "Copia non riuscita";
      }
      setTimeout(() => (label.textContent = "Copia il link"), 2000);
    });
  }
  panel.hidden = false;
}

function init() {
  const payload = payloadFromPath(location.pathname);
  const card = payload && decodeCardPayload(payload);
  if (!card) {
    document.title = "Link non valido · Tesserotto";
    show("error");
    return;
  }

  renderCard(card);
  if (/Android/i.test(navigator.userAgent)) setupAndroid(payload);
  else setupOther();
  show("card");
}

// qrcode.js è caricato con defer: i moduli partono dopo, quindi è già disponibile.
init();
