const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");
const https   = require("https");

const app  = express();
const PORT = 3000;

// ── Move database ─────────────────────────────────────────────────────────────
const MOVES_DB = JSON.parse(fs.readFileSync(path.join(__dirname, "moves.json")));

// ── Normalization (was in tampermonkey, now lives here) ───────────────────────
function getName(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  return x.name || x.label || x.type || x.id || String(x);
}

function normalizeMove(m) {
  if (!m) return null;
  const moveName = (typeof m === "string" ? m : (m.name || m.id || (m.move && m.move.name) || "Unknown Move")).trim();
  const match    = MOVES_DB[moveName];
  return {
    name: moveName,
    type: match?.type ? match.type.trim().toUpperCase() : "",
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
  };
}

function normalizeGameInfo(raw, weather) {
  const info = raw || {};
  return {
    gameInfoVersion: info.gameInfoVersion || "",
    wave:            info.wave ?? "--",
    biome:           info.biome ?? "",
    gameMode:        info.gameMode ?? "",
    playTime:        info.playTime ?? 0,
    money:           info.money ?? 0,
    weather:         weather || null,
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

// ── Game state ────────────────────────────────────────────────────────────────
let latestData = {
  gameInfoVersion: "",
  wave: "--", biome: "", gameMode: "", playTime: 0, money: 0,
  weather: null, party: [], updatedAt: Date.now(),
};

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

// ── Pages ─────────────────────────────────────────────────────────────────────
app.get("/",      (req, res) => res.sendFile(path.join(__dirname, "setup.html")));
app.get("/full",  (req, res) => res.sendFile(path.join(__dirname, "overlay.html")));
app.get("/wave",  (req, res) => res.sendFile(path.join(__dirname, "wave.html")));
app.get("/party", (req, res) => res.sendFile(path.join(__dirname, "party.html")));
app.get("/stats", (req, res) => res.sendFile(path.join(__dirname, "stats.html")));

// ── Sprite ────────────────────────────────────────────────────────────────────
// GET /sprite?slot=0        → HTML page with <img> (OBS browser source)
// GET /sprite?slot=0&raw=1  → raw image bytes (for use inside <img src=>)
app.get("/sprite", async (req, res) => {
  const slot = parseInt(req.query.slot);
  if (isNaN(slot) || slot < 0 || slot > 5)
    return res.status(400).json({ error: "slot must be 0–5" });

  const pokemon = latestData.party[slot];
  if (!pokemon)
    return res.status(404).json({ error: `No pokemon in slot ${slot}` });

  const realName   = cleanPokemonName(pokemon.name);
  const candidates = spriteCandidates(realName, pokemon.form);
  const raw        = req.query.raw !== undefined;

  try {
    const { buf, type, url } = await fetchFirstWorking(candidates);
    console.log(`/sprite slot=${slot}${raw ? " (raw)" : ""} → ${pokemon.name} → ${url}`);

    if (raw) {
      // Return raw image bytes — safe to use in <img src="/sprite?slot=0&raw">
      res.set("Content-Type", type);
      res.set("Cache-Control", "no-cache");
      return res.send(buf);
    }

    // Return a minimal HTML page — use as an OBS browser source
    const b64   = buf.toString("base64");
    const mime  = type;
    const name  = pokemon.nickname || pokemon.name;
    res.set("Content-Type", "text/html");
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
<img src="data:${mime};base64,${b64}" alt="${name}">
</body>
</html>`);
  } catch (err) {
    console.error(`/sprite slot=${slot}: no working sprite for ${pokemon.name}`);
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
  const { gameInfo, weather } = req.body;
  if (!gameInfo) return res.status(400).json({ error: "missing gameInfo" });

  rawPayload = { ...req.body, receivedAt: Date.now() };

  latestData = {
    ...normalizeGameInfo(gameInfo, weather),
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
  console.log(`  Data:    http://localhost:${PORT}/data`);
  console.log(`  Raw:     http://localhost:${PORT}/raw`);
});
