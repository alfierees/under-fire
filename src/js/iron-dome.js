// ── Iron Dome Hero Animation ───────────────────────────────────────────────
// Canvas-based animation showing missile arcs being intercepted mid-air.
// Missiles: red arcs from screen edges. Interceptors: blue arcs rising from
// city. Explosions: gold/white burst at interception point.
(function ironDomeAnimation() {
  const canvas = document.getElementById('iron-dome-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const STARS = Array.from({ length: 220 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.75,
    r: Math.random() * 1.0 + 0.2,
    alpha: Math.random() * 0.45 + 0.12,
    phase: Math.random() * Math.PI * 2
  }));

  const BUILDINGS = [
    [0.00,0.030,0.055],[0.03,0.018,0.095],[0.05,0.035,0.048],
    [0.09,0.025,0.085],[0.12,0.045,0.065],[0.17,0.018,0.040],
    [0.20,0.038,0.110],[0.24,0.028,0.075],[0.27,0.055,0.095],
    [0.33,0.028,0.055],[0.36,0.048,0.130],[0.41,0.038,0.080],
    [0.45,0.025,0.065],[0.48,0.058,0.120],[0.54,0.035,0.070],
    [0.58,0.048,0.100],[0.63,0.028,0.055],[0.66,0.055,0.140],
    [0.72,0.038,0.082],[0.76,0.048,0.115],[0.81,0.028,0.062],
    [0.84,0.048,0.095],[0.89,0.038,0.058],[0.93,0.065,0.078]
  ];
  const GROUND_Y = 0.83;
  const BATTERIES = [0.14, 0.33, 0.52, 0.71, 0.88];

  function bezierQ(t, p0, cp, p1) {
    const mt = 1 - t;
    return mt * mt * p0 + 2 * mt * t * cp + t * t * p1;
  }

  let projectiles = [];
  let explosions  = [];

  function spawnEvent() {
    const intercX = 0.20 + Math.random() * 0.60;
    const intercY = 0.12 + Math.random() * 0.38;

    const side = Math.random();
    let msX, msY;
    if (side < 0.42)       { msX = -0.06; msY = 0.04 + Math.random() * 0.42; }
    else if (side < 0.84)  { msX = 1.06;  msY = 0.04 + Math.random() * 0.42; }
    else                    { msX = 0.05 + Math.random() * 0.90; msY = -0.06; }

    const msCpX = (msX + intercX) * 0.5 + (Math.random() - 0.5) * 0.12;
    const msCpY = Math.min(msY, intercY) - 0.06 - Math.random() * 0.10;
    const msDuration = 2600 + Math.random() * 1600;

    const missileEntry = {
      type:'missile', sx:msX, sy:msY, ex:intercX, ey:intercY,
      cpx:msCpX, cpy:msCpY, duration:msDuration,
      startTime:null, t:0, trail:[], done:false, intercepted:false
    };
    projectiles.push(missileEntry);

    const intDelay    = msDuration * 0.36;
    const intDuration = msDuration * 0.60;
    const battX = BATTERIES.reduce((best, bx) =>
      Math.abs(bx - intercX) < Math.abs(best - intercX) ? bx : best, BATTERIES[0]);
    const intCpX = battX + (intercX - battX) * 0.35 + (Math.random() - 0.5) * 0.05;
    const intCpY = intercY - 0.12 - Math.random() * 0.08;

    setTimeout(() => {
      projectiles.push({
        type:'interceptor', sx:battX, sy:GROUND_Y, ex:intercX, ey:intercY,
        cpx:intCpX, cpy:intCpY, duration:intDuration,
        startTime:null, t:0, trail:[], done:false, intercepted:false
      });
      setTimeout(() => {
        explosions.push({
          x:intercX, y:intercY, startTime:null, t:0, done:false,
          particles: Array.from({ length: 28 }, () => ({
            angle: Math.random() * Math.PI * 2,
            speed: 0.007 + Math.random() * 0.022,
            r: 0.7 + Math.random() * 1.8
          }))
        });
        missileEntry.intercepted = true;
      }, intDuration);
    }, intDelay);
  }

  let lastSpawn = -Infinity;
  const SPAWN_INTERVAL = 2600;

  function draw(ts) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    STARS.forEach(s => {
      const twinkle = 0.72 + 0.28 * Math.sin(ts * 0.00085 + s.phase);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(195,210,235,${s.alpha * twinkle})`;
      ctx.fill();
    });

    if (ts - lastSpawn > SPAWN_INTERVAL) { spawnEvent(); lastSpawn = ts; }

    projectiles = projectiles.filter(p => !p.done);
    projectiles.forEach(p => {
      if (!p.startTime) p.startTime = ts;
      p.t = Math.min((ts - p.startTime) / p.duration, 1);
      const isMissile = p.type === 'missile';
      const px = bezierQ(p.t, p.sx, p.cpx, p.ex);
      const py = bezierQ(p.t, p.sy, p.cpy, p.ey);

      p.trail.push({ x: px, y: py, alpha: 1 });
      p.trail.forEach(pt => { pt.alpha *= 0.89; });
      p.trail = p.trail.filter(pt => pt.alpha > 0.018);

      const trailRGB = isMissile ? '214,68,49' : '74,158,255';
      for (let i = 1; i < p.trail.length; i++) {
        const a = p.trail[i - 1], b = p.trail[i];
        ctx.beginPath();
        ctx.moveTo(a.x * W, a.y * H);
        ctx.lineTo(b.x * W, b.y * H);
        ctx.strokeStyle = `rgba(${trailRGB},${b.alpha * 0.78})`;
        ctx.lineWidth  = isMissile ? 1.6 : 1.1;
        ctx.lineCap    = 'round';
        ctx.stroke();
      }

      if (p.t < 1 && !p.intercepted) {
        const headColor = isMissile ? '#ff7675' : '#74b9ff';
        const headR     = isMissile ? 5 : 3.5;
        const grad = ctx.createRadialGradient(px * W, py * H, 0, px * W, py * H, headR * 2.5);
        grad.addColorStop(0, headColor);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(px * W, py * H, headR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px * W, py * H, headR * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (p.t >= 1 || p.intercepted) p.done = true;
    });

    explosions = explosions.filter(e => !e.done);
    explosions.forEach(exp => {
      if (!exp.startTime) exp.startTime = ts;
      exp.t = Math.min((ts - exp.startTime) / 1600, 1);
      const ex = exp.x * W, ey = exp.y * H;
      const t = exp.t;
      const fadeOut = 1 - t;

      if (t < 0.55) {
        const coreR = (1 - t) * 22 + t * 8;
        const grad  = ctx.createRadialGradient(ex, ey, 0, ex, ey, coreR);
        grad.addColorStop(0,   `rgba(255,255,255,${(1 - t) * 0.98})`);
        grad.addColorStop(0.35,`rgba(232,184,75,${(1 - t) * 0.85})`);
        grad.addColorStop(1,   'rgba(214,48,49,0)');
        ctx.beginPath();
        ctx.arc(ex, ey, coreR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      const ringR = t * 62;
      ctx.beginPath();
      ctx.arc(ex, ey, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(232,184,75,${Math.max(0, 0.55 - t * 0.65)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      const ring2R = t * 38;
      ctx.beginPath();
      ctx.arc(ex, ey, ring2R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.30 - t * 0.40)})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();

      exp.particles.forEach(part => {
        const dist = t * part.speed * W;
        const px2  = ex + Math.cos(part.angle) * dist;
        const py2  = ey + Math.sin(part.angle) * dist;
        const pr   = part.r * (1 - t * 0.7);
        if (pr <= 0) return;
        const pRGB = t < 0.35 ? '232,184,75' : '214,68,49';
        ctx.beginPath();
        ctx.arc(px2, py2, pr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pRGB},${fadeOut * 0.88})`;
        ctx.fill();
      });

      if (t >= 1) exp.done = true;
    });

    const groundPx = GROUND_Y * H;
    BATTERIES.forEach(bx => {
      const bgx = bx * W;
      const battGrad = ctx.createRadialGradient(bgx, groundPx, 0, bgx, groundPx, 48);
      battGrad.addColorStop(0, 'rgba(74,158,255,0.22)');
      battGrad.addColorStop(1, 'rgba(74,158,255,0)');
      ctx.beginPath();
      ctx.arc(bgx, groundPx, 48, 0, Math.PI * 2);
      ctx.fillStyle = battGrad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bgx, groundPx - 3, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74,158,255,0.80)';
      ctx.fill();
    });

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, groundPx);
    BUILDINGS.forEach(([bx, bw, bh]) => {
      const bpx = bx * W, bpw = bw * W, bph = bh * H;
      ctx.lineTo(bpx, groundPx);
      ctx.lineTo(bpx, groundPx - bph);
      ctx.lineTo(bpx + bpw, groundPx - bph);
      ctx.lineTo(bpx + bpw, groundPx);
    });
    ctx.lineTo(W, groundPx);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = '#07070a';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, groundPx);
    BUILDINGS.forEach(([bx, bw, bh]) => {
      const bpx = bx * W, bpw = bw * W, bph = bh * H;
      ctx.lineTo(bpx, groundPx);
      ctx.lineTo(bpx, groundPx - bph);
      ctx.lineTo(bpx + bpw, groundPx - bph);
      ctx.lineTo(bpx + bpw, groundPx);
    });
    ctx.lineTo(W, groundPx);
    ctx.strokeStyle = 'rgba(37,37,58,0.90)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    requestAnimationFrame(draw);
  }

  spawnEvent();
  lastSpawn = performance.now();
  requestAnimationFrame(draw);
})();
