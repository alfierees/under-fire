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

// Story map mini preview: coloured dot clusters per chapter/actor
async function drawPreviewStory(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  // Clusters representing each chapter's region and actor colour
  const clusters = [
    { cx: W*0.28, cy: H*0.78, col: '#d63031', n: 18, r: H*0.25 }, // Hamas south
    { cx: W*0.32, cy: H*0.55, col: '#d63031', n: 12, r: H*0.18 }, // Hamas barrages
    { cx: W*0.42, cy: H*0.18, col: '#f39c12', n: 20, r: H*0.22 }, // Hezbollah north
    { cx: W*0.35, cy: H*0.88, col: '#4a9eff', n: 8,  r: H*0.14 }, // Houthis south tip
    { cx: W*0.34, cy: H*0.60, col: '#c678dd', n: 10, r: H*0.20 }, // Iran direct
    { cx: W*0.36, cy: H*0.48, col: '#c678dd', n: 30, r: H*0.42 }, // 2026 total war
  ];
  const rng = (() => { let s = 42; return () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0)/4294967296; }; })();
  clusters.forEach(cl => {
    for (let i = 0; i < cl.n; i++) {
      const a = rng() * Math.PI * 2;
      const dist = rng() * cl.r;
      svg.append('circle')
        .attr('cx', cl.cx + Math.cos(a) * dist)
        .attr('cy', cl.cy + Math.sin(a) * dist)
        .attr('r', rng() * 1.4 + 0.6)
        .attr('fill', cl.col)
        .attr('opacity', 0.65 + rng() * 0.3);
    }
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

// Oct 7 preview — small shape suggesting map pins
async function drawPreviewOct7(svgEl) {
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  // Scatter dots resembling Israel shape
  const pts = [];
  for (let i = 0; i < 120; i++) {
    const cx = W * 0.4 + (Math.random() - 0.5) * W * 0.5;
    const cy = H * 0.5 + (Math.random() - 0.5) * H * 0.8;
    pts.push({ x: cx, y: cy, r: Math.random() * 1.6 + 0.4 });
  }
  pts.forEach(p => {
    const mixT = Math.min(Math.max((p.y / H), 0), 1);
    const col = mixT < 0.5
      ? d3.interpolateRgb('#4a9eff', '#e8b84b')(mixT * 2)
      : d3.interpolateRgb('#e8b84b', '#d63031')((mixT - 0.5) * 2);
    svg.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', p.r).attr('fill', col).attr('opacity', 0.75);
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
