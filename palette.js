/* =========================================================================
   palette.js — Recherche globale du site (« / », Ctrl+K ou bouton 🔍)
   -------------------------------------------------------------------------
   Fenêtre de recherche instantanée, sur toutes les pages : pages des trois
   coupes, pages pays et outils, et tous les clubs des phases de ligue
   (chargés à la première ouverture, ESPN.forLeague). Clavier : ↑ ↓ pour
   choisir, Entrée pour ouvrir, Échap pour fermer.
   Club choisi : sa fiche s'ouvre sur place si la page a le panneau club
   (clubpanel.js), sinon on part vers le classement de sa coupe.
   Styles injectés ici ; respecte prefers-reduced-motion.
   ========================================================================= */
(function (g) {
  'use strict';
  if (g.LDCPalette) return;
  var d = document;
  function en() { try { return g.I18N && I18N.getLang() === 'en'; } catch (e) { return false; } }
  function T(fr, e) { return en() ? e : fr; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim(); }

  var COMPS = [
    { slug: 'uefa.champions', key: 'ucl', icon: 'logo.svg?v=4', color: '#f5b50a', table: 'tracker.html', fr: 'Ligue des Champions', en: 'Champions League' },
    { slug: 'uefa.europa', key: 'uel', icon: 'europa.svg?v=2', color: '#ff7a1a', table: 'europa-classement.html', fr: 'Europa League', en: 'Europa League' },
    { slug: 'uefa.europa.conf', key: 'uecl', icon: 'conference.svg?v=1', color: '#19c44f', table: 'conference-classement.html', fr: 'Conference League', en: 'Conference League' }
  ];
  /* [url, icône, libellé FR, libellé EN, mots-clés] */
  var PAGES = [
    ['dashboard.html', 'logo.svg?v=4', 'Ligue des Champions — Accueil', 'Champions League — Home', 'ldc ucl'],
    ['tracker.html', 'logo.svg?v=4', 'Ligue des Champions — Classement', 'Champions League — Standings', 'ldc tableau'],
    ['calendrier.html', 'logo.svg?v=4', 'Ligue des Champions — Calendrier', 'Champions League — Schedule', 'ldc matchs'],
    ['palmares.html', 'logo.svg?v=4', 'Ligue des Champions — Palmarès', 'Champions League — Honours', 'ldc vainqueurs'],
    ['monclub.html', 'logo.svg?v=4', 'Ligue des Champions — Mon club', 'Champions League — My club', 'ldc favori'],
    ['jeu.html', 'logo.svg?v=4', 'Ligue des Champions — Jeu', 'Champions League — Game', 'ldc quiz'],
    ['europa.html', 'europa.svg?v=2', 'Europa League — Accueil', 'Europa League — Home', 'uel'],
    ['europa-classement.html', 'europa.svg?v=2', 'Europa League — Classement', 'Europa League — Standings', 'uel tableau'],
    ['europa-calendrier.html', 'europa.svg?v=2', 'Europa League — Calendrier', 'Europa League — Schedule', 'uel matchs'],
    ['europa-palmares.html', 'europa.svg?v=2', 'Europa League — Palmarès', 'Europa League — Honours', 'uel vainqueurs'],
    ['europa-monclub.html', 'europa.svg?v=2', 'Europa League — Mon club', 'Europa League — My club', 'uel favori'],
    ['europa-jeu.html', 'europa.svg?v=2', 'Europa League — Jeu', 'Europa League — Game', 'uel quiz'],
    ['conference.html', 'conference.svg?v=1', 'Conference League — Accueil', 'Conference League — Home', 'uecl'],
    ['conference-classement.html', 'conference.svg?v=1', 'Conference League — Classement', 'Conference League — Standings', 'uecl tableau'],
    ['conference-calendrier.html', 'conference.svg?v=1', 'Conference League — Calendrier', 'Conference League — Schedule', 'uecl matchs'],
    ['conference-palmares.html', 'conference.svg?v=1', 'Conference League — Palmarès', 'Conference League — Honours', 'uecl vainqueurs'],
    ['conference-monclub.html', 'conference.svg?v=1', 'Conference League — Mon club', 'Conference League — My club', 'uecl favori'],
    ['conference-jeu.html', 'conference.svg?v=1', 'Conference League — Jeu', 'Conference League — Game', 'uecl quiz'],
    ['soiree.html', '🌙', 'Soirée européenne', 'European night', 'matchs du jour ce soir'],
    ['nations.html', '🌍', 'Club des Nations', 'Club of Nations', 'pays coefficient classement nations course'],
    ['france.html', 'flag:fra', 'France — clubs français', 'France — French clubs', 'pays'],
    ['allemagne.html', 'flag:ger', 'Allemagne — clubs allemands', 'Germany — German clubs', 'pays bundesliga'],
    ['angleterre.html', 'flag:eng', 'Angleterre — clubs anglais', 'England — English clubs', 'pays premier league'],
    ['espagne.html', 'flag:esp', 'Espagne — clubs espagnols', 'Spain — Spanish clubs', 'pays liga'],
    ['italie.html', 'flag:ita', 'Italie — clubs italiens', 'Italy — Italian clubs', 'pays serie a'],
    ['comparateur.html', '⚖', 'Comparateur de clubs', 'Club comparison', 'face a face duel'],
    ['overlay.html', '🎥', 'Overlay OBS', 'OBS overlay', 'stream'],
    ['legal.html', '§', 'Mentions légales', 'Legal notice', 'legal']
  ];

  /* ---- Styles ---- */
  function css() {
    if (d.getElementById('ldc-pal-css')) return;
    var st = d.createElement('style'); st.id = 'ldc-pal-css';
    st.textContent =
      '.pal-fab{position:fixed;left:16px;bottom:16px;z-index:120;width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.16);cursor:pointer;' +
      'background:rgba(13,20,38,.86);backdrop-filter:blur(8px);color:#fff;font-size:19px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.45);transition:transform .15s,border-color .15s}' +
      '.pal-fab:hover{transform:scale(1.07);border-color:rgba(245,181,10,.6)}.pal-fab:focus-visible{outline:2px solid #f5b50a;outline-offset:3px}' +
      '.pal-back{position:fixed;inset:0;z-index:1100;display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px;background:rgba(4,7,16,.62);backdrop-filter:blur(6px);animation:palFade .18s ease-out}' +
      '.pal{width:min(640px,100%);max-height:70vh;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:linear-gradient(165deg,#111c38,#0a1226);' +
      'border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(245,181,10,.12);animation:palIn .24s cubic-bezier(.22,1,.36,1);font-family:Inter,system-ui,sans-serif;color:#e6eaf5}' +
      '.pal-top{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.09)}' +
      '.pal-top span{font-size:18px;opacity:.8}.pal-top input{flex:1;min-width:0;border:0;outline:0;background:none;color:#fff;font:600 17px/1.3 Inter,system-ui,sans-serif}' +
      '.pal-top input::-webkit-search-cancel-button{display:none}.pal-top input::placeholder{color:#7f8bab}.pal-top kbd,.pal-foot kbd{font:700 11px/1 Inter,system-ui,sans-serif;padding:3px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.18);color:#9aa3c4}' +
      '.pal-list{overflow-y:auto;padding:6px 6px 10px}' +
      '.pal-h{padding:10px 12px 4px;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7f8bab}' +
      '.pal-it{display:flex;align-items:center;gap:12px;width:100%;padding:9px 12px;border:0;border-radius:11px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}' +
      '.pal-it.on{background:rgba(245,181,10,.14);box-shadow:inset 3px 0 0 #f5b50a}' +
      '.pal-ic{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:17px}.pal-ic img{width:26px;height:26px;object-fit:contain}' +
      '.pal-tx{display:flex;flex-direction:column;min-width:0;flex:1}.pal-tx b{font-size:14.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.pal-tx small{font-size:12px;color:#8f9bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pal-tx mark{background:none;color:#f5b50a}' +
      '.pal-cp{width:18px;height:18px;object-fit:contain;flex:none;opacity:.9}' +
      '.pal-empty{padding:22px;text-align:center;color:#8f9bbb;font-size:14px}' +
      '.pal-foot{display:flex;gap:14px;flex-wrap:wrap;padding:9px 16px;border-top:1px solid rgba(255,255,255,.09);font-size:11.5px;color:#7f8bab}' +
      '@keyframes palFade{from{opacity:0}}@keyframes palIn{from{opacity:0;transform:translateY(-14px) scale(.98)}}' +
      '@media (prefers-reduced-motion:reduce){.pal-back,.pal{animation:none}}' +
      '@media (max-width:600px){.pal-back{padding-top:8vh}.pal-foot{display:none}.pal-fab{width:42px;height:42px;font-size:17px}}';
    (d.head || d.documentElement).appendChild(st);
  }

  /* ---- Clubs (chargés une fois) ---- */
  var clubs = null, clubsLoading = null, ctxs = {};
  function loadClubs() {
    if (clubs) return Promise.resolve(clubs);
    if (clubsLoading) return clubsLoading;
    if (!g.ESPN || !ESPN.forLeague) { clubs = []; return Promise.resolve(clubs); }
    clubsLoading = Promise.all(COMPS.map(function (c) {
      var E = ESPN.LEAGUE_SLUG === c.slug ? ESPN : ESPN.forLeague(c.slug);
      return E.fetchSeasonEvents({ ttl: 300000 }).then(function (evs) {
        var ms = evs.map(E.normalizeEvent).filter(Boolean), seen = {}, out = [];
        ctxs[c.key] = { E: E, matches: ms, evs: evs };
        ms.forEach(function (m) { if (m.round === 'qualifying') return; [m.home, m.away].forEach(function (t) {
          var id = String(t.teamId); if (!id || seen[id]) return; seen[id] = 1;
          out.push({ kind: 'club', id: id, name: t.name, logo: t.logo, comp: c, n: norm(t.name + ' ' + (t.shortName || '') + ' ' + (t.abbr || '')) });
        }); });
        return out;
      }).catch(function () { return []; });
    })).then(function (lists) { clubs = [].concat.apply([], lists); clubs.sort(function (a, b) { return a.name.localeCompare(b.name); }); return clubs; });
    return clubsLoading;
  }

  /* ---- Recherche ---- */
  function score(n, q) {
    if (!q) return 1;
    if (n.indexOf(q) === 0) return 100 - n.length * 0.01;
    var words = n.split(' ');
    for (var i = 0; i < words.length; i++) if (words[i].indexOf(q) === 0) return 80;
    return (q.length >= 3 && n.indexOf(q) !== -1) ? 60 : 0;
  }
  function pageItems() {
    return PAGES.map(function (p) { var lab = T(p[2], p[3]); return { kind: 'page', url: p[0], icon: p[1], name: lab, sub: p[0], n: norm(lab + ' ' + p[2] + ' ' + p[3] + ' ' + p[4]) }; });
  }
  function search(q) {
    q = norm(q);
    var ps = pageItems().map(function (x) { return { x: x, s: score(x.n, q) }; }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, q ? 6 : 8).map(function (r) { return r.x; });
    var cs = !q ? [] : (clubs || []).map(function (x) { return { x: x, s: score(x.n, q) }; }).filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 12).map(function (r) { return r.x; });
    /* Le groupe qui correspond le mieux passe en tête. */
    var bp = ps.length ? score(ps[0].n, q) : 0, bc = cs.length ? score(cs[0].n, q) : 0;
    return { pages: ps, clubs: cs, clubsFirst: bc > bp };
  }
  function hl(name, q) {
    q = String(q || '').trim(); if (!q) return esc(name);
    var i = norm(name).indexOf(norm(q)); if (i < 0 || norm(name).length !== name.length) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
  }
  function icon(x) {
    if (x.kind === 'club') return x.logo ? '<img src="' + esc(x.logo) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' : '⚽';
    if (/^flag:/.test(x.icon)) return '<img src="https://a.espncdn.com/i/teamlogos/countries/500/' + x.icon.slice(5) + '.png" alt="">';
    if (/\.svg/.test(x.icon)) return '<img src="' + x.icon + '" alt="">';
    return esc(x.icon);
  }

  /* ---- Fenêtre ---- */
  var back = null, input = null, listEl = null, items = [], sel = 0, lastFocus = null;
  function open(prefill) {
    css();
    if (back) { input.focus(); return; }
    lastFocus = d.activeElement;
    back = d.createElement('div'); back.className = 'pal-back';
    back.innerHTML = '<div class="pal" role="dialog" aria-modal="true" aria-label="' + esc(T('Recherche', 'Search')) + '">' +
      '<div class="pal-top"><span aria-hidden="true">🔍</span><input type="search" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list" placeholder="' +
      esc(T('Rechercher un club, une page, un pays…', 'Search a club, a page, a country…')) + '"><kbd>Esc</kbd></div>' +
      '<div class="pal-list" id="palList" role="listbox"></div>' +
      '<div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> ' + esc(T('naviguer', 'navigate')) + '</span><span><kbd>↵</kbd> ' + esc(T('ouvrir', 'open')) + '</span><span><kbd>/</kbd> ' + esc(T('ou', 'or')) + ' <kbd>Ctrl</kbd> <kbd>K</kbd> ' + esc(T('partout sur le site', 'anywhere on the site')) + '</span></div></div>';
    d.body.appendChild(back);
    input = back.querySelector('input'); listEl = back.querySelector('.pal-list');
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', onKey);
    listEl.addEventListener('click', function (e) { var b = e.target.closest('.pal-it'); if (b) choose(+b.getAttribute('data-i')); });
    listEl.addEventListener('mousemove', function (e) { var b = e.target.closest('.pal-it'); if (b && +b.getAttribute('data-i') !== sel) { sel = +b.getAttribute('data-i'); mark(); } });
    if (prefill) input.value = prefill;
    render(); input.focus();
    loadClubs().then(function () { if (back) render(); });
  }
  function close() {
    if (!back) return;
    back.remove(); back = null; input = null; listEl = null;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function render() {
    var q = input.value, r = search(q), html = '';
    items = [];
    function group(title, arr) {
      if (!arr.length) return;
      html += '<div class="pal-h">' + esc(title) + '</div>';
      arr.forEach(function (x) {
        var i = items.length; items.push(x);
        var sub = x.kind === 'club' ? T(x.comp.fr, x.comp.en) + ' · ' + T('voir la fiche', 'open club card') : x.sub;
        html += '<button type="button" class="pal-it" role="option" id="pal-o' + i + '" data-i="' + i + '"><span class="pal-ic">' + icon(x) + '</span><span class="pal-tx"><b>' + hl(x.name, q) + '</b><small>' + esc(sub) + '</small></span>' +
          (x.kind === 'club' ? '<img class="pal-cp" src="' + x.comp.icon + '" alt="">' : '') + '</button>';
      });
    }
    if (r.clubsFirst) { group(T('Clubs', 'Clubs'), r.clubs); group(T('Pages', 'Pages'), r.pages); }
    else { group(T('Pages', 'Pages'), r.pages); group(T('Clubs', 'Clubs'), r.clubs); }
    if (!items.length) html = '<div class="pal-empty">' + esc(clubs || !q ? T('Aucun résultat.', 'No result.') : T('Chargement des clubs…', 'Loading clubs…')) + '</div>';
    else if (q && !clubs) html += '<div class="pal-empty">' + esc(T('Chargement des clubs…', 'Loading clubs…')) + '</div>';
    listEl.innerHTML = html; sel = 0; mark();
  }
  function mark() {
    Array.prototype.forEach.call(listEl.querySelectorAll('.pal-it'), function (b) { var on = +b.getAttribute('data-i') === sel; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); if (on) b.scrollIntoView({ block: 'nearest' }); });
    if (input) input.setAttribute('aria-activedescendant', items.length ? 'pal-o' + sel : '');
  }
  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { sel = (sel + 1) % items.length; mark(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { sel = (sel - 1 + items.length) % items.length; mark(); } }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }
  function choose(i) {
    var x = items[i]; if (!x) return;
    if (x.kind === 'page') { close(); location.href = x.url; return; }
    var c = ctxs[x.comp.key];
    if (g.LDCClubPanel && c) {
      close();
      var seed = x.comp.key === 'ucl' ? c.E.qualifiedClubs() : c.E.leagueClubs(c.evs);
      LDCClubPanel.open(x.id, { matches: c.matches, standings: c.E.computeStandings(c.evs, seed), espn: c.E,
        thresholds: (g.LDCThresholds && LDCThresholds.forLeague) ? LDCThresholds.forLeague(x.comp.slug) : null });
    } else { close(); location.href = x.comp.table; }
  }

  /* ---- Raccourcis et bouton ---- */
  d.addEventListener('keydown', function (e) {
    var a = d.activeElement, typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); back ? close() : open(); }
    else if (e.key === '/' && !typing && !back && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); open(); }
  });
  function fab() {
    if (d.querySelector('.pal-fab') || !d.body) return;
    css();
    var b = d.createElement('button'); b.type = 'button'; b.className = 'pal-fab';
    b.setAttribute('aria-label', T('Rechercher (/ ou Ctrl+K)', 'Search (/ or Ctrl+K)')); b.title = T('Rechercher — / ou Ctrl+K', 'Search — / or Ctrl+K');
    b.textContent = '🔍'; b.addEventListener('click', function () { open(); });
    d.body.appendChild(b);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fab); else fab();
  g.LDCPalette = { open: open, close: close };
})(window);
