/* =========================================================================
   reactbits.js — Composants de l'accueil LDC, en vanilla, partagés par les
   trois coupes (inspirés de ReactBits / Uiverse, réécrits sans React) :
   - starfield(canvas)            Particles : étoiles qui dérivent en fond
   - heroLetters(el, parts)       titre géant, lettres qui se dressent une à une
   - countUp(node, n)             nombre qui défile jusqu'à sa valeur
   - countUpAll(root)             idem pour tous les [data-count] d'un bloc
   - confetti.goal(side, hex)     salve de confettis à chaque but
   - confetti.champion()          pluie de confettis (vainqueur)
   Les styles vont avec reactbits.css. Tout respecte prefers-reduced-motion.
   API : window.RB
   ========================================================================= */
(function (global) {
  'use strict';
  var reduce = false;
  try { reduce = global.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}

  /* ---- Particles : étoiles dérivantes (fond fixe, sous le contenu) ---- */
  function starfield(c) {
    if (typeof c === 'string') c = document.getElementById(c);
    if (!c || !c.getContext || c._rb) return; c._rb = true;
    var ctx = c.getContext('2d'), stars = [], W = 0, H = 0;
    function build() { stars = []; var n = Math.min(150, Math.floor(W * H / 11000)); for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, vy: 0.05 + Math.random() * 0.22, tw: Math.random() * 6.28 }); }
    function resize() { var dpr = Math.min(2, global.devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); build(); if (reduce) draw(); }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) { var s = stars[i], a = Math.max(0, 0.16 + 0.28 * Math.sin(s.tw)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fillStyle = 'rgba(150,170,210,' + a.toFixed(2) + ')'; ctx.fill(); }
    }
    function loop() {
      if (document.visibilityState === 'hidden') { setTimeout(function () { requestAnimationFrame(loop); }, 600); return; }
      for (var i = 0; i < stars.length; i++) { var s = stars[i]; s.y += s.vy; s.tw += 0.03; if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; } }
      draw(); requestAnimationFrame(loop);
    }
    global.addEventListener('resize', resize); resize();
    if (!reduce) requestAnimationFrame(loop);
  }

  /* ---- Titre : lettres qui se dressent (parts : [{ t:'EUROPA' }, { t:'LEAGUE', c:'gold', gap:true }]) ---- */
  function heroLetters(el, parts) {
    if (!el) return; el.innerHTML = '';
    var i = 0;
    parts.forEach(function (p) {
      var word = document.createElement('span'); word.className = 'rb-word' + (p.gap ? ' gap' : '');
      p.t.split('').forEach(function (ch) {
        var l = document.createElement('span');
        l.className = 'rb-letter' + (p.c ? ' ' + p.c : '');
        l.textContent = ch === ' ' ? ' ' : ch;
        l.style.animationDelay = (i * 0.04) + 's'; i++;
        word.appendChild(l);
      });
      el.appendChild(word);
    });
    el.setAttribute('aria-label', parts.map(function (p) { return p.t; }).join(' '));
  }

  /* ---- CountUp ---- */
  function countUp(node, target) {
    target = +target || 0;
    if (reduce) { node.textContent = target; return; }
    var dur = 1100, t0 = null;
    function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3); node.textContent = Math.floor(target * e); if (p < 1) requestAnimationFrame(step); else node.textContent = target; }
    requestAnimationFrame(step);
    setTimeout(function () { node.textContent = target; }, dur + 400);   // filet (onglet masqué)
  }
  function countUpAll(root) { Array.prototype.forEach.call((root || document).querySelectorAll('[data-count]'), function (n) { countUp(n, parseInt(n.getAttribute('data-count'), 10)); }); }

  /* ---- Confettis ---- */
  var confetti = (function () {
    var canvas = null, ctx = null, parts = [], running = false, W = 0, H = 0, lastFrame = 0;
    function ensure() {
      if (canvas) return true;
      if (reduce || !document.body) return false;
      canvas = document.getElementById('confetti-canvas');
      if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'confetti-canvas'; canvas.className = 'rb-confetti'; canvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(canvas); }
      ctx = canvas.getContext('2d');
      setInterval(function () { if (parts.length && Date.now() - lastFrame > 1200) reset(); }, 1500);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') reset(); });
      global.addEventListener('pagehide', reset);
      return true;
    }
    function resize() { var dpr = global.devicePixelRatio || 1; W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function reset() { parts = []; running = false; try { ctx.clearRect(0, 0, W, H); } catch (e) {} }
    function loop() {
      lastFrame = Date.now(); ctx.clearRect(0, 0, W, H);
      for (var k = 0; k < parts.length; k++) { var p = parts[k]; p.vy += 0.16; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.life < 40 ? Math.max(0, p.life / 40) : 1; ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
      parts = parts.filter(function (p) { return p.life > 0 && p.y < H + 80; });
      if (parts.length) requestAnimationFrame(loop); else { running = false; ctx.clearRect(0, 0, W, H); }
    }
    function emit(x, y, n, colors, o) {
      o = o || {}; var angle = o.angle == null ? -Math.PI / 2 : o.angle, spread = o.spread == null ? Math.PI / 2 : o.spread, power = o.power || 14, life = o.life || 130;
      for (var i = 0; i < n; i++) { var a = angle + (Math.random() - 0.5) * spread, sp = power * (0.5 + Math.random()); parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35, color: colors[(Math.random() * colors.length) | 0], life: life + Math.random() * 50 }); }
      if (!running) { running = true; lastFrame = Date.now(); requestAnimationFrame(loop); }
    }
    function accent() { var v = ''; try { v = getComputedStyle(document.documentElement).getPropertyValue('--gold-rgb').trim(); } catch (e) {} return /^\d/.test(v) ? 'rgb(' + v + ')' : '#f5b50a'; }
    function teamColors(hex) { var c = hex ? (hex[0] === '#' ? hex : '#' + hex) : accent(); return [c, c, accent(), '#ffffff', '#3b7bff']; }
    return {
      goal: function (side, hex) {
        if (!ensure()) return; resize(); var c = teamColors(hex);
        if (side === 'home') emit(W * 0.10, H * 0.62, 70, c, { angle: -Math.PI / 3, spread: Math.PI / 2.4, power: 17 });
        else if (side === 'away') emit(W * 0.90, H * 0.62, 70, c, { angle: -Math.PI * 2 / 3, spread: Math.PI / 2.4, power: 17 });
        else emit(W / 2, H * 0.5, 80, c, { angle: -Math.PI / 2, spread: Math.PI, power: 14 });
      },
      champion: function () {
        if (!ensure()) return; resize(); var c = [accent(), '#ff4757', '#2ed573', '#3b7bff', '#fff', '#a55eea'];
        emit(W * 0.5, -20, 200, c, { angle: Math.PI / 2, spread: Math.PI / 2.5, power: 6, life: 200 });
        emit(W * 0.14, H * 0.6, 60, c, { angle: -Math.PI / 3, spread: Math.PI / 3, power: 18 });
        emit(W * 0.86, H * 0.6, 60, c, { angle: -Math.PI * 2 / 3, spread: Math.PI / 3, power: 18 });
      }
    };
  })();

  global.RB = { starfield: starfield, heroLetters: heroLetters, countUp: countUp, countUpAll: countUpAll, confetti: confetti, reduce: reduce };
  /* <canvas id="starfield" data-rb> : fond étoilé automatique (les pages qui
     animent déjà leur propre canvas — classement, palmarès — n'ont pas data-rb). */
  function auto() { var c = document.getElementById('starfield'); if (c && c.hasAttribute('data-rb')) starfield(c); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})(window);
