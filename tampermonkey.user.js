// ==UserScript==
// @name         PokéRogue Overlay Exporter
// @namespace    local.pokerogue.overlay
// @version      7.0
// @match        https://pokerogue.net/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const ENDPOINT = "http://localhost:3000/update";

  async function sendUpdate() {
    const info = window.gameInfo;
    if (!info) return;

    // Grab weather directly from the scene — not exposed in gameInfo
    let weather = null;
    try {
      const w = globalScene?.arena?.weather;
      if (w) weather = { weatherType: w.weatherType, turnsLeft: w.turnsLeft };
    } catch (e) {}

    const payload = {
      gameInfo: info,
      weather,
    };

    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // server not running — silently ignore
    }
  }

  setInterval(sendUpdate, 1000);
  sendUpdate();
})();
