/* =========================================================================
   footer.js — Pied de page commun : rendu, prochain match RÉEL, animations
   -------------------------------------------------------------------------
   Amélioration progressive : chaque page garde son <footer id="ldc-footer">
   minimal, qui porte la mention légale. Ce script le remplace par le pied de
   page complet ; sans JavaScript, la mention légale reste affichée.

   Dépend de : i18n.js (I18N), espn.js (ESPN), schedule.js (LDCSchedule).
   ========================================================================= */
(function () {
  'use strict';

  var host = document.getElementById('ldc-footer');
  if (!host || !window.I18N || !window.ESPN || !window.LDCSchedule) return;

  var CACHE_KEY = 'ldc_next_v1';
  /* ESPN met une minute ou deux à passer un match « en cours » : pendant ce
     laps, le match reste « imminent » au lieu de faire sauter le compte à
     rebours au match suivant. */
  var GRACE = 15 * 60000;

  var reduceMotion = false;
  try { reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  var state = { data: null, near: false, started: false, loading: false };

  /* Les titres du footer sont en Bebas Neue. Le tableau de bord la charge, pas
     toutes les pages : sans ce garde-fou, le footer changeait de typographie
     d'une page à l'autre (constaté en capture sur legal.html). */
  (function ensureDisplayFont() {
    var links = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
    for (var i = 0; i < links.length; i++) {
      if (/Bebas\+Neue/.test(links[i].getAttribute('href') || '')) return;
    }
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap';
    document.head.appendChild(l);
  })();

  function t(key, fallback) { var v = I18N.t(key); return v == null ? (fallback == null ? key : fallback) : v; }
  function isEn() { return !!(I18N.getLang && I18N.getLang() === 'en'); }
  function locale() { return isEn() ? 'en-GB' : 'fr-FR'; }
  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* -----------------------------------------------------------------------
     Plan du site. Uniquement des pages et sections qui EXISTENT : pas de lien
     « # » ni de fonctionnalité imaginaire (« chances de qualification » n'a
     jamais existé dans le projet).
     [clé i18n, lien, texte de repli FR, marqueur optionnel]
     ----------------------------------------------------------------------- */
  var COLUMNS = [
    { key: 'foot.competition', fr: 'Compétition', items: [
      ['nav.tracker', 'tracker.html', 'Classement'],
      ['foot.simulator', 'dashboard.html#zones', 'Simulateur What-If'],
      ['foot.fullSchedule', 'calendrier.html', 'Calendrier complet'],
      ['foot.draw', 'calendrier.html#draw-results', 'Tirage de la phase de ligue', 'draw']
    ] },
    { key: 'foot.stats', fr: 'Statistiques', items: [
      ['foot.scorers', 'dashboard.html#widgets', 'Buteurs, passeurs, murailles'],
      ['foot.knockout', 'tracker.html#bracketCards', 'Phase finale'],
      ['nav.palmares', 'palmares.html', 'Palmarès']
    ] },
    { key: 'foot.more', fr: 'Et aussi', items: [
      ['nav.myclub', 'monclub.html', 'Mon club'],
      ['nav.game', 'jeu.html', 'Jeu'],
      ['nav.overlay', 'overlay.html', 'Overlay OBS']
    ] }
  ];

  function currentPage() {
    var p = (location.pathname.split('/').pop() || '').toLowerCase();
    return p || 'dashboard.html';                     // « / » est réécrit vers le tableau de bord
  }

  function linkHTML(item) {
    var href = item[1];
    var current = href.indexOf('#') === -1 && href === currentPage();
    return '<li><a href="' + href + '" data-i18n="' + item[0] + '"' +
      (current ? ' aria-current="page"' : '') + (item[3] ? ' data-ft="' + item[3] + '"' : '') + '>' +
      esc(item[2]) + '</a></li>';
  }

  function markup() {
    var cols = COLUMNS.map(function (c) {
      return '<div class="ft-col"><h2 data-i18n="' + c.key + '">' + esc(c.fr) + '</h2><ul>' + c.items.map(linkHTML).join('') + '</ul></div>';
    }).join('');

    return '' +
      '<div class="ft-goo" aria-hidden="true"><div class="ft-goo-layer"></div></div>' +
      '<div class="ft-body">' +
        '<div class="ft-grid">' +
          '<div class="ft-brand">' +
            '<div class="ft-brand-top">' +
              '<div class="ft-mark" aria-hidden="true">' +
                '<img src="favicon.svg" alt="" width="40" height="40" decoding="async">' +
                '<svg viewBox="0 0 100 100" focusable="false"><circle class="ft-ring" cx="50" cy="50" r="46"/></svg>' +
              '</div>' +
              '<div class="ft-brand-text">' +
                '<p class="ft-name" data-i18n="app.title">Tracker Ligue des Champions</p>' +
                '<p class="ft-tagline" data-i18n="foot.tagline">Format ligue unique, 36 équipes engagées, huit journées avant le couperet. Tout le parcours, un seul endroit.</p>' +
              '</div>' +
            '</div>' +
            '<a class="ft-next" id="ldcFtNext" href="dashboard.html" hidden>' +
              '<span class="ft-slot"><span class="ft-label" id="ldcFtL1"></span><span class="ft-value" id="ldcFtV1"></span></span>' +
              '<span class="ft-divider" aria-hidden="true"></span>' +
              '<span class="ft-slot"><span class="ft-label" id="ldcFtL2"></span><span class="ft-value ft-value-sm" id="ldcFtV2"></span></span>' +
            '</a>' +
          '</div>' +
          '<nav class="ft-nav" aria-label="Plan du site" data-i18n-aria-label="foot.navLabel">' + cols + '</nav>' +
        '</div>' +
        '<div class="ft-bottom">' +
          '<span class="ft-copy" id="ldcFtCopy"></span>' +
          '<span class="ft-marks" aria-hidden="true"><span></span><span></span><span></span></span>' +
          '<a class="ft-legal" href="legal.html" data-i18n="foot.notAffiliated">Non affilié à l’UEFA</a>' +
        '</div>' +
        '<p class="ft-disclaimer" data-i18n-html="foot.disclaimer">Projet indépendant réalisé par un fan — <strong>non affilié à l’UEFA</strong>. Scores fournis par ESPN (source non officielle), à titre indicatif.</p>' +
      '</div>' +
      '<svg class="ft-defs" aria-hidden="true" focusable="false"><defs>' +
        /* sRGB : en linearRGB (défaut SVG), le seuil appliqué au flou produit un
           liseré rosé autour des gouttes. */
        '<filter id="ldc-goo" color-interpolation-filters="sRGB">' +
          '<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>' +
          '<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo"/>' +
        '</filter>' +
      '</defs></svg>';
  }

  /* Textes qui ne passent pas par data-i18n. */
  function fillStatic() {
    var copy = byId('ldcFtCopy');
    if (copy) copy.textContent = '© ' + new Date().getFullYear() + ' · ' + t('app.title', 'Tracker Ligue des Champions');
    /* Le tirage n'a de sens que pour la saison en cours. */
    var draw = host.querySelector('[data-ft="draw"]');
    if (draw) draw.parentNode.hidden = !!ESPN.isArchive();
  }

  /* -----------------------------------------------------------------------
     Prochain match : calculé sur le calendrier réel de la saison.
     Le modèle d'origine supposait « mardi ou mercredi, 21 h » : le 11/09/2026
     il annonçait J-4, alors que la J2 commence le 13/10 à 18 h 45.
     ----------------------------------------------------------------------- */
  function roundInfo(match, all) {
    if (match.round !== 'league') return { roundKey: match.round || null, md: null };
    var groups = ESPN.clusterMatchdays(all.filter(function (m) { return m.round === 'league'; }));
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].some(function (m) { return m.id === match.id; })) return { roundKey: 'league', md: i + 1 };
    }
    return { roundKey: 'league', md: null };
  }

  function compute(events) {
    var all = (events || []).map(ESPN.normalizeEvent).filter(function (m) { return m && m.round !== 'qualifying'; });
    var live = LDCSchedule.getLiveMatches(all);
    if (live.length) return { kind: 'live', count: live.length };
    var next = LDCSchedule.getNextKickoff(all, new Date(), { graceMs: GRACE });
    if (!next) return { kind: all.length ? 'over' : 'none' };
    var r = roundInfo(next.match, all);
    return { kind: 'next', time: next.time, dayKey: next.dayKey, dayCount: next.sameDay.length, roundKey: r.roundKey, md: r.md };
  }

  /* Cache local : la plupart des pages n'ont pas besoin de télécharger toute la
     saison pour un compte à rebours. Durée de validité selon la situation. */
  function readCache() {
    try {
      var o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return (o && o.v === 1 && o.season === ESPN.seasonStartYear()) ? o : null;
    } catch (e) { return null; }
  }
  function writeCache(o) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(o)); } catch (e) {} }
  function isFresh(o) {
    if (!o) return false;
    var now = Date.now(), age = now - o.at;
    if (o.kind === 'live') return age < 60000;                                  // direct : 1 min
    if (o.kind === 'next') return age < 10 * 60000 && now < o.time - 2 * 60000; // et jamais à l'approche du coup d'envoi
    return age < 6 * 3600000;                                                    // fin de saison : 6 h
  }

  function load(force) {
    if (ESPN.isArchive()) { state.data = { kind: 'archive' }; renderNext(); return; }
    var cached = readCache();
    if (cached) {
      state.data = cached; renderNext();                 // affichage immédiat du dernier état connu
      if (!force && isFresh(cached)) return;
    }
    if (state.loading) return;
    state.loading = true;
    ESPN.fetchSeasonEvents().then(function (events) {
      var d = compute(events);
      d.v = 1; d.at = Date.now(); d.season = ESPN.seasonStartYear();
      writeCache(d);
      state.data = d; renderNext();
    }).catch(function () {
      if (!state.data) { state.data = { kind: 'none' }; renderNext(); }  // hors ligne : on masque, on n'invente pas
    }).then(function () { state.loading = false; });
  }

  /* FR : « J-32 · 17h05 ». EN : « 32d · 17h 05m » — en anglais « 17h05 » se
     lit comme une heure de la journée, pas comme une durée. */
  function countdownText(ms) {
    var p = LDCSchedule.countdownParts(ms), mm = (p.minutes < 10 ? '0' : '') + p.minutes;
    if (isEn()) {
      if (p.days > 0) return p.days + 'd · ' + p.hours + 'h ' + mm + 'm';
      if (p.hours > 0) return p.hours + 'h ' + mm + 'm';
      return p.minutes + ' min';
    }
    if (p.days > 0) return 'J-' + p.days + ' · ' + p.hours + 'h' + mm;
    if (p.hours > 0) return p.hours + 'h' + mm;
    return p.minutes + ' min';
  }
  function plural(n, fr, frPl, en, enPl) { return n + ' ' + (isEn() ? (n > 1 ? enPl : en) : (n > 1 ? frPl : fr)); }

  function renderNext() {
    var a = byId('ldcFtNext'); if (!a) return;
    var L1 = byId('ldcFtL1'), V1 = byId('ldcFtV1'), L2 = byId('ldcFtL2'), V2 = byId('ldcFtV2');
    var d = state.data, now = Date.now();
    a.classList.remove('is-live');
    a.removeAttribute('aria-label');

    if (!d || d.kind === 'none' || d.kind === 'archive' || (d.kind === 'next' && now > d.time + GRACE)) {
      a.hidden = true;
      return;
    }
    a.hidden = false;

    if (d.kind === 'live') {
      a.classList.add('is-live');
      a.href = 'dashboard.html#live-section';
      L1.innerHTML = '<span class="ft-live-dot" aria-hidden="true"></span>' + esc(t('common.live', 'EN DIRECT'));
      V1.textContent = plural(d.count, 'match', 'matchs', 'match', 'matches');
      L2.textContent = t('tnav.today', 'Aujourd’hui');
      V2.textContent = t('foot.watchLive', 'Suivre le direct') + ' ›';
      return;
    }

    if (d.kind === 'over') {
      a.href = 'palmares.html';
      L1.textContent = t('season.label', 'Saison') + ' ' + ESPN.seasonLabel();
      V1.textContent = t('foot.seasonOver', 'Saison terminée');
      L2.textContent = t('foot.see', 'Voir');
      V2.textContent = t('nav.palmares', 'Palmarès') + ' ›';
      return;
    }

    var kick = new Date(d.time), ms = d.time - now;
    /* Match du jour : la vue « Aujourd'hui » le montre. Sinon l'onglet
       « À venir » du tableau de bord ouvre directement cette journée. */
    a.href = d.dayKey === LDCSchedule.localDayKey(now) ? 'dashboard.html#live-section' : 'dashboard.html#a-venir';
    L1.textContent = t('foot.nextMatch', 'Prochain match');
    V1.textContent = ms > 0 ? countdownText(ms) : t('foot.imminent', 'Imminent');
    L2.textContent = (d.roundKey === 'league' && d.md) ? t('foot.matchday', 'Journée') + ' ' + d.md
                   : (d.roundKey && d.roundKey !== 'league') ? t('trk.round.' + d.roundKey, d.roundKey)
                   : t('foot.kickoff', 'Coup d’envoi');
    var dayTxt = kick.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
    var timeTxt = kick.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    V2.innerHTML = '<time datetime="' + kick.toISOString() + '">' + esc(dayTxt + ' · ' + timeTxt) + '</time>';
    a.setAttribute('aria-label', t('foot.nextMatch', 'Prochain match') + ' : ' + L2.textContent + ', ' +
      kick.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }) + ' ' + timeTxt +
      ' (' + V1.textContent + ')');
  }

  /* -----------------------------------------------------------------------
     Animations : générées une seule fois, à l'approche du footer, et jamais
     si l'utilisateur a demandé à réduire les animations.
     ----------------------------------------------------------------------- */
  function setVars(el, vars) { for (var k in vars) el.style.setProperty(k, vars[k]); }

  function spawnParticles() {
    if (reduceMotion) return;
    var goo = host.querySelector('.ft-goo'), layer = host.querySelector('.ft-goo-layer');
    if (!goo || !layer) return;
    var i, frag = document.createDocumentFragment(), DROPS = 7, SPARKS = 14;
    for (i = 0; i < DROPS; i++) {
      var d = document.createElement('span'), dur = 3.6 + Math.random() * 2.2;
      d.className = 'ft-drop';
      setVars(d, {
        '--d': (1.8 + Math.random()) + 'rem',
        /* Position voulue à l'écran (7 % à 93 %), convertie dans la couche qui
           mesure 120 % de large et commence à -10 %. */
        '--x': (100 / 12 + (7 + (i / (DROPS - 1)) * 86 + (Math.random() * 6 - 3)) * 10 / 12) + '%',
        '--dur': dur + 's', '--delay': (-Math.random() * dur) + 's',
        '--h': (2.2 + Math.random()) + 'rem'
      });
      frag.appendChild(d);
    }
    layer.appendChild(frag);
    frag = document.createDocumentFragment();
    for (i = 0; i < SPARKS; i++) {
      var s = document.createElement('span'), sd = 2.6 + Math.random() * 2.2;
      s.className = 'ft-spark' + (Math.random() > 0.6 ? ' gold' : '');
      setVars(s, { '--x': (Math.random() * 100) + '%', '--dur': sd + 's', '--delay': (-Math.random() * sd) + 's' });
      frag.appendChild(s);
    }
    goo.appendChild(frag);
  }

  /* Le dashboard a un padding de body (40 px) : sans compensation, le footer
     s'arrêterait au-dessus d'une bande vide. */
  function fitBottom() {
    var pb = 0;
    try { pb = parseFloat(getComputedStyle(document.body).paddingBottom) || 0; } catch (e) {}
    host.style.marginBottom = pb ? (-pb) + 'px' : '';
  }

  function syncPaused() { host.classList.toggle('is-paused', !state.near || document.hidden); }

  /* -----------------------------------------------------------------------
     Éléments flottants des pages (widget live du tracker, bouton « prochain
     match » du calendrier) : fixés en bas d'écran, ils recouvraient la mention
     légale du footer une fois en bas de page. On publie en continu la hauteur
     du corps du footer visible à l'écran dans --ldc-footer-overlap ; ces
     éléments l'ajoutent à leur `bottom` pour rester au-dessus.
     La bande gooey, transparente, n'est pas comptée : un élément flottant peut
     la survoler sans rien masquer.
     ----------------------------------------------------------------------- */
  var overlapFrame = 0, lastOverlap = -1;
  function publishOverlap() {
    overlapFrame = 0;
    var body = host.querySelector('.ft-body');
    if (!body) return;
    /* Borné à la hauteur d'écran : quand le footer remplit tout l'écran (mobile),
       l'élément flottant s'arrête juste au-dessus au lieu de recevoir une valeur
       sans limite. */
    var ov = Math.max(0, Math.min(window.innerHeight, Math.round(window.innerHeight - body.getBoundingClientRect().top)));
    if (ov === lastOverlap) return;
    lastOverlap = ov;
    document.documentElement.style.setProperty('--ldc-footer-overlap', ov + 'px');
  }
  function scheduleOverlap() { if (!overlapFrame) overlapFrame = requestAnimationFrame(publishOverlap); }

  function start() {
    if (state.started) return;
    state.started = true;
    spawnParticles();
    load(false);
    setInterval(function () {
      if (document.hidden || !state.near) return;
      renderNext();
      if (!isFresh(state.data)) load(false);
    }, 30000);
  }

  /* ----------------------------- montage -------------------------------- */
  host.className = 'ldc-footer';
  host.innerHTML = markup();
  I18N.apply(host);
  fillStatic();
  try { ESPN.preserveSeasonLinks(host); } catch (e) {}
  fitBottom();

  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitBottom, 150); scheduleOverlap(); });
  window.addEventListener('scroll', scheduleOverlap, { passive: true });
  window.addEventListener('load', scheduleOverlap);
  /* Chaque page construit son contenu APRÈS ce script (classement, calendrier,
     polices) : le footer descend sans le moindre défilement. Sans cette
     observation, la valeur mesurée au chargement restait figée, et le widget
     du tracker flottait à mi-écran (234 px au lieu de 18) jusqu'au premier
     défilement. */
  if ('ResizeObserver' in window) new ResizeObserver(scheduleOverlap).observe(document.body);
  publishOverlap();
  window.addEventListener('ldc:langchange', function () { I18N.apply(host); fillStatic(); renderNext(); });
  document.addEventListener('visibilitychange', function () {
    syncPaused();
    if (!document.hidden && state.started) { renderNext(); if (!isFresh(state.data)) load(false); }
  });

  var mark = host.querySelector('.ft-mark');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { state.near = e.isIntersecting; });
      syncPaused();
      if (state.near) start();
    }, { rootMargin: '600px 0px' }).observe(host);

    var ringObserver = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { mark.classList.add('drawn'); ringObserver.disconnect(); }
    }, { threshold: 0.4 });
    ringObserver.observe(mark);
  } else {
    state.near = true; mark.classList.add('drawn'); start();
  }

  window.LDCFooter = { refresh: function () { load(true); }, _compute: compute, _countdownText: countdownText };
})();
