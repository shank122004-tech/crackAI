/**
 * intro.js — CrackAI v14.0  "NEURAL INK"
 * ═══════════════════════════════════════════════════════
 *
 *  Concept: Pure 2D canvas. No Three.js dependency.
 *  A cracked ink-burst / circuit-board awakening sequence.
 *
 *  Visual layers:
 *    1. Black void → deep navy gradient morphs in
 *    2. Circuit traces draw themselves outward from center
 *    3. Ink-burst shockwave rings explode outward
 *    4. Floating binary/math glyphs rain upward
 *    5. Brand name assembles char-by-char with glitch frames
 *    6. Tagline types out with blinking cursor
 *    7. Stat counters pop in with stagger
 *    8. Shatter exit — screen cracks then dissolves
 *
 *  Zero external dependencies. Pure Canvas 2D + CSS.
 *  Loads instantly, works on all devices.
 */

(function () {
  'use strict';

  if (document.getElementById('sscIntroOverlay')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ═══════════════════════════════════════════════════════
     INJECT CSS
  ═══════════════════════════════════════════════════════ */
  const ST = document.createElement('style');
  ST.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;600;700;800&family=JetBrains+Mono:wght@300;400;600&display=swap');

    #sscIntroOverlay {
      position: fixed; inset: 0; z-index: 99999;
      overflow: hidden; touch-action: none;
      background: #000;
      will-change: opacity;
    }

    #ni-canvas {
      position: absolute; inset: 0;
      width: 100%; height: 100%; display: block;
    }

    /* ── Center HUD ── */
    #ni-hud {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      pointer-events: none;
      z-index: 10;
    }

    /* Brand name — assembles from glitch */
    #ni-brand {
      font-family: 'Space Grotesk', sans-serif;
      font-size: clamp(48px, 12vw, 96px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
      opacity: 0;
      color: #fff;
      position: relative;
    }

    #ni-brand .crack  { color: #fff; }
    #ni-brand .ai-txt {
      background: linear-gradient(135deg, #f97316 0%, #ec4899 45%, #8b5cf6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Tagline typewriter */
    #ni-tagline {
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(10px, 2.2vw, 13px);
      font-weight: 300;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(249,115,22,0.55);
      margin-top: 10px;
      opacity: 0;
      white-space: nowrap;
    }

    #ni-cursor {
      display: inline-block;
      width: 2px; height: 1em;
      background: #f97316;
      margin-left: 3px;
      vertical-align: text-bottom;
      animation: niCurBlink 0.6s step-end infinite;
    }

    @keyframes niCurBlink { 0%,100%{opacity:1} 50%{opacity:0} }

    /* Stats row */
    #ni-stats {
      display: flex; gap: clamp(10px, 2.5vw, 24px);
      margin-top: clamp(22px, 4vw, 36px);
      opacity: 0;
    }

    .ni-stat {
      display: flex; flex-direction: column; align-items: center;
      padding: clamp(8px,1.5vw,12px) clamp(14px,2.5vw,22px);
      border: 1px solid rgba(249,115,22,0.22);
      border-radius: 12px;
      background: rgba(249,115,22,0.04);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      position: relative;
      overflow: hidden;
    }

    .ni-stat::before {
      content: '';
      position: absolute;
      top: 0; left: -100%; width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(249,115,22,0.08), transparent);
      animation: niShimmer 2.5s ease infinite;
    }

    @keyframes niShimmer { to { left: 200%; } }

    .ni-stat-val {
      font-family: 'Space Grotesk', sans-serif;
      font-size: clamp(16px, 3.5vw, 24px);
      font-weight: 700;
      background: linear-gradient(135deg, #f97316, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .ni-stat-lbl {
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(7px, 1.3vw, 9px);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.30);
      margin-top: 3px;
    }

    /* Corner decorations */
    .ni-corner {
      position: absolute;
      width: clamp(18px,3vw,28px);
      height: clamp(18px,3vw,28px);
      opacity: 0;
      transition: opacity 0.6s ease;
    }
    .ni-corner.show { opacity: 1; }
    .ni-tl { top: clamp(16px,3vw,32px); left: clamp(16px,3vw,32px); }
    .ni-tr { top: clamp(16px,3vw,32px); right: clamp(16px,3vw,32px); transform: scaleX(-1); }
    .ni-bl { bottom: clamp(16px,3vw,32px); left: clamp(16px,3vw,32px); transform: scaleY(-1); }
    .ni-br { bottom: clamp(16px,3vw,32px); right: clamp(16px,3vw,32px); transform: scale(-1,-1); }

    /* System info */
    #ni-sys {
      position: absolute;
      bottom: clamp(16px,3vw,28px);
      left: 50%; transform: translateX(-50%);
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(7px,1.4vw,9px);
      letter-spacing: 0.20em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.18);
      opacity: 0;
      transition: opacity 1s ease 1.2s;
      white-space: nowrap;
    }
    #ni-sys.show { opacity: 1; }

    /* Version top-right */
    #ni-ver {
      position: absolute;
      top: clamp(16px,3vw,28px);
      right: clamp(16px,3vw,32px);
      font-family: 'JetBrains Mono', monospace;
      font-size: clamp(7px,1.3vw,9px);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(249,115,22,0.30);
      opacity: 0;
      transition: opacity 0.8s ease 0.9s;
    }
    #ni-ver.show { opacity: 1; }

    /* Progress bar at bottom */
    #ni-prog {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 2px;
      background: rgba(255,255,255,0.05);
    }
    #ni-prog-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #f97316, #ec4899, #8b5cf6);
      background-size: 300% 100%;
      animation: niProgGrad 1.5s linear infinite;
      box-shadow: 0 0 12px rgba(249,115,22,0.8);
      transition: width 0.08s linear;
    }
    @keyframes niProgGrad {
      0%   { background-position: 0% 0; }
      100% { background-position: 300% 0; }
    }

    /* Shatter veil */
    #ni-veil {
      position: absolute; inset: 0; z-index: 20;
      opacity: 0; pointer-events: none;
      background: radial-gradient(circle at 50% 50%,
        rgba(249,115,22,0.25) 0%,
        rgba(139,92,246,0.15) 40%,
        rgba(0,0,0,0) 70%);
    }

    /* Mobile */
    @media (max-width: 480px) {
      #ni-stats { flex-wrap: wrap; justify-content: center; gap: 8px; }
      .ni-stat { padding: 8px 14px; min-width: 80px; }
    }
    @media (max-height: 500px) and (orientation: landscape) {
      #ni-stats { display: none; }
      #ni-brand { font-size: 36px; }
    }
  `;
  document.head.appendChild(ST);

  /* ═══════════════════════════════════════════════════════
     BUILD DOM
  ═══════════════════════════════════════════════════════ */
  const cornerSVG = `<svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 14V2H14" stroke="rgba(249,115,22,0.55)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="2" cy="2" r="1.5" fill="rgba(249,115,22,0.7)"/>
  </svg>`;

  const ov = document.createElement('div');
  ov.id = 'sscIntroOverlay';
  ov.innerHTML = `
    <canvas id="ni-canvas"></canvas>

    <div class="ni-corner ni-tl">${cornerSVG}</div>
    <div class="ni-corner ni-tr">${cornerSVG}</div>
    <div class="ni-corner ni-bl">${cornerSVG}</div>
    <div class="ni-corner ni-br">${cornerSVG}</div>

    <div id="ni-hud">
      <div id="ni-brand">
        <span class="crack">Crack</span><span class="ai-txt">AI</span>
      </div>
      <div id="ni-tagline"><span id="ni-typed"></span><span id="ni-cursor"></span></div>
      <div id="ni-stats">
        <div class="ni-stat"><div class="ni-stat-val" id="ns-q">0</div><div class="ni-stat-lbl">Questions</div></div>
        <div class="ni-stat"><div class="ni-stat-val" id="ns-a">0</div><div class="ni-stat-lbl">AI Accuracy</div></div>
        <div class="ni-stat"><div class="ni-stat-val" id="ns-s">0</div><div class="ni-stat-lbl">Students</div></div>
      </div>
    </div>

    <div id="ni-sys">CrackAI Neural Engine · India's #1 Study AI</div>
    <div id="ni-ver">v14.0 · NEURAL INK</div>
    <div id="ni-prog"><div id="ni-prog-fill"></div></div>
    <div id="ni-veil"></div>
  `;
  document.body.insertBefore(ov, document.body.firstChild);

  /* ═══════════════════════════════════════════════════════
     CANVAS SETUP
  ═══════════════════════════════════════════════════════ */
  const canvas = document.getElementById('ni-canvas');
  const ctx    = canvas.getContext('2d');
  const MB     = window.innerWidth < 620;
  const DPR    = Math.min(window.devicePixelRatio || 1, MB ? 1.5 : 2);

  let W, H, CX, CY;

  function resize() {
    W  = window.innerWidth;
    H  = window.innerHeight;
    CX = W / 2;
    CY = H / 2;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(DPR, DPR);
  }
  resize();
  window.addEventListener('resize', resize);

  /* ═══════════════════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════════════════ */
  const lerp     = (a, b, t) => a + (b - a) * t;
  const clamp    = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const eOut3    = t => 1 - Math.pow(1 - t, 3);
  const eOut5    = t => 1 - Math.pow(1 - t, 5);
  const eIn3     = t => t * t * t;
  const rand     = (lo, hi) => lo + Math.random() * (hi - lo);
  const randInt  = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const TAU      = Math.PI * 2;

  /* Color helpers */
  function hsla(h, s, l, a) { return `hsla(${h},${s}%,${l}%,${a})`; }

  /* ═══════════════════════════════════════════════════════
     LAYER 1 — BACKGROUND GRADIENT (animated)
  ═══════════════════════════════════════════════════════ */
  let bgAlpha = 0; // fades in from black

  function drawBG(t) {
    // Deep dark with subtle radial
    const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.75);
    grd.addColorStop(0, `rgba(8,4,20,${bgAlpha})`);
    grd.addColorStop(0.45, `rgba(3,2,10,${bgAlpha})`);
    grd.addColorStop(1, `rgba(0,0,0,${bgAlpha})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Moving color pools
    const pools = [
      { x: CX + Math.sin(t*0.4)*W*0.18, y: CY - H*0.22, r: W*0.28, c: [249,115,22], a: 0.045 },
      { x: CX - Math.cos(t*0.3)*W*0.20, y: CY + H*0.18, r: W*0.32, c: [139,92,246], a: 0.038 },
      { x: CX + Math.cos(t*0.5)*W*0.12, y: CY,           r: W*0.20, c: [236,72,153], a: 0.028 },
    ];
    pools.forEach(p => {
      const g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g2.addColorStop(0, `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${p.a * bgAlpha})`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    });
  }

  /* ═══════════════════════════════════════════════════════
     LAYER 2 — CIRCUIT TRACES
     Lines grow outward from center like PCB traces
  ═══════════════════════════════════════════════════════ */
  const TRACE_COUNT = MB ? 28 : 52;
  const traces = [];

  (function initTraces() {
    for (let i = 0; i < TRACE_COUNT; i++) {
      const angle  = (i / TRACE_COUNT) * TAU + rand(-0.08, 0.08);
      const steps  = randInt(2, 5);
      const segs   = [];
      let cx = CX, cy = CY;
      let dir = angle;

      for (let s = 0; s < steps; s++) {
        const len = rand(W * 0.04, W * 0.18);
        const nx  = cx + Math.cos(dir) * len;
        const ny  = cy + Math.sin(dir) * len;
        segs.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx; cy = ny;
        // 90° turn bias
        dir += (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2) + rand(-0.15, 0.15);
      }

      const hue   = [22, 330, 270, 200][randInt(0,3)]; // orange/pink/purple/cyan
      const speed = rand(0.35, 0.85);
      const delay = rand(0, 0.55);
      const width = rand(0.5, 1.4);

      traces.push({ segs, progress: 0, speed, delay, drawn: 0,
        color: `hsl(${hue},90%,65%)`, alpha: rand(0.35, 0.80), width,
        nodes: [], // junction dots populated on draw
        glow: Math.random() > 0.55,
      });
    }
  })();

  let traceTime = 0;

  function updateTraces(dt) {
    traceTime += dt;
  }

  function drawTraces(globalAlpha) {
    traces.forEach(tr => {
      const tLocal = Math.max(0, traceTime - tr.delay);
      const totalLen = tr.segs.reduce((a, s) =>
        a + Math.hypot(s.x2-s.x1, s.y2-s.y1), 0);
      const drawn = totalLen * clamp(tLocal * tr.speed, 0, 1);

      ctx.save();
      ctx.globalAlpha = tr.alpha * globalAlpha;
      ctx.strokeStyle = tr.color;
      ctx.lineWidth   = tr.width;
      ctx.lineCap     = 'round';

      if (tr.glow) {
        ctx.shadowColor = tr.color;
        ctx.shadowBlur  = 6;
      }

      let rem = drawn;
      let firstSeg = true;

      for (let si = 0; si < tr.segs.length && rem > 0; si++) {
        const seg = tr.segs[si];
        const sLen = Math.hypot(seg.x2-seg.x1, seg.y2-seg.y1);
        const t    = clamp(rem / sLen, 0, 1);
        const ex   = lerp(seg.x1, seg.x2, t);
        const ey   = lerp(seg.y1, seg.y2, t);

        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Junction dot at segment end
        if (t >= 1 && si > 0) {
          ctx.beginPath();
          ctx.arc(seg.x1, seg.y1, tr.width * 2.5, 0, TAU);
          ctx.fillStyle = tr.color;
          ctx.fill();
        }

        // Traveling dot at head
        if (rem < sLen || si === tr.segs.length - 1) {
          ctx.beginPath();
          ctx.arc(ex, ey, tr.width * 3.5, 0, TAU);
          ctx.fillStyle = '#fff';
          ctx.shadowColor = tr.color;
          ctx.shadowBlur = 14;
          ctx.globalAlpha = tr.alpha * globalAlpha * clamp(rem/8, 0, 1);
          ctx.fill();
        }

        rem -= sLen;
      }
      ctx.restore();
    });
  }

  /* ═══════════════════════════════════════════════════════
     LAYER 3 — INK / SHOCKWAVE RINGS
     Concentric rings burst from center at intervals
  ═══════════════════════════════════════════════════════ */
  const rings = [];
  let ringTimer = 0;
  const RING_INTERVAL = 0.38;

  function spawnRing(t) {
    const colors = [
      ['#f97316','rgba(249,115,22,'],
      ['#ec4899','rgba(236,72,153,'],
      ['#8b5cf6','rgba(139,92,246,'],
      ['#06b6d4','rgba(6,182,212,'],
    ];
    const c = colors[rings.length % colors.length];
    rings.push({
      r: 0,
      maxR: Math.max(W, H) * 0.85,
      speed: rand(260, 400),
      color: c[0],
      rgba: c[1],
      width: rand(1.0, 2.5),
      alpha: rand(0.55, 0.90),
      born: t,
    });
  }

  function updateRings(dt, t) {
    ringTimer += dt;
    if (ringTimer > RING_INTERVAL && rings.length < (MB ? 5 : 8)) {
      ringTimer = 0;
      spawnRing(t);
    }
    rings.forEach(r => { r.r += r.speed * dt; });
  }

  function drawRings(globalAlpha) {
    rings.forEach(r => {
      const prog  = r.r / r.maxR;
      const alpha = r.alpha * (1 - eOut3(prog)) * globalAlpha;
      if (alpha < 0.002) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(CX, CY, r.r, 0, TAU);
      ctx.strokeStyle = r.color;
      ctx.lineWidth   = r.width * (1 - prog * 0.6);
      ctx.shadowColor = r.color;
      ctx.shadowBlur  = 18;
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ═══════════════════════════════════════════════════════
     LAYER 4 — FLOATING GLYPHS
     Math/code chars drift upward, fading out
  ═══════════════════════════════════════════════════════ */
  const GLYPHS = '01∑∫√π×÷αβγδεθλμσ≠≡∞∂∇abcxyz+-={}[]<>'.split('');
  const glyphParticles = [];
  let glyphTimer = 0;
  const GLYPH_RATE = MB ? 0.10 : 0.065;

  function spawnGlyph() {
    const x = rand(W * 0.05, W * 0.95);
    const baseY = rand(H * 0.65, H * 0.95);
    glyphParticles.push({
      x, y: baseY,
      char: GLYPHS[randInt(0, GLYPHS.length-1)],
      vy: rand(-55, -120),
      vx: rand(-12, 12),
      alpha: rand(0.5, 0.85),
      life: 0,
      maxLife: rand(1.8, 3.5),
      size: rand(9, 18),
      color: ['#f97316','#ec4899','#8b5cf6','#06b6d4','#a3e635'][randInt(0,4)],
      glitch: Math.random() > 0.75,
    });
  }

  function updateGlyphs(dt) {
    glyphTimer += dt;
    if (glyphTimer > GLYPH_RATE) { glyphTimer = 0; spawnGlyph(); }
    for (let i = glyphParticles.length - 1; i >= 0; i--) {
      const g = glyphParticles[i];
      g.life += dt;
      g.y += g.vy * dt;
      g.x += g.vx * dt;
      if (g.life > g.maxLife) glyphParticles.splice(i, 1);
    }
  }

  function drawGlyphs(globalAlpha) {
    glyphParticles.forEach(g => {
      const t  = g.life / g.maxLife;
      const a  = g.alpha * (1 - eOut3(t)) * Math.min(t * 5, 1) * globalAlpha;
      if (a < 0.01) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `${g.size}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = g.glitch && Math.random() > 0.88 ? '#fff' : g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur  = 8;
      ctx.fillText(g.char, g.x, g.y);
      ctx.restore();
    });
  }

  /* ═══════════════════════════════════════════════════════
     LAYER 5 — CENTRAL INK BLOOM
     A radial "ink exploding" shape at center
  ═══════════════════════════════════════════════════════ */
  let bloomAlpha = 0;
  let bloomScale = 0;

  function drawBloom(t, globalAlpha) {
    if (bloomAlpha < 0.01) return;
    const pulse = 0.88 + 0.12 * Math.sin(t * 3.1);
    const R = Math.min(W, H) * 0.16 * bloomScale * pulse;

    ctx.save();
    ctx.globalAlpha = bloomAlpha * globalAlpha;

    // Outer diffuse halo
    const g1 = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 2.8);
    g1.addColorStop(0,   'rgba(249,115,22,0.18)');
    g1.addColorStop(0.35,'rgba(139,92,246,0.10)');
    g1.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);

    // Inner bright core
    const g2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
    g2.addColorStop(0,   'rgba(255,255,255,0.72)');
    g2.addColorStop(0.2, 'rgba(249,115,22,0.55)');
    g2.addColorStop(0.6, 'rgba(139,92,246,0.22)');
    g2.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Ink spikes — sharp rays
    const SPIKE_N = 24;
    for (let i = 0; i < SPIKE_N; i++) {
      const a   = (i / SPIKE_N) * TAU + t * 0.4;
      const len = R * (0.6 + 0.4 * Math.sin(i * 2.9 + t * 1.7));
      const w   = 0.04 + 0.03 * Math.sin(i * 1.7);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, len, a - w, a + w);
      ctx.closePath();
      const alpha2 = (0.12 + 0.08 * Math.sin(i + t * 2)) * bloomAlpha * globalAlpha;
      ctx.fillStyle = `rgba(249,115,22,${alpha2})`;
      ctx.fill();
    }

    ctx.restore();
  }

  /* ═══════════════════════════════════════════════════════
     LAYER 6 — SCAN LINE (subtle)
  ═══════════════════════════════════════════════════════ */
  function drawScanLine(t, globalAlpha) {
    const y = ((t * 0.18) % 1) * H;
    const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0,   'rgba(249,115,22,0)');
    g.addColorStop(0.5, `rgba(249,115,22,${0.04 * globalAlpha})`);
    g.addColorStop(1,   'rgba(249,115,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 40, W, 80);
  }

  /* ═══════════════════════════════════════════════════════
     HUD ANIMATIONS
  ═══════════════════════════════════════════════════════ */
  const brandEl    = document.getElementById('ni-brand');
  const taglineEl  = document.getElementById('ni-tagline');
  const typedEl    = document.getElementById('ni-typed');
  const statsEl    = document.getElementById('ni-stats');
  const sysEl      = document.getElementById('ni-sys');
  const verEl      = document.getElementById('ni-ver');
  const progFill   = document.getElementById('ni-prog-fill');
  const veilEl     = document.getElementById('ni-veil');
  const corners    = document.querySelectorAll('.ni-corner');

  let hudShown      = false;
  let typeStarted   = false;
  let statsShown    = false;
  let cornersShown  = false;

  const TAGLINE_TEXT = 'India\'s #1 AI Study Engine';
  let typeIdx = 0, typeTimer = 0;
  const TYPE_SPEED = 0.055; // seconds per char

  function showBrand() {
    brandEl.style.transition = 'opacity 0.01s';
    brandEl.style.opacity = '1';

    // Glitch reveal: scramble chars then settle
    const full = 'CrackAI';
    const chars = '!@#$%^&*<>?/|{}[]01'.split('');
    let frame = 0;
    const glitchFrames = 14;
    function glitchTick() {
      if (frame >= glitchFrames) {
        brandEl.innerHTML = '<span class="crack">Crack</span><span class="ai-txt">AI</span>';
        return;
      }
      const ratio = frame / glitchFrames;
      let out = '';
      for (let i = 0; i < full.length; i++) {
        if (Math.random() < ratio) {
          out += full[i];
        } else {
          out += chars[randInt(0, chars.length - 1)];
        }
      }
      // Re-split at position 5
      const crackPart = out.substring(0, 5);
      const aiPart    = out.substring(5);
      brandEl.innerHTML = `<span class="crack">${crackPart}</span><span class="ai-txt">${aiPart}</span>`;
      frame++;
      setTimeout(glitchTick, 45);
    }
    glitchTick();
  }

  function tickTypewriter(dt) {
    if (!typeStarted) return;
    typeTimer += dt;
    if (typeTimer > TYPE_SPEED && typeIdx < TAGLINE_TEXT.length) {
      typeTimer = 0;
      typeIdx++;
      typedEl.textContent = TAGLINE_TEXT.substring(0, typeIdx);
    }
  }

  function animCount(el, target, dur, suffix) {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / (dur * 1000), 1);
      const val = Math.floor(eOut3(p) * target);
      el.textContent = val >= 1000
        ? (val >= 100000 ? Math.floor(val/1000) + 'K' : val.toLocaleString('en-IN'))
        : val + (suffix || '');
      if (!suffix && val >= 1000) el.textContent = val.toLocaleString('en-IN');
      if (suffix) el.textContent = Math.floor(eOut3(p)*target) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  function setProgress(pct) {
    progFill.style.width = pct + '%';
  }

  /* ═══════════════════════════════════════════════════════
     MAIN ANIMATION LOOP
  ═══════════════════════════════════════════════════════ */
  let elapsed   = 0;
  let phase     = 0;   // 0=rise, 1=bloom+trace, 2=hud, 3=hold, 4=exit
  let phaseT    = 0;
  let rafId     = null;
  let lastTs    = null;

  function animate(ts) {
    rafId = requestAnimationFrame(animate);
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;
    elapsed += dt;
    phaseT  += dt;

    /* ── Clear ── */
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    /* ════ PHASE 0 : RISE (0 → 0.5s) ════
       BG fades in, bloom starts small       */
    if (phase === 0) {
      bgAlpha     = eOut3(clamp(phaseT / 0.5, 0, 1));
      bloomAlpha  = eOut5(clamp(phaseT / 0.5, 0, 1)) * 0.7;
      bloomScale  = eOut5(clamp(phaseT / 0.5, 0, 1)) * 0.6;

      drawBG(elapsed);
      drawBloom(elapsed, 1);
      drawRings(0); // no rings yet

      setProgress(Math.floor(phaseT / 0.5 * 15));

      if (phaseT > 0.5) { phase = 1; phaseT = 0; }
    }

    /* ════ PHASE 1 : BURST (0.5 → 1.6s) ════
       Rings explode, traces draw, bloom peaks  */
    else if (phase === 1) {
      const t = clamp(phaseT / 1.1, 0, 1);
      bgAlpha    = 1;
      bloomAlpha = lerp(0.7, 0.45, eOut3(t));
      bloomScale = lerp(0.6, 1.0,  eOut3(t));

      drawBG(elapsed);
      updateRings(dt, elapsed);
      drawRings(eOut3(t));
      updateTraces(dt);
      drawTraces(eOut3(t));
      drawBloom(elapsed, lerp(1.0, 0.55, eOut3(t)));
      updateGlyphs(dt);
      drawGlyphs(eOut3(clamp(phaseT / 0.5, 0, 1)));
      drawScanLine(elapsed, eOut3(t) * 0.6);

      setProgress(15 + Math.floor(eOut3(t) * 35));

      if (phaseT > 1.1) { phase = 2; phaseT = 0; }
    }

    /* ════ PHASE 2 : HUD IN (1.6 → 2.4s) ════
       Brand glitches in, typewriter starts     */
    else if (phase === 2) {
      const t = clamp(phaseT / 0.8, 0, 1);
      bgAlpha = 1;
      bloomAlpha = lerp(0.45, 0.28, eOut3(t));
      bloomScale = 1.0;

      drawBG(elapsed);
      updateRings(dt, elapsed);
      drawRings(0.35 * (1 - eOut3(t) * 0.5));
      updateTraces(dt);
      drawTraces(lerp(1, 0.45, eOut3(t)));
      drawBloom(elapsed, lerp(0.55, 0.30, eOut3(t)));
      updateGlyphs(dt);
      drawGlyphs(0.65 * (1 - eOut3(t) * 0.3));
      drawScanLine(elapsed, 0.4);

      setProgress(50 + Math.floor(eOut3(t) * 30));

      // Show brand when phase starts
      if (!hudShown) {
        hudShown = true;
        showBrand();
        setTimeout(() => {
          taglineEl.style.opacity = '1';
          typeStarted = true;
        }, 300);
      }

      // Corners
      if (phaseT > 0.3 && !cornersShown) {
        cornersShown = true;
        corners.forEach(c => c.classList.add('show'));
        sysEl.classList.add('show');
        verEl.classList.add('show');
      }

      tickTypewriter(dt);

      if (phaseT > 0.8) { phase = 3; phaseT = 0; }
    }

    /* ════ PHASE 3 : HOLD (2.4 → 4.2s) ════
       Everything breathing, stats count up     */
    else if (phase === 3) {
      const t = clamp(phaseT / 1.8, 0, 1);

      drawBG(elapsed);
      updateRings(dt, elapsed);
      drawRings(0.18 * (1 - t * 0.8));
      updateTraces(dt);
      drawTraces(0.35 * (1 - t * 0.5));
      drawBloom(elapsed, 0.22 * (1 - t * 0.5));
      updateGlyphs(dt);
      drawGlyphs(0.50 * (1 - t * 0.3));
      drawScanLine(elapsed, 0.28);

      tickTypewriter(dt);

      if (!statsShown && typeIdx >= TAGLINE_TEXT.length) {
        statsShown = true;
        statsEl.style.transition = 'opacity 0.7s ease';
        statsEl.style.opacity = '1';
        animCount(document.getElementById('ns-q'), 284600, 2.0);
        animCount(document.getElementById('ns-a'), 98, 1.8, '%');
        animCount(document.getElementById('ns-s'), 51200, 2.2);
      }

      setProgress(80 + Math.floor(t * 20));

      if (phaseT > 1.8) {
        setProgress(100);
        phase = 4; phaseT = 0;
      }
    }

    /* ════ PHASE 4 : EXIT (4.2s+) ════
       Bright flash → fade out               */
    else if (phase === 4) {
      const t = clamp(phaseT / 0.7, 0, 1);

      drawBG(elapsed);
      drawBloom(elapsed, 0.12 * (1 - t));
      updateGlyphs(dt);
      drawGlyphs(0.35 * (1 - t));
      drawScanLine(elapsed, 0.15 * (1 - t));

      // Veil flash
      veilEl.style.opacity = String(eIn3(clamp(t * 1.4 - 0.1, 0, 1)));

      if (t >= 1 && !exited) {
        cancelAnimationFrame(rafId);
        doExit(0);
      }
    }


  }

  animate(0);

  /* ═══════════════════════════════════════════════════════
     EXIT
  ═══════════════════════════════════════════════════════ */
  let exited = false;

  function doExit(delay) {
    if (exited) return;
    exited = true;
    setTimeout(() => {
      ov.style.transition = 'opacity 0.55s cubic-bezier(.4,0,.2,1)';
      ov.style.opacity = '0';
      setTimeout(() => {
        ov.style.display = 'none';
        try { ov.parentNode.removeChild(ov); } catch(e) {}
      }, 600);
    }, delay);
  }

  /* ═══════════════════════════════════════════════════════
     SEQUENCE CONTROL
  ═══════════════════════════════════════════════════════ */
  window._niStartExit = () => { if (phase < 4) { phase = 4; phaseT = 0; } };

  const startTs  = Date.now();
  const MIN_SHOW = 4200;

  window.addEventListener('load', () => {
    const waited = Date.now() - startTs;
    setTimeout(() => {
      if (window._niStartExit) window._niStartExit();
      else doExit(0);
    }, Math.max(0, MIN_SHOW - waited));
  }, { once: true });

  // Absolute hard cap
  setTimeout(() => { if (!exited) doExit(0); }, 6000);

})();