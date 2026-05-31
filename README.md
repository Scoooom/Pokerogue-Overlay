# Pokerogue-Overlay
Free Stream overlay made for Pokerogue

Search "cmd" in the address bar of this folder, and then type node server.js and then enter to start it. it should automatically start working.


chatgpt generated instructions and overview


# PokéRogue Auto-Updating Stream Overlay

A browser-based overlay that automatically displays your current PokéRogue run for streaming (OBS / TikTok), including your team, HP, moves, and upcoming boss waves.

---

## 🧩 What This Does

* Automatically tracks your **team in real time**
* Displays:

  * Pokémon sprites
  * HP bars
  * Level, status, tera type
  * Moves (with type colors)
  * Ability, passive, nature (manual)
* Shows **upcoming boss battles**
* Designed for **stream overlays**

---

## ⚙️ Requirements

* Node.js installed
* A browser with **Tampermonkey extension**
* OBS (or similar streaming software)

---

## 📁 Files Included

Place all of these in the same folder:

```
overlay.html
server.js
moves.txt
dna-splicer.png
```

---

## 🚀 Setup Instructions

### 1. Start the server

Open a terminal in the folder and run:

```
node server.js
```

You should see a message that it’s running on:

```
http://localhost:3000
```

---

### 2. Install the userscript

* Open Tampermonkey in your browser
* Create a new script
* Paste the provided userscript code
* Save it

This script is what reads PokéRogue data.

---

### 3. Open PokéRogue

Go to:

```
https://pokerogue.net/
```

Make sure the userscript is enabled.

---

### 4. Open the overlay

In your browser (or OBS), open:

```
http://localhost:3000
```

---

### 5. Add to OBS

* Add a **Browser Source**
* Set URL to:

  ```
  http://localhost:3000
  ```
* Resize and position as needed
* Place your game capture in the top-left area

---

## 📝 Important Notes / Limitations

* Some data must be **entered manually**, including:

  * moves 
  * abilities
  * passives
  * natures

* This is because PokéRogue does not expose all of this information

* Fusion Pokémon:

  * Uses the **primary Pokémon’s sprite**
  * Falls back to a **DNA splicer if needed**

* Mega / alternate forms:

  * Attempts to load correct sprite
  * Falls back to base form if unavailable

---

## 🎮 Controls (Overlay Editor)

* Click **EDIT** on a Pokémon to:

  * set moves
  * set ability / passive / nature
* Changes are saved automatically

---

## 🔧 Troubleshooting

### Overlay not updating

* Make sure server is running
* Make sure userscript is enabled
* Refresh both PokéRogue and the overlay

### Moves not showing types

* Ensure `moves.txt` is in the folder
* Restart the server

### Sprites flickering / missing

* Usually resolves automatically
* Some forms may fallback intentionally

---

## 📌 Summary

This system works by:

```
PokéRogue → userscript → local server → overlay
```

Once set up, it is mostly automatic.

---

## 💡 Optional Improvements

* Add facecam/chat to empty panels
* Customize layout in overlay.html
* Expand move database if needed

---

If you run into issues or want features, feel free to modify or extend it.
