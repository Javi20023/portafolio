(function () {
  'use strict';

  var SNIPPETS = {
    js: [
      ['const [fps, setFps] = useState(60);'],
      ['useEffect(() => {', '  mount();', '}, []);'],
      ['export default function App() {'],
      ['const trail = new Float32Array(24);'],
      ['requestAnimationFrame(loop);'],
      ['await fetch("/api/projects");'],
      ['memo(() => <Key />, []);'],
      ['ref.current.setZoom(v);']
    ],
    css: [
      ['.hero { display: grid; }'],
      ['color: #00E5FF;'],
      ['backdrop-filter: blur(12px);'],
      ['transform: translateZ(0);'],
     ['@media (width < 768px) {'],
      ['--glow: 0.75;'],
      ['transition: transform .3s ease;'],
      ['box-shadow: 0 0 24px #2563eb38;']
    ],
    gl: [
      ['gl_FragColor = vec4(col, 1.0);'],
      ['uniform float uTime;'],
      ['float fbm(vec2 p) { ... }'],
      ['attribute vec2 aPos;'],
      ['precision highp float;'],
      ['vec3 col = mix(deep, lift, k);'],
      ['gl_Position = vec4(aPos, 1.0);']
    ],
    sh: [
      ['$ npm run dev'],
      ['$ git commit -m "feat: knob"'],
      ['> build finished in 1.2s'],
      ['> deploy --prod'],
      ['$ vite build --watch'],
      ['200 OK · 60fps']
    ]
  };

  var CAT_COLORS = {
    js: 'rgba(129, 154, 241, ',
    css: 'rgba(34, 211, 238, ',
    gl: 'rgba(96, 165, 250, ',
    sh: 'rgba(0, 229, 255, '
  };

  var CAT_ALPHA = { js: 0.21, css: 0.24, gl: 0.19, sh: 0.28 };

  var CAT_WEIGHTS = [
    ['js', 0.38],
    ['css', 0.27],
    ['gl', 0.2],
    ['sh', 0.15]
  ];

  var NODE_COLOR_A = 'rgba(118, 146, 226, 0.20)';
  var NODE_COLOR_B = 'rgba(0, 229, 255, 0.26)';

  var COL_W = 400, ROW_H = 175, SLICE_D = 310;
  var COLS = 13, ROWS = 16, SLICES = 20;
  var X_OFF = 2600, Y_OFF = 1350, Z_BASE = 300;
  var OCCUPANCY = 0.36;
  var CAM_Z = 140;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function pickCategory() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < CAT_WEIGHTS.length; i++) {
      acc += CAT_WEIGHTS[i][1];
      if (r < acc) return CAT_WEIGHTS[i][0];
    }
    return 'js';
  }

  function CodeField(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.onFrame = opts.onFrame || null;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      this.markFallback();
      return;
    }

    this.isCoarse = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.zoom = typeof opts.zoom === 'number' ? clamp(opts.zoom, 0, 1) : 0.75;
    this.targetZoom = this.zoom;
    this.zs = 0.42 + this.zoom * 2.5;

    this.mxT = 0; this.myT = 0;
    this.mx = 0; this.my = 0;
    this.lastGyro = -1e4;

    this.blocks = [];
    this.inView = true;
    this.hidden = document.hidden;
    this.rafId = 0;
    this.prevT = 0;

    this.buildField();
    this.resize();
    this.bindEvents();

    if (this.reduceMotion) {
      this.drawFrame(12.5);
    } else {
      this.updateRunning();
    }
  }

  CodeField.prototype.markFallback = function () {
    var bg = this.canvas.parentElement;
    if (bg) bg.classList.add('no-webgl');
  };

  CodeField.prototype.makeBlock = function (col, row, slice) {
    var cat = pickCategory();
    var snip = pick(SNIPPETS[cat]);
    return {
      x: col * COL_W - X_OFF + rand(-70, 70),
      y: row * ROW_H - Y_OFF + rand(-40, 40),
      z: slice * SLICE_D + Z_BASE + rand(-85, 85),
      fs: rand(13, 17),
      cat: cat,
      lines: snip,
      seed: Math.random()
    };
  };

  CodeField.prototype.buildField = function () {
    this.blocks.length = 0;
    for (var s = 0; s < SLICES; s++) {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          if (Math.random() < OCCUPANCY) {
            this.blocks.push(this.makeBlock(c, r, s));
          }
        }
      }
    }
  };

  CodeField.prototype.setZoom = function (v) {
    this.targetZoom = clamp(v, 0, 1);
    if (this.reduceMotion) {
      this.zoom = this.targetZoom;
      this.zs = 0.42 + this.zoom * 2.5;
      if (!this.rafId) this.drawFrame(12.5);
    }
  };

  CodeField.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, this.isCoarse ? 1.25 : 1.75);
    this.cw = Math.max(2, Math.floor(rect.width));
    this.ch = Math.max(2, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.cw * dpr);
    this.canvas.height = Math.floor(this.ch * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.reduceMotion && !this.rafId) this.drawFrame(12.5);
  };

  CodeField.prototype.onPointerMove = function (e) {
    if (this.isCoarse || this.reduceMotion) return;
    var r = this.canvas.getBoundingClientRect();
    this.mxT = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 2;
    this.myT = ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * 2;
  };

  CodeField.prototype.onGyro = function (e) {
    if (e.beta === null || e.gamma === null) return;
    this.mxT = clamp(e.gamma / 25, -1, 1);
    this.myT = -clamp((e.beta - 40) / 25, -1, 1);
    this.lastGyro = performance.now() / 1000;
  };

  CodeField.prototype.bindEvents = function () {
    var self = this;
    this._onMove = function (e) { self.onPointerMove(e); };
    window.addEventListener('pointermove', this._onMove, { passive: true });

    this._onGyro = function (e) { self.onGyro(e); };
    if (this.isCoarse && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', this._onGyro, { passive: true });
    }

    var resizeT = 0;
    this._onResize = function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () { self.resize(); }, 150);
    };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);

    this._onVis = function () {
      self.hidden = document.hidden;
      self.updateRunning();
    };
    document.addEventListener('visibilitychange', this._onVis);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(function (entries) {
        self.inView = entries[0].isIntersecting;
        self.updateRunning();
      }, { threshold: 0 });
      this._io.observe(this.canvas);
    }
  };

  CodeField.prototype.setRunning = function (v) {
    if (v && !this.rafId) {
      this.prevT = performance.now() / 1000;
      var self = this;
      var loop = function (nowMs) {
        self.rafId = requestAnimationFrame(loop);
        self.tick(nowMs / 1000);
      };
      this.rafId = requestAnimationFrame(loop);
    } else if (!v && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  };

  CodeField.prototype.updateRunning = function () {
    var should = this.inView && !this.hidden && !this.reduceMotion;
    this.setRunning(should);
  };

  CodeField.prototype.tick = function (t) {
    var dt = Math.min(0.066, Math.max(0.001, t - this.prevT));
    this.prevT = t;

    var k = 1 - Math.exp(-dt * 3.4);
    this.zoom += (this.targetZoom - this.zoom) * k;
    this.zs = 0.42 + this.zoom * 2.5;

    if (this.isCoarse && t - this.lastGyro > 3) {
      this.mxT = Math.sin(t * 0.1) * 0.32;
      this.myT = Math.cos(t * 0.14) * 0.22;
    }

    var km = 1 - Math.exp(-dt * 3.2);
    this.mx += (this.mxT - this.mx) * km;
    this.my += (this.myT - this.my) * km;

    var speed = 44 * (0.55 + this.zs * 0.5);
    var blocks = this.blocks;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      b.z -= speed * dt;
      if (b.z < CAM_Z + 70) {
        b.z += SLICES * SLICE_D;
        b.x = ((Math.random() * COLS) | 0) * COL_W - X_OFF + rand(-70, 70);
        b.y = ((Math.random() * ROWS) | 0) * ROW_H - Y_OFF + rand(-40, 40);
        var ncat = pickCategory();
        b.cat = ncat;
        b.lines = pick(SNIPPETS[ncat]);
      }
    }

    this.drawFrame(t);

    if (this.onFrame) this.onFrame(this.mx, this.my);
  };

  CodeField.prototype.drawFrame = function (t) {
    var ctx = this.ctx;
    var W = this.cw;
    var H = this.ch;
    if (!W || !H) return;

    ctx.clearRect(0, 0, W, H);

    var Zf = this.zs;
    var v = clamp((Zf - 0.42) / 2.5, 0, 1);
    var f = H * 1.15 * Zf;
    var camX = this.mx * 70 + Math.sin(t * 0.06) * 26;
    var camY = this.my * 48 + Math.cos(t * 0.05) * 18;
    var focusZ = 3300 - (3300 - 900) * v;
    var cx = W / 2;
    var cy = H / 2;

    ctx.textBaseline = 'top';

    var nodesA = [];
    var nodesB = [];
    var texts = [];

    var blocks = this.blocks;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var rel = b.z - CAM_Z;
      if (rel < 50) continue;

      var s = f / b.z;
      var pxFS = b.fs * s;
      var sx = cx + (b.x - camX) * s;
      var sy = cy + (b.y - camY) * s;

      if (sx < -170 || sx > W + 170 || sy < -100 || sy > H + 70) continue;

      if (pxFS < 9) {
        var size = clamp(pxFS * 0.26, 1.1, 2.4);
        if (b.seed < 0.12) {
          nodesB.push(sx, sy, size);
        } else {
          nodesA.push(sx, sy, size);
        }
        continue;
      }

      var fall = clamp(1 - Math.abs(b.z - focusZ) / 3000, 0.42, 1);
      var alpha = clamp(CAT_ALPHA[b.cat] * fall, 0.08, 0.3);
      if (pxFS < 17) alpha *= 0.82;

      texts.push({
        sx: sx,
        sy: sy,
        pxFS: pxFS,
        lines: b.lines,
        rel: rel,
        color: CAT_COLORS[b.cat] + alpha.toFixed(3) + ')'
      });
    }

    ctx.fillStyle = NODE_COLOR_A;
    for (var na = 0; na < nodesA.length; na += 3) {
      ctx.fillRect(nodesA[na], nodesA[na + 1], nodesA[na + 2], nodesA[na + 2]);
    }
    ctx.fillStyle = NODE_COLOR_B;
    for (var nb = 0; nb < nodesB.length; nb += 3) {
      ctx.fillRect(nodesB[nb], nodesB[nb + 1], nodesB[nb + 2], nodesB[nb + 2]);
    }

    texts.sort(function (a, b) { return b.rel - a.rel; });

    var mono = 'ui-monospace, SFMono-Regular, Consolas, "Cascadia Mono", Menlo, monospace';
    var glowBudget = 5;

    for (var ti = 0; ti < texts.length; ti++) {
      var it = texts[ti];
      var lh = it.pxFS * 1.45;
      ctx.font = '500 ' + it.pxFS.toFixed(1) + 'px ' + mono;

      var hot = glowBudget > 0 && it.rel < 1050 && it.pxFS > 30;
      if (hot) {
        glowBudget--;
        ctx.shadowColor = 'rgba(0, 229, 255, 0.45)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = 'rgba(186, 245, 255, 0.32)';
      } else {
        ctx.fillStyle = it.color;
      }

      for (var li = 0; li < it.lines.length; li++) {
        ctx.fillText(it.lines[li], it.sx, it.sy + li * lh);
      }

      if (hot) ctx.shadowBlur = 0;
    }
  };

  window.CodeField = CodeField;
})();
