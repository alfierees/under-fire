// ── Shared utilities for all Under Fire pages ───────────────────────────────
const DATA = 'data/processed/';

const DATA_V = '20260613b';
async function fetchData(file) {
  const r = await fetch(DATA + file + '?v=' + DATA_V);
  if (!r.ok) throw new Error(`Failed to load ${file}`);
  return r.json();
}

const tooltip = document.getElementById('tooltip');
function showTip(html, e) {
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.style.opacity = 1;
  moveTip(e);
}
function moveTip(e) {
  if (!tooltip) return;
  let x = e.clientX + 14, y = e.clientY - 28;
  if (x + 240 > window.innerWidth) x = e.clientX - 220;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function hideTip() { if (tooltip) tooltip.style.opacity = 0; }

function fmtNum(n) { return n.toLocaleString(); }

// ── Israel-time helpers ──────────────────────────────────────────────────────
// Alert timestamps are Israel wall-clock time; compare against "now" in
// Asia/Jerusalem rather than the browser's zone.
function israelNowMs() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
function alertTsToMs(ts) {
  return Date.UTC(ts.slice(0, 4), +ts.slice(5, 7) - 1, +ts.slice(8, 10),
                  +ts.slice(11, 13), +ts.slice(14, 16), +ts.slice(17, 19));
}
function alertRelTime(ts) {
  const mins = Math.max(0, Math.round((israelNowMs() - alertTsToMs(ts)) / 60000));
  if (mins < 60) return mins + ' min ago';
  if (mins < 48 * 60) return Math.round(mins / 60) + ' h ago';
  return Math.round(mins / 1440) + ' d ago';
}

function fmtPct(p) { return (p * 100).toFixed(1) + '%'; }

// Run fn once, when `target` first scrolls into view (or immediately if the
// browser lacks IntersectionObserver / the user prefers reduced motion). This
// replaces the old press-to-run code panel: charts reveal themselves.
function revealOnScroll(target, fn, threshold = 0.2) {
  if (!target) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inView = () => {
    const r = target.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * (1 - threshold * 0.5) && r.bottom > 0;
  };
  // already on screen (or reduced motion) → run immediately
  if (reduced || inView()) { fn(); return; }
  // otherwise reveal when it scrolls in. Use IntersectionObserver *and* a
  // scroll-listener fallback so it never gets stuck if IO misfires.
  let done = false, io;
  const cleanup = () => {
    if (io) io.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
  const run = () => { if (done) return; done = true; cleanup(); fn(); };
  const onScroll = () => { if (inView()) run(); };
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((e) => { if (e[0].isIntersecting) run(); }, { threshold });
    io.observe(target);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
}

// File-protocol warning
(function() {
  if (window.location.protocol === 'file:') {
    const w = document.getElementById('file-protocol-warning');
    if (w) w.style.display = 'block';
  }
})();

// ── Live stats: one shared fetch fills the nav badge and any element carrying
// a [data-live] attribute. Never hardcode a number that the dataset can
// produce — mark the element instead:
//   <span data-live="total">160,000+</span>      total alerts
//   <span data-live="origin:Iran">…</span>       per-actor total
//   <span data-live="share:Iran">…</span>        per-actor % of total
//   total+ | end-year | year-range | end-month-name | end-month-year |
//   range-eyebrow | years-word | years-word-cap | busiest-count | busiest-date
// The static text in the HTML acts as the fetch-failure fallback, so keep it
// a safe floor (e.g. "160,000+"), not a precise count.
window.__statsPromise = fetchData('stats_summary.json')
  .then(s => (window.__STATS_SUMMARY = s));

(async function initLiveStats() {
  const badge = document.getElementById('nav-badge');
  let s;
  try { s = await window.__statsPromise; }
  catch (e) { if (badge) badge.style.display = 'none'; return; }

  if (badge) badge.textContent = '🔔 ' + fmtNum(s.total_alerts) + ' alerts';

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const WORDS = ['zero','one','two','three','four','five','six','seven',
                 'eight','nine','ten','eleven','twelve'];
  const start = new Date(s.date_range.start), end = new Date(s.date_range.end);
  const nYears = Math.floor((end - start) / (365.25 * 86400e3));
  const word = WORDS[nYears] || String(nYears);
  const abbr = d => MONTHS[d.getMonth()].slice(0, 3).toUpperCase() + ' ' + d.getFullYear();
  const busiest = new Date(s.busiest_day.date);

  const vals = {
    'total': fmtNum(s.total_alerts),
    'total+': fmtNum(s.total_alerts) + '+',
    'end-year': String(end.getFullYear()),
    'year-range': start.getFullYear() + '–' + end.getFullYear(),
    'end-month-name': MONTHS[end.getMonth()],
    'end-month-year': MONTHS[end.getMonth()] + ' ' + end.getFullYear(),
    'range-eyebrow': abbr(start) + ' → ' + abbr(end),
    'years-word': word,
    'years-word-cap': word[0].toUpperCase() + word.slice(1),
    'busiest-count': fmtNum(s.busiest_day.count),
    'busiest-date': MONTHS[busiest.getMonth()] + ' ' + busiest.getDate() + ', ' + busiest.getFullYear(),
  };

  // freshness stamp in the footer on every page
  const credit = document.querySelector('.footer-credit');
  if (credit && !document.getElementById('data-through')) {
    const span = document.createElement('span');
    span.id = 'data-through';
    span.textContent = ' Data through ' + MONTHS[end.getMonth()] + ' ' + end.getDate() + ', ' + end.getFullYear() + ', updated every 30 minutes.';
    credit.appendChild(span);
  }

  document.querySelectorAll('[data-live]').forEach(el => {
    const k = el.dataset.live;
    if (vals[k] != null) { el.textContent = vals[k]; return; }
    const m = k.match(/^(origin|share):(.+)$/);
    if (m && s.origins && s.origins[m[2]] != null) {
      el.textContent = m[1] === 'origin'
        ? fmtNum(s.origins[m[2]])
        : (s.origins[m[2]] / s.total_alerts * 100).toFixed(1) + '%';
    }
  });
})();

// Nav dropdowns: mark the current page's link + group as active, and enable
// click-toggle for touch devices (desktop relies on CSS :hover / :focus-within).
(function initNavDropdowns() {
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-dropdown a').forEach(a => {
    if ((a.getAttribute('href') || '').toLowerCase() === path) {
      a.classList.add('active');
      const grp = a.closest('.nav-group');
      if (grp) grp.classList.add('active');
    }
  });

  document.querySelectorAll('.nav-group-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const grp = btn.closest('.nav-group');
      const wasOpen = grp.classList.contains('open');
      document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
      if (!wasOpen) grp.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
  });
})();
