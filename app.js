// app.js - LabelScore GitHub Report UI (matches index.html IDs)
"use strict";

const WEBAPP =
  "https://script.google.com/macros/s/AKfycbwWe2w-EJ3Oz1aslnKafCZj19akZWOSjUkj2m_orS08kMhk8lH8wxMv0D-soHfgvix_tw/exec";

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function setText(id, txt, fallback = "—") {
  const el = $(id);
  if (!el) return;
  const v = (txt === undefined || txt === null || txt === "") ? fallback : String(txt);
  el.textContent = v;
}

function setStatus(txt) {
  setText("status", txt, "");
}

function setPill(id, txt) {
  const el = $(id);
  if (!el) return;
  el.textContent = txt || "—";
}

function renderCallouts(list, mountId) {
  const el = $(mountId);
  if (!el) return;
  el.innerHTML = "";

  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return;

  arr.slice(0, 12).forEach((c) => {
    const tone = String(c.tone || c.severity || "note").toLowerCase();
    const title = c.title || c.category || "Note";
    const body = c.body || c.why || c.text || "";

    const chipText =
      tone === "good" ? "GOOD" :
      tone === "warn" ? "CAUTION" :
      (tone === "bad" || tone === "error") ? "WARNING" :
      tone === "info" ? "INFO" :
      "NOTE";

    const classTone =
      tone === "good" ? "good" :
      tone === "warn" ? "warn" :
      (tone === "bad" || tone === "error") ? "bad" :
      tone === "info" ? "info" :
      "note";

    const div = document.createElement("div");
    div.className = `callout ${classTone}`;
    div.innerHTML = `
      <div class="chip">${escapeHtml(chipText)}</div>
      <div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="body">${escapeHtml(body)}</div>
      </div>`;
    el.appendChild(div);
  });
}

function getRidFromUrl() {
  const qs = new URLSearchParams(window.location.search);
  let rid = qs.get("rid") || qs.get("RID") || qs.get("id") || "";
  if (rid) return rid.trim();

  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (!hash) return "";
  const hs = new URLSearchParams(hash);
  rid = hs.get("rid") || hs.get("RID") || hs.get("id") || "";
  if (rid) return rid.trim();

  if (/^RID_/i.test(hash)) return hash.trim();
  return "";
}

async function fetchJsonWithTimeout(url, ms = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const txt = await res.text();
    let json = null;
    try { json = JSON.parse(txt); } catch (_) {}
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${json?.error || txt.slice(0, 200)}`);
    if (!json) throw new Error("Backend did not return JSON.");
    return json;
  } finally {
    clearTimeout(t);
  }
}

function numOrNull(v) {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
}

function hydrateReport(data) {
  const d = data.data || data;

  // Header pills
  const verdict = String(d.verdict || "").toUpperCase() || "—";
  setPill("pillVerdict", verdict);
  setPill("pillScore", `Score: ${d.score ?? "—"}`);
  setPill("pillConf", `Confidence: ${d.confidence ?? "—"}`);

  // Product
  setText("prodTitle", d.title || d.productTitle || d.name || "—");
  setText("asin", d.asin || "—");
  const img = d.imageUrl || d.image || pick(d, ["primaryImage", "img"]);
  const imgEl = $("prodImg");
  if (imgEl) {
    if (img) {
      imgEl.src = img;
      imgEl.classList.remove("hidden");
    } else {
      imgEl.classList.add("hidden");
    }
  }

  // Nutrition (support multiple shapes)
  const v = d.virtualLabel || d.nutrition || d.extracted || d.nutritionFacts || {};

  const servingsPerContainer =
    pick(v, ["servingsPerContainer", "servings_per_container", "servings"]) ??
    pick(d, ["servingsPerContainer", "servings_per_container", "servings"]);

  const servingSize =
    pick(v, ["servingSize", "serving_size"]) ??
    pick(d, ["servingSize", "serving_size"]);

  const calories =
    pick(v, ["calories", "kcal"]) ??
    pick(d, ["calories", "kcal"]);

  const fat = pick(v, ["totalFatG", "fatG", "totalFat"]) ?? pick(d, ["totalFatG", "fatG", "totalFat"]);
  const sat = pick(v, ["satFatG", "saturatedFatG", "satFat"]) ?? pick(d, ["satFatG", "saturatedFatG", "satFat"]);
  const trans = pick(v, ["transFatG", "transFat"]) ?? pick(d, ["transFatG", "transFat"]);
  const sodium = pick(v, ["sodiumMg", "sodium_mg", "sodium"]) ?? pick(d, ["sodiumMg", "sodium_mg", "sodium"]);
  const carb = pick(v, ["totalCarbG", "carbG", "totalCarb"]) ?? pick(d, ["totalCarbG", "carbG", "totalCarb"]);
  const fiber = pick(v, ["fiberG", "dietaryFiberG", "fiber"]) ?? pick(d, ["fiberG", "dietaryFiberG", "fiber"]);
  const sugar = pick(v, ["totalSugarG", "sugarsG", "totalSugars"]) ?? pick(d, ["totalSugarG", "sugarsG", "totalSugars"]);
  const added = pick(v, ["addedSugarG", "addedSugarsG", "addedSugar"]) ?? pick(d, ["addedSugarG", "addedSugarsG", "addedSugar"]);
  const protein = pick(v, ["proteinG", "protein"]) ?? pick(d, ["proteinG", "protein"]);

  setText("nfServings", servingsPerContainer);
  setText("nfServingSize", servingSize);
  setText("nfCalories", calories);
  setText("nfFat", fat);
  setText("nfSat", sat);
  setText("nfTrans", trans);
  setText("nfSodium", sodium);
  setText("nfCarb", carb);
  setText("nfFiber", fiber);
  setText("nfSugar", sugar);
  setText("nfAdded", added);
  setText("nfProtein", protein);

  // Ingredients
  const ing =
    d.ingredients_exact ||
    d.ingredientsText ||
    d.ingredients ||
    v.ingredientsText ||
    v.ingredients ||
    "—";
  setText("ingText", ing);

  // Callouts
  const callouts =
    (Array.isArray(d.callouts) && d.callouts.length) ? d.callouts :
    (Array.isArray(d.aiCallouts) && d.aiCallouts.length) ? d.aiCallouts :
    (Array.isArray(d.topReasons) && d.topReasons.length) ? d.topReasons.map(t => ({ tone: "info", title: "Info", body: t })) :
    [];
  renderCallouts(callouts, "callouts");

  // Flags / advice (optional)
  const flagsEl = $("flags");
  if (flagsEl) {
    const flags = Array.isArray(d.flags) ? d.flags : (Array.isArray(d.warnings) ? d.warnings : []);
    flagsEl.innerHTML = "";
    flags.slice(0, 12).forEach((f) => {
      const chip = document.createElement("span");
      chip.className = "flag";
      chip.textContent = String(f);
      flagsEl.appendChild(chip);
    });
  }
  setText("advice", d.advice || d.summary || d.notes || "", "");

  // AI box (optional)
  const aiBox = $("aiBox");
  const aiCallouts = Array.isArray(d.aiCallouts) ? d.aiCallouts : [];
  if (aiBox) {
    if (aiCallouts.length) {
      aiBox.classList.remove("hidden");
      renderCallouts(aiCallouts, "aiCallouts");
    } else {
      aiBox.classList.add("hidden");
    }
  }

  // Reality check slider totals
  const baseCal = numOrNull(calories);
  const baseAdded = numOrNull(added);
  const baseSodium = numOrNull(sodium);

  const slider = $("servSlider");
  const servVal = $("servVal");
  const servNote = $("servNote");

  if (slider && servVal) {
    // Set max based on servings per container if we have it
    const spc = numOrNull(servingsPerContainer);
    if (spc && spc > 1) slider.max = String(Math.min(20, Math.ceil(spc)));
    else slider.max = slider.max || "6";

    const update = () => {
      const n = Number(slider.value || 1);
      servVal.textContent = String(n);

      if (baseCal != null) setText("tCal", Math.round(baseCal * n));
      else setText("tCal", "—");

      if (baseAdded != null) setText("tSugar", `${(baseAdded * n).toFixed(baseAdded % 1 ? 1 : 0)} g`);
      else setText("tSugar", "—");

      if (baseSodium != null) setText("tSodium", `${Math.round(baseSodium * n)} mg`);
      else setText("tSodium", "—");

      if (servNote) {
        if (spc && n > spc) servNote.textContent = `You selected ${n} servings (label says ${spc} per container).`;
        else servNote.textContent = "";
      }
    };

    slider.addEventListener("input", update);
    update();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const rid = getRidFromUrl();
  if (!rid) {
    setStatus("");
    renderCallouts([{ tone: "info", title: "No report ID", body: "Open a link like ?rid=RID_..." }], "callouts");
    return;
  }

  try {
    setStatus("Loading...");
    const url = `${WEBAPP}?action=get&rid=${encodeURIComponent(rid)}`;
    const json = await fetchJsonWithTimeout(url, 20000);
    if (!json.ok) throw new Error(json.error || "Backend returned ok:false");
    hydrateReport(json.data || json);
    setStatus("");
  } catch (e) {
    setStatus("");
    const msg =
      (e && e.name === "AbortError") ? "Timed out (20s) talking to the backend." :
      (e && e.message) ? e.message :
      String(e);
    renderCallouts([{ tone: "error", title: "Report failed to load", body: msg }], "callouts");
  }
});
