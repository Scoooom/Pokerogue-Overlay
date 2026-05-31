const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");
const https   = require("https");

const app  = express();
const PORT = 3000;

// ── Showdown sprite logic (mirrors overlay.html) ────────────────────────────
function slug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeForm(form) {
  const f = String(form || "").toLowerCase().trim();
  if (!f) return "";
  if (f === "mega") return "mega";
  if (f === "mega-x" || f === "megax" || f === "mega x") return "megax";
  if (f === "mega-y" || f === "megay" || f === "mega y") return "megay";
  if (f === "gmax" || f === "gigantamax") return "gmax";
  return slug(f);
}

function cleanPokemonName(name) {
  let n = String(name || "").trim();
  if (n.toLowerCase().endsWith("-mega")) n = n.slice(0, -5);
  return n.split(" ").filter(Boolean).join(" ");
}

// Strip a form suffix from the name if it's already captured in explicitForm.
// e.g. "Zacian-crowned" + form "crowned" -> "Zacian"
//      "Mega Latios"    + form "mega"    -> "Latios"
//      "Latios-mega"    + form "mega"    -> "Latios"
function baseNameForSprite(name, explicitForm) {
  let n = cleanPokemonName(name);
  // Strip "Mega " prefix (e.g. "Mega Latios")
  if (n.toLowerCase().startsWith("mega ")) n = n.slice(5);
  // Strip hyphenated form suffix when it matches the explicit form
  // e.g. "Zacian-crowned" with form "crowned" -> "Zacian"
  if (explicitForm) {
    const formSlug = slug(explicitForm);
    const lower = n.toLowerCase();
    // Strip "-<form>" suffix
    if (lower.endsWith("-" + formSlug)) {
      n = n.slice(0, -(formSlug.length + 1));
    }
    // Strip "-mega", "-mega-x", "-mega-y" suffixes regardless
    n = n.replace(/-mega-[xy]$/i, "").replace(/-mega$/i, "");
  }
  return n.trim();
}

function formFromName(name, explicitForm) {
  const n = String(name || "").toLowerCase();
  const f = normalizeForm(explicitForm);
  if (f) return f;
  if (n.startsWith("mega ") || n.endsWith("-mega")) return "mega";
  if (n.endsWith("-mega-x") || n.includes("mega x")) return "megax";
  if (n.endsWith("-mega-y") || n.includes("mega y")) return "megay";
  if (n.endsWith("-gmax") || n.includes("gigantamax")) return "gmax";
  return "";
}

function isFusionName(name) {
  const n = String(name || "").toLowerCase();
  return n.includes("/") || n.includes(" fused with ") || n.includes(" + ") || n.includes(" x ");
}

function primaryFusionName(name) {
  let n = cleanPokemonName(name);
  n = n.replace(" fused with ", "/").replace(" + ", "/").replace(" x ", "/");
  return n.split("/")[0].trim();
}

function spriteCandidates(name, form) {
  const fusion   = isFusionName(name);
  const baseName = fusion ? primaryFusionName(name) : baseNameForSprite(name, form);
  const base     = slug(baseName || name);
  const f        = fusion ? "" : formFromName(name, form);
  const cdn      = "https://play.pokemonshowdown.com/sprites";
  const candidates = [];

  if (f === "gmax") {
    candidates.push(`${cdn}/gen5ani-gmax/${base}-gmax.gif`);
    candidates.push(`${cdn}/gen5-gmax/${base}-gmax.png`);
    candidates.push(`${cdn}/gen8-gmax/${base}-gmax.png`);
  } else if (f) {
    candidates.push(`${cdn}/gen5/${base}-${f}.png`);
    candidates.push(`${cdn}/gen5ani/${base}-${f}.gif`);
    candidates.push(`${cdn}/gen8/${base}-${f}.png`);
  }

  candidates.push(`${cdn}/gen5/${base}.png`);
  candidates.push(`${cdn}/gen5ani/${base}.gif`);
  candidates.push(`${cdn}/gen8/${base}.png`);
  return candidates;
}

// Try each candidate URL in order, return the first that serves a real image
function fetchFirstWorking(candidates) {
  return new Promise((resolve, reject) => {
    let i = 0;
    function tryNext() {
      if (i >= candidates.length) return reject(new Error("No working sprite found"));
      const url = candidates[i++];
      https.get(url, res => {
        if (res.statusCode === 200) {
          const chunks = [];
          res.on("data", c => chunks.push(c));
          res.on("end", () => resolve({ url, buf: Buffer.concat(chunks), type: res.headers["content-type"] || "image/png" }));
        } else {
          res.resume();
          tryNext();
        }
      }).on("error", () => tryNext());
    }
    tryNext();
  });
}

// ── Game state ────────────────────────────────────────────────────────────────
let latestData = {
  wave: "--", biome: "", gameMode: "", playTime: 0, money: 0,
  weather: null, team: [], updatedAt: Date.now()
};

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

// ── Pages ─────────────────────────────────────────────────────────────────────
app.get("/",      (req, res) => res.sendFile(path.join(__dirname, "setup.html")));
app.get("/full",  (req, res) => res.sendFile(path.join(__dirname, "overlay.html")));
app.get("/wave",  (req, res) => res.sendFile(path.join(__dirname, "wave.html")));
app.get("/party", (req, res) => res.sendFile(path.join(__dirname, "party.html")));
app.get("/stats", (req, res) => res.sendFile(path.join(__dirname, "stats.html")));

// ── Sprite endpoint ──────────────────────────────────────────────────────────
// GET /sprite?slot=0
// Tries each Showdown candidate in order, proxies the first working image
// as raw bytes so it can be used directly in <img src="/sprite?slot=N">.
app.get("/sprite", async (req, res) => {
  const slot = parseInt(req.query.slot);
  if (isNaN(slot) || slot < 0 || slot > 5)
    return res.status(400).json({ error: "slot must be 0–5" });

  const pokemon = latestData.team[slot];
  if (!pokemon)
    return res.status(404).json({ error: `No pokemon in slot ${slot}` });

  const realName = cleanPokemonName(pokemon.name);
  const candidates = spriteCandidates(realName, pokemon.form);

  try {
    const { buf, type, url } = await fetchFirstWorking(candidates);
    console.log(`/sprite slot=${slot} → ${pokemon.name} → ${url}`);
    res.set("Content-Type", type);
    res.set("Cache-Control", "no-cache");
    res.send(buf);
  } catch (err) {
    console.error(`/sprite slot=${slot}: no working sprite for ${pokemon.name}`);
    res.status(404).json({ error: "No working sprite found" });
  }
});

// ── Slot names ───────────────────────────────────────────────────────────────
// GET /names        → all 6 slot names as array
// GET /names?slot=0 → single slot name as string
app.get("/names", (req, res) => {
  const team = latestData.team || [];
  if (req.query.slot !== undefined) {
    const slot = parseInt(req.query.slot);
    if (isNaN(slot) || slot < 0 || slot > 5)
      return res.status(400).json({ error: "slot must be 0–5" });
    const p = team[slot];
    return res.json({ slot, name: p ? (p.nickname || p.name) : null });
  }
  // Return all slots
  const slots = Array.from({ length: 6 }, (_, i) => {
    const p = team[i];
    return { slot: i, name: p ? (p.nickname || p.name) : null };
  });
  res.json(slots);
});

// ── Data API ──────────────────────────────────────────────────────────────────
app.get("/data", (req, res) => res.json(latestData));

app.post("/update", (req, res) => {
  latestData = { ...req.body, updatedAt: Date.now() };
  console.log(`[Wave ${latestData.wave}] ${latestData.biome} | Team: ${(latestData.team||[]).map(p=>p.name).join(", ")}`);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`PokéRogue overlay running at http://localhost:${PORT}`);
  console.log(`  Setup guide:   http://localhost:${PORT}/`);
  console.log(`  Main overlay:  http://localhost:${PORT}/full`);
  console.log(`  Wave display:  http://localhost:${PORT}/wave`);
  console.log(`  Party strip:   http://localhost:${PORT}/party`);
  console.log(`  Run stats:     http://localhost:${PORT}/stats`);
  console.log(`  Sprite proxy:  http://localhost:${PORT}/sprite?slot=0`);
  console.log(`  Slot names:    http://localhost:${PORT}/names`);
});
