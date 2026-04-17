// ── Salvo Visualiser ──────────────────────────────────────────────────────
// Overlays missile arcs + Iron Dome interceptors on top of a container when
// triggered. Missile count scales from real alert total, capped for sanity.
//
// Usage:
//   const salvo = mountSalvo({ mount: '#my-chart' });
//   salvo.fire({ count: 4000, label: 'Oct 7, 2023' });

(function () {
  const MAX_MISSILES = 80;

  function bezierQ(t, p0, cp, p1) {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * cp + t * t * p1;
  }

  window.mountSalvo = function (opts) {
    const container = document.querySelector(opts.mount);
    if (!container) return null;

    // Ensure container is positioned
    const cs = window.getComputedStyle(container);
    if (cs.position === 'static') container.style.position = 'relative';

    // Canvas overlay
    const canvas = document.createElement('canvas');
    canvas.className = 'salvo-overlay';
    Object.assign(canvas.style, {
      position: 'absolute', inset: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '50',
      opacity: '0', transition: 'opacity .25s'
    });
    container.appendChild(canvas);

    // Label
    const label = document.createElement('div');
    label.className = 'salvo-label';
    Object.assign(label.style, {
      position: 'absolute', top: '1rem', left: '50%',
      transform: 'translateX(-50%)',
      padding: '.6rem 1.2rem',
      background: 'rgba(7,7,10,.88)',
      border: '1px solid var(--red)',
      borderRadius: '3px',
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '.7rem', letterSpacing: '.12em',
      textTransform: 'uppercase', color: 'var(--accent)',
      zIndex: '51', opacity: '0',
      transition: 'opacity .25s',
      pointerEvents: 'none', whiteSpace: 'nowrap'
    });
    container.appendChild(label);

    const ctx = canvas.getContext('2d');
    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width  = Math.round(r.width);
      canvas.height = Math.round(r.height);
    }

    let rAFId = null;
    let projectiles = [];
    let explosions = [];
    let running = false;
    let startTime = 0;
    const DURATION = 4200; // ms total animation

    function addMissile(delayMs) {
      // Target somewhere in the middle 60% of width, upper 60% of height
      const ex = 0.20 + Math.random() * 0.60;
      const ey = 0.20 + Math.random() * 0.45;

      // Origin: edges
      const side = Math.random();
      let sx, sy;
      if (side < 0.45)      { sx = -0.04; sy = 0.05 + Math.random() * 0.4; }
      else if (side < 0.90) { sx = 1.04;  sy = 0.05 + Math.random() * 0.4; }
      else                   { sx = 0.1 + Math.random() * 0.8; sy = -0.04; }

      const cpx = (sx + ex) * 0.5 + (Math.random() - 0.5) * 0.12;
      const cpy = Math.min(sy, ey) - 0.1 - Math.random() * 0.1;
      const dur = 1300 + Math.random() * 900;

      const m = {
        type:'missile', sx, sy, ex, ey, cpx, cpy,
        duration: dur, delay: delayMs, startTime: null,
        trail: [], done: false, intercepted: false
      };
      projectiles.push(m);

      // Interceptor from bottom battery
      const battX = 0.1 + Math.random() * 0.8;
      const intDelay = delayMs + dur * 0.3;
      const intDur = dur * 0.55;

      setTimeout(() => {
        projectiles.push({
          type:'interceptor', sx: battX, sy: 0.98,
          ex, ey,
          cpx: battX + (ex - battX) * 0.35,
          cpy: ey - 0.12,
          duration: intDur, delay: 0, startTime: null,
          trail: [], done: false, intercepted: false
        });
        setTimeout(() => {
          explosions.push({
            x: ex, y: ey, startTime: null, t: 0, done: false,
            particles: Array.from({ length: 14 }, () => ({
              angle: Math.random() * Math.PI * 2,
              speed: 0.006 + Math.random() * 0.018,
              r: 0.6 + Math.random() * 1.4
            }))
          });
          m.intercepted = true;
        }, intDur);
      }, intDelay);
    }

    function draw(ts) {
      if (!running) return;
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      projectiles = projectiles.filter(p => !p.done);
      projectiles.forEach(p => {
        if (p.delay > 0 && elapsed < p.delay) return;
        if (!p.startTime) p.startTime = ts;
        p.t = Math.min((ts - p.startTime) / p.duration, 1);

        const isMissile = p.type === 'missile';
        const px = bezierQ(p.t, p.sx, p.cpx, p.ex);
        const py = bezierQ(p.t, p.sy, p.cpy, p.ey);

        p.trail.push({ x: px, y: py, alpha: 1 });
        p.trail.forEach(pt => { pt.alpha *= 0.89; });
        p.trail = p.trail.filter(pt => pt.alpha > 0.02);

        const rgb = isMissile ? '214,68,49' : '74,158,255';
        for (let i = 1; i < p.trail.length; i++) {
          const a = p.trail[i - 1], b = p.trail[i];
          ctx.beginPath();
          ctx.moveTo(a.x * W, a.y * H);
          ctx.lineTo(b.x * W, b.y * H);
          ctx.strokeStyle = `rgba(${rgb},${b.alpha * 0.78})`;
          ctx.lineWidth  = isMissile ? 1.4 : 1.0;
          ctx.lineCap    = 'round';
          ctx.stroke();
        }

        if (p.t < 1 && !p.intercepted) {
          const headR = isMissile ? 4 : 3;
          ctx.beginPath();
          ctx.arc(px * W, py * H, headR, 0, Math.PI * 2);
          ctx.fillStyle = isMissile ? '#ff7675' : '#74b9ff';
          ctx.fill();
        }

        if (p.t >= 1 || p.intercepted) p.done = true;
      });

      explosions = explosions.filter(e => !e.done);
      explosions.forEach(exp => {
        if (!exp.startTime) exp.startTime = ts;
        exp.t = Math.min((ts - exp.startTime) / 900, 1);
        const ex = exp.x * W, ey = exp.y * H;
        const t = exp.t;

        if (t < 0.5) {
          const coreR = (1 - t) * 14 + 4;
          const grad = ctx.createRadialGradient(ex, ey, 0, ex, ey, coreR);
          grad.addColorStop(0, `rgba(255,255,255,${(1 - t) * 0.95})`);
          grad.addColorStop(0.4, `rgba(232,184,75,${(1 - t) * 0.8})`);
          grad.addColorStop(1, 'rgba(214,48,49,0)');
          ctx.beginPath();
          ctx.arc(ex, ey, coreR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        const ringR = t * 40;
        ctx.beginPath();
        ctx.arc(ex, ey, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(232,184,75,${Math.max(0, 0.5 - t * 0.6)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        exp.particles.forEach(part => {
          const dist = t * part.speed * W;
          const px2 = ex + Math.cos(part.angle) * dist;
          const py2 = ey + Math.sin(part.angle) * dist;
          const pr = part.r * (1 - t * 0.7);
          if (pr <= 0) return;
          ctx.beginPath();
          ctx.arc(px2, py2, pr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(232,184,75,${(1 - t) * 0.85})`;
          ctx.fill();
        });

        if (t >= 1) exp.done = true;
      });

      if (elapsed < DURATION || projectiles.length > 0 || explosions.length > 0) {
        rAFId = requestAnimationFrame(draw);
      } else {
        running = false;
        canvas.style.opacity = '0';
        label.style.opacity = '0';
      }
    }

    function fire(opts) {
      const rawCount = Math.max(1, opts.count || 1);
      const count = Math.min(MAX_MISSILES, Math.max(3, Math.round(Math.sqrt(rawCount) * 1.8)));

      if (rAFId) cancelAnimationFrame(rAFId);
      projectiles = [];
      explosions = [];
      startTime = 0;
      running = true;
      resize();

      canvas.style.opacity = '1';
      label.textContent = `${opts.label || ''} — ${rawCount.toLocaleString()} alerts (${count} shown)`;
      label.style.opacity = '1';

      // Stagger missiles over the first 2.5s
      for (let i = 0; i < count; i++) {
        const d = (i / count) * 2500 + Math.random() * 200;
        addMissile(d);
      }

      rAFId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize, { passive: true });

    return { fire };
  };
})();
