/* =========================================================================
   favs.js — Les clubs favoris des trois coupes, partout sur le site
   -------------------------------------------------------------------------
   Chaque coupe a son club favori (ESPN.forLeague(slug).getFav(), clés
   ldc_fav, ldc_fav_uel, ldc_fav_uecl). Ce module les réunit :
   - LDCFavs.list()            [{ slug, key, id, name, logo, color, page }]
   - LDCFavs.isFav(slug, id)   le club est-il le favori de cette coupe ?
   - LDCFavs.mark(name)        « ★ nom » pour les listes
   - rangée « Mes clubs » dans la barre (.topbar .tb-left) : blasons des
     favoris, lien vers la page « Mon club » de chaque coupe ;
   - styles communs des éléments favoris (.is-fav) des pages Soirée, pays
     et Club des Nations (injectés ici, aucune feuille à charger).
   Se met à jour quand un favori change (événement storage, autre onglet).
   ========================================================================= */
(function (g) {
  'use strict';
  var COMPS = [
    { slug: 'uefa.champions', key: 'ucl', page: 'monclub.html', icon: 'logo.svg?v=4', fr: 'Ligue des Champions', en: 'Champions League' },
    { slug: 'uefa.europa', key: 'uel', page: 'europa-monclub.html', icon: 'europa.svg?v=2', fr: 'Europa League', en: 'Europa League' },
    { slug: 'uefa.europa.conf', key: 'uecl', page: 'conference-monclub.html', icon: 'conference.svg?v=1', fr: 'Conference League', en: 'Conference League' }
  ];
  function en() { try { return g.I18N && I18N.getLang() === 'en'; } catch (e) { return false; } }
  function T(fr, e) { return en() ? e : fr; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function list() {
    var out = [];
    if (!g.ESPN || !ESPN.forLeague) return out;
    COMPS.forEach(function (c) {
      try {
        var E = ESPN.LEAGUE_SLUG === c.slug ? ESPN : ESPN.forLeague(c.slug), f = E.getFav();
        if (f && f.id) out.push({ slug: c.slug, key: c.key, id: String(f.id), name: f.name || '', logo: f.logo || '',
          color: f.color ? '#' + String(f.color).replace('#', '') : '', page: c.page, icon: c.icon, comp: T(c.fr, c.en) });
      } catch (e) {}
    });
    return out;
  }
  function isFav(slug, id) { var s = String(id); return list().some(function (f) { return f.slug === slug && f.id === s; }); }

  /* ---- Styles communs ---- */
  function css() {
    if (document.getElementById('ldc-favs-css')) return;
    var st = document.createElement('style'); st.id = 'ldc-favs-css';
    st.textContent =
      '.fav-strip{display:inline-flex;align-items:center;gap:6px;padding:3px 6px 3px 10px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(245,181,10,.35)}' +
      '.fav-strip .fs-l{font:800 10.5px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#f5b50a;white-space:nowrap}' +
      '.fav-strip a{position:relative;display:inline-flex;width:30px;height:30px;border-radius:50%;background:#0d1426;border:2px solid var(--fc,#f5b50a);align-items:center;justify-content:center;transition:transform .15s}' +
      '.fav-strip a:hover{transform:translateY(-2px) scale(1.06)}.fav-strip a:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
      '.fav-strip a img.fs-c{width:20px;height:20px;object-fit:contain}' +
      '.fav-strip a img.fs-k{position:absolute;right:-5px;bottom:-4px;width:14px;height:14px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}' +
      /* éléments favoris des pages */
      '.fr-card.is-fav{border-color:rgba(245,181,10,.75);box-shadow:0 0 0 1px rgba(245,181,10,.35),0 12px 34px rgba(245,181,10,.16)}' +
      '.fav-badge{display:inline-flex;align-items:center;gap:4px;margin-left:6px;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#1a1300;background:#f5b50a;vertical-align:2px}' +
      '.fr-match.is-fav{border-color:rgba(245,181,10,.7);box-shadow:inset 4px 0 0 #f5b50a}' +
      '.fr-side .fav-star{color:#f5b50a;margin:0 3px;font-size:.95em}' +
      '.fr-cname .fav-star{color:#f5b50a}' +
      '.nt-club.is-fav{box-shadow:0 0 0 2px #f5b50a;border-color:#f5b50a}' +
      '.nt-table tr.is-fav td{background:rgba(245,181,10,.07)}.nt-table tr.is-fav td:first-child{box-shadow:inset 3px 0 0 #f5b50a}' +
      '.nt-page .fav-badge{position:absolute;top:-8px;left:12px;margin:0}' +
      '.sr-fav .sr-favh{color:#f5b50a}.sr-chip-fav i{font-style:normal;color:#f5b50a}' +
      '@media (max-width:600px){.fav-strip .fs-l{display:none}}';
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---- Rangée « Mes clubs » dans la barre ---- */
  function mountStrip() {
    var host = document.querySelector('.topbar .tb-left'); if (!host) return;
    var old = host.querySelector('.fav-strip'); if (old) old.remove();
    var fs = list(); if (!fs.length) return;
    css();
    var el = document.createElement('div'); el.className = 'fav-strip';
    el.innerHTML = '<span class="fs-l">★ ' + esc(T('Mes clubs', 'My clubs')) + '</span>' + fs.map(function (f) {
      var lab = f.name + ' · ' + f.comp;
      return '<a href="' + f.page + '" title="' + esc(lab) + '" aria-label="' + esc(T('Mon club : ', 'My club: ') + lab) + '"' + (f.color ? ' style="--fc:' + esc(f.color) + '"' : '') + '>' +
        (f.logo ? '<img class="fs-c" src="' + esc(f.logo) + '" alt="" onerror="this.style.visibility=\'hidden\'">' : '★') +
        '<img class="fs-k" src="' + f.icon + '" alt=""></a>';
    }).join('');
    host.appendChild(el);
  }

  g.LDCFavs = { COMPS: COMPS, list: list, isFav: isFav, css: css, mountStrip: mountStrip,
    star: function () { return '<span class="fav-star" aria-hidden="true">★</span>'; },
    badge: function () { return '<span class="fav-badge">★ ' + esc(T('Mon club', 'My club')) + '</span>'; } };
  function boot() {
    css(); mountStrip();
    /* Favori changé sur la page même (accueil d'une coupe) : la rangée suit. */
    if (g.ESPN && ESPN.setFav && !ESPN.__favsHooked) {
      ESPN.__favsHooked = true;
      ['setFav', 'clearFav'].forEach(function (k) { var f = ESPN[k]; if (typeof f === 'function') ESPN[k] = function () { var r = f.apply(this, arguments); setTimeout(mountStrip, 0); return r; }; });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  g.addEventListener('storage', function (e) { if (e.key && /^ldc_fav/.test(e.key)) mountStrip(); });
  g.addEventListener('ldc:langchange', mountStrip);
})(window);
