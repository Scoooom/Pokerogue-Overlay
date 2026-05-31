// ── Shared card rendering logic ───────────────────────────────────────────────
// Used by /party and /card

// Type colours are defined in card-shared.css via .type-{TYPE} classes
// typeRgb() kept for backwards compat but not used for rendering
const TYPE_RGB = {
  NORMAL:'168,168,120', FIRE:'240,128,48',   WATER:'104,144,240',
  ELECTRIC:'248,208,48', GRASS:'120,200,80', ICE:'152,216,216',
  FIGHTING:'192,48,40',  POISON:'160,64,160', GROUND:'224,192,104',
  FLYING:'168,144,240',  PSYCHIC:'248,88,136', BUG:'168,184,32',
  ROCK:'184,160,56',     GHOST:'112,88,152',  DRAGON:'112,56,248',
  DARK:'112,88,72',      STEEL:'184,184,208', FAIRY:'238,153,172',
};

const STATUS_STYLE = {
  BRN: 'background:var(--status-brn-bg);border:1px solid var(--status-brn-border);color:var(--color-status-brn)',
  PAR: 'background:var(--status-par-bg);border:1px solid var(--status-par-border);color:var(--color-status-par)',
  PSN: 'background:var(--status-psn-bg);border:1px solid var(--status-psn-border);color:var(--color-status-psn)',
  TOX: 'background:var(--status-psn-bg);border:1px solid var(--status-psn-border);color:var(--color-status-psn)',
  SLP: 'background:var(--status-slp-bg);border:1px solid var(--status-slp-border);color:var(--color-status-slp)',
  FRZ: 'background:var(--status-frz-bg);border:1px solid var(--status-frz-border);color:var(--color-status-frz)',
};

const STAT_LABELS = { atk:'ATK', def:'DEF', spAtk:'SPA', spDef:'SPD', speed:'SPE', acc:'ACC', eva:'EVA' };

function cleanName(name) {
  let n = String(name || '').trim();
  if (n.toLowerCase().endsWith('-mega')) n = n.slice(0, -5);
  return n.split(' ').filter(Boolean).join(' ');
}

function typeRgb(t) { return TYPE_RGB[(t||'').toUpperCase()] || '139,92,246'; }

function hpPct(p) {
  return Math.max(0, Math.min(100, (Number(p.hp ?? p.currentHP ?? 0) / Number(p.maxHp ?? p.maxHP ?? 1)) * 100));
}
function hpColor(pct) { return pct <= 25 ? 'var(--bad)' : pct <= 50 ? 'var(--warn)' : 'var(--good)'; }

function typeBadge(t) {
  const cls = (t || 'normal').toUpperCase();
  return `<span class="type-badge type-${cls}">${t}</span>`;
}

function moveRow(move) {
  if (!move || !move.name) return `<div class="move empty"><div class="move-dot"></div><span class="move-name">—</span></div>`;
  const cls  = (move.type || 'normal').toUpperCase();
  const name = move.name.replace(/ \(P\)$/, '');
  return `<div class="move type-${cls}">
    <div class="move-dot"></div>
    <span class="move-name" title="${move.name}">${name}</span>
  </div>`;
}

function statStagesHtml(stages) {
  const s = stages || {};
  const cells = Object.entries(STAT_LABELS).map(([key, label]) => {
    const val = s[key] ?? 0;
    const cls = val > 0 ? 'stat-up' : val < 0 ? 'stat-down' : 'stat-neutral';
    const display = val === 0 ? '–' : (val > 0 ? '+' : '') + val;
    return `<div class="stat-cell ${cls}">
      <span class="stat-cell-label">${label}</span>
      <span class="stat-cell-val">${display}</span>
    </div>`;
  });
  return `<div class="stat-stages">${cells.join('')}</div>`;
}

function renderCard(p, slot, minimal = false) {
  const pct         = hpPct(p);
  const primaryType = ((p.types || [])[0] || 'normal').toUpperCase();
  const primaryRgb  = typeRgb((p.types || [])[0] || 'Normal');
  const isFainted   = pct === 0;
  const shinyHtml   = p.shiny ? `<div class="shiny-badge">✨</div>` : '';
  const typesHtml   = (p.types || []).map(typeBadge).join('');

  const statusHtml = (() => {
    if (!p.status) return '';
    const key   = String(p.status).toUpperCase().slice(0, 3);
    const style = STATUS_STYLE[key] || 'background:var(--status-unknown-bg,rgba(255,255,255,0.15));border:1px solid var(--status-unknown-border,rgba(255,255,255,0.3));color:var(--status-unknown-color,#fff)';
    return `<div class="status-badge" style="${style}">${p.status}</div>`;
  })();

  if (minimal) {
    return `
      <div class="card card-minimal type-primary-${primaryType} ${isFainted ? 'fainted' : ''}" style="--card-rgb:${primaryRgb}">
        <div class="col-left">
          <div class="sprite-wrap">
            <img class="sprite" src="/sprite?name=${encodeURIComponent(cleanName(p.name))}&form=${encodeURIComponent(p.form||'')}&raw" alt="${p.name}">
          </div>
          ${shinyHtml}
        </div>
        <div class="col-right">
          <div class="poke-name">${p.nickname || p.name}</div>
          <div class="types">${typesHtml}</div>
          ${statusHtml ? `<div class="info-row">${statusHtml}</div>` : ''}
        </div>
      </div>`;
  }

  const stagesHtml = statStagesHtml(p.statStages);

  const abilityHtml = (() => {
    const parts = [];
    if (p.ability) parts.push(`<span class="ability-name">${p.ability}</span>`);
    if (p.passive && p.passiveEnabled !== false) parts.push(`<span class="passive-name">/ ${p.passive}</span>`);
    return parts.join(' ');
  })();

  const teraHtml = (() => {
    if (!p.teraType) return '';
    const cls    = (p.teraType || 'normal').toUpperCase();
    const active = p.isTerastallized;
    return `<div class="tera-badge type-${cls}${active ? ' tera-active' : ''}">
      ${active ? '◆' : '◇'} ${p.teraType}
    </div>`;
  })();

  const moves = [...(p.moves || [])];
  while (moves.length < 4) moves.push(null);

  return `
    <div class="card type-primary-${primaryType} ${isFainted ? 'fainted' : ''}" style="--card-rgb:${primaryRgb}">
      <div class="col-left">
        <div class="sprite-wrap">
          <img class="sprite" src="/sprite?name=${encodeURIComponent(cleanName(p.name))}&form=${encodeURIComponent(p.form||'')}&raw" alt="${p.name}">
        </div>
        ${shinyHtml}
      </div>
      <div class="col-right">
        <div class="name-level">
          <div class="poke-name">${p.nickname || p.name}</div>
          <div class="level">Lv.${p.level ?? '--'}</div>
        </div>
        <div class="types">${typesHtml}</div>
        <div class="info-row">${statusHtml}${teraHtml}</div>
        <div class="ability-line">${abilityHtml}</div>
        ${stagesHtml}
        <div class="hp-bar-wrap">
          <div class="hp-bar-bg">
            <div class="hp-bar-fill" style="width:${pct}%;background:${hpColor(pct)};"></div>
          </div>
          <div class="hp-text">${p.hp ?? '--'}/${p.maxHp ?? '--'}</div>
        </div>
        <div class="divider"></div>
        <div class="moves">${moves.slice(0,4).map(moveRow).join('')}</div>
      </div>
    </div>`;
}

function renderEmpty() {
  return `<div class="card empty">
    <div class="col-left"><div class="sprite-wrap"><div class="empty-sprite"></div></div></div>
    <div class="col-right"><div class="poke-name" style="opacity:0.3">Empty</div></div>
  </div>`;
}
