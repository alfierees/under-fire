// ── Hub page — hero counters + card sparkline previews ─────────────────────

function animateCounter(el, target, duration = 2000, suffix = '') {
  if (!el) return;
  const start = performance.now();
  const startVal = parseInt(el.textContent) || 0;
  function update(ts) {
    const pct = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    el.textContent = Math.round(startVal + (target - startVal) * ease).toLocaleString() + suffix;
    if (pct < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

(async () => {
  try {
    const s = await fetchData('stats_summary.json');
    animateCounter(document.getElementById('counter-alerts'), s.total_alerts, 2200, '+');
    animateCounter(document.getElementById('counter-actors'), 4, 1000);
    animateCounter(document.getElementById('counter-years'), 6, 800);
  } catch (e) {
    document.getElementById('counter-alerts').textContent = '142,837+';
    document.getElementById('counter-actors').textContent = '4';
    document.getElementById('counter-years').textContent = '6';
  }
})();

// ── Card sparkline previews ────────────────────────────────────────────────
// Each card gets a tiny live D3 chart rendered on first scroll into view.
// Data is shared/cached so loading one chart costs nothing for siblings.

const _cache = {};
async function getData(file) {
  if (!_cache[file]) _cache[file] = fetchData(file);
  return _cache[file];
}

// Weekly timeline mini area
async function drawPreviewTimeline(svgEl) {
  const data = await getData('timeline_weekly.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const parse = d3.timeParse('%Y-%m-%d');
  const oct7 = new Date('2023-10-07');
  const x = d3.scaleTime()
    .domain(d3.extent(data, d => parse(d.week))).range([0, W]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.total)]).range([H, 2]);
  const area = d3.area()
    .x(d => x(parse(d.week))).y0(H).y1(d => y(d.total))
    .curve(d3.curveMonotoneX);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  const pre = data.filter(d => parse(d.week) < oct7);
  const post = data.filter(d => parse(d.week) >= oct7);
  svg.append('path').datum(pre).attr('fill','rgba(200,200,216,0.25)').attr('stroke','rgba(200,200,216,0.5)').attr('stroke-width',0.8).attr('d', area);
  svg.append('path').datum(post).attr('fill','rgba(214,48,49,0.4)').attr('stroke','rgba(214,48,49,0.8)').attr('stroke-width',0.8).attr('d', area);
  svg.append('line').attr('x1', x(oct7)).attr('x2', x(oct7)).attr('y1', 0).attr('y2', H)
    .attr('stroke','#e8b84b').attr('stroke-width',0.8).attr('stroke-dasharray','2,2');
}

// Stacked bars fronts (mini)
async function drawPreviewFronts(svgEl) {
  const raw = await getData('actors_monthly.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const actors = ['Hamas', 'Hezbollah', 'Houthis', 'Iran', 'Unknown'];
  const colors = { Iran:'#c678dd', Hezbollah:'#f39c12', Houthis:'#4a9eff', Hamas:'#d63031', Unknown:'#3a3a4a' };
  const data = raw.map(d => { const r = { month: d.month }; actors.forEach(a => r[a] = d[a] || 0); return r; });
  const xBand = d3.scaleBand().domain(data.map(d => d.month)).range([0, W]).paddingInner(0.15);
  const stack = d3.stack().keys(actors)(data);
  const yMax = d3.max(stack[stack.length-1], d => d[1]);
  const y = d3.scaleLinear().domain([0, yMax]).range([H, 2]);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  stack.forEach((layer, i) => {
    svg.selectAll('rect.f' + i).data(layer).enter().append('rect')
      .attr('class', 'f' + i)
      .attr('x', d => xBand(d.data.month))
      .attr('width', xBand.bandwidth())
      .attr('y', d => y(d[1]))
      .attr('height', d => Math.max(0, y(d[0]) - y(d[1])))
      .attr('fill', colors[actors[i]]);
  });
}

// Calendar heatmap mini preview
async function drawPreviewCalendar(svgEl) {
  const data = await getData('daily_counts.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  const maxC = d3.max(data, d => d.count);
  const scale = d3.scaleSequential(t => d3.interpolateRgb('#15151c', '#d63031')(t))
    .domain([0, Math.log10(maxC + 1)]);
  // Sample every Nth day to fit
  const stride = Math.ceil(data.length / (W * 0.9));
  const cellW = (W - 4) / Math.ceil(data.length / stride / 7);
  const cellH = (H - 2) / 7;
  let col = 0, row = 0;
  for (let i = 0; i < data.length; i += stride) {
    const d = data[i];
    const dt = new Date(d.date + 'T00:00:00');
    row = (dt.getDay() + 6) % 7;
    col = Math.floor(i / stride / 7);
    svg.append('rect')
      .attr('x', 2 + col * cellW)
      .attr('y', 1 + row * cellH)
      .attr('width', Math.max(1, cellW - 0.6))
      .attr('height', Math.max(1, cellH - 0.6))
      .attr('fill', d.count === 0 ? '#0f0f14' : scale(Math.log10(d.count + 1)))
      .attr('rx', 0.8);
  }
}


// Israel silhouette polygon in normalised [0,1] coords (top-left origin).
// Approximates the Galilee panhandle → coast → Negev → Eilat tip.
const ISRAEL_POLYGON = [
  [0.46, 0.00], [0.54, 0.02], [0.58, 0.06],   // panhandle top
  [0.66, 0.10], [0.72, 0.14],                  // upper Galilee bulge
  [0.76, 0.20], [0.78, 0.27],                  // east of Sea of Galilee
  [0.74, 0.34], [0.78, 0.42],                  // Dead Sea east border
  [0.74, 0.52], [0.70, 0.62],                  // Negev east border
  [0.62, 0.74], [0.54, 0.85],                  // Negev tapering south
  [0.50, 0.98],                                // Eilat tip
  [0.46, 0.92], [0.40, 0.78],                  // Negev west (Egypt border)
  [0.32, 0.66], [0.24, 0.56],                  // up the Sinai/Egypt edge
  [0.18, 0.46],                                // Gaza/Egypt corner on coast
  [0.16, 0.36], [0.18, 0.26],                  // coast heading NW
  [0.22, 0.18], [0.30, 0.12],                  // Haifa bulge
  [0.36, 0.06], [0.42, 0.02],                  // back to panhandle
  [0.46, 0.00],
];

// Even-odd point-in-polygon test (poly is array of [x,y] in same coord system as p).
function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Draw the Israel silhouette as a stipple field inside the polygon, with a
// faint coast/border outline. Returns the function used to project a normalised
// (nx, ny) inside the polygon to actual SVG coords, so callers can place dots.
function drawIsraelStipple(svg, W, H, opts = {}) {
  const padX = opts.padX != null ? opts.padX : 0.04;
  const padY = opts.padY != null ? opts.padY : 0.04;
  const seed = opts.seed || 421;
  const stippleN = opts.stippleN || 320;

  // Israel polygon is taller than wide (~2.4:1). Fit it into the card with
  // padding; the polygon's normalised box maps to a sub-rect inside the card.
  const polyAR = 2.0; // height / width of the source polygon, approx
  const cardAR = H / W;
  let boxW, boxH;
  if (polyAR > cardAR) {
    boxH = H * (1 - 2 * padY);
    boxW = boxH / polyAR;
  } else {
    boxW = W * (1 - 2 * padX);
    boxH = boxW * polyAR;
  }
  const boxX = (W - boxW) / 2;
  const boxY = (H - boxH) / 2;

  const project = (nx, ny) => [boxX + nx * boxW, boxY + ny * boxH];

  // Mediterranean wash to the left of the silhouette
  svg.append('rect').attr('x', 0).attr('y', 0)
    .attr('width', boxX + boxW * 0.18).attr('height', H)
    .attr('fill', '#080a13');
  // Inland wash on the right
  svg.append('rect').attr('x', boxX + boxW * 0.18).attr('y', 0)
    .attr('width', W - (boxX + boxW * 0.18)).attr('height', H)
    .attr('fill', '#0d0f17');

  // Stipple inside the polygon (deterministic RNG so it doesn't change per render)
  let s = seed;
  const rng = () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0) / 4294967296; };
  let placed = 0, attempts = 0;
  while (placed < stippleN && attempts < stippleN * 6) {
    attempts++;
    const nx = rng(), ny = rng();
    if (!pointInPolygon(nx, ny, ISRAEL_POLYGON)) continue;
    const [x, y] = project(nx, ny);
    const r = rng() * 0.5 + 0.4;
    const a = 0.35 + rng() * 0.45;
    svg.append('circle').attr('cx', x).attr('cy', y).attr('r', r)
      .attr('fill', `rgba(232,184,75,${a.toFixed(3)})`);
    placed++;
  }

  // Polygon outline in faint gold for definition
  const pathD = ISRAEL_POLYGON.map((p, i) => {
    const [x, y] = project(p[0], p[1]);
    return (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ') + ' Z';
  svg.append('path').attr('d', pathD)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(232,184,75,0.55)')
    .attr('stroke-width', 0.7)
    .attr('stroke-linejoin', 'round');

  // Gaza marker — small dark protrusion on the SW coast (just outside the polygon)
  const [gx, gy] = project(0.10, 0.46);
  svg.append('rect')
    .attr('x', gx - 4).attr('y', gy - 3).attr('width', 5).attr('height', 8)
    .attr('fill', 'rgba(214,48,49,0.18)')
    .attr('stroke', 'rgba(214,48,49,0.55)').attr('stroke-width', 0.5)
    .attr('rx', 0.6);

  return { project, boxX, boxY, boxW, boxH };
}

// Oct 7 preview — Israel silhouette as a stipple field, dense alert cloud
// over the Gaza envelope coloured by time-of-day progression.
async function drawPreviewOct7(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 110;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);

  const { project } = drawIsraelStipple(svg, W, H, { seed: 313, stippleN: 280 });

  let s = 919;
  const rng = () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0) / 4294967296; };

  // Cluster centres in normalised polygon space — Gaza envelope (south coast) + a sprinkle.
  const N = 80;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const bias = rng();
    let nx, ny;
    if (bias < 0.7) {
      // Heavy southern coastal cluster
      nx = 0.18 + rng() * 0.20;
      ny = 0.46 + rng() * 0.20;
    } else if (bias < 0.9) {
      // Central sprinkle
      nx = 0.30 + rng() * 0.30;
      ny = 0.30 + rng() * 0.18;
    } else {
      // Stray northern dots
      nx = 0.40 + rng() * 0.25;
      ny = 0.10 + rng() * 0.15;
    }
    const [x, y] = project(nx, ny);
    const col = t < 0.5
      ? d3.interpolateRgb('#4a9eff', '#e8b84b')(t * 2)
      : d3.interpolateRgb('#e8b84b', '#d63031')((t - 0.5) * 2);
    svg.append('circle').attr('cx', x).attr('cy', y)
      .attr('r', rng() * 1.0 + 0.7)
      .attr('fill', col).attr('opacity', 0.75 + rng() * 0.2);
  }
}

// Story preview — sky-burst still frame: dark sky, stars, missile arcs being
// intercepted, one explosion bloom, tiny city skyline at the bottom.
async function drawPreviewStory(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 110;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);

  // Sky gradient (deeper at top, very dark navy at bottom)
  const defs = svg.append('defs');
  const sky = defs.append('linearGradient').attr('id', 'story-sky')
    .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1);
  sky.append('stop').attr('offset', '0%').attr('stop-color', '#0b0d18');
  sky.append('stop').attr('offset', '70%').attr('stop-color', '#070710');
  sky.append('stop').attr('offset', '100%').attr('stop-color', '#050508');
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'url(#story-sky)');

  // Stars
  let s = 4242;
  const rng = () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0) / 4294967296; };
  for (let i = 0; i < 60; i++) {
    svg.append('circle')
      .attr('cx', rng() * W).attr('cy', rng() * H * 0.78)
      .attr('r', rng() * 0.7 + 0.2)
      .attr('fill', `rgba(195,210,235,${(0.25 + rng() * 0.55).toFixed(3)})`);
  }

  const groundY = H * 0.86;

  // Quadratic Bezier arc — render as a path with a faded leading-edge dot.
  function arc(sx, sy, ex, ey, cpx, cpy, color, width, headR) {
    const path = `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`;
    svg.append('path').attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', width)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.85);
    // Glow head at the end of the arc
    const grad = defs.append('radialGradient').attr('id', `g-${Math.round(ex)}-${Math.round(ey)}-${Math.round(rng()*9999)}`);
    grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 1);
    grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);
    svg.append('circle')
      .attr('cx', ex).attr('cy', ey).attr('r', headR)
      .attr('fill', `url(#${grad.attr('id')})`);
  }

  // Three incoming missile arcs (red) from screen edges to upper sky
  const missiles = [
    { sx: -W * 0.04, sy: H * 0.18, ex: W * 0.36, ey: H * 0.30, cpx: W * 0.10, cpy: H * 0.05 },
    { sx:  W * 1.04, sy: H * 0.22, ex: W * 0.62, ey: H * 0.28, cpx: W * 0.92, cpy: H * 0.06 },
    { sx:  W * 1.05, sy: H * 0.10, ex: W * 0.78, ey: H * 0.40, cpx: W * 0.95, cpy: H * 0.02 },
  ];
  missiles.forEach(m => arc(m.sx, m.sy, m.ex, m.ey, m.cpx, m.cpy, '#ff5a4a', 1.4, 5));

  // Two interceptor arcs (blue) rising from city batteries toward two missile tips
  const interceptors = [
    { sx: W * 0.22, sy: groundY, ex: missiles[0].ex, ey: missiles[0].ey, cpx: W * 0.30, cpy: H * 0.20 },
    { sx: W * 0.70, sy: groundY, ex: missiles[1].ex, ey: missiles[1].ey, cpx: W * 0.66, cpy: H * 0.18 },
  ];
  interceptors.forEach(it => arc(it.sx, it.sy, it.ex, it.ey, it.cpx, it.cpy, '#4a9eff', 1.0, 3));

  // Explosion bloom at the first interception
  const ex = missiles[0].ex, ey = missiles[0].ey;
  const exGrad = defs.append('radialGradient').attr('id', 'story-bloom');
  exGrad.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,0.95)');
  exGrad.append('stop').attr('offset', '40%').attr('stop-color', 'rgba(232,184,75,0.7)');
  exGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(214,48,49,0)');
  svg.append('circle').attr('cx', ex).attr('cy', ey).attr('r', 11).attr('fill', 'url(#story-bloom)');
  svg.append('circle').attr('cx', ex).attr('cy', ey).attr('r', 14)
    .attr('fill', 'none').attr('stroke', 'rgba(232,184,75,0.45)').attr('stroke-width', 0.5);

  // City skyline silhouette at the bottom
  const skyline = [
    [0.00, 0.04], [0.04, 0.07], [0.08, 0.05], [0.12, 0.10], [0.16, 0.06],
    [0.20, 0.09], [0.24, 0.05], [0.28, 0.11], [0.32, 0.07], [0.36, 0.10],
    [0.40, 0.05], [0.44, 0.09], [0.48, 0.06], [0.52, 0.12], [0.56, 0.07],
    [0.60, 0.10], [0.64, 0.05], [0.68, 0.11], [0.72, 0.06], [0.76, 0.09],
    [0.80, 0.05], [0.84, 0.10], [0.88, 0.07], [0.92, 0.09], [0.96, 0.05], [1.00, 0.07],
  ];
  let cityD = `M 0 ${H} L 0 ${groundY} `;
  skyline.forEach(([nx, nh]) => { cityD += `L ${nx * W} ${groundY - nh * H} `; });
  cityD += `L ${W} ${groundY} L ${W} ${H} Z`;
  svg.append('path').attr('d', cityD).attr('fill', '#04050a');

  // Battery glow markers on the ground
  [W * 0.22, W * 0.50, W * 0.70].forEach(bx => {
    const bg = defs.append('radialGradient').attr('id', `bat-${Math.round(bx)}`);
    bg.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(74,158,255,0.55)');
    bg.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(74,158,255,0)');
    svg.append('circle').attr('cx', bx).attr('cy', groundY).attr('r', 8).attr('fill', `url(#bat-${Math.round(bx)})`);
  });
}

// Records mini preview: 4 stacked stat bars with a big number on top
async function drawPreviewRecords(svgEl) {
  const records = await getData('records.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('text').attr('x', W/2).attr('y', H * 0.50)
    .attr('text-anchor','middle')
    .attr('font-family','Playfair Display').attr('font-weight', 900)
    .attr('font-size', H * 0.55).attr('fill', '#d63031')
    .text(records.busiest_day.count.toLocaleString());
  svg.append('text').attr('x', W/2).attr('y', H * 0.88)
    .attr('text-anchor','middle')
    .attr('font-family','IBM Plex Mono').attr('font-size', 8).attr('fill','#5a5a70')
    .attr('letter-spacing', '0.1em')
    .text('BUSIEST DAY · ALL-TIME RECORD');
}

// Polar clock mini
async function drawPreviewClock(svgEl) {
  const d = await getData('hourly_dow.json');
  const data = d.hourly;
  const size = Math.min(svgEl.clientWidth || 120, svgEl.clientHeight || 120, 120);
  const cx = size/2, cy = size/2;
  const innerR = 12, outerMax = size/2 - 4;
  const maxVal = d3.max(data, r => r.count);
  const rS = d3.scaleLinear().domain([0, maxVal]).range([innerR, outerMax]);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${size} ${size}`);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  const tau = 2*Math.PI, sA = tau/24;
  data.forEach(row => {
    const startA = (row.hour/24)*tau;
    const arc = d3.arc().innerRadius(innerR).outerRadius(rS(row.count)).startAngle(startA).endAngle(startA + sA - 0.01);
    const isPeak = row.hour === 10;
    const isNight = row.hour < 6 || row.hour >= 22;
    g.append('path').attr('d', arc).attr('fill', isPeak ? '#d63031' : isNight ? 'rgba(74,158,255,0.5)' : 'rgba(232,184,75,0.6)');
  });
}

// Area bars mini
async function drawPreviewAreas(svgEl) {
  const data = (await getData('areas_summary.json')).slice(0, 8);
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const maxVal = d3.max(data, d => d.total);
  const x = d3.scaleLinear().domain([0, maxVal]).range([0, W]);
  const y = d3.scaleBand().domain(data.map(d => d.area)).range([0, H]).padding(0.25);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  data.forEach((d, i) => {
    svg.append('rect').attr('x', 0).attr('y', y(d.area))
      .attr('width', x(d.total)).attr('height', y.bandwidth())
      .attr('fill', i < 3 ? '#d63031' : 'rgba(232,184,75,0.55)').attr('rx', 1);
  });
}

// DOW mini bars
async function drawPreviewDow(svgEl) {
  const d = await getData('hourly_dow.json');
  const data = d.day_of_week;
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const x = d3.scaleBand().domain(data.map(d => d.day)).range([0, W]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count)]).range([H, 2]);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  data.forEach(row => {
    const isSat = row.day === 'Saturday';
    svg.append('rect')
      .attr('x', x(row.day)).attr('y', y(row.count))
      .attr('width', x.bandwidth()).attr('height', H - y(row.count))
      .attr('fill', isSat ? '#d63031' : 'rgba(232,184,75,0.55)').attr('rx', 1);
  });
}

// Observer to draw on first scroll-into-view
const previewMap = {
  timeline: drawPreviewTimeline,
  fronts:   drawPreviewFronts,
  calendar: drawPreviewCalendar,
  clock:    drawPreviewClock,
  dow:      drawPreviewDow,
  areas:    drawPreviewAreas,
  oct7:     drawPreviewOct7,
  story:    drawPreviewStory,
  records:  drawPreviewRecords,
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
