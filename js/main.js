(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CONTACT_FORM_ENDPOINT = '';
  var CONTACT_EMAIL = 'contacto@javieraleon.cl';
  var DEFAULT_ZOOM = 1;

  var audioCtx = null;
  var audioMaster = null;

  function ensureAudio() {
    if (coarsePointer) return;
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        audioCtx = new AC();
        audioMaster = audioCtx.createGain();
        audioMaster.gain.value = 0.5;
        audioMaster.connect(audioCtx.destination);
      } catch (err) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
  }

  function blip(f0, f1, dur, gain, type) {
    if (!audioCtx || !audioMaster || audioCtx.state !== 'running') return;
    var t = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(audioMaster);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playKeySound() {
    if (!audioCtx || coarsePointer || reduceMotion) return;
    blip(190, 70, 0.09, 0.14, 'sine');
    blip(2300, 500, 0.035, 0.05, 'triangle');
  }

  function playTick() {
    if (!audioCtx || coarsePointer || reduceMotion) return;
    blip(1400, 900, 0.03, 0.028, 'square');
  }

  document.addEventListener('pointerdown', ensureAudio, { capture: true });
  document.addEventListener('keydown', ensureAudio, { capture: true });

  function initDockKeys() {
    $$('.key').forEach(function (key) {
      var press = function () {
        key.classList.add('pressed');
        ensureAudio();
        playKeySound();
      };
      var release = function () {
        key.classList.remove('pressed');
      };
      key.addEventListener('pointerdown', press);
      key.addEventListener('pointerup', release);
      key.addEventListener('pointerleave', release);
      key.addEventListener('pointercancel', release);
      key.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') press();
      });
      key.addEventListener('keyup', release);
      key.addEventListener('blur', release);
    });
  }

  function initKnob() {
    var knob = $('#knob');
    if (!knob) return;

    var root = document.documentElement;
    var stored = null;
    try { stored = localStorage.getItem('code-zoom'); } catch (err) {}
    if (stored === null || stored === undefined) {
      try { stored = localStorage.getItem('code-distance'); } catch (err) {}
    }
    var saved = parseFloat(stored);
    var val = isNaN(saved) ? DEFAULT_ZOOM : clamp01(saved);
    var lastTickVal = val;
    var dragging = false;
    var activePid = null;
    var lastAngle = 0;
    var startVal = 0;
    var accDelta = 0;

    function apply(silent) {
      root.style.setProperty('--kval', val.toFixed(3));
      root.style.setProperty('--krot', (-135 + val * 270).toFixed(1) + 'deg');
      knob.setAttribute('aria-valuenow', String(Math.round(val * 100)));
      knob.setAttribute('aria-valuetext', 'Zoom ' + Math.round(val * 100) + '%');
      if (window.__hero && typeof window.__hero.setZoom === 'function') {
        window.__hero.setZoom(val);
      }
      if (!silent && Math.abs(val - lastTickVal) > 0.045) {
        lastTickVal = val;
        playTick();
      }
      try {
        localStorage.setItem('code-zoom', val.toFixed(3));
      } catch (err) {}
    }

    function angleOf(e) {
      var r = knob.getBoundingClientRect();
      return Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)
      ) * 180 / Math.PI;
    }

    function stepDrag(e) {
      if (!dragging) return;
      if (activePid !== null && e.pointerId !== undefined && e.pointerId !== activePid) return;
      var a = angleOf(e);
      var delta = a - lastAngle;
      delta = ((delta + 540) % 360) - 180;
      lastAngle = a;
      accDelta += delta;
      val = clamp01(startVal + accDelta / 270);
      apply(false);
    }

    function endDrag(e) {
      if (!dragging) return;
      if (e && activePid !== null && e.pointerId !== undefined && e.pointerId !== activePid) return;
      dragging = false;
      activePid = null;
      knob.classList.remove('dragging');
      document.removeEventListener('pointermove', docMove);
      document.removeEventListener('pointerup', docUp);
      document.removeEventListener('pointercancel', docUp);
    }

    function docMove(e) { stepDrag(e); }
    function docUp(e) { endDrag(e); }

    knob.addEventListener('pointerdown', function (e) {
      ensureAudio();
      dragging = true;
      activePid = e.pointerId !== undefined ? e.pointerId : null;
      lastAngle = angleOf(e);
      startVal = val;
      accDelta = 0;
      knob.classList.add('dragging');
      try { knob.setPointerCapture(activePid); } catch (err) {}
      document.addEventListener('pointermove', docMove);
      document.addEventListener('pointerup', docUp);
      document.addEventListener('pointercancel', docUp);
      e.preventDefault();
    });

    knob.addEventListener('pointermove', stepDrag);

    ['pointerup', 'pointercancel'].forEach(function (ev) {
      knob.addEventListener(ev, endDrag);
    });
    knob.addEventListener('lostpointercapture', function () {
      endDrag(null);
    });

    knob.addEventListener('wheel', function (e) {
      e.preventDefault();
      val = clamp01(val + (e.deltaY < 0 ? 0.07 : -0.07));
      ensureAudio();
      apply(false);
    }, { passive: false });

    knob.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.15 : 0.05;
      var handled = true;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') val += step;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') val -= step;
      else if (e.key === 'Home') val = 0;
      else if (e.key === 'End') val = 1;
      else handled = false;
      if (handled) {
        e.preventDefault();
        val = clamp01(val);
        ensureAudio();
        apply(false);
      }
    });

    knob.addEventListener('dblclick', function () {
      val = DEFAULT_ZOOM;
      apply(false);
    });

    apply(true);
  }

  function initSpy() {
    var keys = $$('.key');
    var map = {};
    keys.forEach(function (k) {
      map[k.getAttribute('href').slice(1)] = k;
    });
    var sections = $$('main section[id]');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var key = map[entry.target.id];
        if (!key) return;
        keys.forEach(function (k) { k.classList.remove('is-active'); });
        key.classList.add('is-active');
      });
    }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  function initReveals() {
    var items = $$('.reveal, .skills-panel.bars');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  function initCounters() {
    var nums = $$('.stat-num');
    if (!nums.length) return;
    var animate = function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (reduceMotion) {
        el.textContent = String(target);
        return;
      }
      var dur = 1300;
      var start = performance.now();
      var step = function (now) {
        var p = Math.min(1, (now - start) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * e));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) {
      nums.forEach(animate);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { io.observe(el); });
  }

  function initCards() {
    if (!finePointer) return;
    $$('.project-card').forEach(function (card) {
      var raf = 0;
      var hover = false;
      var tx = 0, ty = 0, rx = 0, ry = 0;
      var MAXD = 4;

      var step = function () {
        rx += (tx - rx) * 0.12;
        ry += (ty - ry) * 0.12;
        card.style.setProperty('--rx', (-ry).toFixed(3) + 'deg');
        card.style.setProperty('--ry', rx.toFixed(3) + 'deg');
        if (hover || Math.abs(tx - rx) > 0.02 || Math.abs(ty - ry) > 0.02) {
          raf = requestAnimationFrame(step);
        } else {
          raf = 0;
          card.style.removeProperty('--rx');
          card.style.removeProperty('--ry');
        }
      };

      card.addEventListener('pointerenter', function () {
        hover = true;
        if (!raf) raf = requestAnimationFrame(step);
      });

      card.addEventListener('pointermove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        tx = ((x / rect.width) - 0.5) * 2 * MAXD;
        ty = ((y / rect.height) - 0.5) * 2 * MAXD;
        card.style.setProperty('--mx', x.toFixed(1) + 'px');
        card.style.setProperty('--my', y.toFixed(1) + 'px');
      }, { passive: true });

      card.addEventListener('pointerleave', function () {
        hover = false;
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(step);
      });
    });
  }

  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var dot = $('#cursorDot');
    var ring = $('#cursorRing');
    if (!dot || !ring) return;

    var mx = innerWidth / 2, my = innerHeight / 2;
    var dx = mx, dy = my, gx = mx, gy = my, sc = 1, tsc = 1;
    var started = false;

    var loop = function () {
      dx += (mx - dx) * 0.55;
      dy += (my - dy) * 0.55;
      gx += (mx - gx) * 0.16;
      gy += (my - gy) * 0.16;
      sc += (tsc - sc) * 0.15;
      dot.style.transform = 'translate(' + dx + 'px,' + dy + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + gx + 'px,' + gy + 'px) translate(-50%,-50%) scale(' + sc.toFixed(3) + ')';
      requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (!started) {
        started = true;
        requestAnimationFrame(loop);
      }
    }, { passive: true });

    document.addEventListener('pointerover', function (e) {
      var hot = e.target.closest('a, button, input, textarea, label, .project-card, .knob');
      tsc = hot ? 1.65 : 1;
      ring.classList.toggle('is-hot', !!hot);
    });
  }

  function initMagnet() {
    if (!finePointer || reduceMotion) return;
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        el.style.transform = 'translate(' + (x * 0.18).toFixed(1) + 'px,' + (y * 0.24).toFixed(1) + 'px)';
      }, { passive: true });
      el.addEventListener('pointerleave', function () {
        el.style.transform = '';
      });
    });
  }

  function initForm() {
    var form = $('#contactForm');
    var status = $('#formStatus');
    if (!form || !status) return;

    var fields = {
      name: $('#f-name'),
      email: $('#f-email'),
      message: $('#f-msg')
    };

    var setInvalid = function (input, invalid) {
      input.closest('.field').classList.toggle('invalid', invalid);
      input.setAttribute('aria-invalid', String(invalid));
    };

    Object.keys(fields).forEach(function (key) {
      fields[key].addEventListener('input', function () {
        setInvalid(fields[key], false);
      });
    });

    var validate = function () {
      var ok = true;
      if (fields.name.value.trim().length < 2) { setInvalid(fields.name, true); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) { setInvalid(fields.email, true); ok = false; }
      if (fields.message.value.trim().length < 10) { setInvalid(fields.message, true); ok = false; }
      return ok;
    };

    var mailtoFallback = function () {
      var name = encodeURIComponent(fields.name.value.trim());
      var email = encodeURIComponent(fields.email.value.trim());
      var subject = encodeURIComponent('Contacto desde el portafolio — ' + name);
      var body = encodeURIComponent(fields.message.value.trim() + '\n\n— ' + name + ' <' + email + '>');
      window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body.replace(/%0A/g, '%0D%0A');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';

      if (!validate()) {
        status.classList.add('err');
        status.textContent = 'Revisa los campos marcados.';
        return;
      }

      if (CONTACT_FORM_ENDPOINT) {
        status.textContent = 'Enviando…';
        var fd = new FormData(form);
        fetch(CONTACT_FORM_ENDPOINT, {
          method: 'POST',
          body: fd,
          headers: { Accept: 'application/json' }
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          status.classList.add('ok');
          status.textContent = '¡Mensaje enviado! Te responderé muy pronto.';
          form.reset();
        }).catch(function () {
          mailtoFallback();
          status.classList.add('ok');
          status.textContent = 'No se pudo enviar por red; se abrió tu cliente de correo con el mensaje listo.';
        });
      } else {
        mailtoFallback();
        status.classList.add('ok');
        status.textContent = 'Se abrió tu cliente de correo con el mensaje listo para enviar.';
      }
    });
  }

  function readSavedZoom() {
    try {
      var v = localStorage.getItem('code-zoom');
      if (v === null || v === undefined) v = localStorage.getItem('code-distance');
      var n = parseFloat(v);
      return isNaN(n) ? null : clamp01(n);
    } catch (err) {
      return null;
    }
  }

  function initCodeField() {
    var canvas = $('#heroCanvas');
    if (!canvas || typeof window.CodeField !== 'function') return;
    var hero = $('#inicio');
    var saved = readSavedZoom();
    var zoom = saved === null ? DEFAULT_ZOOM : saved;
    window.__hero = new window.CodeField(canvas, {
      zoom: zoom,
      onFrame: finePointer && !reduceMotion
        ? function (x, y) {
            hero.style.setProperty('--px', x.toFixed(3));
            hero.style.setProperty('--py', y.toFixed(3));
          }
        : null
    });
  }

  function initYear() {
    var el = $('#year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function safeCall(fn) {
    try {
      fn();
    } catch (err) {}
  }

  safeCall(initDockKeys);
  safeCall(initCodeField);
  safeCall(initKnob);
  safeCall(initSpy);
  safeCall(initReveals);
  safeCall(initCounters);
  safeCall(initCards);
  safeCall(initCursor);
  safeCall(initMagnet);
  safeCall(initForm);
  safeCall(initYear);
})();
