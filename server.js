const express  = require("express");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");
const https    = require("https");
const app  = express();
const PORT = 3000;

// ── Move database ─────────────────────────────────────────────────────────────
const MOVES_DB = JSON.parse(fs.readFileSync(path.join(__dirname, "moves.json")));

// ── Luck rank table ────────────────────────────────────────────────────────────
// In-game letter grade shown in the shop for a given luck score (0–14).
// 14 (max) renders with the game's animated rainbow text — flagged here as `rainbow`.
const LUCK_RANKS = ["D", "C", "C+", "B-", "B", "B+", "A-", "A", "A+", "A++", "S", "S+", "SS", "SS+", "SSS"];

function getLuckRank(luck) {
  const clamped = Math.max(0, Math.min(14, Number(luck) || 0));
  return {
    value: clamped,
    rank: LUCK_RANKS[clamped],
    rainbow: clamped === 14,
  };
}

// ── Normalization (was in tampermonkey, now lives here) ───────────────────────
function getName(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  return x.name || x.label || x.type || x.id || String(x);
}

function normalizeMove(m) {
  if (!m) return null;
  // gameInfo sends moveset as plain strings e.g. "Flower Trick", "Rollout (P)"
  // Strip the (P) passive marker if present
  const raw      = (typeof m === "string" ? m : (m.name || m.id || "Unknown Move")).trim();
  const moveName = raw.replace(/\s*\(P\)$/, "").trim();
  const match    = MOVES_DB[moveName];
  return {
    name: moveName,
    type: match?.type ? match.type.trim().toUpperCase() : "",
    passive: raw.endsWith("(P)"),
  };
}

function normalizePokemon(p, index) {
  const moveset = Array.isArray(p.moves)    ? p.moves
                : Array.isArray(p.moveset)  ? p.moveset
                : [];
  return {
    name:            p.name || `Pokemon ${index + 1}`,
    nickname:        p.nickname || "",
    form:            p.form || "",
    gender:          p.gender || "",
    level:           p.level ?? "--",
    hp:              p.currentHP ?? p.hp ?? "--",
    maxHp:           p.maxHP ?? p.maxHp ?? "--",
    status:          p.status || "",
    types:           Array.isArray(p.types) ? p.types.map(getName) : [],
    tempTypes:       Array.isArray(p.tempTypes) ? p.tempTypes.map(getName) : [],
    teraType:        p.teraType || "",
    isTerastallized: !!p.isTerastallized,
    ability:         getName(p.ability),
    tempAbility:     getName(p.tempAbility),
    passive:         getName(p.passiveAbility),
    passiveEnabled:  !!p.isPassiveEnabled,
    nature:          getName(p.nature),
    moves:           moveset.map(normalizeMove).filter(Boolean),
    tempMoveset:     Array.isArray(p.tempMoveset) ? p.tempMoveset.map(normalizeMove).filter(Boolean) : [],
    items:           Array.isArray(p.items)      ? p.items.map(getName)
                   : Array.isArray(p.heldItems)  ? p.heldItems.map(getName)
                   : p.heldItem                  ? [getName(p.heldItem)]
                   : [],
    baseStats:       p.baseStats || {},
    statStages:      p.statStages || {},
    tempStats:       p.tempStats || {},
    shiny:           !!p.shiny,
    variant:         p.variant || "",
    isFusion:        !!p.isFusion,
    luck:            p.luck ?? 0,
  };
}

function normalizeGameInfo(raw) {
  const info = raw || {};
  return {
    gameInfoVersion: info.gameInfoVersion || "",
    wave:            info.wave ?? "--",
    biome:           info.biome ?? "",
    gameMode:        info.gameMode ?? "",
    playTime:        info.playTime ?? 0,
    money:           info.money ?? 0,
    runName:         info.name  || "",
    luck:            info.luck ?? 0,
    party:           Array.isArray(info.party) ? info.party.map(normalizePokemon) : [],
  };
}

// ── Sprite helpers (Showdown CDN) ─────────────────────────────────────────────
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

function baseNameForSprite(name, explicitForm) {
  let n = cleanPokemonName(name);
  if (n.toLowerCase().startsWith("mega ")) n = n.slice(5);
  if (explicitForm) {
    const formSlug = slug(explicitForm);
    if (n.toLowerCase().endsWith("-" + formSlug)) n = n.slice(0, -(formSlug.length + 1));
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

// ── Cycle state (20 or 30 — set manually, persists until reset) ──────────────
let gymCycle = null; // null = unknown, 20 or 30 = known

// ── Sprite cache ─────────────────────────────────────────────────────────────
// Keyed by "name|form" — invalidated when slot contents change
const spriteCache = new Map(); // key -> { buf, type, url }

function spriteCacheKey(pokemon) {
  return `${pokemon.name}|${pokemon.form || ""}`;
}

async function getCachedSprite(pokemon) {
  const key = spriteCacheKey(pokemon);
  if (spriteCache.has(key)) return spriteCache.get(key);
  const realName   = cleanPokemonName(pokemon.name);
  const candidates = spriteCandidates(realName, pokemon.form);
  const result     = await fetchFirstWorking(candidates);
  spriteCache.set(key, result);
  return result;
}

// ── Game state ────────────────────────────────────────────────────────────────
let latestData = {
  gameInfoVersion: "",
  wave: "--", biome: "", gameMode: "", playTime: 0, money: 0, runName: "",
  luck: 0, party: [], updatedAt: Date.now(),
};

app.use(cors());
app.use(express.json({ limit: "10mb" }));
// ── Custom CSS (before static so no-store header always applies) ─────────────
app.get("/custom.css", (req, res) => {
  res.set("Content-Type", "text/css");
  res.set("Cache-Control", "no-store");
  const p = path.join(__dirname, "custom.css");
  if (fs.existsSync(p)) {
    res.sendFile(p);
  } else {
    res.send("/* custom.css not found — create one in the project root */");
  }
});

app.use(express.static(__dirname));

// ── Pages ─────────────────────────────────────────────────────────────────────
app.get("/",      (req, res) => res.sendFile(path.join(__dirname, "setup.html")));
app.get("/full",  (req, res) => res.sendFile(path.join(__dirname, "overlay.html")));
app.get("/wave",  (req, res) => res.sendFile(path.join(__dirname, "wave.html")));
app.get("/party", (req, res) => res.sendFile(path.join(__dirname, "party.html")));
app.get("/stats", (req, res) => res.sendFile(path.join(__dirname, "stats.html")));
app.get("/card",  (req, res) => res.sendFile(path.join(__dirname, "card.html")));
app.get("/luck",  (req, res, next) => req.query.json !== undefined ? next() : res.sendFile(path.join(__dirname, "luck.html")));
app.get("/docs",  (req, res) => res.sendFile(path.join(__dirname, "docs.html")));



// ── Sprite ────────────────────────────────────────────────────────────────────
// GET /sprite?slot=0        → HTML page with <img> (OBS browser source)
// GET /sprite?slot=0&raw=1  → raw image bytes (for use inside <img src=>)
// ── Sprite ────────────────────────────────────────────────────────────────────
// GET /sprite?slot=N          → HTML page (OBS browser source) — dynamic, always current slot
// GET /sprite?name=X&form=Y&raw → raw image bytes (for <img src>) — browser-cacheable
app.get("/sprite", async (req, res) => {
  const raw  = req.query.raw !== undefined;

  let pokemon;

  if (req.query.slot !== undefined) {
    // Slot mode — OBS browser source, always reflects current slot contents
    const slot = parseInt(req.query.slot);
    if (isNaN(slot) || slot < 0 || slot > 5)
      return res.status(400).json({ error: "slot must be 0–5" });
    pokemon = latestData.party[slot];
    if (!pokemon)
      return res.status(404).json({ error: `No pokemon in slot ${slot}` });
  } else if (req.query.name) {
    // Name mode — identity-based, browser-cacheable, for use in <img src>
    pokemon = { name: req.query.name, form: req.query.form || "" };
  } else {
    return res.status(400).json({ error: "provide ?slot=N or ?name=X" });
  }

  try {
    const { buf, type, url } = await getCachedSprite(pokemon);
    console.log(`/sprite ${pokemon.name}${raw ? " (raw)" : ""} → ${url}`);

    if (raw) {
      res.set("Content-Type", type);
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(buf);
    }

    // HTML page for OBS browser source — polls every second to catch slot changes
    const label = pokemon.nickname || pokemon.name;
    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "no-cache");
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:transparent; display:flex; align-items:center; justify-content:center; }
  img { image-rendering:pixelated; max-width:100%; max-height:100%; object-fit:contain; }
</style>
</head>
<body>
<img id="spr" src="/sprite?name=${encodeURIComponent(pokemon.name)}&form=${encodeURIComponent(pokemon.form||"")}&raw" alt="${label}">
<script>
  // Poll for slot changes and swap the image src when the pokemon changes
  ${req.query.slot !== undefined ? `
  let current = ${JSON.stringify(pokemon.name + "|" + (pokemon.form||""))};
  setInterval(async () => {
    try {
      const d = await (await fetch('/data')).json();
      const p = (d.party || [])[${parseInt(req.query.slot)}];
      if (!p) return;
      const key = p.name + '|' + (p.form || '');
      if (key !== current) {
        current = key;
        document.getElementById('spr').src = '/sprite?name=' + encodeURIComponent(p.name) + '&form=' + encodeURIComponent(p.form||'') + '&raw';
      }
    } catch(e) {}
  }, 1000);` : ''}
</script>
</body>
</html>`);
  } catch (err) {
    console.error(`/sprite: no working sprite for ${pokemon.name}`);
    if (raw) return res.status(404).json({ error: "No working sprite found" });
    res.set("Content-Type", "text/html");
    res.send(`<!DOCTYPE html><html><body style="background:transparent;margin:0"></body></html>`);
  }
});

// ── Names ─────────────────────────────────────────────────────────────────────
app.get("/names", (req, res) => {
  const party = latestData.party || [];
  if (req.query.slot !== undefined) {
    const slot = parseInt(req.query.slot);
    if (isNaN(slot) || slot < 0 || slot > 5)
      return res.status(400).json({ error: "slot must be 0–5" });
    const p = party[slot];
    return res.json({ slot, name: p ? (p.nickname || p.name) : null });
  }
  res.json(Array.from({ length: 6 }, (_, i) => {
    const p = party[i];
    return { slot: i, name: p ? (p.nickname || p.name) : null };
  }));
});

// ── Luck ──────────────────────────────────────────────────────────────────────
// GET /luck        — OBS page (defined above in ── Pages ──), rainbow SSS text
// GET /luck?json   — overall run luck translated to its in-game rank (D–SSS),
//                    plus a per-slot breakdown of raw luck points
app.get("/luck", (req, res) => {
  const party = latestData.party || [];
  res.json({
    ...getLuckRank(latestData.luck),
    party: party.map((p, i) => ({ slot: i, name: p.nickname || p.name, luck: p.luck })),
  });
});

// ── Cycle ─────────────────────────────────────────────────────────────────────
// GET  /cycle        → { cycle: 20|30|null }
// POST /cycle        → { cycle: 20|30|null } to set; null resets to unknown
app.get("/cycle", (req, res) => res.json({ cycle: gymCycle }));

app.post("/cycle", (req, res) => {
  const { cycle } = req.body;
  if (cycle !== 20 && cycle !== 30 && cycle !== null)
    return res.status(400).json({ error: "cycle must be 20, 30, or null" });
  gymCycle = cycle;
  console.log(`Gym cycle set to: ${gymCycle ?? "unknown"}`);
  res.json({ cycle: gymCycle });
});

// ── Data ──────────────────────────────────────────────────────────────────────
app.get("/data", (req, res) => res.json({ ...latestData, gymCycle }));

// ── Raw ───────────────────────────────────────────────────────────────────────
// GET /raw — the exact payload received from Tampermonkey, unmodified
let rawPayload = null;
app.get("/raw", (req, res) => {
  if (!rawPayload) return res.status(503).json({ error: "No data received yet" });
  res.json(rawPayload);
});

// ── Update (from Tampermonkey) ────────────────────────────────────────────────
app.post("/update", (req, res) => {
  const gameInfo = req.body;
  if (!gameInfo || !gameInfo.gameInfoVersion) return res.status(400).json({ error: "missing gameInfo" });

  rawPayload = { gameInfo, receivedAt: Date.now() };

  latestData = {
    ...normalizeGameInfo(gameInfo),
    updatedAt: Date.now(),
  };

  console.log(`[Wave ${latestData.wave}] ${latestData.biome} | ${latestData.party.map(p => p.name).join(", ")}`);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`PokéRogue overlay running at http://localhost:${PORT}`);
  console.log(`  Setup:   http://localhost:${PORT}/`);
  console.log(`  Full:    http://localhost:${PORT}/full`);
  console.log(`  Wave:    http://localhost:${PORT}/wave`);
  console.log(`  Party:   http://localhost:${PORT}/party`);
  console.log(`  Stats:   http://localhost:${PORT}/stats`);
  console.log(`  Sprite:  http://localhost:${PORT}/sprite?slot=0`);
  console.log(`  Names:   http://localhost:${PORT}/names`);
  console.log(`  Luck:    http://localhost:${PORT}/luck`);
  console.log(`  Data:    http://localhost:${PORT}/data`);
  console.log(`  Raw:     http://localhost:${PORT}/raw`);
  console.log(`  Card:    http://localhost:${PORT}/card?slot=0`);
});
