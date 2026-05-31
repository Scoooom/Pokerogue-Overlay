# PokéRogue Overlay

A local Node.js server that reads your live [PokéRogue](https://pokerogue.net) game state and serves browser-source-ready overlay pages for OBS and other streaming software. Fully themeable with CSS variables.

**[📖 Full Documentation](https://scoooom.github.io/Pokerogue-Overlay)**

---

## Features

- **Party strip** — all 6 slots with sprite, name, level, types, ability, passive ability, tera type indicator, status condition, stat stages (all 7, always visible), HP bar, and 4 moves with type-coloured dots
- **Single slot card** — focused view of one Pokémon, same renderer as party strip
- **Wave widget** — current wave, biome, and next encounter countdown with full Classic mode battle map (rival, evil team, gym leaders, Elite Four, Eternatus)
- **Run stats** — wave, biome, timer, money, shiny count, alive count, run name
- **Sprite proxy** — server-side Showdown CDN resolution with in-memory caching, no flickering
- **Fully themeable** — 100+ CSS variables, `custom.css` file support, per-type colour classes, OBS Custom CSS compatible

---

## Requirements

- [Node.js](https://nodejs.org/) 18 or later
- [Tampermonkey](https://www.tampermonkey.net/) browser extension
- OBS or any streaming software that supports browser sources

---

## Quick Start

```bash
git clone https://github.com/Scoooom/Pokerogue-Overlay.git -b v2
cd Pokerogue-Overlay
npm install
node server.js
```

Then open **http://localhost:3000** for the interactive setup page.

### Install the Tampermonkey script

In Tampermonkey, create a new script and paste this URL — it auto-updates from GitHub:

```
https://raw.githubusercontent.com/Scoooom/Pokerogue-Overlay/refs/heads/v2/tampermonkey.user.js
```

---

## OBS Sources

| URL | Description | Recommended size |
|-----|-------------|-----------------|
| `http://localhost:3000/party` | 6-slot party strip (horizontal) | 840×175px |
| `http://localhost:3000/party?layout=vertical` | Party strip (vertical) | 320×510px |
| `http://localhost:3000/card?slot=0` | Single slot card | 130×220px |
| `http://localhost:3000/wave` | Wave / biome / encounter widget | 280×140px |
| `http://localhost:3000/wave?cycle=20` | Wave widget — C-20 gym cycle | 280×140px |
| `http://localhost:3000/wave?cycle=30` | Wave widget — C-30 gym cycle | 280×140px |
| `http://localhost:3000/stats` | Run stats panel | 230×260px |
| `http://localhost:3000/sprite?slot=0` | Single sprite (HTML page) | any |
| `http://localhost:3000/full` | Full overlay with inline editor | 860×520px |

---

## Customization

Every visual property is a CSS variable. Two ways to override:

### 1. `custom.css` file (recommended)

```bash
cp custom.css.example custom.css
# edit custom.css — gitignored, changes apply on next page load
```

### 2. OBS Custom CSS

Right-click a browser source → Properties → Custom CSS:

```css
:root {
  --color-accent: #ff6b6b;
  --border-radius-card: 0px;
  --bg-card: rgba(0, 0, 0, 0.95);
}
```

### Type colours

Each Pokémon type has a CSS class with RGB component variables:

```css
/* Recolour Fire type */
.type-FIRE { --tr: 255; --tg: 90; --tb: 0; }
```

See the [full variable reference](https://scoooom.github.io/Pokerogue-Overlay#custom-vars) for all 100+ variables.

---

## How It Works

```
PokéRogue tab → Tampermonkey → POST /update → Node.js server → OBS browser sources
```

The Tampermonkey script reads `window.gameInfo` — the official extension API exposed by the PokéRogue developers — and POSTs it to the local server once per second. The server normalises the data, resolves sprites from the Pokémon Showdown CDN, and serves the overlay pages. No data leaves your machine.

---

## Credits

Thanks to **[cannonb33](https://github.com/cannonb33/Pokerogue-Overlay)** for the original base code that this project was built upon.

---

## License

MIT — see [LICENSE](LICENSE)

Sprites served via [Pokémon Showdown](https://play.pokemonshowdown.com/) CDN. Pokémon is © Nintendo / Game Freak.
