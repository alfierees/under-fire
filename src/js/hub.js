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

// ── Row previews ────────────────────────────────────────────────
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
  svg.append('path').datum(post).attr('fill','rgba(224,73,62,0.4)').attr('stroke','rgba(224,73,62,0.8)').attr('stroke-width',0.8).attr('d', area);
  svg.append('line').attr('x1', x(oct7)).attr('x2', x(oct7)).attr('y1', 0).attr('y2', H)
    .attr('stroke','#b9b5ac').attr('stroke-width',0.8).attr('stroke-dasharray','2,2');
}

// Stacked bars fronts (mini)
async function drawPreviewFronts(svgEl) {
  const raw = await getData('actors_monthly.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const actors = ['Hamas', 'Hezbollah', 'Houthis', 'Iran', 'Unknown'];
  const colors = { Iran:'#b27ce0', Hezbollah:'#ee8a2a', Houthis:'#4f9be8', Hamas:'#e0493e', Unknown:'#6f6c66' };
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
  const scale = d3.scaleSequential(t => d3.interpolateRgb('#15151c', '#e0493e')(t))
    .domain([0, Math.log10(maxC + 1)]);
  // One column per week, one row per weekday. (Sampling every Nth day broke
  // when N landed on 7: every sample fell on the same weekday.)
  const first = new Date(data[0].date + 'T00:00:00');
  const offset = (first.getDay() + 6) % 7;
  const nWeeks = Math.ceil((data.length + offset) / 7);
  const cellW = (W - 4) / nWeeks;
  const cellH = (H - 2) / 7;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const row = (i + offset) % 7;
    const col = Math.floor((i + offset) / 7);
    svg.append('rect')
      .attr('x', 2 + col * cellW)
      .attr('y', 1 + row * cellH)
      .attr('width', Math.max(0.8, cellW - (cellW > 2 ? 0.6 : 0)))
      .attr('height', Math.max(1, cellH - 0.6))
      .attr('fill', d.count === 0 ? '#16171a' : scale(Math.log10(d.count + 1)))
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
      .attr('fill', `rgba(242,178,51,${a.toFixed(3)})`);
    placed++;
  }

  // Polygon outline in faint gold for definition
  const pathD = ISRAEL_POLYGON.map((p, i) => {
    const [x, y] = project(p[0], p[1]);
    return (i === 0 ? 'M' : 'L') + ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ') + ' Z';
  svg.append('path').attr('d', pathD)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(242,178,51,0.55)')
    .attr('stroke-width', 0.7)
    .attr('stroke-linejoin', 'round');

  // Gaza marker — small dark protrusion on the SW coast (just outside the polygon)
  const [gx, gy] = project(0.10, 0.46);
  svg.append('rect')
    .attr('x', gx - 4).attr('y', gy - 3).attr('width', 5).attr('height', 8)
    .attr('fill', 'rgba(224,73,62,0.18)')
    .attr('stroke', 'rgba(224,73,62,0.55)').attr('stroke-width', 0.5)
    .attr('rx', 0.6);

  return { project, boxX, boxY, boxW, boxH };
}

// Oct 7 preview — static image
async function drawPreviewOct7(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 110;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('image')
    .attr('href', 'images/oct7-preview.webp')
    .attr('x', 0).attr('y', 0)
    .attr('width', W).attr('height', H)
    .attr('preserveAspectRatio', 'xMidYMid slice');
}

// Story preview — static image
async function drawPreviewStory(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 110;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('image')
    .attr('href', 'images/story-preview.webp')
    .attr('x', 0).attr('y', 0)
    .attr('width', W).attr('height', H)
    .attr('preserveAspectRatio', 'xMidYMid slice');
}

// Records mini preview: 4 stacked stat bars with a big number on top
async function drawPreviewRecords(svgEl) {
  const records = await getData('records.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('text').attr('x', W/2).attr('y', H * 0.50)
    .attr('text-anchor','middle')
    .attr('font-family','Archivo Narrow').attr('font-weight', 700)
    .attr('font-size', H * 0.58).attr('fill', '#f1ede4')
    .text(records.busiest_day.count.toLocaleString());
  svg.append('text').attr('x', W/2).attr('y', H * 0.88)
    .attr('text-anchor','middle')
    .attr('font-family','Archivo Narrow').attr('font-weight', 600).attr('font-size', 11).attr('fill','#8f8b83')
    .attr('letter-spacing', '0.08em')
    .text('BUSIEST DAY ON RECORD');
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
    g.append('path').attr('d', arc).attr('fill', isPeak ? '#e0493e' : isNight ? 'rgba(79,155,232,0.5)' : 'rgba(242,178,51,0.6)');
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
      .attr('fill', i < 3 ? '#e0493e' : 'rgba(242,178,51,0.55)').attr('rx', 1);
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
      .attr('fill', isSat ? '#e0493e' : 'rgba(242,178,51,0.55)').attr('rx', 1);
  });
}

// Compare mini: operation totals as horizontal bars, coloured by front
async function drawPreviewCompare(svgEl) {
  const ops = (await getData('operations.json')).operations;
  const FRONT = { 'Gaza': '#e0493e', 'Lebanon': '#ee8a2a', 'Yemen': '#4f9be8',
                  'Iran': '#b27ce0', 'All fronts': '#e8e8ea' };
  const data = [...ops].sort((a, b) => b.total - a.total).slice(0, 7);
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const x = d3.scaleLinear().domain([0, data[0].total]).range([0, W]);
  const y = d3.scaleBand().domain(data.map(d => d.id)).range([0, H]).padding(0.25);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  data.forEach(d => {
    svg.append('rect').attr('x', 0).attr('y', y(d.id))
      .attr('width', Math.max(x(d.total), 2)).attr('height', y.bandwidth())
      .attr('fill', FRONT[d.front] || '#aaa').attr('fill-opacity', 0.65).attr('rx', 1);
  });
}

// Time-lapse mini: national monthly totals as an area chart
async function drawPreviewTimelapse(svgEl) {
  const am = await getData('area_monthly.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const x = d3.scaleLinear().domain([0, am.totals.length - 1]).range([0, W]);
  const y = d3.scaleSymlog().domain([0, d3.max(am.totals)]).range([H, 4]).constant(30);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('path').datum(am.totals)
    .attr('d', d3.area().x((d, i) => x(i)).y0(H).y1(d => y(d)).curve(d3.curveMonotoneX))
    .attr('fill', 'rgba(224,73,62,0.3)').attr('stroke', '#e0493e').attr('stroke-width', 1);
}

// Arsenal mini: weapon ranges as log-scale bars, coloured by actor
async function drawPreviewArsenal(svgEl) {
  const a = await getData('arsenal.json');
  const ACTOR = { hamas: '#e0493e', hezbollah: '#ee8a2a', houthis: '#4f9be8', iran: '#b27ce0' };
  const data = [...a.systems]
    .map(s => ({ actor: s.actor, r: Array.isArray(s.range_km) ? s.range_km[1] : s.range_km }))
    .filter(s => s.r > 0).sort((p, q) => q.r - p.r).slice(0, 9);
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const x = d3.scaleLog().domain([1, d3.max(data, d => d.r)]).range([2, W]);
  const y = d3.scaleBand().domain(d3.range(data.length)).range([0, H]).padding(0.3);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  data.forEach((d, i) => {
    svg.append('rect').attr('x', 0).attr('y', y(i))
      .attr('width', x(d.r)).attr('height', y.bandwidth())
      .attr('fill', ACTOR[d.actor] || '#aaa').attr('fill-opacity', 0.65).attr('rx', 1);
  });
}

// Data mini: stylised file listing (static — no fetch)
async function drawPreviewData(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  const files = ['alerts.csv.gz', 'stats_summary.json', 'timeline_weekly.json', 'operations.json'];
  files.forEach((f, i) => {
    const yPos = 12 + i * (H - 14) / 3.2;
    svg.append('text').attr('x', 2).attr('y', yPos)
      .attr('font-family', 'Archivo Narrow').attr('font-size', '12px').attr('font-weight', 600)
      .attr('fill', i === 0 ? '#f1ede4' : '#b9b5ac').text(f);
    svg.append('text').attr('x', W - 2).attr('y', yPos).attr('text-anchor', 'end')
      .attr('font-family', 'Archivo Narrow').attr('font-size', '12px')
      .attr('fill', '#8f8b83').text(i === 0 ? 'CSV' : 'JSON');
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
