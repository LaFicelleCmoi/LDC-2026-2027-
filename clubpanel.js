/* =========================================================================
   clubpanel.js — Fiche club « Ligue des Champions » (panneau latéral)
   -------------------------------------------------------------------------
   Ouverte au clic sur une équipe du classement. Reprend la fiche club de
   LeagueHub, limitée à la Ligue des Champions : derniers matchs, bilan de la
   saison, prochain match et calendrier restant.

   Deux parties :
   1. clubData(teamId, matches, standings) — calcul PUR, sans DOM, testable
      dans Node. `matches` : matchs au format ESPN.normalizeEvent.
   2. open / refresh / close — rendu et comportement de dialogue (navigateur).

   API : window.LDCClubPanel
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCClubPanel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ======================================================================
     1. DONNÉES
     ====================================================================== */
  var MATCHDAY_GAP = 5 * 86400000;   // même règle que ESPN.clusterMatchdays

  function timeOf(m) {
    if (!m) return 0;
    if (m.dateObj && m.dateObj.getTime) return m.dateObj.getTime();
    if (typeof m.time === 'number') return m.time;
    return m.date ? Date.parse(m.date) || 0 : 0;
  }

  /* Numéro de journée de chaque match de phase de ligue : un écart de plus de
     5 jours entre deux matchs ouvre une nouvelle journée. */
  function matchdayMap(matches) {
    var league = (matches || []).filter(function (m) { return m && m.round === 'league' && timeOf(m); })
      .sort(function (a, b) { return timeOf(a) - timeOf(b); });
    var map = {}, md = 0, last = null;
    league.forEach(function (m) {
      var t = timeOf(m);
      if (last === null || t - last > MATCHDAY_GAP) md++;
      map[m.id] = md; last = t;
    });
    return map;
  }

  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }

  /* Tout ce que la fiche affiche, pour un club. Le score est toujours donné du
     point de vue du club (gf = ses buts). Le résultat suit le score ; une
     séance de tirs au but est signalée à part (pens). */
  function clubData(teamId, matches, standings) {
    var id = String(teamId);
    var mds = matchdayMap(matches);
    var team = null;

    var rows = (matches || []).filter(function (m) {
      return m && m.home && m.away && m.round !== 'qualifying' &&
        (String(m.home.teamId) === id || String(m.away.teamId) === id);
    }).map(function (m) {
      var home = String(m.home.teamId) === id;
      var me = home ? m.home : m.away, opp = home ? m.away : m.home;
      if (!team || (!team.logo && me.logo)) team = { id: id, name: me.name, logo: me.logo || '', abbr: me.abbr || '' };
      var gf = num(me.score), ga = num(opp.score);
      var pens = (me.shootout != null && opp.shootout != null) ? { me: me.shootout, opp: opp.shootout } : null;
      return {
        id: m.id, time: timeOf(m), home: home, state: m.state,
        live: m.state === 'in', clock: m.displayClock || '',
        opp: { id: String(opp.teamId || ''), name: opp.name || '', logo: opp.logo || '', abbr: opp.abbr || '' },
        gf: gf, ga: ga, pens: pens,
        result: m.state === 'post' ? (gf > ga ? 'w' : (gf < ga ? 'l' : 'd')) : null,
        round: m.round, md: mds[m.id] || null, leg: m.leg || null
      };
    });

    var played = rows.filter(function (r) { return r.state === 'post' || r.state === 'in'; })
      .sort(function (a, b) { return b.time - a.time; });
    var upcoming = rows.filter(function (r) { return r.state === 'pre'; })
      .sort(function (a, b) { return a.time - b.time; });
    var finished = played.filter(function (r) { return r.state === 'post'; });

    var summary = { pld: finished.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    finished.forEach(function (r) { summary[r.result]++; summary.gf += r.gf; summary.ga += r.ga; });

    var st = null;
    (standings || []).forEach(function (r) { if (!st && String(r.teamId) === id) st = r; });
    if (!team && st) team = { id: id, name: st.name, logo: st.logo || '', abbr: st.abbr || '' };

    return {
      team: team,
      played: played,
      last: played.slice(0, 5),
      summary: summary,
      next: upcoming[0] || null,
      upcoming: upcoming,
      standing: st ? { rank: st.rank || st.pos, pos: st.pos, pts: st.pts,
                       zone: st.pos <= 8 ? 'q' : (st.pos <= 24 ? 'po' : 'out') } : null
    };
  }

  var api = { clubData: clubData, matchdayMap: matchdayMap };
  if (typeof document === 'undefined') return api;

  /* ======================================================================
     2. RENDU ET DIALOGUE
     ====================================================================== */
  var host = null, panel = null, state = { id: null, ctx: null, lastFocus: null };

  function isEn() { try { return window.I18N && I18N.getLang() === 'en'; } catch (e) { return false; } }
  function T(fr, en) { return isEn() ? en : fr; }
  function locale() { return isEn() ? 'en-GB' : 'fr-FR'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function crest(url, cls) {
    return url ? '<img class="' + cls + '" src="' + esc(url) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
               : '<span class="' + cls + ' cp-crest-ph"></span>';
  }
  function letter(res) { return { w: T('V', 'W'), d: T('N', 'D'), l: T('D', 'L') }[res] || ''; }
  function roundLabel(r) {
    if (r.round === 'league') return r.md ? T('Journée ', 'Matchday ') + r.md : T('Phase de ligue', 'League phase');
    var k = { po: T('Barrages', 'Play-offs'), r16: T('Huitièmes', 'Round of 16'), qf: T('Quarts', 'Quarter-finals'),
              sf: T('Demies', 'Semi-finals'), final: T('Finale', 'Final') }[r.round] || '';
    if (r.leg === 1) k += ' · ' + T('aller', '1st leg');
    if (r.leg === 2) k += ' · ' + T('retour', '2nd leg');
    return k;
  }
  function shortDate(t) { return new Date(t).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }); }
  function longDate(t) { return new Date(t).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }); }
  function hour(t) { return new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); }
  function venue(home) { return home ? T('Domicile', 'Home') : T('Extérieur', 'Away'); }
  function prep(home) { return home ? 'vs' : T('chez', 'at'); }

  function countdown(t) {
    var ms = t - Date.now();
    if (ms <= 0) return T('Imminent', 'Imminent');
    var p = (window.LDCSchedule && LDCSchedule.countdownParts) ? LDCSchedule.countdownParts(ms)
          : { days: Math.floor(ms / 86400000), hours: Math.floor(ms % 86400000 / 3600000), minutes: Math.ceil(ms % 3600000 / 60000) };
    if (p.days > 0) return T('J-', 'D-') + p.days;
    if (p.hours > 0) return p.hours + 'h' + (p.minutes < 10 ? '0' : '') + p.minutes;
    return p.minutes + ' min';
  }

  function matchRow(r) {
    var score = r.gf + '–' + r.ga;
    var meta = [r.live ? (r.clock || T('En cours', 'In progress')) : shortDate(r.time), venue(r.home), roundLabel(r)];
    if (r.pens) meta.push(T('tab ', 'pens ') + r.pens.me + '–' + r.pens.opp);
    var badge = r.live ? '<span class="cp-badge live" aria-label="' + esc(T('En direct', 'Live')) + '"><i></i></span>'
                       : '<span class="cp-badge ' + r.result + '">' + letter(r.result) + '</span>';
    return '<li class="cp-match' + (r.live ? ' is-live' : '') + '">' + badge +
      '<div class="cp-mid"><div class="cp-opp"><span class="cp-prep">' + esc(prep(r.home)) + '</span>' +
        crest(r.opp.logo, 'cp-ologo') + '<span class="cp-oname">' + esc(r.opp.name) + '</span></div>' +
        '<div class="cp-meta">' + meta.map(esc).join(' · ') + '</div></div>' +
      '<span class="cp-score ' + (r.live ? 'live' : r.result) + '">' + score + '</span></li>';
  }

  function render() {
    var d = clubData(state.id, state.ctx.matches, state.ctx.standings);
    var team = d.team || { name: '—', logo: '' };
    var fav = null; try { fav = window.ESPN && ESPN.getFav(); } catch (e) {}
    var isFav = fav && String(fav.id) === String(state.id);
    var s = d.summary, st = d.standing;

    var zoneTxt = st ? { q: T('Top 8 · huitièmes directs', 'Top 8 · direct to R16'), po: T('9–24 · barrages', '9–24 · play-offs'),
                         out: T('25–36 · éliminé', '25–36 · eliminated') }[st.zone] : '';
    var sub = T('Ligue des Champions', 'Champions League') +
      (st ? ' · ' + st.rank + (isEn() ? (st.rank === 1 ? 'st' : st.rank === 2 ? 'nd' : st.rank === 3 ? 'rd' : 'th') : (st.rank === 1 ? 'er' : 'e')) +
            ' · ' + st.pts + ' pt' + (st.pts > 1 ? 's' : '') : '');

    var html =
      '<header class="cp-head">' +
        crest(team.logo, 'cp-crest') +
        '<div class="cp-htxt">' +
          (isFav ? '<span class="cp-fav">★ ' + esc(T('Votre club', 'Your club')) + '</span>' : '') +
          '<h2 class="cp-name" id="cpTitle">' + esc(team.name) + '</h2>' +
          '<div class="cp-sub">' + esc(sub) + '</div>' +
          (st ? '<span class="cp-zone z-' + st.zone + '">' + esc(zoneTxt) + '</span>' : '') +
        '</div>' +
        '<button type="button" class="cp-close" data-cp-close aria-label="' + esc(T('Fermer', 'Close')) + '">×</button>' +
      '</header>';

    html += '<section class="cp-sec"><div class="cp-sec-head"><h3>' + esc(T('Derniers matchs', 'Latest matches')) + '</h3>' +
      '<div class="cp-tally"><div>' + esc(T('Saison', 'Season')) + ' · ' + s.pld + ' ' + esc(T('match', 'match') + (s.pld > 1 ? (isEn() ? 'es' : 's') : '')) + ' · ' +
        '<b class="w">' + s.w + ' ' + letter('w') + '</b> · <b class="d">' + s.d + ' ' + letter('d') + '</b> · <b class="l">' + s.l + ' ' + letter('l') + '</b></div>' +
        '<div>' + s.gf + ' ' + esc(T('buts marqués', 'goals scored')) + ' · ' + s.ga + ' ' + esc(T('encaissés', 'conceded')) + '</div></div></div>';
    var form = d.played.filter(function (r) { return r.result; }).slice(0, 5);
    if (form.length) {
      html += '<div class="cp-form" aria-label="' + esc(T('Forme', 'Form')) + '">' +
        form.map(function (r) { return '<span class="cp-badge ' + r.result + '" title="' + esc(prep(r.home) + ' ' + r.opp.name + ' · ' + r.gf + '–' + r.ga) + '">' + letter(r.result) + '</span>'; }).join('') +
        '</div><p class="cp-legend">' + esc(T('Du plus récent au plus ancien · V victoire · N nul · D défaite', 'Most recent first · W win · D draw · L loss')) + '</p>';
    }
    html += d.last.length ? '<ul class="cp-list">' + d.last.map(matchRow).join('') + '</ul>'
                          : '<p class="cp-empty">' + esc(T('Aucun match joué pour l’instant.', 'No match played yet.')) + '</p>';
    html += '</section>';

    /* Objectifs : points manquants pour atteindre les seuils RÉELS des phases
       de ligue précédentes (thresholds.js). Uniquement pendant la phase. */
    var TH = window.LDCThresholds;
    var leagueLeft = d.upcoming.filter(function (r) { return r.round === 'league'; }).length;
    if (TH && st && leagueLeft > 0) {
      var ob = TH.objectives(st.pts, leagueLeft);
      var objRow = function (o, label, cls, note) {
        var pct = Math.min(100, Math.round(o.pts / o.target * 100));
        var txt;
        if (o.status === 'reached') txt = T('✓ Seuil atteint.', '✓ Threshold reached.');
        else if (o.status === 'out') txt = T('Hors de portée : au mieux ' + o.max + ' pts.', 'Out of reach: ' + o.max + ' pts at best.');
        else txt = T('Il manque ' + o.missing + ' pt' + (o.missing > 1 ? 's' : '') + ', l’équivalent de ' + o.wins + ' victoire' + (o.wins > 1 ? 's' : '') +
                     ' · ' + leagueLeft + ' match' + (leagueLeft > 1 ? 's' : '') + ' restant' + (leagueLeft > 1 ? 's' : ''),
                     o.missing + ' pt' + (o.missing > 1 ? 's' : '') + ' short, the equivalent of ' + o.wins + ' win' + (o.wins > 1 ? 's' : '') +
                     ' · ' + leagueLeft + ' match' + (leagueLeft > 1 ? 'es' : '') + ' left');
        return '<div class="cp-obj ' + cls + ' is-' + o.status + '">' +
          '<div class="cp-obj-head"><span>' + esc(label) + '</span><b>' + o.pts + ' / ' + o.target + ' pts</b></div>' +
          '<div class="cp-bar" role="img" aria-label="' + esc(o.pts + ' / ' + o.target + ' pts') + '"><i style="width:' + pct + '%"></i></div>' +
          '<p class="cp-obj-txt">' + esc(txt) + (note ? ' <span class="cp-obj-note">' + esc(note) + '</span>' : '') + '</p></div>';
      };
      html += '<section class="cp-sec"><h3>' + esc(T('Objectifs', 'Targets')) + '</h3>' +
        objRow(ob.top8, T('Top 8 · huitièmes directs', 'Top 8 · direct to R16'), 'o-q', '') +
        objRow(ob.top24, T('Top 24 · barrages', 'Top 24 · play-offs'), 'o-po', T('(9 pts ont suffi en 2025-26)', '(9 pts were enough in 2025-26)')) +
        '<p class="cp-legend">' + esc(T('Seuils réels des deux dernières phases de ligue : le 8e avait 16 pts en 2024-25 comme en 2025-26, le 24e 11 puis 9 pts. Indicatif : ils varient d’une saison à l’autre.',
                                        'Actual thresholds of the last two league phases: 8th place had 16 pts in both 2024-25 and 2025-26, 24th had 11 then 9. Indicative: they vary from season to season.')) + '</p>' +
        '</section>';
    }

    if (d.next) {
      var n = d.next;
      html += '<section class="cp-sec"><h3>' + esc(T('Prochain match', 'Next match')) + '</h3>' +
        '<div class="cp-next">' +
          '<div class="cp-next-top"><span>★ ' + esc(T('Ligue des Champions', 'Champions League')) + ' · ' + esc(roundLabel(n)) + '</span>' +
            '<span class="cp-cd">' + esc(countdown(n.time)) + '</span></div>' +
          '<div class="cp-next-main">' + crest(n.opp.logo, 'cp-nlogo') +
            '<div><div class="cp-next-opp"><span class="cp-prep">' + esc(prep(n.home)) + '</span> ' + esc(n.opp.name) + '</div>' +
            '<div class="cp-next-when"><time datetime="' + new Date(n.time).toISOString() + '">' + esc(longDate(n.time) + ' · ' + hour(n.time)) + '</time> · ' + esc(venue(n.home)) + '</div></div>' +
          '</div></div></section>';
    }

    if (d.upcoming.length > 1) {
      html += '<section class="cp-sec"><h3>' + esc(T('Calendrier restant', 'Remaining fixtures')) + ' <span class="cp-count">' + (d.upcoming.length - 1) + '</span></h3><ul class="cp-fix">' +
        d.upcoming.slice(1).map(function (r) {
          return '<li><span class="cp-md">' + esc(r.round === 'league' && r.md ? T('J', 'MD') + r.md : roundLabel(r)) + '</span>' +
            '<span class="cp-prep">' + esc(prep(r.home)) + '</span>' + crest(r.opp.logo, 'cp-ologo') +
            '<span class="cp-oname">' + esc(r.opp.name) + '</span><span class="cp-fdate">' + esc(shortDate(r.time)) + '</span></li>';
        }).join('') + '</ul></section>';
    }

    var keep = panel.scrollTop;
    panel.innerHTML = html;
    panel.scrollTop = keep;
  }

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.className = 'cp-backdrop';
    host.hidden = true;
    host.innerHTML = '<aside class="cp-panel" role="dialog" aria-modal="true" aria-labelledby="cpTitle" tabindex="-1"></aside>';
    document.body.appendChild(host);
    panel = host.firstChild;

    host.addEventListener('click', function (e) {
      if (e.target === host || (e.target.closest && e.target.closest('[data-cp-close]'))) close();
    });
    document.addEventListener('keydown', function (e) {
      if (host.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      /* Piège de focus : Tab et Maj+Tab restent dans la fiche. */
      var f = panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) { e.preventDefault(); return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    window.addEventListener('ldc:langchange', function () { if (!host.hidden) render(); });
  }

  function open(teamId, ctx) {
    ensureHost();
    var wasOpen = !host.hidden;
    state.id = String(teamId);
    state.ctx = ctx || { matches: [], standings: [] };
    if (!wasOpen) state.lastFocus = document.activeElement;
    panel.scrollTop = 0;
    render();
    host.hidden = false;
    document.documentElement.classList.add('cp-open');
    var c = panel.querySelector('[data-cp-close]');
    if (c) c.focus({ preventScroll: true });
  }

  /* Nouvelles données (rechargement de la saison, score en direct) : la fiche
     ouverte se met à jour sans perdre sa position de défilement. */
  function refresh(ctx) {
    if (!host || host.hidden || !state.id) return;
    state.ctx = ctx || state.ctx;
    render();
  }

  function close() {
    if (!host || host.hidden) return;
    host.hidden = true;
    document.documentElement.classList.remove('cp-open');
    var back = state.lastFocus;
    state.id = null;
    if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true });
  }

  api.open = open;
  api.refresh = refresh;
  api.close = close;
  api.isOpen = function () { return !!(host && !host.hidden); };
  return api;
});
