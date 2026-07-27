// ── Arsenal interactives: the Hangar + the Saturation Duel ──────────────────
// renderHangar({ mount, arsenal }) — schematic SVG silhouettes per system,
//   grouped by actor. Hover = quick stats tooltip, click = scroll to the
//   system's detail card.
// mountDuel({ mount, arsenal }) — launch simulator with two views:
//   • Map view: real geography (Leaflet), the projectile arcs from its actual
//     front (Gaza/Lebanon/Yemen/Iran) to a real Israeli city; the map frames
//     itself to the threat's range, so a Qassam zooms into the Gaza border and
//     a Shahed pulls back to the whole Red Sea approach.
//   • Side view: altitude cross-section — trajectory shape + interceptor layer.
//   Pick a defense, pick a salvo, fire. Live cost tally for both sides.
//   Illustrative — intercept rates anchored to publicly reported figures.

(function () {
  const ACTOR_COLOR = {
    hamas: '#d63031', hezbollah: '#f39c12', houthis: '#4a9eff', iran: '#c678dd',
  };
  const ACTOR_RGB = {
    hamas: '214,48,49', hezbollah: '243,156,18', houthis: '74,158,255', iran: '198,120,221',
  };
  const ACTOR_LABEL = {
    hamas: 'Gaza', hezbollah: 'Lebanon', houthis: 'Yemen', iran: 'Iran',
  };

  // Representative launch points per front (approx lat/lon — stylised, not
  // precise firing sites).
  const ORIGIN_LATLNG = {
    hamas: [31.45, 34.40],      // Gaza
    hezbollah: [33.35, 35.35],  // south Lebanon
    houthis: [15.35, 44.20],    // Sana'a
    iran: [35.70, 51.40],       // Tehran
  };

  // Per front, nearest → deepest targets: [name, approx km from the front,
  // [lat, lon]]. targetFor() picks the deepest one the system can reach.
  const TARGETS = {
    hamas: [
      ['the Gaza-border communities', 3, [31.47, 34.53]],
      ['Sderot', 10, [31.52, 34.60]],
      ['Ashkelon', 20, [31.67, 34.57]],
      ['Ashdod', 40, [31.79, 34.65]],
      ['Tel Aviv', 65, [32.08, 34.78]],
      ['Jerusalem', 75, [31.78, 35.21]],
    ],
    hezbollah: [
      ['the border posts', 3, [33.24, 35.57]],
      ['Kiryat Shmona', 8, [33.21, 35.57]],
      ['Safed', 20, [32.96, 35.50]],
      ['Haifa', 45, [32.79, 34.99]],
      ['Tel Aviv', 130, [32.08, 34.78]],
    ],
    houthis: [
      ['Eilat', 1700, [29.55, 34.95]],
      ['Tel Aviv', 2000, [32.08, 34.78]],
    ],
    iran: [
      ['Tel Aviv', 1500, [32.08, 34.78]],
    ],
  };

  // Class-typical average speeds (km/s) for flight-time estimates — public
  // ballpark figures, good to the order of magnitude the sim needs.
  const CLASS_SPEED = {
    'mortar': 0.15, 'artillery rocket': 0.4, 'heavy artillery rocket': 0.55,
    'SRBM': 1.1, 'MRBM': 2.0, 'cruise missile': 0.22, 'OWA drone': 0.05,
    'ATGM': 0.13,
  };
  // Fallback unit costs by class when no documented estimate exists (USD,
  // conservative public ballparks) — flagged "est." in the UI.
  const CLASS_COST = {
    'mortar': 500, 'artillery rocket': 1500, 'heavy artillery rocket': 20000,
    'SRBM': 500000, 'MRBM': 1000000, 'cruise missile': 900000,
    'OWA drone': 35000, 'ATGM': 120000,
  };
  // The selectable defense layers. Per-class kill probabilities are anchored
  // to claimed/reported rates; 0 means the system genuinely cannot engage
  // that threat class (wrong envelope) — picking it teaches why the shield
  // is layered. Costs are midpoints of documented per-interceptor figures.
  const DEFENSE_CATALOG = {
    'auto': { name: 'Auto — best layer for the threat', auto: true },
    'iron-dome': {
      name: 'Iron Dome', cost: 70000, beam: false,
      note: 'Short-range rockets, mortars, drones',
      p: { 'mortar': 0.9, 'artillery rocket': 0.93, 'heavy artillery rocket': 0.9,
           'OWA drone': 0.94, 'cruise missile': 0.8, 'ATGM': 0.82, 'SRBM': 0, 'MRBM': 0 },
    },
    'davids-sling': {
      name: "David's Sling", cost: 1000000, beam: false,
      note: 'The middle layer — heavy rockets, SRBMs, cruise missiles',
      p: { 'mortar': 0, 'artillery rocket': 0.75, 'heavy artillery rocket': 0.93,
           'OWA drone': 0.92, 'cruise missile': 0.92, 'ATGM': 0, 'SRBM': 0.93, 'MRBM': 0.6 },
    },
    'arrow': {
      name: 'Arrow 2 / 3', cost: 3000000, beam: false,
      note: 'Ballistic missiles, up to the edge of space',
      p: { 'mortar': 0, 'artillery rocket': 0, 'heavy artillery rocket': 0,
           'OWA drone': 0, 'cruise missile': 0, 'ATGM': 0, 'SRBM': 0.9, 'MRBM': 0.94 },
    },
    'thaad': {
      name: 'THAAD (US Army)', cost: 12500000, beam: false,
      note: 'Terminal high-altitude ballistic-missile defense',
      p: { 'mortar': 0, 'artillery rocket': 0, 'heavy artillery rocket': 0,
           'OWA drone': 0, 'cruise missile': 0, 'ATGM': 0, 'SRBM': 0.92, 'MRBM': 0.96 },
    },
    'iron-beam': {
      name: 'Iron Beam (laser)', cost: 5, beam: true,
      note: '~10 km-class laser — rockets, mortars, drones at ~$5 a shot',
      p: { 'mortar': 0.87, 'artillery rocket': 0.85, 'heavy artillery rocket': 0.7,
           'OWA drone': 0.92, 'cruise missile': 0, 'ATGM': 0.8, 'SRBM': 0, 'MRBM': 0 },
    },
  };
  const AUTO_LAYER = {
    'mortar': 'iron-dome', 'artillery rocket': 'iron-dome',
    'heavy artillery rocket': 'iron-dome', 'ATGM': 'iron-dome',
    'OWA drone': 'iron-dome', 'SRBM': 'davids-sling',
    'cruise missile': 'davids-sling', 'MRBM': 'arrow',
  };

  const fmtUsd = n => n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B'
    : n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
    : n >= 1e3 ? '$' + Math.round(n / 1e3) + 'k' : '$' + Math.round(n);

  function unitCost(s) {
    const c = s.est_unit_cost_usd;
    if (c == null) return { v: CLASS_COST[s.class] || 50000, est: true };
    if (Array.isArray(c)) return { v: (c[0] + c[1]) / 2, est: false };
    return { v: c, est: false };
  }

  function maxRange(s) { return Array.isArray(s.range_km) ? s.range_km[1] : (s.range_km || 0); }

  function targetFor(s) {
    const list = TARGETS[s.actor] || TARGETS.hamas;
    const r = maxRange(s);
    let best = list[0];
    for (const t of list) if (t[1] <= r) best = t;
    return { name: best[0], km: Math.min(best[1], Math.max(2, r)), latlng: best[2] };
  }

  function flightSeconds(s, km) {
    return km / (CLASS_SPEED[s.class] || 0.5);
  }

  function fmtDuration(sec) {
    if (sec < 90) return Math.round(sec) + ' s';
    if (sec < 5400) return Math.round(sec / 60) + ' min';
    return (sec / 3600).toFixed(1) + ' h';
  }

  // trajectory apex (fraction of stage height) per class — used by both views
  function apexFor(cls) {
    return { 'mortar': 0.75, 'artillery rocket': 0.55, 'heavy artillery rocket': 0.6,
             'SRBM': 0.78, 'MRBM': 0.92, 'cruise missile': 0.16, 'OWA drone': 0.22,
           }[cls] || 0.5;
  }

  const bez = (t, a, c, b) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

  // ── Silhouettes ────────────────────────────────────────────────────────────
  // Side profiles, nose pointing right, drawn in a 100×26 box.
  function silhouettePath(s) {
    const cls = s.class, id = s.id;
    if (cls === 'mortar') {
      return 'M60,13 L72,13 M30,9 L58,9 Q72,13 58,17 L30,17 Z M30,9 L22,4 L26,13 L22,22 L30,17';
    }
    if (cls === 'OWA drone') {
      if (id.includes('shahed')) {
        return 'M8,13 L86,4 L96,13 L86,22 Z M8,13 L20,2 L24,4 L14,13 L24,22 L20,24 Z';
      }
      return 'M14,13 L84,10 Q96,13 84,16 Z M40,12 L46,-1 L52,12 M40,14 L46,27 L52,14 M14,10 L6,2 M14,16 L6,24';
    }
    if (cls === 'cruise missile') {
      return 'M10,10 L78,10 Q96,13 78,16 L10,16 Z M34,12 L50,0 L54,0 L44,12 M34,14 L50,26 L54,26 L44,14 M10,10 L2,3 L8,13 L2,23 L10,16 M60,16 L64,21 L70,16';
    }
    if (cls === 'SRBM') {
      return 'M12,8 L72,8 L94,13 L72,18 L12,18 Z M12,8 L2,1 L8,13 L2,25 L12,18 M44,8 L50,2 L56,8 M44,18 L50,24 L56,18';
    }
    if (cls === 'MRBM') {
      return 'M8,7 L58,7 L66,9 L80,10 L96,13 L80,16 L66,17 L58,19 L8,19 Z M8,7 L1,2 L5,13 L1,24 L8,19';
    }
    if (cls === 'ATGM') {
      return 'M20,10 L80,10 Q92,13 80,16 L20,16 Z M44,10 L48,4 L52,10 M44,16 L48,22 L52,16 M20,10 L14,6 L17,13 L14,20 L20,16';
    }
    if (cls === 'heavy artillery rocket') {
      return 'M12,8.5 L74,8.5 Q94,13 74,17.5 L12,17.5 Z M12,8.5 L4,3 L9,13 L4,23 L12,17.5';
    }
    return 'M16,10 L76,10 Q92,13 76,16 L16,16 Z M16,10 L8,5 L12,13 L8,21 L16,16';
  }

  function silhouetteLen(s) {
    const base = {
      'mortar': 34, 'ATGM': 40, 'artillery rocket': 52,
      'heavy artillery rocket': 66, 'OWA drone': 60, 'cruise missile': 78,
      'SRBM': 88, 'MRBM': 108,
    }[s.class] || 52;
    return Math.round(base * (0.92 + Math.min(0.18, maxRange(s) / 15000)));
  }

  window.renderHangar = function ({ mount, arsenal, onSelect }) {
    const root = document.querySelector(mount);
    if (!root) return;
    const order = ['hamas', 'hezbollah', 'houthis', 'iran'];
    for (const actor of order) {
      const systems = arsenal.systems.filter(s => s.actor === actor);
      if (!systems.length) continue;
      const row = document.createElement('div');
      row.className = 'hangar-row';
      row.innerHTML = `<div class="hangar-actor" style="color:${ACTOR_COLOR[actor]}">${(arsenal.meta.actors[actor] || {}).label || actor}</div>`;
      const rack = document.createElement('div');
      rack.className = 'hangar-rack';
      for (const s of systems.sort((a, b) => maxRange(a) - maxRange(b))) {
        const len = silhouetteLen(s);
        const fig = document.createElement('button');
        fig.type = 'button';
        fig.className = 'hangar-item';
        fig.setAttribute('aria-label', s.name + ' — details');
        fig.innerHTML =
          `<svg viewBox="-2 -2 104 30" width="${len}" height="${Math.round(len * 30 / 104)}" ` +
          `fill="none" stroke="${ACTOR_COLOR[actor]}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">` +
          `<path d="${silhouettePath(s)}" fill="rgba(255,255,255,0.03)"/></svg>` +
          `<span class="hangar-name">${s.name}</span>`;
        const cost = unitCost(s);
        const tip = () =>
          `<b>${s.name}</b><br>` +
          `${ACTOR_LABEL[s.actor]} · ${s.class}<br>` +
          `Range: ${Array.isArray(s.range_km) ? s.range_km[0].toLocaleString() + '–' + s.range_km[1].toLocaleString() : s.range_km} km<br>` +
          `Warhead: ${s.warhead_kg == null ? 'undisclosed' : (Array.isArray(s.warhead_kg) ? s.warhead_kg[0] + '–' + s.warhead_kg[1] : '~' + s.warhead_kg) + ' kg'}<br>` +
          `Guidance: ${s.guidance.split(';')[0].split('(')[0].trim()}<br>` +
          `Cost: ${fmtUsd(cost.v)}${cost.est ? ' (class est.)' : ''}/round<br>` +
          `<span style="color:var(--accent);">▶ click for the full entry</span>`;
        fig.addEventListener('mouseover', e => showTip(tip(), e));
        fig.addEventListener('mousemove', moveTip);
        fig.addEventListener('mouseleave', hideTip);
        fig.addEventListener('click', () => { hideTip(); onSelect && onSelect(s); });
        rack.appendChild(fig);
      }
      row.appendChild(rack);
      root.appendChild(row);
    }
  };

  // ── The Duel ───────────────────────────────────────────────────────────────
  window.mountDuel = function ({ mount, arsenal }) {
    const root = document.querySelector(mount);
    if (!root) return null;
    const systems = arsenal.systems.filter(s => maxRange(s) > 0 && s.class !== 'ATGM');
    const hasLeaflet = typeof window.L !== 'undefined';

    root.innerHTML = `
      <div class="duel-controls">
        <select id="duel-system" class="duel-select" aria-label="Weapon system"></select>
        <span class="filter-label" style="margin:0 .2rem 0 .6rem;">vs</span>
        <select id="duel-defense" class="duel-select" aria-label="Defense system"></select>
        <span class="filter-label" style="margin:0 .2rem 0 .6rem;">Salvo</span>
        <span id="duel-sizes">
          <button class="filter-btn active" data-n="1" type="button">×1</button>
          <button class="filter-btn" data-n="5" type="button">×5</button>
          <button class="filter-btn" data-n="20" type="button">×20</button>
          <button class="filter-btn" data-n="80" type="button">×80</button>
        </span>
        <button class="filter-btn duel-fire" id="duel-fire" type="button">▶ Fire</button>
        ${hasLeaflet ? `<span id="duel-views" style="margin-left:auto;">
          <button class="filter-btn active" data-view="map" type="button">Map</button>
          <button class="filter-btn" data-view="side" type="button">Side</button>
        </span>` : ''}
      </div>
      <div class="duel-stage-wrap">
        <div id="duel-map-stage"${hasLeaflet ? '' : ' hidden'}>
          <div id="duel-map"></div>
          <canvas id="duel-map-canvas"></canvas>
        </div>
        <canvas id="duel-canvas"${hasLeaflet ? ' hidden' : ''}></canvas>
        <div class="duel-readout" id="duel-readout"></div>
      </div>
      <div class="duel-counters" id="duel-counters"></div>`;

    const select = root.querySelector('#duel-system');
    for (const actor of ['hamas', 'hezbollah', 'houthis', 'iran']) {
      const grp = document.createElement('optgroup');
      grp.label = (arsenal.meta.actors[actor] || {}).label || actor;
      for (const s of systems.filter(x => x.actor === actor)) {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = `${s.name} (${maxRange(s).toLocaleString()} km)`;
        grp.appendChild(o);
      }
      select.appendChild(grp);
    }

    const defSelect = root.querySelector('#duel-defense');
    for (const [key, d] of Object.entries(DEFENSE_CATALOG)) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = d.name;
      defSelect.appendChild(o);
    }

    const canvas = root.querySelector('#duel-canvas');
    const ctx = canvas.getContext('2d');
    const mapStage = root.querySelector('#duel-map-stage');
    const mapCanvas = root.querySelector('#duel-map-canvas');
    const mapCtx = mapCanvas.getContext('2d');
    const readout = root.querySelector('#duel-readout');
    const countersEl = root.querySelector('#duel-counters');

    let view = hasLeaflet ? 'map' : 'side';
    let salvoN = 1;
    let running = false, rAF = null;
    // mirror `running` onto the DOM so the animation's true idle state is
    // observable (used to re-enable controls / by tests). If a resize arrived
    // mid-run (deferred), reframe once the salvo finishes.
    let pendingReframe = false;
    function setRun(v) {
      running = v;
      root.dataset.duelRunning = v ? '1' : '0';
      if (!v && pendingReframe) { pendingReframe = false; requestAnimationFrame(drawIdle); }
    }

    root.querySelectorAll('#duel-sizes .filter-btn').forEach(b => {
      b.addEventListener('click', () => {
        root.querySelectorAll('#duel-sizes .filter-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        salvoN = +b.dataset.n;
        if (!running) { updateStatic(); drawIdle(); }
      });
    });

    function currentSystem() { return systems.find(s => s.id === select.value) || systems[0]; }

    function currentDefense(s) {
      const key = defSelect.value === 'auto' ? AUTO_LAYER[s.class] : defSelect.value;
      return { key, ...DEFENSE_CATALOG[key], autoPicked: defSelect.value === 'auto' };
    }

    // per-threat kill probability: the chosen defense's base rate for this
    // class, degraded gently as the salvo grows (anchored so ×80 lands near
    // the ~86–90% reported across the June 2025 barrages)
    function pIntercept(def, s, n) {
      const base = (def.p || {})[s.class] || 0;
      if (base === 0) return 0;
      return Math.max(base - 0.07, base - Math.log2(Math.max(1, n)) * 0.012);
    }

    function summarize(s, n) {
      const tgt = targetFor(s);
      const def = currentDefense(s);
      const cost = unitCost(s);
      const p = pIntercept(def, s, n);
      const atk = cost.v * n;
      const shots = def.beam ? n : Math.round(n * 1.15);
      const defCost = p === 0 ? 0 : shots * def.cost;
      return { tgt, def, cost, p, atk, defCost };
    }

    let tally = null;

    function updateStatic() {
      const s = currentSystem();
      const { tgt, def, cost, p, atk, defCost } = summarize(s, salvoN);
      const secs = flightSeconds(s, tgt.km);
      readout.innerHTML =
        `<div class="dr-name" style="color:${ACTOR_COLOR[s.actor]}">${s.name}</div>` +
        `<div class="dr-row"><span>Launch → target</span><span>${ACTOR_LABEL[s.actor]} → ${tgt.name} (~${tgt.km.toLocaleString()} km)</span></div>` +
        `<div class="dr-row"><span>Est. flight time</span><span>${fmtDuration(secs)}</span></div>` +
        `<div class="dr-row"><span>Defense</span><span>${def.name}${def.autoPicked ? ' (auto)' : ''}</span></div>` +
        (p === 0
          ? `<div class="dr-row"><span style="color:var(--red);">⚠ wrong layer</span><span style="color:var(--red);">${def.name} cannot engage a ${s.class}</span></div>`
          : `<div class="dr-row"><span>Kill probability / threat</span><span>~${Math.round(p * 100)}%${salvoN > 1 ? ' at ×' + salvoN : ''}</span></div>`);
      renderCounters(salvoN, 0, 0, atk, defCost, cost.est, s, true);
    }

    function renderCounters(fired, stopped, through, atk, defSpend, est, s, idle) {
      const asym = (defSpend / Math.max(1, atk));
      countersEl.innerHTML =
        `<div class="duel-counter"><div class="dc-num">${fired}</div><div class="dc-lbl">${idle ? 'to fire' : 'fired'}</div></div>` +
        `<div class="duel-counter"><div class="dc-num" style="color:#4a9eff">${idle ? '—' : stopped}</div><div class="dc-lbl">intercepted</div></div>` +
        `<div class="duel-counter"><div class="dc-num" style="color:var(--red)">${idle ? '—' : through}</div><div class="dc-lbl">got through</div></div>` +
        `<div class="duel-counter"><div class="dc-num" style="color:${ACTOR_COLOR[s.actor]}">${fmtUsd(atk)}${est ? '*' : ''}</div><div class="dc-lbl">attacker ${idle ? 'spends' : 'spent'}</div></div>` +
        `<div class="duel-counter"><div class="dc-num" style="color:#4a9eff">${fmtUsd(defSpend)}</div><div class="dc-lbl">defense ${idle ? 'spends' : 'spent'}</div></div>` +
        `<div class="duel-counter"><div class="dc-num">${asym.toFixed(asym >= 10 ? 0 : 1)}×</div><div class="dc-lbl">cost asymmetry</div></div>`;
    }

    function updateLiveCounters() {
      const { s, sim } = tally;         // sim.cost is unitCost(s), memoized at fire time
      const atk = sim.cost.v * tally.fired;
      // Defenders engage every resolved threat (including leakers), matching the
      // pre-fire estimate's n×1.15 — the two figures converge when the salvo ends.
      const engaged = sim.p === 0 ? 0 : tally.stopped + tally.hit;
      const shots = sim.def.beam ? engaged : Math.round(engaged * 1.15);
      renderCounters(tally.fired, tally.stopped, tally.hit, atk, shots * sim.def.cost,
        sim.cost.est, s, false);
    }

    select.addEventListener('change', () => { if (!running) { updateStatic(); drawIdle(); } });
    defSelect.addEventListener('change', () => { if (!running) updateStatic(); });

    // ════════════════════════════════════════════════════════════════════════
    // SIDE VIEW — altitude cross-section
    // ════════════════════════════════════════════════════════════════════════
    let missiles = [], interceptors = [], booms = [], beams = [];
    const BATTERIES = [0.72, 0.785, 0.85]; // x-fractions of the batteries

    function resizeSide() {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawSideScene(W, H) {
      const s = tally ? tally.s : currentSystem();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, H * 0.88); ctx.lineTo(W, H * 0.88); ctx.stroke();
      ctx.fillStyle = ACTOR_COLOR[s.actor];
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(W * 0.03, H * 0.86, 14, 4);
      ctx.fillText(ACTOR_LABEL[s.actor].toUpperCase(), W * 0.03, H * 0.94);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const cityX = W * 0.9;
      [[0, 16], [7, 24], [14, 12], [21, 30], [30, 18]].forEach(([dx, h]) => {
        ctx.fillRect(cityX + dx, H * 0.88 - h, 5, h);
      });
      ctx.fillText(targetFor(s).name.toUpperCase().replace(/^THE /, ''), Math.min(cityX, W - 120), H * 0.94);
      ctx.fillStyle = '#4a9eff';
      for (const bx of BATTERIES) {
        ctx.fillRect(W * bx, H * 0.865, 4, 9);
        ctx.fillRect(W * bx + 5, H * 0.855, 3, 7);
      }
      ctx.globalAlpha = 1;
    }

    function fireSide() {
      const s = currentSystem();
      const sim = summarize(s, salvoN);
      resizeSide();
      setRun(true);
      missiles = []; interceptors = []; booms = []; beams = [];
      const r = canvas.getBoundingClientRect();
      tally = { fired: salvoN, done: 0, hit: 0, stopped: 0, s, sim,
                fireTs: null, W: r.width, H: r.height };
      const flightMs = 3600 + Math.min(2400, Math.log2(salvoN + 1) * 700);
      for (let i = 0; i < salvoN; i++) {
        missiles.push({
          delay: salvoN === 1 ? 0 : (i / salvoN) * 2600 + Math.random() * 260,
          t: 0, start: null, dur: flightMs * (0.92 + Math.random() * 0.16),
          apex: apexFor(s.class) * (0.94 + Math.random() * 0.12),
          y0: 0.86 + (Math.random() - 0.5) * 0.05,
          intercepted: Math.random() < sim.p, intAt: 0.62 + Math.random() * 0.16,
          batt: Math.floor(Math.random() * BATTERIES.length),
          trail: [], dead: false, intLaunched: false,
        });
      }
      updateLiveCounters();
      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(stepSide);
    }

    function stepSide(ts) {
      const W = tally.W, H = tally.H;
      if (tally.fireTs == null) tally.fireTs = ts;
      ctx.clearRect(0, 0, W, H);
      drawSideScene(W, H);
      const s = tally.s, rgb = ACTOR_RGB[s.actor];
      const isBeam = tally.sim.def.beam;

      let active = 0;
      for (const m of missiles) {
        if (m.dead) continue;
        if (m.start === null) {
          // real-time launch stagger (frame-rate independent)
          if (ts - tally.fireTs < m.delay) { active++; continue; }
          m.start = ts;
        }
        m.t = Math.min(1, (ts - m.start) / m.dur);
        active++;
        const x0 = 0.045, x1 = 0.9;
        const endT = m.intercepted ? m.intAt : 1;
        const tt = Math.min(m.t, endT);
        const px = (x0 + (x1 - x0) * tt) * W;
        const py = (m.y0 - Math.sin(Math.PI * tt) * m.apex * (m.y0 - 0.06)) * H
          + (s.class === 'OWA drone' ? Math.sin(tt * 26) * 3 : 0);

        m.trail.push({ x: px, y: py, a: 1 });
        if (m.trail.length > 26) m.trail.shift();
        m.trail.forEach(p => p.a *= 0.9);
        for (let i = 1; i < m.trail.length; i++) {
          const a = m.trail[i - 1], b = m.trail[i];
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${rgb},${b.a * 0.7})`; ctx.lineWidth = 1.3; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${rgb})`; ctx.fill();

        if (m.intercepted && m.t > m.intAt - (isBeam ? 0.03 : 0.28) && !m.intLaunched) {
          m.intLaunched = true;
          const ix = (0.045 + (0.9 - 0.045) * m.intAt) * W;
          const iy = (m.y0 - Math.sin(Math.PI * m.intAt) * m.apex * (m.y0 - 0.06)) * H;
          const bx = W * BATTERIES[m.batt] + 2;
          if (isBeam) {
            beams.push({ x0: bx, y0: H * 0.855, x1: ix, y1: iy, start: ts });
            m.dead = true; tally.done++; tally.stopped++;
            booms.push({ x: ix, y: iy, start: ts, big: false });
            updateLiveCounters();
            continue;
          }
          interceptors.push({ x0: bx, y0: H * 0.86, x1: ix, y1: iy, cX: bx + 15, cY: iy - 30, start: ts, dur: m.dur * 0.26 });
        }
        if (m.t >= endT) {
          m.dead = true; tally.done++;
          if (m.intercepted) {
            if (!m.intLaunched) {
              m.intLaunched = true; tally.stopped++;
              booms.push({ x: px, y: py, start: ts, big: false });
              updateLiveCounters();
            }
          } else {
            tally.hit++;
            booms.push({ x: px, y: H * 0.85, start: ts, big: true });
            updateLiveCounters();
          }
        }
      }

      interceptors = interceptors.filter(it => !it.dead);
      for (const it of interceptors) {
        const t = Math.min(1, (ts - it.start) / it.dur);
        const px = bez(t, it.x0, it.cX, it.x1), py = bez(t, it.y0, it.cY, it.y1);
        ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#74b9ff'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(it.x0, it.y0); ctx.lineTo(px, py);
        ctx.strokeStyle = 'rgba(74,158,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
        if (t >= 1) {
          it.dead = true; tally.stopped++;
          booms.push({ x: it.x1, y: it.y1, start: ts, big: false });
          updateLiveCounters();
        }
      }

      drawBeams(ctx, beams, ts);
      drawBooms(ctx, booms, ts);

      if (active > 0 || interceptors.length > 0 || booms.length > 0 || beams.length > 0) {
        rAF = requestAnimationFrame(stepSide);
      } else { setRun(false); }
    }

    // ════════════════════════════════════════════════════════════════════════
    // MAP VIEW — real geography (Leaflet base + canvas overlay)
    // ════════════════════════════════════════════════════════════════════════
    let map = null, mMissiles = [], mInterceptors = [], mBooms = [], mBeams = [], mScene = null;

    function ensureMap() {
      if (map || !hasLeaflet) return;
      map = L.map('duel-map', {
        zoomControl: false, attributionControl: true, dragging: false,
        scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
        keyboard: false, touchZoom: false, tap: false,
        // don't let Leaflet auto-reproject on window resize mid-salvo — the
        // canvas overlay is projected once per fire and would otherwise detach
        // from the shifting basemap. We reframe ourselves when idle.
        trackResize: false,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 12,
      }).addTo(map);
      map.setView([31.5, 35], 7);
    }

    function sizeMapCanvas() {
      const r = root.querySelector('#duel-map').getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mapCanvas.width = Math.round(r.width * dpr);
      mapCanvas.height = Math.round(r.height * dpr);
      mapCanvas.style.width = r.width + 'px';
      mapCanvas.style.height = r.height + 'px';
      mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Frame the map to the active threat and return projected screen geometry.
    function frameMap(s) {
      ensureMap();
      map.invalidateSize({ animate: false });
      const o = ORIGIN_LATLNG[s.actor], t = targetFor(s).latlng;
      map.fitBounds([o, t], { paddingTopLeft: [70, 46], paddingBottomRight: [46, 70], maxZoom: 10, animate: false });
      sizeMapCanvas();
      const O = map.latLngToContainerPoint(o), T = map.latLngToContainerPoint(t);
      const rect = mapCanvas.getBoundingClientRect();
      const dx = T.x - O.x, dy = T.y - O.y, len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len, ny = dx / len;
      if (ny > 0) { nx = -nx; ny = -ny; } // bow toward the top of the frame
      const bow = Math.min(len * 0.30, rect.height * 0.4) * (0.65 + apexFor(s.class) * 0.45);
      const batteries = [
        { x: T.x - 15, y: T.y + 11 }, { x: T.x + 2, y: T.y + 17 }, { x: T.x + 17, y: T.y + 9 },
      ];
      // W/H cached here so the per-frame draw never touches layout (dims are
      // invariant during a run — interaction and Leaflet resize are disabled).
      return { O: { x: O.x, y: O.y }, T: { x: T.x, y: T.y }, nx, ny, bow, batteries, s,
               W: rect.width, H: rect.height };
    }

    function mapArcPoint(sc, m, t) {
      const cx = (sc.O.x + sc.T.x) / 2 + sc.nx * m.bow;
      const cy = (sc.O.y + sc.T.y) / 2 + sc.ny * m.bow;
      return { x: bez(t, sc.O.x, cx, sc.T.x), y: bez(t, sc.O.y, cy, sc.T.y) };
    }

    function drawMapScene(sc) {
      const s = sc.s, W = sc.W;
      mapCtx.font = '600 9px "IBM Plex Mono", monospace';
      // origin
      mapCtx.beginPath(); mapCtx.arc(sc.O.x, sc.O.y, 5, 0, Math.PI * 2);
      mapCtx.fillStyle = ACTOR_COLOR[s.actor]; mapCtx.fill();
      mapCtx.beginPath(); mapCtx.arc(sc.O.x, sc.O.y, 9, 0, Math.PI * 2);
      mapCtx.strokeStyle = `rgba(${ACTOR_RGB[s.actor]},0.5)`; mapCtx.lineWidth = 1; mapCtx.stroke();
      mapCtx.fillStyle = ACTOR_COLOR[s.actor];
      mapCtx.textAlign = sc.O.x > W - 80 ? 'right' : 'left';
      mapCtx.fillText(ACTOR_LABEL[s.actor].toUpperCase(), sc.O.x + (sc.O.x > W - 80 ? -10 : 10), sc.O.y + 3);
      // batteries
      mapCtx.fillStyle = '#4a9eff';
      for (const b of sc.batteries) { mapCtx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); }
      // target
      mapCtx.beginPath(); mapCtx.arc(sc.T.x, sc.T.y, 4, 0, Math.PI * 2);
      mapCtx.fillStyle = '#e8b84b'; mapCtx.fill();
      mapCtx.textAlign = sc.T.x > W - 80 ? 'right' : 'left';
      mapCtx.fillText(targetFor(s).name.toUpperCase().replace(/^THE /, ''),
        sc.T.x + (sc.T.x > W - 80 ? -9 : 9), sc.T.y - 8);
    }

    function drawIdleMap() {
      if (!hasLeaflet) return;
      const s = currentSystem();
      mScene = frameMap(s);
      mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
      // faint dashed trajectory hint
      mapCtx.save();
      mapCtx.setLineDash([4, 5]);
      mapCtx.strokeStyle = `rgba(${ACTOR_RGB[s.actor]},0.35)`; mapCtx.lineWidth = 1.2;
      mapCtx.beginPath();
      for (let t = 0; t <= 1.0001; t += 0.04) {
        const p = mapArcPoint(mScene, { bow: mScene.bow }, t);
        t === 0 ? mapCtx.moveTo(p.x, p.y) : mapCtx.lineTo(p.x, p.y);
      }
      mapCtx.stroke();
      mapCtx.restore();
      drawMapScene(mScene);
    }

    function fireMap() {
      const s = currentSystem();
      const sim = summarize(s, salvoN);
      mScene = frameMap(s);
      setRun(true);
      mMissiles = []; mInterceptors = []; mBooms = []; mBeams = [];
      tally = { fired: salvoN, done: 0, hit: 0, stopped: 0, s, sim };
      const flightMs = 4200 + Math.min(2800, Math.log2(salvoN + 1) * 800);
      for (let i = 0; i < salvoN; i++) {
        mMissiles.push({
          delay: salvoN === 1 ? 0 : (i / salvoN) * 2800 + Math.random() * 300,
          t: 0, start: null, dur: flightMs * (0.9 + Math.random() * 0.2),
          bow: mScene.bow * (0.85 + Math.random() * 0.3),
          intercepted: Math.random() < sim.p, intAt: 0.6 + Math.random() * 0.18,
          batt: Math.floor(Math.random() * mScene.batteries.length),
          trail: [], dead: false, intLaunched: false,
        });
      }
      updateLiveCounters();
      if (rAF) cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(stepMap);
    }

    function stepMap(ts) {
      const sc = mScene, s = tally.s, rgb = ACTOR_RGB[s.actor];
      const isBeam = tally.sim.def.beam;
      if (tally.fireTs == null) tally.fireTs = ts;
      mapCtx.clearRect(0, 0, sc.W, sc.H);
      drawMapScene(sc);

      let active = 0;
      for (const m of mMissiles) {
        if (m.dead) continue;
        if (m.start === null) {
          // real-time launch stagger (frame-rate independent)
          if (ts - tally.fireTs < m.delay) { active++; continue; }
          m.start = ts;
        }
        m.t = Math.min(1, (ts - m.start) / m.dur);
        active++;
        const endT = m.intercepted ? m.intAt : 1;
        const tt = Math.min(m.t, endT);
        const p = mapArcPoint(sc, m, tt);

        m.trail.push({ x: p.x, y: p.y, a: 1 });
        if (m.trail.length > 30) m.trail.shift();
        m.trail.forEach(q => q.a *= 0.92);
        for (let i = 1; i < m.trail.length; i++) {
          const a = m.trail[i - 1], b = m.trail[i];
          mapCtx.beginPath(); mapCtx.moveTo(a.x, a.y); mapCtx.lineTo(b.x, b.y);
          mapCtx.strokeStyle = `rgba(${rgb},${b.a * 0.75})`; mapCtx.lineWidth = 1.4; mapCtx.stroke();
        }
        mapCtx.beginPath(); mapCtx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        mapCtx.fillStyle = `rgb(${rgb})`; mapCtx.fill();

        if (m.intercepted && m.t > m.intAt - (isBeam ? 0.03 : 0.26) && !m.intLaunched) {
          m.intLaunched = true;
          const ip = mapArcPoint(sc, m, m.intAt);
          const b = sc.batteries[m.batt];
          if (isBeam) {
            mBeams.push({ x0: b.x, y0: b.y, x1: ip.x, y1: ip.y, start: ts });
            m.dead = true; tally.done++; tally.stopped++;
            mBooms.push({ x: ip.x, y: ip.y, start: ts, big: false });
            updateLiveCounters();
            continue;
          }
          const midx = (b.x + ip.x) / 2, midy = Math.min(b.y, ip.y) - 20;
          mInterceptors.push({ x0: b.x, y0: b.y, x1: ip.x, y1: ip.y, cX: midx, cY: midy, start: ts, dur: m.dur * 0.24 });
        }
        if (m.t >= endT) {
          m.dead = true; tally.done++;
          if (m.intercepted) {
            if (!m.intLaunched) {
              m.intLaunched = true; tally.stopped++;
              mBooms.push({ x: p.x, y: p.y, start: ts, big: false });
              updateLiveCounters();
            }
          } else {
            tally.hit++;
            mBooms.push({ x: p.x, y: p.y, start: ts, big: true });
            updateLiveCounters();
          }
        }
      }

      mInterceptors = mInterceptors.filter(it => !it.dead);
      for (const it of mInterceptors) {
        const t = Math.min(1, (ts - it.start) / it.dur);
        const px = bez(t, it.x0, it.cX, it.x1), py = bez(t, it.y0, it.cY, it.y1);
        mapCtx.beginPath(); mapCtx.arc(px, py, 1.8, 0, Math.PI * 2);
        mapCtx.fillStyle = '#74b9ff'; mapCtx.fill();
        mapCtx.beginPath(); mapCtx.moveTo(it.x0, it.y0); mapCtx.lineTo(px, py);
        mapCtx.strokeStyle = 'rgba(74,158,255,0.18)'; mapCtx.lineWidth = 1; mapCtx.stroke();
        if (t >= 1) {
          it.dead = true; tally.stopped++;
          mBooms.push({ x: it.x1, y: it.y1, start: ts, big: false });
          updateLiveCounters();
        }
      }

      drawBeams(mapCtx, mBeams, ts);
      drawBooms(mapCtx, mBooms, ts);

      if (active > 0 || mInterceptors.length > 0 || mBooms.length > 0 || mBeams.length > 0) {
        rAF = requestAnimationFrame(stepMap);
      } else { setRun(false); }
    }

    // ── shared explosion / beam rendering ────────────────────────────────────
    function drawBeams(c, arr, ts) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const b = arr[i];
        const a = 1 - (ts - b.start) / 240;
        if (a <= 0) { arr.splice(i, 1); continue; }
        c.beginPath(); c.moveTo(b.x0, b.y0); c.lineTo(b.x1, b.y1);
        c.strokeStyle = `rgba(255,140,90,${a * 0.9})`; c.lineWidth = 1.6; c.stroke();
      }
    }
    function drawBooms(c, arr, ts) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const b = arr[i];
        const t = (ts - b.start) / 700;
        if (t >= 1) { arr.splice(i, 1); continue; }
        const R = (b.big ? 26 : 13) * t + 3;
        const grad = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, R);
        grad.addColorStop(0, `rgba(255,255,255,${(1 - t) * 0.9})`);
        grad.addColorStop(0.5, `rgba(232,184,75,${(1 - t) * 0.7})`);
        grad.addColorStop(1, 'rgba(214,48,49,0)');
        c.beginPath(); c.arc(b.x, b.y, R, 0, Math.PI * 2);
        c.fillStyle = grad; c.fill();
      }
    }

    // ── view routing ─────────────────────────────────────────────────────────
    function drawIdle() {
      if (running) return;
      if (view === 'map') { drawIdleMap(); }
      else {
        resizeSide();
        const W = canvas.getBoundingClientRect().width, H = canvas.getBoundingClientRect().height;
        ctx.clearRect(0, 0, W, H);
        const keep = tally; tally = null; drawSideScene(W, H); tally = keep;
      }
    }

    function fire() {
      if (running) return;
      if (view === 'map') fireMap(); else fireSide();
    }
    root.querySelector('#duel-fire').addEventListener('click', fire);

    root.querySelectorAll('#duel-views .filter-btn').forEach(b => {
      b.addEventListener('click', () => {
        if (running || b.dataset.view === view) return;
        root.querySelectorAll('#duel-views .filter-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        view = b.dataset.view;
        mapStage.hidden = view !== 'map';
        canvas.hidden = view === 'map';
        drawIdle();
      });
    });

    let resizeT;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { if (running) pendingReframe = true; else drawIdle(); }, 160);
    }, { passive: true });

    updateStatic();
    requestAnimationFrame(drawIdle);

    return {
      select(id) {
        if (systems.some(s => s.id === id)) {
          select.value = id;
          updateStatic();
          if (!running) drawIdle();
        }
      },
    };
  };
})();
