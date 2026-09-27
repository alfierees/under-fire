// ── Hub page — the board (flap counters + latest alerts) + row previews ─────

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Split a figure into flap cells. Digits cycle briefly before settling, left to
// right, like a board catching up with new data. Separators never flap.
function renderFlaps(container, text, delay = 0) {
  if (!container) return;
  container.setAttribute('aria-label', text);
  const cells = [...text].map(ch => {
    const el = document.createElement('span');
    el.className = /\d/.test(ch) ? 'flap' : 'flap sep';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = ch;
    return el;
  });
  container.replaceChildren(...cells);
  if (REDUCED_MOTION) return;
  cells.forEach((el, i) => {
    if (el.classList.contains('sep')) return;
    const final = el.textContent;
    let steps = 5 + i;
    el.textContent = String((+final + 5) % 10);
    const turn = () => {
      el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
      steps -= 1;
      el.textContent = steps <= 0 ? final : String((+el.textContent + 1) % 10);
      if (steps > 0) setTimeout(turn, 60);
    };
    setTimeout(turn, delay + i * 35);
  });
}

function fmtBoardTime(ts) {
  const [d, t] = ts.split(' ');
  const [, m, day] = d.split('-');
  return `${day} ${MONTH_ABBR[+m - 1]} ${t.slice(0, 5)}`;
}

(async () => {
  try {
    const s = await fetchData('stats_summary.json');
    const start = new Date(s.date_range.start), end = new Date(s.date_range.end);
    const long = d => `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
    document.getElementById('board-range').textContent = `Alerts recorded, ${long(start)} to ${long(end)}`;
    renderFlaps(document.getElementById('board-total'), fmtNum(s.total_alerts));
    document.querySelectorAll('[data-front]').forEach((el, i) => {
      const n = s.origins[el.dataset.front];
      if (n != null) renderFlaps(el, fmtNum(n), 250 + i * 120);
    });
  } catch (e) { /* static floors in the HTML stay in place */ }
})();

(async () => {
  const body = document.getElementById('board-latest');
  if (!body) return;
  try {
    const data = await fetchData('recent_alerts.json');
    const rows = (data.events || []).slice(0, 5).map(ev => {
      const tr = document.createElement('tr');
      const who = ev.origin === 'Unknown' ? 'Unattributed' : ev.origin;
      const extra = ev.areas.length - 1;
      const cells = [
        fmtBoardTime(ev.ts),
        (ev.areas[0] || 'Israel') + (extra > 0 ? ` +${extra}` : ''),
        who,
        fmtNum(ev.count),
      ];
      cells.forEach((txt, i) => {
        const td = document.createElement('td');
        if (i === 2) {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.style.background = `var(--${ev.origin.toLowerCase()})`;
          td.appendChild(chip);
          const name = document.createElement('span');
          name.className = 'origin-name';
          name.textContent = txt;
          name.style.color = `var(--${ev.origin.toLowerCase()})`;
          td.appendChild(name);
          td.title = txt;
        } else {
          td.appendChild(document.createTextNode(txt));
        }
        if (i === 1) td.title = ev.areas.join(', ');
        tr.appendChild(td);
      });
      return tr;
    });
    if (rows.length) {
      body.replaceChildren(...rows);
      document.getElementById('board-fresh').textContent =
        `Last alert ${alertRelTime(data.events[0].ts)}. Origin estimated from location and timing.`;
    } else {
      throw new Error('no events');
    }
  } catch (e) {
    const tr = document.createElement('tr'); tr.className = 'empty';
    const td = document.createElement('td'); td.colSpan = 4;
    td.textContent = 'Latest alerts are unavailable right now. The full record below is unaffected.';
    tr.appendChild(td); body.replaceChildren(tr);
  }
})();

// ── Row previews ────────────────────────────────────────────────────────────
// Decorative thumbnails for the chart index. They are shaped by the real data
// files but styled for the board (fire gradients, no axes, no numbers), so they
// read as a taste of each page rather than a chart to be quoted.
// Drawn once on first scroll into view; data files are shared and cached.

const _cache = {};
async function getData(file) {
  if (!_cache[file]) _cache[file] = fetchData(file);
  return _cache[file];
}

const FIRE_STOPS = ['#e0493e', '#ee8a2a', '#f2b233', '#ffd27a'];
const ACTOR_HEX = { Hamas: '#e0493e', Hezbollah: '#ee8a2a', Houthis: '#4f9be8', Iran: '#b27ce0', Unknown: '#6f6c66' };
const fireScale = d3.scaleLinear().domain([0, 0.45, 0.75, 1]).range(FIRE_STOPS).clamp(true);

function previewSvg(svgEl) {
  const W = svgEl.clientWidth || 240, H = svgEl.clientHeight || 72;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  return { svg, W, H };
}

// Linear gradient in the fire palette. Vertical runs red (bottom) → gold (top).
let _gradId = 0;
function fireGradient(svg, { vertical = true, fadeFrom = 1 } = {}) {
  const id = 'uf-fire-' + (++_gradId);
  const g = svg.append('defs').append('linearGradient').attr('id', id)
    .attr('x1', 0).attr('y1', vertical ? 1 : 0).attr('x2', vertical ? 0 : 1).attr('y2', 0);
  FIRE_STOPS.forEach((c, i) => g.append('stop')
    .attr('offset', `${(i / (FIRE_STOPS.length - 1)) * 100}%`)
    .attr('stop-color', c)
    .attr('stop-opacity', fadeFrom + (1 - fadeFrom) * (i / (FIRE_STOPS.length - 1))));
  return `url(#${id})`;
}

// Six Years of Alerts: one smooth fire wave (square-root scaled so the quiet
// years still show a pulse instead of a flat line).
async function drawPreviewTimeline(svgEl) {
  const data = (await getData('timeline_weekly.json')).slice().sort((a, b) => a.week < b.week ? -1 : 1);
  const { svg, W, H } = previewSvg(svgEl);
  const parse = d3.timeParse('%Y-%m-%d');
  const x = d3.scaleTime().domain(d3.extent(data, d => parse(d.week))).range([0, W]);
  const y = d3.scalePow().exponent(0.4).domain([0, d3.max(data, d => d.total)]).range([H, 3]);
  const area = d3.area().x(d => x(parse(d.week))).y0(H).y1(d => y(d.total)).curve(d3.curveBasis);
  const line = d3.line().x(d => x(parse(d.week))).y(d => y(d.total)).curve(d3.curveBasis);
  svg.append('path').datum(data).attr('d', area).attr('fill', fireGradient(svg, { fadeFrom: 0.55 }));
  svg.append('path').datum(data).attr('d', line).attr('fill', 'none')
    .attr('stroke', '#ffd27a').attr('stroke-width', 1).attr('stroke-opacity', 0.85);
}

// The Four Fronts: a streamgraph of the four actors (plus unattributed).
async function drawPreviewFronts(svgEl) {
  const raw = await getData('actors_monthly.json');
  const { svg, W, H } = previewSvg(svgEl);
  const keys = ['Unknown', 'Hamas', 'Hezbollah', 'Houthis', 'Iran'];
  const rows = raw.map(d => { const r = {}; keys.forEach(k => r[k] = Math.pow(d[k] || 0, 0.35)); return r; });
  const series = d3.stack().keys(keys).offset(d3.stackOffsetWiggle).order(d3.stackOrderInsideOut)(rows);
  const x = d3.scaleLinear().domain([0, rows.length - 1]).range([0, W]);
  const y = d3.scaleLinear()
    .domain([d3.min(series, s => d3.min(s, d => d[0])), d3.max(series, s => d3.max(s, d => d[1]))])
    .range([H - 1, 1]);
  const area = d3.area().x((d, i) => x(i)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveBasis);
  svg.selectAll('path').data(series).enter().append('path')
    .attr('d', area).attr('fill', s => ACTOR_HEX[s.key]).attr('fill-opacity', s => s.key === 'Unknown' ? 0.55 : 0.9);
}

// Every Day, Six Years: six months around October 7, 2023, where the grid
// turns from scattered days into a near-continuous band.
async function drawPreviewCalendar(svgEl) {
  const data = await getData('daily_counts.json');
  const { svg, W, H } = previewSvg(svgEl);
  const weeks = 26, days = weeks * 7;
  // The file omits weeks with no alerts, so walk real calendar days (missing = 0).
  const byDate = new Map(data.map(d => [d.date, d.count]));
  const t0 = Date.UTC(2023, 6, 10); // Monday 10 July 2023
  const win = d3.range(days).map(i => {
    const date = new Date(t0 + i * 864e5).toISOString().slice(0, 10);
    return { date, count: byDate.get(date) || 0 };
  });
  const logs = win.filter(d => d.count > 0).map(d => Math.log10(d.count + 1));
  const lo = d3.min(logs) || 0, hi = d3.max(logs) || 1;
  const cell = Math.min((W - 2) / weeks, (H - 2) / 7);
  const x0 = (W - cell * weeks) / 2, y0 = (H - cell * 7) / 2;
  win.forEach((d, i) => {
    svg.append('rect')
      .attr('x', x0 + Math.floor(i / 7) * cell).attr('y', y0 + (i % 7) * cell)
      .attr('width', cell - 1.5).attr('height', cell - 1.5).attr('rx', 1)
      .attr('fill', d.count === 0 ? '#1f2024' : fireScale(0.08 + 0.92 * (Math.log10(d.count + 1) - lo) / (hi - lo || 1)));
  });
}

// The Wars, Side by Side: every operation as an overlapping bubble, in date order.
async function drawPreviewCompare(svgEl) {
  const ops = (await getData('operations.json')).operations.slice().sort((a, b) => a.start < b.start ? -1 : 1);
  const { svg, W, H } = previewSvg(svgEl);
  const FRONT = { Gaza: '#e0493e', Lebanon: '#ee8a2a', Yemen: '#4f9be8', Iran: '#b27ce0', 'All fronts': '#f2b233' };
  const r = d3.scaleSqrt().domain([0, d3.max(ops, d => d.total)]).range([3, H / 2 - 2]);
  const step = (W - H) / Math.max(1, ops.length - 1);
  ops.forEach((d, i) => {
    const c = FRONT[d.front] || '#b9b5ac';
    svg.append('circle').attr('cx', H / 2 + i * step).attr('cy', H / 2).attr('r', r(d.total))
      .attr('fill', c).attr('fill-opacity', 0.28).attr('stroke', c).attr('stroke-width', 1.2);
  });
}

// The Spread: five small maps of the alert regions filling in, 2020 → today.
async function drawPreviewTimelapse(svgEl) {
  const [am, geo] = await Promise.all([getData('area_monthly.json'), getData('area_polygons.json')]);
  const { svg, W, H } = previewSvg(svgEl);
  const n = 5;
  const lastIdx = am.months.length - 1;
  const stops = [0.12, 0.45, 0.62, 0.8, 1].map(f => Math.round(f * lastIdx));
  const cum = stops.map(end => {
    const out = {};
    am.areas.forEach(a => { out[a] = d3.sum(am.counts[a].slice(0, end + 1)); });
    return out;
  });
  const maxLog = Math.log10(d3.max(Object.values(cum[n - 1])) + 1);
  const slot = W / n;
  // Fit each map to the populated north; the long Arabah tail runs off the bottom edge.
  const north = { type: 'FeatureCollection', features: geo.features.filter(f => d3.geoCentroid(f)[1] > 30.6) };
  stops.forEach((_, k) => {
    const proj = d3.geoMercator().fitExtent([[k * slot + 4, 2], [(k + 1) * slot - 4, H + 6]], north);
    const path = d3.geoPath(proj);
    svg.append('g').selectAll('path').data(geo.features).enter().append('path')
      .attr('d', path)
      .attr('fill', f => { const v = cum[k][f.properties.area] || 0; return v ? fireScale(Math.log10(v + 1) / maxLog) : '#1f2024'; })
      .attr('stroke', '#0e0f11').attr('stroke-width', 0.3);
  });
}

// When Do They Strike?: a radial 24-hour clock beside the weekday rhythm.
async function drawPreviewClock(svgEl) {
  const d = await getData('hourly_dow.json');
  const { svg, W, H } = previewSvg(svgEl);
  const size = H, cx = size / 2, cy = size / 2;
  const maxH = d3.max(d.hourly, r => r.count);
  const rS = d3.scaleSqrt().domain([0, maxH]).range([size * 0.14, size / 2 - 1]);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  g.append('circle').attr('r', size / 2 - 1).attr('fill', 'none').attr('stroke', '#2c2d33');
  const tau = 2 * Math.PI;
  d.hourly.forEach(row => {
    const a0 = (row.hour / 24) * tau;
    g.append('path').attr('d', d3.arc().innerRadius(size * 0.12).outerRadius(rS(row.count))
      .startAngle(a0).endAngle(a0 + tau / 24 - 0.02))
      .attr('fill', fireScale(row.count / maxH));
  });
  const days = d.day_of_week;
  const bx0 = size + 14, bw = (W - bx0) / days.length;
  const maxD = d3.max(days, r => r.count);
  const y = d3.scaleLinear().domain([0, maxD]).range([0, H - 6]);
  days.forEach((row, i) => {
    svg.append('rect').attr('x', bx0 + i * bw + 2).attr('width', Math.max(2, bw - 5))
      .attr('y', H - 1 - y(row.count)).attr('height', y(row.count)).attr('rx', 1)
      .attr('fill', fireScale(row.count / maxD));
  });
}

// Area Vulnerability: the ten most-hit regions as fading fire bars.
async function drawPreviewAreas(svgEl) {
  const data = (await getData('areas_summary.json')).slice(0, 10);
  const { svg, W, H } = previewSvg(svgEl);
  const x = d3.scaleSqrt().domain([0, d3.max(data, d => d.total)]).range([0, W]);
  const y = d3.scaleBand().domain(data.map(d => d.area)).range([0, H]).padding(0.28);
  const fill = fireGradient(svg, { vertical: false });
  data.forEach((d, i) => {
    svg.append('rect').attr('x', 0).attr('y', y(d.area))
      .attr('width', x(d.total)).attr('height', y.bandwidth()).attr('rx', 1)
      .attr('fill', fill).attr('opacity', 1 - i * 0.06);
  });
}

// Records: the busiest-day figure on flap cells, like the homepage board.
async function drawPreviewRecords(svgEl) {
  const records = await getData('records.json');
  const { svg, W, H } = previewSvg(svgEl);
  const txt = records.busiest_day.count.toLocaleString('en-US');
  const ch = H - 10, cw = ch * 0.62, gap = 3;
  const widths = [...txt].map(c => /\d/.test(c) ? cw : cw * 0.35);
  let x = (W - (d3.sum(widths) + gap * (txt.length - 1))) / 2;
  [...txt].forEach((c, i) => {
    const w = widths[i];
    if (/\d/.test(c)) {
      svg.append('rect').attr('x', x).attr('y', 5).attr('width', w).attr('height', ch / 2).attr('rx', 2).attr('fill', '#26272c');
      svg.append('rect').attr('x', x).attr('y', 5 + ch / 2).attr('width', w).attr('height', ch / 2).attr('rx', 2).attr('fill', '#1f2024');
      svg.append('rect').attr('x', x).attr('y', 5 + ch / 2 - 1).attr('width', w).attr('height', 2).attr('fill', '#08090a');
    }
    svg.append('text').attr('x', x + w / 2).attr('y', 5 + ch * 0.8).attr('text-anchor', 'middle')
      .attr('font-family', 'Archivo Narrow').attr('font-weight', 700).attr('font-size', ch * 0.82)
      .attr('fill', '#f1ede4').text(c);
    x += w + gap;
  });
}

// What They Fire: a size line-up of weapon silhouettes standing nose-up,
// smallest to largest, in each front's colour. Schematic, like the arsenal page.
const LINEUP = ['mortars', 'qassam', 'fajr-3', 'mirsad-1', 'fateh-110-m600', 'quds-cruise', 'shahed-131-136', 'toofan', 'sejjil'];
const SIL_PATH = {
  'mortar': 'M30,9 L58,9 Q72,13 58,17 L30,17 Z M30,9 L22,4 L26,13 L22,22 L30,17',
  'artillery rocket': 'M16,10 L76,10 Q92,13 76,16 L16,16 Z M16,10 L8,5 L12,13 L8,21 L16,16',
  'heavy artillery rocket': 'M12,8.5 L74,8.5 Q94,13 74,17.5 L12,17.5 Z M12,8.5 L4,3 L9,13 L4,23 L12,17.5',
  'SRBM': 'M12,8 L72,8 L94,13 L72,18 L12,18 Z M12,8 L2,1 L8,13 L2,25 L12,18 M44,8 L50,2 L56,8 M44,18 L50,24 L56,18',
  'MRBM': 'M8,7 L58,7 L66,9 L80,10 L96,13 L80,16 L66,17 L58,19 L8,19 Z M8,7 L1,2 L5,13 L1,24 L8,19',
  'cruise missile': 'M10,10 L78,10 Q96,13 78,16 L10,16 Z M34,12 L50,0 L54,0 L44,12 M34,14 L50,26 L54,26 L44,14 M10,10 L2,3 L8,13 L2,23 L10,16',
  'OWA drone': 'M14,13 L84,10 Q96,13 84,16 Z M40,12 L46,-1 L52,12 M40,14 L46,27 L52,14 M14,10 L6,2 M14,16 L6,24',
  'shahed': 'M8,13 L86,4 L96,13 L86,22 Z M8,13 L20,2 L24,4 L14,13 L24,22 L20,24 Z',
};
const SIL_LEN = { 'mortar': 34, 'artillery rocket': 52, 'heavy artillery rocket': 66, 'OWA drone': 60, 'shahed': 62, 'cruise missile': 78, 'SRBM': 88, 'MRBM': 108 };
async function drawPreviewArsenal(svgEl) {
  const a = await getData('arsenal.json');
  const { svg, W, H } = previewSvg(svgEl);
  const byId = Object.fromEntries(a.systems.map(s => [s.id, s]));
  const items = LINEUP.map(id => byId[id]).filter(Boolean).map(s => {
    const kind = s.id.includes('shahed') ? 'shahed' : s.class;
    const len = (SIL_LEN[kind] || 52) + (s.id === 'sejjil' ? 12 : 0);
    return { s, kind, len };
  }).sort((p, q) => p.len - q.len);
  const base = H - 2, maxLen = d3.max(items, d => d.len);
  const slot = W / items.length;
  svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', base + 0.5).attr('y2', base + 0.5).attr('stroke', '#2c2d33');
  items.forEach((d, i) => {
    const h = (d.len / maxLen) * (H - 6);
    const sx = h / 100, sy = sx * 1.05;
    const w = 26 * sy;
    const c = a.meta.actors[d.s.actor].color;
    svg.append('path').attr('d', SIL_PATH[d.kind])
      .attr('transform', `translate(${i * slot + (slot - w) / 2},${base}) rotate(-90) scale(${sx},${sy})`)
      .attr('fill', c).attr('fill-opacity', 0.35)
      .attr('stroke', c).attr('stroke-width', 1.1).attr('vector-effect', 'non-scaling-stroke')
      .attr('stroke-linejoin', 'round');
  });
}

// Take the Data: the newest records as rows on a mini board.
async function drawPreviewData(svgEl) {
  const data = await getData('recent_alerts.json');
  const { svg, W, H } = previewSvg(svgEl);
  const rows = (data.events || []).slice(0, 3);
  const rh = (H - 4) / 3;
  rows.forEach((ev, i) => {
    const y = 1 + i * (rh + 1);
    svg.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rh / 2).attr('fill', '#26272c');
    svg.append('rect').attr('x', 0).attr('y', y + rh / 2).attr('width', W).attr('height', rh / 2).attr('fill', '#1f2024');
    const ty = y + rh * 0.68, fs = Math.min(11.5, rh * 0.52);
    const t = svg.append('text').attr('y', ty).attr('font-family', 'Archivo Narrow').attr('font-weight', 600)
      .attr('font-size', fs).attr('letter-spacing', '0.04em');
    t.append('tspan').attr('x', 6).attr('fill', '#b9b5ac').text(fmtBoardTime(ev.ts).toUpperCase());
    t.append('tspan').attr('x', 6 + fs * 7.4).attr('fill', '#f1ede4').text((ev.areas[0] || 'Israel').toUpperCase());
    svg.append('rect').attr('x', W - 14).attr('y', y + rh / 2 - 4).attr('width', 8).attr('height', 8).attr('rx', 1)
      .attr('fill', ACTOR_HEX[ev.origin] || '#6f6c66');
  });
}

// Oct 7 and Story: static screenshots of those pages.
async function drawPreviewOct7(svgEl) {
  const { svg, W, H } = previewSvg(svgEl);
  svg.append('image').attr('href', 'images/oct7-preview.webp')
    .attr('width', W).attr('height', H).attr('preserveAspectRatio', 'xMidYMid slice');
}
async function drawPreviewStory(svgEl) {
  const { svg, W, H } = previewSvg(svgEl);
  svg.append('image').attr('href', 'images/story-preview.webp')
    .attr('width', W).attr('height', H).attr('preserveAspectRatio', 'xMidYMid slice');
}

// Observer to draw on first scroll-into-view
const previewMap = {
  timeline: drawPreviewTimeline,
  fronts:   drawPreviewFronts,
  calendar: drawPreviewCalendar,
  clock:    drawPreviewClock,
  areas:    drawPreviewAreas,
  oct7:     drawPreviewOct7,
  story:    drawPreviewStory,
  records:  drawPreviewRecords,
  compare:  drawPreviewCompare,
  timelapse: drawPreviewTimelapse,
  arsenal:  drawPreviewArsenal,
  data:     drawPreviewData,
};

const previewObs = new IntersectionObserver((entries) => {
  entries.forEach(ent => {
    if (!ent.isIntersecting) return;
    const svg = ent.target;
    const key = svg.dataset.preview;
    const fn = previewMap[key];
    if (fn && !svg.dataset.drawn) {
      svg.dataset.drawn = '1';
      fn(svg).catch(err => console.warn('preview', key, err));
      previewObs.unobserve(svg);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px 100px 0px' });

document.querySelectorAll('[data-preview]').forEach(el => previewObs.observe(el));
