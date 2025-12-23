// app.js — LabelScore GitHub Report UI
// - Reads ?rid=RID_xxx (or #rid=RID_xxx) and auto-loads report
// - Fetches from Apps Script backend (WEBAPP?action=get&rid=...)
// - Renders into existing IDs if present; otherwise renders a fallback report

// Set this to your Apps Script Web App URL (the same one your extension uses)
const WEBAPP = "https://script.google.com/macros/s/AKfycbwWe2w-EJ3Oz1aslnKafCZj19akZWOSjUkj2m_orS08kMhk8lH8wxMv0D-soHfgvix_tw/exec";

const $ = (id) => document.getElementById(id);

/** ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function setText(id, txt) {
  const el = $(id);
  if (el) el.textContent = (txt === undefined || txt === null || txt === "") ? "—" : String(txt);
}

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html || "";
}

function show(id, on = true) {
  const el = $(id);
  if (el) el.style.display = on ? "" : "none";
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

function fmt(val, suffix = "") {
  if (val === null || val === undefined || val === "") return "—";
  return String(val) + suffix;
}

function getRidFromUrl() {
  // supports:
  //  - ?rid=RID_xxx
  //  - ?RID=RID_xxx
  //  - #rid=RID_xxx
  //  - #RID_xxx  (bare)
  const qs = new URLSearchParams(window.location.search);
  let rid = qs.get("rid") || qs.get("RID") || qs.get("id") || qs.get("record") || "";
  if (rid) return rid.trim();

  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (!hash) return "";

  // #rid=RID_xxx
  const hs = new URLSearchParams(hash);
  rid = hs.get("rid") || hs.get("RID") || hs.get("id") || "";
  if (rid) return rid.trim();

  // #RID_xxx
  if (/^RID_/i.test(hash)) return hash.trim();

  return "";
}

/** ---------- callouts renderer (safe) ---------- */
function renderCallouts(list, mountId) {
  const el = $(mountId);
  if (!el) return;

  el.innerHTML = "";
  const arr = Array.isArray(list) ? list : [];

  if (!arr.length) {
    el.innerHTML = `
      <div class="callout note">
        <div class="chip">NOTE</div>
        <div>
          <div class="title">No callouts</div>
          <div class="body">If something looks off, verify directly on the package label.</div>
        </div>
      </div>`;
    return;
  }

  arr.slice(0, 10).forEach((c) => {
    const tone = String(c.tone || c.severity || "note").toLowerCase();
    const title = c.title || c.category || "Note";
    const body = c.body || c.why || c.text || "";

    const chipText =
      tone === "good" ? "GOOD" :
      tone === "warn" ? "CAUTION" :
      tone === "bad" ? "WARNING" :
      tone === "error" ? "ERROR" :
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
      </div>
    `;
    el.appendChild(div);
  });
}

/** ---------- API ---------- */
async function apiGet(rid) {
  const url = `${WEBAPP}?action=get&rid=${encodeURIComponent(rid)}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error("Bad JSON from backend.");
  if (!json.ok) throw new Error(json.error || "Backend error.");
  return json;
}

/** ---------- rendering ---------- */
function renderIntoKnownIds(data) {
  // These IDs are OPTIONAL. If your HTML has them, they get filled.
  // If not, nothing breaks.
  setText("ridVal", data.rid || data.RID || "");
  setText("productTitle", data.title || "");
  setText("scoreVal", data.score);
  setText("verdictVal", String(data.verdict || "").toUpperCase());
  setText("riskVal", riskFromVerdict(data.verdict));
  setText("confidenceVal", String(data.confidence || "").toLowerCase());

  const grade = gradeFromScore(data.score);
  setText("gradeVal", grade);

  // Nutrition (supports nested shapes)
  const v = data.virtualLabel || data.nutrition || {};
  const calories = v.calories ?? data.calories ?? null;
  const addedSugar = v.addedSugarG ?? v.addedSugar ?? data.addedSugarG ?? data.addedSugar ?? null;
  const sodium = v.sodiumMg ?? v.sodium ?? data.sodiumMg ?? data.sodium ?? null;
  const serving = v.servingSize ?? data.servingSize ?? null;

  setText("caloriesVal", fmt(calories));
  setText("addedSugarVal", addedSugar == null ? "—" : fmt(addedSugar, "g"));
  setText("sodiumVal", sodium == null ? "—" : fmt(sodium, "mg"));
  setText("servingSizeVal", fmt(serving));

  // Ingredients
  // Prefer an exact string from label if your backend provides it:
  const ingredientsExact =
    data.ingredients_exact ||
    data.ingredientsText ||
    data.ingredients ||
    (data.extracted && data.extracted.ingredientsText) ||
    "";

  if ($("ingredientsVal")) {
    setText("ingredientsVal", ingredientsExact || "—");
  }

  // Callouts
  const callouts =
    (Array.isArray(data.aiCallouts) && data.aiCallouts.length) ? data.aiCallouts :
    (Array.isArray(data.callouts) && data.callouts.length) ? data.callouts :
    (Array.isArray(data.topReasons) && data.topReasons.length)
      ? data.topReasons.map(t => ({ tone: "note", title: "Note", body: t }))
      : [];

  renderCallouts(callouts, "callouts");
}

function renderFallback(data) {
  // If your page doesn't have the expected IDs, we still show a usable report.
  const mount = $("app") || $("root") || document.body;

  const grade = gradeFromScore(data.score);
  const risk = riskFromVerdict(data.verdict);

  const v = data.virtualLabel || data.nutrition || {};
  const calories = v.calories ?? data.calories ?? "—";
  const addedSugar = v.addedSugarG ?? v.addedSugar ?? data.addedSugarG ?? data.addedSugar ?? "—";
  const sodium = v.sodiumMg ?? v.sodium ?? data.sodiumMg ?? data.sodium ?? "—";
  const serving = v.servingSize ?? data.servingSize ?? "—";

  const ingredientsExact =
    data.ingredients_exact ||
    data.ingredientsText ||
    data.ingredients ||
    "";

  const callouts =
    (Array.isArray(data.aiCallouts) && data.aiCallouts.length) ? data.aiCallouts :
    (Array.isArray(data.callouts) && data.callouts.length) ? data.callouts :
    (Array.isArray(data.topReasons) && data.topReasons.length)
      ? data.topReasons.map(t => ({ tone: "note", title: "Note", body: t }))
      : [];

  const html = `
    <div style="max-width: 980px; margin: 24px auto; padding: 18px;">
      <h2 style="margin:0 0 10px 0;">LabelScore Report</h2>
      <div style="opacity:.8; margin-bottom:14px;">RID: <b>${escapeHtml(data.rid || "")}</b></div>

      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px; min-width:140px;">
          <div style="opacity:.7;">Grade</div><div style="font-size:32px; font-weight:800;">${escapeHtml(grade)}</div>
        </div>
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px; min-width:140px;">
          <div style="opacity:.7;">Score</div><div style="font-size:32px; font-weight:800;">${escapeHtml(data.score)}</div>
        </div>
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px; min-width:140px;">
          <div style="opacity:.7;">Risk</div><div style="font-size:28px; font-weight:800;">${escapeHtml(risk)}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px; margin-bottom:18px;">
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px;">
          <div style="opacity:.7;">Calories</div><div style="font-size:20px; font-weight:800;">${escapeHtml(calories)}</div>
        </div>
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px;">
          <div style="opacity:.7;">Added sugar</div><div style="font-size:20px; font-weight:800;">${escapeHtml(String(addedSugar) + (addedSugar === "—" ? "" : "g"))}</div>
        </div>
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px;">
          <div style="opacity:.7;">Sodium</div><div style="font-size:20px; font-weight:800;">${escapeHtml(String(sodium) + (sodium === "—" ? "" : "mg"))}</div>
        </div>
        <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px;">
          <div style="opacity:.7;">Serving size</div><div style="font-size:20px; font-weight:800;">${escapeHtml(serving)}</div>
        </div>
      </div>

      <h3 style="margin:0 0 8px 0;">Ingredients (best effort)</h3>
      <div style="padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px; margin-bottom:18px; white-space:pre-wrap;">
        ${escapeHtml(ingredientsExact || "—")}
      </div>

      <h3 style="margin:0 0 8px 0;">Key callouts</h3>
      <div id="__fallbackCallouts"></div>

      <div style="opacity:.75; margin-top:16px;">
        Best effort scan. Always verify on the package label if something looks off.
      </div>
    </div>
  `;

  // Only replace content if the page doesn't have expected UI IDs
  // (so we don't destroy your designed layout).
  const hasDesignedLayout =
    $("scoreVal") || $("gradeVal") || $("callouts") || $("ingredientsVal");
  if (!hasDesignedLayout) {
    mount.innerHTML = html;
    // render callouts into fallback mount
    const fallbackMount = document.getElementById("__fallbackCallouts");
    if (fallbackMount) {
      fallbackMount.id = "callouts";
      renderCallouts(callouts, "callouts");
    }
  }
}

async function loadReport(rid) {
  // Optional: show loading state if you have these ids
  setText("loadState", "Loading…");

  const data = await apiGet(rid);

  // Ensure the RID is preserved in the URL (nice for sharing)
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.get("rid")) {
      u.searchParams.set("rid", rid);
      window.history.replaceState({}, "", u.toString());
    }
  } catch (_) {}

  renderIntoKnownIds(data);
  renderFallback(data);

  setText("loadState", "");
}

/** ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // If you have an input/button, we wire them up (optional)
  const ridInput = $("ridInput");
  const loadBtn = $("loadBtn");

  if (loadBtn) {
    loadBtn.addEventListener("click", async () => {
      const rid = (ridInput && ridInput.value ? ridInput.value : "").trim();
      if (!rid) return;
      try {
        await loadReport(rid);
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        renderCallouts([{ tone: "error", title: "Load failed", body: msg }], "callouts");
      }
    });
  }

  // Auto-load from URL if present
  const rid = getRidFromUrl();
  if (rid) {
    try {
      await loadReport(rid);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      renderCallouts([{ tone: "error", title: "Load failed", body: msg }], "callouts");
    }
  }
});
