# PokéRogue Overlay

A local Node.js server that reads your live [PokéRogue](https://pokerogue.net) game state and serves browser-source-ready overlay pages for OBS and other streaming software.

**[📖 Full Documentation](https://scoooom.github.io/Pokerogue-Overlay)**

---

## Features

- **Party strip** — all 6 slots with sprite, name, level, types, ability, passive, tera type, status, stat stages, HP bar, and moves
- **Single slot card** — focused view of one Pokémon
- **Wave widget** — current wave, biome, and next encounter countdown with full Classic mode battle map (rival, evil team, gym leaders, Elite Four, Eternatus)
- **Run stats** — wave, biome, timer, money, shiny count, alive count, run name
- **Sprite proxy** — server-side Showdown CDN resolution with caching, no flickering
- **Fully themeable** — 60+ CSS variables, `custom.css` support, OBS Custom CSS compatible

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

Then open **http://localhost:3000** for the setup page.

### Install the Tampermonkey script

In Tampermonkey, create a new script and paste the URL below — it will auto-update from GitHub whenever a new version is pushed:

```
https://raw.githubusercontent.com/Scoooom/Pokerogue-Overlay/refs/heads/v2/tampermonkey.user.js
```

Or install it directly from the setup page at `http://localhost:3000`.

---

## OBS Sources

| URL | Description | Recommended size |
|-----|-------------|-----------------|
| `http://localhost:3000/party` | 6-slot party strip (horizontal) | 840×175px |
| `http://localhost:3000/party?layout=vertical` | Party strip (vertical) | 320×510px |
| `http://localhost:3000/card?slot=0` | Single slot card | 320×175px |
| `http://localhost:3000/wave` | Wave / biome / encounter widget | 280×140px |
| `http://localhost:3000/wave?cycle=20` | Wave widget — C-20 gym cycle | 280×140px |
| `http://localhost:3000/wave?cycle=30` | Wave widget — C-30 gym cycle | 280×140px |
| `http://localhost:3000/stats` | Run stats panel | 230×260px |
| `http://localhost:3000/sprite?slot=0` | Single sprite (slot-based) | any |
| `http://localhost:3000/full` | Full overlay with editor | 860×520px |

---

## Customization

Every visual property is a CSS variable. Override them in OBS Custom CSS or create a `custom.css` file in the project root:

```bash
cp custom.css.example custom.css
# edit custom.css freely — it's gitignored
```

Example:

```css
:root {
  --color-accent: #ff6b6b;
  --border-radius-card: 0px;
  --bg-card: rgba(0, 0, 0, 0.95);
}
```

See the [full variable reference](https://scoooom.github.io/Pokerogue-Overlay#custom-vars) for all 60+ variables.

---

## How It Works

```
PokéRogue tab → Tampermonkey → POST /update → Node.js server → OBS browser sources
```

The Tampermonkey script reads `window.gameInfo` — the official extension API exposed by the PokéRogue developers — and POSTs it to the local server once per second. The server normalises the data, resolves sprites from the Pokémon Showdown CDN, and serves the overlay pages.

No data leaves your machine. No private save data is read.

---

## License

MIT — see [LICENSE](LICENSE)

Sprites served via [Pokémon Showdown](https://play.pokemonshowdown.com/) CDN. Pokémon is © Nintendo / Game Freak.
