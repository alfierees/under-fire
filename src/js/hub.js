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

// Stacked area fronts
async function drawPreviewFronts(svgEl) {
  const raw = await getData('actors_monthly.json');
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const actors = ['Iran', 'Hezbollah', 'Houthis', 'Hamas', 'Unknown'];
  const colors = { Iran:'#c678dd', Hezbollah:'#f39c12', Houthis:'#4a9eff', Hamas:'#d63031', Unknown:'#3a3a4a' };
  const data = raw.map(d => { const r = { month: d.month }; actors.forEach(a => r[a] = d[a] || 0); return r; });
  const parse = d3.timeParse('%Y-%m');
  const x = d3.scaleTime().domain(d3.extent(data, d => parse(d.month))).range([0, W]);
  const stack = d3.stack().keys(actors)(data);
  const yMax = d3.max(stack[stack.length-1], d => d[1]);
  const y = d3.scaleLinear().domain([0, yMax]).range([H, 2]);
  const area = d3.area().x(d => x(parse(d.data.month))).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveBasis);
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  stack.forEach((layer, i) => svg.append('path').datum(layer).attr('fill', colors[actors[i]]).attr('opacity', 0.82).attr('d', area));
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
    const startA = (row.hour/24)*tau - Math.PI/2;
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

// Odds big-number preview
async function drawPreviewOdds(svgEl) {
  const p = await getData('shower_probs.json');
  const region = 'Confrontation Line';
  const probs = p[region]?.shower || p[Object.keys(p)[0]].shower;
  const pct = (probs.since_oct7 * 100).toFixed(1);
  const W = svgEl.clientWidth || 280, H = svgEl.clientHeight || 70;
  const svg = d3.select(svgEl).attr('viewBox', `0 0 ${W} ${H}`);
  svg.append('text').attr('x', W/2).attr('y', H * 0.58)
    .attr('text-anchor','middle')
    .attr('font-family','Playfair Display').attr('font-weight', 900)
    .attr('font-size', H * 0.65).attr('fill', probs.since_oct7 > 0.5 ? '#d63031' : '#e8b84b')
    .text(pct + '%');
  svg.append('text').attr('x', W/2).attr('y', H * 0.92)
    .attr('text-anchor','middle')
    .attr('font-family','IBM Plex Mono').attr('font-size', 8).attr('fill','#5a5a70')
    .attr('letter-spacing', '0.1em')
    .text('SHOWER ALERT CHANCE');
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
  clock:    drawPreviewClock,
  dow:      drawPreviewDow,
  areas:    drawPreviewAreas,
  oct7:     drawPreviewOct7,
  odds:     drawPreviewOdds,
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
