// Set this to your Apps Script Web App URL (the same one your extension uses)
const WEBAPP = "https://script.google.com/macros/s/AKfycbwWe2w-EJ3Oz1aslnKafCZj19akZWOSjUkj2m_orS08kMhk8lH8wxMv0D-soHfgvix_tw/exec";

const $ = (id) => document.getElementById(id);

function toneFromVerdict(v){
  if (v === "GOOD") return "good";
  if (v === "MIDDLE") return "warn";
  if (v === "BAD") return "bad";
  return "info";
}

function fmt(val, suffix=""){
  if (val === null || val === undefined || val === "") return "—";
  return String(val) + suffix;
}

function escapeHtml(s){
  return String(s || "").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function renderCallouts(list, mountId){
  const el = $(mountId);
  el.innerHTML = "";
  (list || []).forEach(c => {
    const div = document.createElement("div");
    div.className = `callout ${c.tone || "info"}`;
    div.innerHTML = `<h4>${escapeHtml(c.title || "")}</h4><p>${escapeHtml(c.body || "")}</p>`;
    el.appendChild(div);
  });
}

function renderFlags(findings){
  const el = $("flags");
  el.innerHTML = "";
  (findings || []).slice(0, 10).forEach(f => {
    const tone = f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : "info";
    const pill = document.createElement("span");
    pill.className = `flag ${tone}`;
    const matches = (f.matches || []).slice(0, 3).join(", ");
    pill.textContent = `${f.category}: ${matches}`;
    el.appendChild(pill);
  });
  if (!findings || !findings.length){
    const pill = document.createElement("span");
    pill.className = "flag info";
    pill.textContent = "No ingredient flags detected (or ingredients not readable).";
    el.appendChild(pill);
  }
}

function fillNF(v){
  $("nfServings").textContent = fmt(v.servingsPerContainer);
  $("nfServingSize").textContent = fmt(v.servingSize);
  $("nfCalories").textContent = fmt(v.calories);
  $("nfFat").textContent = fmt(v.totalFatG, "");
  $("nfSat").textContent = fmt(v.satFatG, "");
  $("nfTrans").textContent = fmt(v.transFatG, "");
  $("nfSodium").textContent = fmt(v.sodiumMg, "");
  $("nfCarb").textContent = fmt(v.totalCarbG, "");
  $("nfFiber").textContent = fmt(v.fiberG, "");
  $("nfSugar").textContent = fmt(v.totalSugarG, "");
  $("nfAdded").textContent = fmt(v.addedSugarG, "");
  $("nfProtein").textContent = fmt(v.proteinG, "");
}

function updateTotals(v, servings){
  const s = Number(servings || 1);

  const cal = v.calories != null ? Math.round(v.calories * s) : null;
  const sugar = v.addedSugarG != null ? +(v.addedSugarG * s).toFixed(1) : null;
  const sodium = v.sodiumMg != null ? Math.round(v.sodiumMg * s) : null;

  $("tCal").textContent = cal == null ? "—" : `${cal}`;
  $("tSugar").textContent = sugar == null ? "—" : `${sugar} g`;
  $("tSodium").textContent = sodium == null ? "—" : `${sodium} mg`;

  const noteParts = [];
  if (v.addedSugarG != null) noteParts.push(`Added sugar becomes ~${+(v.addedSugarG*s).toFixed(1)}g`);
  if (v.calories != null) noteParts.push(`Calories become ~${Math.round(v.calories*s)}`);
  if (v.sodiumMg != null) noteParts.push(`Sodium becomes ~${Math.round(v.sodiumMg*s)}mg`);
  $("servNote").textContent = noteParts.length ? noteParts.join(" • ") : "Enter a clearer label to enable the servings math.";
}

async function main(){
  const rid = new URLSearchParams(location.search).get("rid");
  if (!rid) {
    $("status").textContent = "Missing rid. Open this from the extension.";
    return;
  }

  $("status").textContent = "Loading…";

  const url = `${WEBAPP}?action=get&rid=${encodeURIComponent(rid)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.ok) {
    $("status").textContent = "Error: " + (data.error || "Unknown");
    return;
  }

  $("status").textContent = "Loaded.";
  $("prodTitle").textContent = data.title || "—";
  $("asin").textContent = data.asin || "—";
  if (data.bestImageUrl) $("prodImg").src = data.bestImageUrl;

  const verdict = data.verdict || "—";
  const score = (data.score === null || data.score === undefined) ? "—" : data.score;
  const conf = data.confidence || "—";

  const tone = toneFromVerdict(verdict);

  $("pillVerdict").textContent = verdict;
  $("pillVerdict").className = `pill ${tone}`;
  $("pillScore").textContent = `Score: ${score}`;
  $("pillScore").className = `pill ${tone}`;
  $("pillConf").textContent = `Confidence: ${conf}`;
  $("pillConf").className = `pill`;

  const v = data.virtualLabel || {};
  fillNF(v);

  const ing = (data.ingredientsText || "").trim();
  $("ingText").innerHTML = ing ? escapeHtml(ing) : `<span class="muted">Ingredients not readable yet — pick a clearer Ingredients panel image.</span>`;

  renderCallouts(data.callouts || [], "callouts");
  renderFlags(data.ingredientFindings || []);
  $("advice").textContent = data.tailoredAdvice || "—";

  // AI callouts (optional)
  if (data.aiCallouts && Array.isArray(data.aiCallouts) && data.aiCallouts.length) {
    $("aiBox").classList.remove("hidden");
    renderCallouts(data.aiCallouts, "aiCallouts");
  }

  // Slider totals
  const slider = $("servSlider");
  const val = $("servVal");
  const apply = () => {
    val.textContent = slider.value;
    updateTotals(v, slider.value);
  };
  slider.addEventListener("input", apply);
  apply();
}

main().catch(err => {
  $("status").textContent = "Error: " + String(err?.message || err);
});
