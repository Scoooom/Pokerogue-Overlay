// ==UserScript==
// @name         PokéRogue Overlay Exporter
// @namespace    local.pokerogue.overlay
// @version      2.0.2
// @description  Sends game state to the PokéRogue Overlay server for stream overlays
// @match        https://pokerogue.net/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Scoooom/Pokerogue-Overlay/refs/heads/v2/tampermonkey.user.js
// @downloadURL  https://raw.githubusercontent.com/Scoooom/Pokerogue-Overlay/refs/heads/v2/tampermonkey.user.js
// ==/UserScript==

(function () {
  "use strict";

  const ENDPOINT = "http://localhost:3000/update";

  async function sendUpdate() {
    const info = window.gameInfo;
    if (!info) return;

    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(info),
      });
    } catch (e) {
      // server not running — silently ignore
    }
  }

  setInterval(sendUpdate, 1000);
  sendUpdate();
})();
