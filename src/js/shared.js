// ── Shared utilities for all Under Fire pages ───────────────────────────────
const DATA = 'data/processed/';

async function fetchData(file) {
  const r = await fetch(DATA + file);
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
function fmtPct(p) { return (p * 100).toFixed(1) + '%'; }

// File-protocol warning
(function() {
  if (window.location.protocol === 'file:') {
    const w = document.getElementById('file-protocol-warning');
    if (w) w.style.display = 'block';
  }
})();

// Nav badge: load stats summary and display alert count
(async function initNavBadge() {
  const badge = document.getElementById('nav-badge');
  if (!badge) return;
  try {
    const s = await fetchData('stats_summary.json');
    badge.textContent = '🔔 ' + fmtNum(s.total_alerts) + ' alerts';
    window.__STATS_SUMMARY = s;
  } catch (e) {
    badge.textContent = '🔔 142,837 alerts';
  }
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
