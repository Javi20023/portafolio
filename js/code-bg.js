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
      ['color: #39FF88;'],
      ['backdrop-filter: blur(12px);'],
      ['transform: translateZ(0);'],
     ['@media (width < 768px) {'],
      ['--glow: 0.75;'],
      ['transition: transform .3s ease;'],
      ['box-shadow: 0 0 24px #39ff8838;']
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
    js: 'rgba(163, 230, 53, ',
    css: 'rgba(57, 255, 136, ',
    gl: 'rgba(134, 239, 172, ',
    sh: 'rgba(196, 146, 82, '
  };

  var CAT_ALPHA = { js: 0.21, css: 0.24, gl: 0.19, sh: 0.28 };

  var CAT_WEIGHTS = [
    ['js', 0.38],
    ['css', 0.27],
    ['gl', 0.2],
    ['sh', 0.15]
  ];

  var NODE_COLOR_A = 'rgba(21, 68, 38, 0.20)';
  var NODE_COLOR_B = 'rgba(57, 255, 136, 0.26)';

  var SYCAMORE_TRUNK_COLOR = '133, 94, 46';
  var SYCAMORE_BRANCH_COLOR = '57, 255, 136';
  var SYCAMORE_ROOT_COLOR = '94, 62, 30';

  var TREE_GLYPHS = ['{', '}', '[', ']', '=>', '=', ';', '()', '+', '*', '/', '<', '>', '//', '#', '|', '&&', '…'];

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildSycamore() {
    var rng = mulberry32(0x9E3779B9);
    var branches = [];
    var slots = [];

    function branch(x, y, ang, len, w, depth, kind) {
      var n = 5;
      var pts = [];
      var ws = [];
      var cx = x, cy = y, ca = ang;
      for (var i = 0; i <= n; i++) {
        pts.push({ x: cx, y: cy });
        var t = i / n;
        ws.push(w * (1 - 0.52 * t));
        ca += (rng() - 0.5) * 0.18 + (rng() - 0.5) * 0.06 * Math.sin(t * Math.PI);
        cx += Math.cos(ca) * (len / n);
        cy += Math.sin(ca) * (len / n);
      }
      branches.push({ pts: pts, ws: ws, kind: kind });

      if (depth <= 4) {
        var kids = rng() < 0.5 ? 3 : 2;
        if (depth >= 3) kids = rng() < 0.55 ? 2 : 1;
        if (depth === 4) kids = rng() < 0.4 ? 1 : 0;
        for (var k2 = 0; k2 < kids; k2++) {
          var spread = (k2 - (kids - 1) / 2) * (0.4 + rng() * 0.34);
          var a2 = ca + spread + (rng() - 0.5) * 0.22;
          branch(cx, cy, a2, len * (0.5 + rng() * 0.24), w * 0.6, depth + 1, kind === 'root' ? 'root' : 'branch');
        }
      }
    }

    branch(0.5, 0.012, Math.PI / 2, 0.42, 0.082, 0, 'trunk');

    for (var r2 = 0; r2 < 10; r2++) {
      var side = r2 < 5 ? -1 : 1;
      var off = 0.1 + (r2 % 5) * 0.045 + rng() * 0.05;
      var ang = side < 0 ? Math.PI + off : -off;
      var cx = 0.5, cy = 0.012, ca = ang;
      var n = 5;
      var pts = [];
      var ws = [];
      for (var i = 0; i <= n; i++) {
        pts.push({ x: cx, y: cy });
        var t = i / n;
        ws.push((0.05 - (r2 % 5) * 0.005) * (1 - 0.52 * t));
        ca += (rng() - 0.5) * 0.1;
        cx += Math.cos(ca) * ((0.15 + rng() * 0.09) / n);
        cy += Math.sin(ca) * ((0.15 + rng() * 0.09) / n);
      }
      branches.push({ pts: pts, ws: ws, kind: 'root' });
    }

    for (var b = 0; b < branches.length; b++) {
      var pts = branches[b].pts;
      var ws = branches[b].ws;
      var targetLen = 0;
      for (var pi = 0; pi < pts.length - 1; pi++) {
        var ddx = pts[pi + 1].x - pts[pi].x;
        var ddy = pts[pi + 1].y - pts[pi].y;
        targetLen += Math.sqrt(ddx * ddx + ddy * ddy);
      }
      var steps = Math.max(4, Math.round(targetLen / 0.012));
      for (var st = 0; st < steps; st++) {
        var s = st / steps;
        var segIdx = Math.min(pts.length - 2, Math.floor(s * (pts.length - 1)));
        var tf = (s * (pts.length - 1)) - segIdx;
        var p0 = pts[segIdx];
        var p1 = pts[segIdx + 1];
        slots.push({
          x: p0.x + (p1.x - p0.x) * tf,
          y: p0.y + (p1.y - p0.y) * tf,
          w: ws[segIdx] + (ws[segIdx + 1] - ws[segIdx]) * tf,
          dx: (p1.x - p0.x),
          dy: (p1.y - p0.y),
          glyph: (st % 11 === 5),
          kind: branches[b].kind
        });
      }
    }

    return { branches: branches, slots: slots };
  }

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

  // Fase del morphing según el valor normalizado t (0 = código, 1 = sicomoro):
  //   0.00–0.20  → solo escala del editor (mantiene la estructura de código).
  //   0.20–0.80  → transformación: cada bloque de código interpola su posición
  //                hacia un punto sobre una rama/raíz del sicomoro (morph 0→1).
  //   0.80–1.00  → solidificación: el árbol se dibuja completo (morph pisa 1) y
  //                se intensifica el resplandor verde.
  function morphAmount(t) {
    if (t <= 0.2) return 0;
    if (t >= 0.8) return 1;
    var u = (t - 0.2) / 0.6;
    return u * u * (3 - 2 * u);
  }

  // Intensidad del "glow" final: arranca en la frontera 0.7 y alcanza 1 al 100%.
  function solidify(t) {
    var u = clamp((t - 0.7) / 0.3, 0, 1);
    return u * u * (3 - 2 * u);
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

    this.tree = 1 - this.zoom;
    this.sycamore = null;

    this.blocks = [];
    this.inView = true;
    this.hidden = document.hidden;
    this.rafId = 0;
    this.prevT = 0;

    this.buildSycamoreData();
    this.buildField();
    this.assignTreeSlots();
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

  CodeField.prototype.buildSycamoreData = function () {
    var data = buildSycamore();
    this.sycamore = data;
    this.sycamoreSlotCount = data.slots.length;
  };

  CodeField.prototype.assignTreeSlots = function () {
    var slots = this.sycamore ? this.sycamore.slots : null;
    if (!slots || !slots.length) return;
    var n = slots.length;
    for (var i = 0; i < this.blocks.length; i++) {
      var b = this.blocks[i];
      var idx = Math.floor(b.seed * n) % n;
      b.treeSlot = idx;
      b.treeJit = (Math.sin(b.seed * 9830.5) * 43758.5453) % 1;
      if (b.treeJit < 0) b.treeJit = 1 - b.treeJit;
    }
  };

  CodeField.prototype.setZoom = function (v) {
    this.targetZoom = clamp(v, 0, 1);
    if (this.reduceMotion) {
      this.zoom = this.targetZoom;
      this.zs = 0.42 + this.zoom * 2.5;
      this.tree = 1 - this.zoom;
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

    var treeTgt = 1 - (this.zoom - 0) / 1;
    var tk = 1 - Math.exp(-dt * 2.6);
    this.tree += (treeTgt - this.tree) * tk;
    this.tree = clamp(this.tree, 0, 1);

    if (this.isCoarse && t - this.lastGyro > 3) {
      this.mxT = Math.sin(t * 0.1) * 0.32;
      this.myT = Math.cos(t * 0.14) * 0.22;
    }

    var km = 1 - Math.exp(-dt * 3.2);
    this.mx += (this.mxT - this.mx) * km;
    this.my += (this.myT - this.my) * km;

    var freeze = this.tree * this.tree * (3 - 2 * this.tree);
    var speed = 44 * (0.55 + this.zs * 0.5) * (1 - freeze * 0.985);
    var blocks = this.blocks;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      b.z -= speed * dt;
      if (this.tree < 0.999 && b.z < CAM_Z + 70) {
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

    var treeF = clamp(this.tree, 0, 1);
    var sycamore = this.sycamore;
    var treeOK = treeF > 0.001 && !!sycamore && sycamore.slots.length > 0;
    // Progreso interpolado faseadeado: 0 hasta que t=0.2, 0→1 entre 0.2 y 0.8,
    // y clavado en 1 desde 0.8 (fase de solidificación).
    var tf = morphAmount(treeF);
    var sol = solidify(treeF);
    var SC = H * 0.62;
    var baseY = H * 0.94;

    if (treeF > 0.02 && sycamore && sycamore.branches.length) {
      this.drawTreeStrokes(ctx, W, H, treeF, SC, baseY, sol);
    }

    var nodesCat = {};
    var nodesA = [];
    var nodesB = [];
    var texts = [];

    var blocks = this.blocks;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var rel = b.z - CAM_Z;
      if (treeF > 0.5) {
        rel = 600 + (b.treeJit * 700);
      } else if (rel < 50) {
        continue;
      }

      var s = f / b.z;
      var pxFS = b.fs * s;
      var sx = cx + (b.x - camX) * s;
      var sy = cy + (b.y - camY) * s;
      var slot = null;

      if (treeOK) {
        slot = sycamore.slots[b.treeSlot % sycamore.slots.length];
        var ln = Math.sqrt(slot.dx * slot.dx + slot.dy * slot.dy) || 0.001;
        var pxn = -slot.dy / ln;
        var pyn = slot.dx / ln;
        var jit = (b.treeJit - 0.5) * slot.w * SC * 2.4;
        var basePx = cx + (slot.x - 0.5) * SC;
        var basePy = baseY - slot.y * SC;
        sx = sx + (basePx + pxn * jit - sx) * tf;
        sy = sy + (basePy + pyn * jit - sy) * tf;
        var treeFS = slot.glyph ? (12 + slot.w * 60) : (6 + slot.w * 26);
        pxFS = pxFS + (treeFS - pxFS) * tf;
      }

      if (sx < -170 || sx > W + 170 || sy < -100 || sy > H + 70) continue;

      if (pxFS < 9) {
        if (treeF > 0.25 && slot) {
          var size = clamp(1.5 + slot.w * 60, 1.6, 4.6);
          if (!nodesCat[b.cat]) nodesCat[b.cat] = [];
          nodesCat[b.cat].push(sx, sy, size);
        } else if (b.seed < 0.12) {
          nodesB.push(sx, sy, clamp(pxFS * 0.26, 1.1, 2.4));
        } else {
          nodesA.push(sx, sy, clamp(pxFS * 0.26, 1.1, 2.4));
        }
        continue;
      }

      var fall = clamp(1 - Math.abs(b.z - focusZ) / 3000, 0.42, 1);
      var alpha = clamp(CAT_ALPHA[b.cat] * fall, 0.08, 0.3);
      if (pxFS < 17) alpha *= 0.82;
      if (treeF > 0.3) alpha = Math.min(0.32, alpha * 1.35);

      texts.push({
        sx: sx,
        sy: sy,
        pxFS: pxFS,
        lines: treeF > 0.3 ? b.lines.slice(0, 1) : b.lines,
        rel: rel,
        color: CAT_COLORS[b.cat] + alpha.toFixed(3) + ')'
      });
    }

    for (var cat in nodesCat) {
      var catArr = nodesCat[cat];
      var catBase = CAT_COLORS[cat];
      ctx.fillStyle = catBase + (0.34 + 0.16 * sol) + ')';
      for (var cni = 0; cni < catArr.length; cni += 3) {
        ctx.fillRect(catArr[cni], catArr[cni + 1], catArr[cni + 2], catArr[cni + 2]);
      }
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
    var glowBudget = 5 + Math.round(sol * 18);

    for (var ti = 0; ti < texts.length; ti++) {
      var it = texts[ti];
      var lh = it.pxFS * 1.45;
      ctx.font = '500 ' + it.pxFS.toFixed(1) + 'px ' + mono;

      var hot = glowBudget > 0 && (it.rel < 1050 && it.pxFS > 30 || sol > 0.05 && it.pxFS > 14);
      if (hot) {
        glowBudget--;
        ctx.shadowColor = 'rgba(57, 255, 136, 0.45)';
        ctx.shadowBlur = 12 + sol * 12;
        ctx.fillStyle = 'rgba(214, 255, 228, 0.32)';
      } else {
        ctx.fillStyle = it.color;
      }

      for (var li = 0; li < it.lines.length; li++) {
        ctx.fillText(it.lines[li], it.sx, it.sy + li * lh);
      }

      if (hot) ctx.shadowBlur = 0;
    }
  };

  CodeField.prototype.drawTreeStrokes = function (ctx, W, H, k, SC, baseY, sol) {
    var cx = W / 2;
    // Las ramas raíz/tronco se "solidifican" en la fase final (80-100%) con más alpha.
    var a = clamp(k * 0.32, 0.02, 0.32) * (1 + sol * 0.6);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var branches = this.sycamore.branches;
    for (var bi = 0; bi < branches.length; bi++) {
      var br = branches[bi];
      if (br.kind === 'trunk') {
        ctx.strokeStyle = 'rgba(' + SYCAMORE_TRUNK_COLOR + ', ' + a.toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, br.ws[0] * SC * 2.2);
      } else if (br.kind === 'root') {
        ctx.strokeStyle = 'rgba(' + SYCAMORE_ROOT_COLOR + ', ' + (a * 1.15).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.8, br.ws[0] * SC * 1.6);
      } else {
        ctx.strokeStyle = 'rgba(' + SYCAMORE_BRANCH_COLOR + ', ' + (a * 0.9).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.6, (br.ws[0] + br.ws[br.ws.length - 1]) / 2 * SC * 1.5);
      }
      ctx.beginPath();
      ctx.moveTo(cx + (br.pts[0].x - 0.5) * SC, baseY - br.pts[0].y * SC);
      for (var pi = 1; pi < br.pts.length; pi++) {
        var px = cx + (br.pts[pi].x - 0.5) * SC;
        var py = baseY - br.pts[pi].y * SC;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  };

  window.CodeField = CodeField;
})();
