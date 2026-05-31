// ==UserScript==
// @name         PokéRogue Overlay Exporter
// @namespace    local.pokerogue.overlay
// @version      8.0
// @match        https://pokerogue.net/*
// @grant        none
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
