// ═══════════════════════════════════════════════════
// DATA PIPELINE
// ═══════════════════════════════════════════════════
let DATA_MODE = "live";
let LAST_UPDATED = null;
let ALL_DATA = [];

const ACTOR_COLORS = { "Hamas": "#d63031", "Hezbollah": "#4a9eff", "PIJ": "#e8b84b", "Iran Direct": "#9b59b6", "Other": "#636e72" };
const EPISODES = [
  { name: "Cast Lead", start: "2008-12-27", end: "2009-01-18", color: "#d63031", peak: 200 },
  { name: "Pillar of Defence", start: "2012-11-14", end: "2012-11-21", color: "#d63031", peak: 180 },
  { name: "Protective Edge", start: "2014-07-08", end: "2014-08-26", color: "#d63031", peak: 350 },
  { name: "Guardian of Walls", start: "2021-05-10", end: "2021-05-21", color: "#d63031", peak: 280 },
  { name: "Breaking Dawn", start: "2022-08-05", end: "2022-08-07", color: "#e8b84b", peak: 120 },
  { name: "Shield & Arrow", start: "2023-05-09", end: "2023-05-13", color: "#e8b84b", peak: 150 },
  { name: "Oct 7 War", start: "2023-10-07", end: "2024-12-31", color: "#d63031", peak: 500 },
  { name: "Iran Strike I", start: "2024-04-13", end: "2024-04-14", color: "#9b59b6", peak: 300 },
  { name: "Iran Strike II", start: "2024-10-01", end: "2024-10-02", color: "#9b59b6", peak: 200 },
];
const HOUR_WEIGHTS = {
  "Hamas": [2, 1, 1, 1, 2, 3, 5, 7, 9, 10, 9, 8, 7, 8, 10, 12, 14, 13, 11, 9, 7, 5, 4, 3],
  "Hezbollah": [2, 1, 1, 2, 3, 5, 7, 8, 9, 9, 8, 7, 6, 7, 9, 11, 13, 14, 12, 10, 8, 6, 4, 2],
  "PIJ": [1, 1, 1, 1, 1, 2, 4, 6, 8, 9, 10, 11, 10, 9, 8, 9, 10, 11, 9, 8, 6, 5, 4, 2],
  "Iran Direct": [3, 2, 1, 1, 1, 2, 3, 4, 5, 6, 5, 4, 3, 4, 6, 8, 10, 12, 14, 13, 10, 7, 5, 3],
};
const ALL_HOUR_WEIGHTS = [2, 1, 1, 1, 2, 3, 5, 7, 9, 10, 9, 8, 7, 8, 10, 12, 14, 13, 11, 9, 7, 5, 4, 3];

function weightedRandom(weights) {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return weights.length - 1;
}

function generateSyntheticData() {
  const events = [];
  const start = new Date("2008-01-01"), end = new Date("2024-12-31");
  for (const ep of EPISODES) {
    const s = new Date(ep.start), e = new Date(ep.end);
    const days = Math.ceil((e - s) / 864e5) + 1;
    const actors = ep.color === "#9b59b6" ? ["Iran Direct"] : ep.name.includes("Arrow") || ep.name.includes("Dawn") ? ["PIJ"] : ep.name.includes("Hezbollah") ? ["Hezbollah"] : ["Hamas", "Hamas", "Hamas", "PIJ"];
    for (let i = 0; i < ep.peak * days; i++) {
      const d = new Date(s.getTime() + Math.random() * (e - s));
      const a = actors[Math.floor(Math.random() * actors.length)];
      let lat, lng;
      if (a === "Hezbollah") { lat = 32.8 + Math.random() * 0.5; lng = 35.0 + Math.random() * 0.6; }
      else if (a === "Iran Direct") { lat = 31.0 + Math.random() * 2.0; lng = 34.5 + Math.random() * 1.0; }
      else { lat = 31.0 + Math.random() * 1.2; lng = 34.3 + Math.random() * 0.7; }
      events.push({ date: d, hour: weightedRandom(HOUR_WEIGHTS[a] || ALL_HOUR_WEIGHTS), dow: (d.getDay() + 6) % 7, actor: a, episode: ep.name, month: d.getMonth(), year: d.getFullYear(), lat, lng });
    }
  }
  let d = new Date(start);
  while (d <= end) {
    if (!EPISODES.some(ep => d >= new Date(ep.start) && d <= new Date(ep.end)) && Math.random() < 0.12) {
      const a = ["Hamas", "Hamas", "PIJ", "Hezbollah", "Other"][Math.floor(Math.random() * 5)];
      let lat, lng;
      if (a === "Hezbollah") { lat = 32.8 + Math.random() * 0.5; lng = 35.0 + Math.random() * 0.6; } else { lat = 31.0 + Math.random() * 1.2; lng = 34.3 + Math.random() * 0.7; }
      events.push({ date: new Date(d), hour: weightedRandom(HOUR_WEIGHTS[a] || ALL_HOUR_WEIGHTS), dow: (d.getDay() + 6) % 7, actor: a, episode: "Inter-conflict", month: d.getMonth(), year: d.getFullYear(), lat, lng });
    } d.setDate(d.getDate() + 1);
  }
  return events.sort((a, b) => a.date - b.date);
}

async function loadData() {
  try {
    const res = await fetch("data/alerts.json");
    if (!res.ok) throw new Error("No live data found");
    const json = await res.json();
    return json.map(d => ({ ...d, date: new Date(d.date) }));
  } catch (e) {
    console.warn("Falling back to synthetic data.", e);
    DATA_MODE = "synthetic";
    return generateSyntheticData();
  }
}

// ═══════════════════════════════════════════════════
// TOOLTIPS & COUNTERS
// ═══════════════════════════════════════════════════
const tooltip = document.getElementById("tooltip");
function showTip(html, x, y) { tooltip.innerHTML = html; tooltip.style.opacity = 1; tooltip.style.left = (x + 14) + "px"; tooltip.style.top = (y - 10) + "px"; }
function hideTip() { tooltip.style.opacity = 0; }

function initCounters() {
  const badge = document.getElementById("live-badge");
  if (badge) {
    badge.innerHTML = DATA_MODE === "synthetic" ? "Using Synthetic Data" : "🔴 Live Data Connected";
    badge.style.borderColor = DATA_MODE === "synthetic" ? "rgba(232,184,75,0.3)" : "rgba(214,48,49,0.4)";
    badge.style.color = DATA_MODE === "synthetic" ? "var(--accent)" : "var(--red)";
  }

  const animate = (elId, targ, dur, suf = "") => {
    const el = document.getElementById(elId); if (!el) return;
    const s = Date.now();
    const t = () => {
      const p = Math.min((Date.now() - s) / dur, 1);
      el.innerHTML = Math.round((1 - Math.pow(1 - p, 3)) * targ).toLocaleString() + (suf ? `<span>${suf}</span>` : '');
      if (p < 1) requestAnimationFrame(t);
    }; t();
  };
  animate("counter-events", Math.round(ALL_DATA.length / 1000) * 1000, 2000, "+");
  animate("counter-years", 17, 1200);
  animate("counter-actors", 5, 900);
}

// ═══════════════════════════════════════════════════
// D3 VISUALIZATIONS WITH ENTRANCE ANIMATIONS
// ═══════════════════════════════════════════════════
let currentTimelineFilter = "all";

function buildTimeline(filterActor = "all") {
  const el = document.getElementById("timeline-chart"); if (!el) return; el.innerHTML = "";
  const W = el.parentElement.clientWidth || el.clientWidth, H = el.parentElement.clientHeight - 60 || el.clientHeight;
  const svg = d3.select("#timeline-chart").append("svg").attr("width", W).attr("height", H);
  const data = filterActor === "all" ? ALL_DATA : ALL_DATA.filter(d => d.actor === filterActor);
  const x = d3.scaleTime().domain([new Date("2008-01-01"), new Date("2024-12-31")]).range([40, W - 40]);

  svg.append("g").attr("transform", `translate(0,${H - 20})`).call(d3.axisBottom(x).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")).tickSize(0))
    .call(g => { g.select(".domain").attr("stroke", "#252530"); g.selectAll("text").attr("fill", "#5a5a70").attr("font-family", "IBM Plex Mono").attr("font-size", "10"); });

  const epGroup = svg.append("g");
  for (const ep of EPISODES) {
    const x1 = x(new Date(ep.start)), x2 = x(new Date(ep.end));
    epGroup.append("rect").attr("x", x1).attr("y", 10).attr("width", Math.max(x2 - x1, 4)).attr("height", H - 30).attr("fill", ep.color).attr("opacity", 0);
    if (x2 - x1 > 30) epGroup.append("text").attr("x", (x1 + x2) / 2).attr("y", 8).attr("text-anchor", "middle").attr("fill", ep.color).attr("opacity", 0).attr("font-size", "8").attr("font-family", "IBM Plex Mono").text(ep.name.split(" ").slice(0, 2).join(" "));
  }

  const jitter = () => (Math.random() - 0.5) * 40;

  // Create dots but with 0 opacity
  const circles = svg.append("g").selectAll("circle").data(data).join("circle")
    .attr("cx", d => x(d.date)).attr("cy", H / 2 - 10 + jitter()).attr("r", 3)
    .attr("fill", d => ACTOR_COLORS[d.actor] || "#636e72").attr("opacity", 0)
    .on("mousemove", (e, d) => showTip(`<b style="color:${ACTOR_COLORS[d.actor]}">${d.actor}</b><br>${d.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}<br>${d.episode}`, e.clientX, e.clientY))
    .on("mouseleave", hideTip);

  // Animate Episode Rectangles
  epGroup.selectAll("rect").transition().duration(1000).attr("opacity", 0.06);
  epGroup.selectAll("text").transition().duration(1000).attr("opacity", 0.8);

  // Animate dots (Opacity fade over 1.5s to prevent lag from 15k individual delays)
  circles.transition().duration(1500).ease(d3.easeCubicInOut).attr("opacity", 0.6);
}

async function buildMap() {
  const el = document.getElementById("map-chart"); if (!el) return; el.innerHTML = "";
  const W = el.clientWidth, H = el.clientHeight;
  const svg = d3.select("#map-chart").append("svg").attr("width", W).attr("height", H);
  const proj = d3.geoMercator().center([35.1, 31.5]).scale(H * 8).translate([W / 2, H / 2]);
  const path = d3.geoPath().projection(proj);
  const mg = svg.append("g");

  try {
    const geo = await d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson");
    // Animate map drawing
    mg.selectAll("path").data(geo.features.filter(d => ["Israel", "Palestine", "Lebanon", "Syria", "Jordan"].includes(d.properties.name)))
      .join("path").attr("d", path).attr("fill", d => d.properties.name === "Israel" ? "#16161e" : "#0a0a0c").attr("stroke", "#252530").attr("stroke-width", 1)
      .attr("opacity", 0).transition().duration(1000).attr("opacity", 1);
  } catch (e) { }

  const sample = ALL_DATA.length > 5000 ? ALL_DATA.filter((_, i) => i % 6 === 0) : ALL_DATA;

  // Create dots but with 0 radius for entrance animation
  svg.append("g").selectAll("circle").data(sample).join("circle")
    .attr("cx", d => proj([d.lng, d.lat])[0]).attr("cy", d => proj([d.lng, d.lat])[1]).attr("r", 0)
    .attr("fill", d => ACTOR_COLORS[d.actor] || "#636e72").attr("opacity", 0.6).attr("mix-blend-mode", "screen")
    .on("mousemove", (e, d) => showTip(`<b>${d.actor} Strike</b><br>Lat: ${d.lat.toFixed(2)}, Lng: ${d.lng.toFixed(2)}<br>${d.date.getFullYear()}`, e.clientX, e.clientY))
    .on("mouseleave", hideTip)
    .transition().duration(1200).delay(() => Math.random() * 800) // Random pop-in
    .attr("r", 2);
}

function buildClock() {
  const el = document.getElementById("clock-chart"); if (!el) return; el.innerHTML = "";
  const SIZE = 300, cx = SIZE / 2, cy = SIZE / 2, outerR = SIZE * 0.4, innerR = SIZE * 0.15;
  const svg = d3.select("#clock-chart").append("svg").attr("width", SIZE).attr("height", SIZE);

  const cnts = Array(24).fill(0); ALL_DATA.forEach(d => cnts[d.hour]++);
  const max = Math.max(...cnts);
  const ang = d => (d / 24) * 2 * Math.PI - Math.PI / 2, rad = v => innerR + (v / max) * (outerR - innerR);

  [0.33, 0.66, 1].forEach(t => svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", innerR + t * (outerR - innerR)).attr("fill", "none").attr("stroke", "#252530").attr("stroke-width", "0.5"));

  const arc = d3.arc();

  // Arc transition sequence
  cnts.forEach((c, h) => {
    svg.append("path")
      .datum({ innerRadius: innerR, outerRadius: innerR, startAngle: ang(h) + 0.04, endAngle: ang(h + 1) - 0.04 })
      .attr("transform", `translate(${cx},${cy})`).attr("fill", c / max > 0.8 ? "#e8b84b" : c / max > 0.4 ? "#d63031" : "#636e72")
      .attr("opacity", 0.8)
      .on("mousemove", (e) => showTip(`<b>${h}:00 - ${h + 1}:00</b><br>${c.toLocaleString()} recorded alerts<br>Peak Intesnity: ${((c / max) * 100).toFixed(0)}%`, e.clientX, e.clientY))
      .on("mouseleave", hideTip)
      .transition().duration(1000).delay(h * 30).ease(d3.easeCubicOut)
      .attrTween("d", function (d) {
        const i = d3.interpolate(d.outerRadius, rad(c));
        return function (t) { d.outerRadius = i(t); return arc(d); };
      });
  });
}

function buildEscalation() {
  const el = document.getElementById("escalation-chart"); if (!el) return; el.innerHTML = "";
  const W = el.clientWidth, H = el.clientHeight || 500, m = { t: 20, r: 20, b: 30, l: 40 };
  const svg = d3.select("#escalation-chart").append("svg").attr("width", W).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

  const rol = d3.rollup(ALL_DATA, v => v.length, d => d3.timeMonth(d.date));
  const ran = d3.timeMonths(new Date("2008-01-01"), new Date("2025-01-01"));
  const c = ran.map(m => ({ d: m, v: rol.get(m) || 0 }));
  const smo = c.map((d, i) => ({ d: d.d, v: d3.mean(c.slice(Math.max(0, i - 1), i + 2), _ => _.v) }));

  const x = d3.scaleTime().domain(d3.extent(smo, d => d.d)).range([0, W - m.l - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(smo, d => d.v) * 1.1]).range([H - m.t - m.b, 0]);

  // Define a clipPath for the wipe animation
  svg.append("defs").append("clipPath").attr("id", "wipe-clip")
    .append("rect").attr("width", 0).attr("height", H).attr("x", 0).attr("y", 0)
    .transition().duration(2000).ease(d3.easeCubicOut).attr("width", W);

  const wipeGroup = g.append("g").attr("clip-path", "url(#wipe-clip)");

  wipeGroup.append("path").datum(smo).attr("fill", "#d63031").attr("opacity", 0.1).attr("d", d3.area().x(d => x(d.d)).y0(H - m.t - m.b).y1(d => y(d.v)).curve(d3.curveBasis));
  wipeGroup.append("path").datum(smo).attr("fill", "none").attr("stroke", "#d63031").attr("stroke-width", 2).attr("d", d3.line().x(d => x(d.d)).y(d => y(d.v)).curve(d3.curveBasis));

  // Add invisible hover overlay for tooltips
  g.append("rect").attr("width", W - m.l - m.r).attr("height", H - m.t - m.b).attr("fill", "transparent")
    .on("mousemove", (e) => {
      const x0 = x.invert(d3.pointer(e)[0]);
      const closest = smo.reduce((a, b) => Math.abs(b.d - x0) < Math.abs(a.d - x0) ? b : a);
      showTip(`<b>${closest.d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b><br>Average Intensity: ${Math.round(closest.v)} strikes/month`, e.clientX, e.clientY);
    })
    .on("mouseleave", hideTip);
}

// ═══════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════
window.addEventListener("load", async () => {
  ALL_DATA = await loadData();

  initCounters();
  buildTimeline();
  buildMap();
  buildClock();
  buildEscalation();

  document.getElementById("timeline-filters")?.addEventListener("click", e => {
    if (!e.target.dataset.actor) return;
    document.querySelectorAll("#timeline-filters button").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    buildTimeline(e.target.dataset.actor);
  });
});

window.addEventListener("resize", () => {
  buildTimeline(currentTimelineFilter);
  buildMap();
  buildClock();
  buildEscalation();
});