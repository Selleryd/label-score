// app.js — LabelScore GitHub Report UI (robust: timeout + CORS-safe errors)
const WEBAPP = "https://script.google.com/macros/s/AKfycbwWe2w-EJ3Oz1aslnKafCZj19akZWOSjUkj2m_orS08kMhk8lH8wxMv0D-soHfgvix_tw/exec";

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function setText(id, txt) {
  const el = $(id);
  if (!el) return;
  el.textContent = (txt === undefined || txt === null || txt === "") ? "—" : String(txt);
}

// Tries a bunch of common loading indicator IDs so your UI will actually stop “Loading…”
function setLoadingUI(isLoading, msg) {
  const text = msg || (isLoading ? "Loading…" : "");
  ["loadState", "loadingText", "statusText", "pageStatus", "topStatus"].forEach((id) => {
    const el = $(id);
    if (el) el.textContent = text;
  });

  // If your page uses a literal "Loading..." element without an id, this will still help:
  const loadingNodes = document.querySelectorAll("[data-loading]");
  loadingNodes.forEach(n => n.textContent = text);

  document.documentElement.classList.toggle("is-loading", !!isLoading);
}

function gradeFromScore(score) {
  const s = Number(score);
  if (!isFinite(s)) return "—";
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  return "F";
}

function riskFromVerdict(verdict) {
  const v = String(verdict || "").toUpperCase();
  if (v === "GOOD") return "Low";
  if (v === "MIDDLE") return "Medium";
  if (v === "BAD") return "High";
  return "Unknown";
}

function renderCallouts(list, mountId) {
  const el = $(mountId);
  if (!el) return;
  el.innerHTML = "";

  const arr = Array.isArray(list) ? list : [];
  if (!arr.length) return;

  arr.slice(0, 10).forEach((c) => {
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

    // If Apps Script returns HTML (error page), show it clearly
    let json = null;
    try { json = JSON.parse(txt); } catch (_) {}

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${json?.error || txt.slice(0, 200)}`);
    }
    if (!json) throw new Error("Backend did not return JSON. (Often CORS / wrong URL / not deployed)");
    return json;
  } finally {
    clearTimeout(t);
  }
}

function renderKnownIds(data) {
  // Works if your HTML has these IDs; otherwise harmless.
  setText("scoreVal", data.score);
  setText("confidenceVal", data.confidence);
  setText("verdictVal", String(data.verdict || "").toUpperCase());
  setText("riskVal", riskFromVerdict(data.verdict));

  const grade = gradeFromScore(data.score);
  setText("gradeVal", grade);

  // Nutrition support multiple shapes
  const v = data.virtualLabel || data.nutrition || data.extracted || {};
  const calories = v.calories ?? data.calories ?? null;
  const addedSugar = v.addedSugarG ?? v.addedSugar ?? data.addedSugarG ?? data.addedSugar ?? null;
  const sodium = v.sodiumMg ?? v.sodium ?? data.sodiumMg ?? data.sodium ?? null;
  const serving = v.servingSize ?? data.servingSize ?? null;

  setText("caloriesVal", calories);
  setText("addedSugarVal", addedSugar == null ? "—" : `${addedSugar}g`);
  setText("sodiumVal", sodium == null ? "—" : `${sodium}mg`);
  setText("servingSizeVal", serving);

  const ingredientsExact =
    data.ingredients_exact ||
    data.ingredientsText ||
    data.ingredients ||
    (data.extracted && data.extracted.ingredientsText) ||
    "";

  setText("ingredientsVal", ingredientsExact);

  const callouts =
    (Array.isArray(data.aiCallouts) && data.aiCallouts.length) ? data.aiCallouts :
    (Array.isArray(data.callouts) && data.callouts.length) ? data.callouts :
    (Array.isArray(data.topReasons) && data.topReasons.length)
      ? data.topReasons.map(t => ({ tone: "note", title: "Note", body: t }))
      : [];

  renderCallouts(callouts, "callouts");
}

async function loadReport(rid) {
  setLoadingUI(true, "Loading…");

  const url = `${WEBAPP}?action=get&rid=${encodeURIComponent(rid)}`;
  const json = await fetchJsonWithTimeout(url, 20000);

  if (!json.ok) throw new Error(json.error || "Backend error.");

  // some backends put payload at json.data; support both
  const data = json.data || json;

  renderKnownIds(data);

  setLoadingUI(false, "");
}

document.addEventListener("DOMContentLoaded", async () => {
  const rid = getRidFromUrl();
  if (!rid) {
    setLoadingUI(false, "");
    renderCallouts([{ tone: "info", title: "No report ID", body: "Open a report link that includes ?rid=RID_..." }], "callouts");
    return;
  }

  try {
    await loadReport(rid);
  } catch (e) {
    setLoadingUI(false, "");
    const msg =
      (e && e.name === "AbortError") ? "Timed out talking to the backend (20s). This is usually CORS or the web app URL is wrong/not deployed." :
      (e && e.message) ? e.message :
      String(e);

    renderCallouts([{ tone: "error", title: "Report failed to load", body: msg }], "callouts");
  }
});
