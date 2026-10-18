/* =========================================================================
   matchpanel.js — Fiche de match (Ligue des Champions, Europa League,
   Conference League)
   -------------------------------------------------------------------------
   Fenêtre ouverte au clic sur un match. Données : résumé ESPN du match
   (/summary?event=ID), rafraîchi toutes les 30 s pendant le direct.
   Onglets : Résumé (buts, cartons, remplacements), Compositions (système,
   titulaires, remplaçants), Statistiques (possession, tirs…), Avant-match
   (forme toutes compétitions, probabilités du marché).

   Deux parties :
   1. parseSummary(summary) — calcul PUR, sans DOM, testable dans Node ;
   2. open(eventId, opts) / close() — fenêtre et comportement de dialogue.
      opts.espn : instance ESPN de la compétition (défaut : window.ESPN) ;
      opts.match : match normalisé déjà connu (affiché en attendant le résumé).
   API : window.LDCMatchPanel
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCMatchPanel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- 1. Lecture du résumé ESPN ---------------- */
  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function teamLogo(t) { return (t && (t.logo || (t.logos && t.logos[0] && t.logos[0].href))) || ''; }
  function clockVal(e) { return (e.clock && typeof e.clock.value === 'number') ? e.clock.value : 0; }

  /* Statistiques retenues, dans l'ordre d'affichage. pct : valeur ESPN entre
     0 et 1 (passes réussies). */
  var STATS = [
    { key: 'possessionPct', fr: 'Possession', en: 'Possession', unit: '%' },
    { key: 'totalShots', fr: 'Tirs', en: 'Shots' },
    { key: 'shotsOnTarget', fr: 'Tirs cadrés', en: 'Shots on target' },
    { key: 'wonCorners', fr: 'Corners', en: 'Corners' },
    { key: 'saves', fr: 'Arrêts', en: 'Saves' },
    { key: 'totalPasses', fr: 'Passes', en: 'Passes' },
    { key: 'passPct', fr: 'Passes réussies', en: 'Pass accuracy', pct: true },
    { key: 'foulsCommitted', fr: 'Fautes', en: 'Fouls' },
    { key: 'offsides', fr: 'Hors-jeu', en: 'Offsides' },
    { key: 'yellowCards', fr: 'Cartons jaunes', en: 'Yellow cards' },
    { key: 'redCards', fr: 'Cartons rouges', en: 'Red cards' }
  ];

  /* Cote américaine -> probabilité implicite. */
  function implied(ml) {
    ml = Number(ml); if (!ml || isNaN(ml)) return null;
    return ml > 0 ? 100 / (ml + 100) : -ml / (-ml + 100);
  }

  function parseSummary(s) {
    s = s || {};
    var comp = (s.header && s.header.competitions && s.header.competitions[0]) || {};
    var st = comp.status || {}, type = st.type || {};
    var sides = { home: null, away: null };
    (comp.competitors || []).forEach(function (c) {
      var t = c.team || {};
      sides[c.homeAway === 'away' ? 'away' : 'home'] = {
        id: String(t.id || c.id || ''), name: t.displayName || t.name || '—', abbr: t.abbreviation || '',
        logo: teamLogo(t), score: num(c.score), shootout: num(c.shootoutScore), winner: !!c.winner
      };
    });
    var home = sides.home || { id: '', name: '—' }, away = sides.away || { id: '', name: '—' };
    function sideOf(teamId) { return String(teamId) === home.id ? 'home' : (String(teamId) === away.id ? 'away' : null); }

    /* Événements clés. Un but contre son camp est attribué par ESPN à l'équipe
       qui en profite (vérifié : « Own Goal by Seslar, Celje », équipe Leverkusen). */
    var events = [], goals = { home: [], away: [] };
    (s.keyEvents || []).forEach(function (e) {
      var k = (e.type && e.type.type) || '', side = sideOf(e.team && e.team.id);
      var who = (e.participants || []).map(function (p) { return (p.athlete && p.athlete.displayName) || ''; });
      var minute = (e.clock && e.clock.displayValue) || '';
      var ev = null;
      if (e.scoringPlay || /^goal|penalty---scored|own-goal/.test(k)) {
        if (k === 'penalty---missed' || k === 'penalty---saved') return;
        ev = { kind: 'goal', side: side, minute: minute, player: who[0] || '', assist: k === 'own-goal' ? '' : (who[1] || ''),
               own: k === 'own-goal', pen: /penalty/.test(k) };
        if (side) goals[side].push(ev);
      } else if (k === 'yellow-card') ev = { kind: 'yellow', side: side, minute: minute, player: who[0] || '' };
      else if (k === 'red-card') ev = { kind: /second yellow/i.test(e.text || '') ? 'second-yellow' : 'red', side: side, minute: minute, player: who[0] || '' };
      else if (k === 'substitution') ev = { kind: 'sub', side: side, minute: minute, player: who[0] || '', out: who[1] || '' };
      else if (k === 'halftime') ev = { kind: 'ht', side: null, minute: minute };
      else if (k === 'penalty---missed' || k === 'penalty---saved') ev = { kind: 'pen-miss', side: side, minute: minute, player: who[0] || '' };
      if (ev) { ev.t = clockVal(e); ev.period = (e.period && e.period.number) || 0; events.push(ev); }
    });
    events.sort(function (a, b) { return (a.period - b.period) || (a.t - b.t); });

    /* Compositions : titulaires dans l'ordre du système, puis remplaçants. */
    var lineups = {};
    (s.rosters || []).forEach(function (r) {
      var side = r.homeAway === 'away' ? 'away' : 'home';
      var players = (r.roster || []).map(function (p) {
        var a = p.athlete || {};
        return { id: String(a.id || ''), name: a.displayName || a.fullName || '', short: a.shortName || a.displayName || '',
                 jersey: p.jersey || '', pos: (p.position && p.position.abbreviation) || '', starter: !!p.starter,
                 place: num(p.formationPlace) || 99, subbedIn: !!p.subbedIn, subbedOut: !!p.subbedOut };
      });
      if (!players.length) return;
      lineups[side] = {
        formation: r.formation || '',
        starters: players.filter(function (p) { return p.starter; }).sort(function (a, b) { return a.place - b.place; }),
        bench: players.filter(function (p) { return !p.starter; }).sort(function (a, b) { return (b.subbedIn - a.subbedIn) || a.name.localeCompare(b.name); })
      };
    });

    /* Statistiques d'équipe. */
    var raw = {};
    ((s.boxscore && s.boxscore.teams) || []).forEach(function (t) {
      var side = sideOf(t.team && t.team.id); if (!side) return;
      raw[side] = {};
      (t.statistics || []).forEach(function (x) { raw[side][x.name] = x.displayValue; });
    });
    var stats = [];
    if (raw.home && raw.away) STATS.forEach(function (d) {
      var h = parseFloat(raw.home[d.key]), a = parseFloat(raw.away[d.key]);
      if (isNaN(h) || isNaN(a)) return;
      if (d.pct) { h = Math.round(h * 100); a = Math.round(a * 100); }
      stats.push({ key: d.key, fr: d.fr, en: d.en, home: h, away: a, unit: d.pct || d.unit ? '%' : '' });
    });

    /* Forme : 5 derniers matchs, toutes compétitions. */
    var form = {};
    (s.lastFiveGames || []).forEach(function (g) {
      var side = sideOf(g.team && g.team.id); if (!side) return;
      form[side] = (g.events || []).map(function (e) {
        /* « score » d'ESPN met le vainqueur en premier : on recompose le score
           du point de vue du club (ses buts d'abord). */
        var at = e.atVs === '@', hs = num(e.homeTeamScore), as = num(e.awayTeamScore);
        var sc = (hs != null && as != null) ? (at ? as + '-' + hs : hs + '-' + as) : (e.score || '');
        return { result: e.gameResult || '', score: sc, at: at, opp: (e.opponent && e.opponent.displayName) || '',
                 oppLogo: e.opponentLogo || (e.opponent && e.opponent.logo) || '', date: e.gameDate || '', comp: e.leagueName || e.competitionName || '' };
      });
    });

    /* Probabilités du marché : cotes du premier fournisseur, marge retirée. */
    var probs = null, pc = (s.pickcenter && s.pickcenter[0]) || (s.odds && s.odds[0]) || null;
    if (pc) {
      var ph = implied(pc.homeTeamOdds && pc.homeTeamOdds.moneyLine), pa = implied(pc.awayTeamOdds && pc.awayTeamOdds.moneyLine),
          pd = implied(pc.drawOdds && pc.drawOdds.moneyLine);
      if (ph && pa && pd) {
        var sum = ph + pa + pd;
        probs = { home: Math.round(ph / sum * 100), draw: Math.round(pd / sum * 100), away: Math.round(pa / sum * 100),
                  provider: (pc.provider && pc.provider.name) || '' };
      }
    }

    var gi = s.gameInfo || {}, v = gi.venue || {};
    return {
      id: String(comp.id || (s.header && s.header.id) || ''),
      date: comp.date || null,
      state: type.state || 'pre', detail: type.shortDetail || type.detail || '', clock: st.displayClock || '',
      completed: !!type.completed,
      home: home, away: away, goals: goals, events: events, lineups: lineups, stats: stats, form: form, probs: probs,
      venue: v.fullName ? { name: v.fullName, city: (v.address && v.address.city) || '', country: (v.address && v.address.country) || '' } : null,
      attendance: gi.attendance || null,
      round: (comp.notes && comp.notes[0] && comp.notes[0].headline) || ''
    };
  }

  var api = { parseSummary: parseSummary, implied: implied, STATS: STATS };
  if (typeof document === 'undefined') return api;

  /* ---------------- 2. Fenêtre ---------------- */
  var LIVE_REFRESH = 30000;
  function isEn() { try { return window.I18N && I18N.getLang() === 'en'; } catch (e) { return false; } }
  function T(fr, en) { return isEn() ? en : fr; }
  function loc() { return isEn() ? 'en-GB' : 'fr-FR'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function crest(src, cls) { return src ? '<img class="' + cls + '" src="' + esc(src) + '" alt="" onerror="this.style.visibility=\'hidden\'">' : '<span class="' + cls + '"></span>'; }

  var host = null, panel = null, body = null;
  var state = { id: null, espn: null, data: null, base: null, tab: null, tabChosen: false, timer: null, lastFocus: null, err: false };

  function compName(espn) { var c = espn && espn.COMP; return c ? T(c.fr, c.en) : T('Ligue des Champions', 'Champions League'); }

  /* Données de secours tant que le résumé n'est pas arrivé : le match tel que
     la page le connaît déjà. */
  function fromMatch(m) {
    function side(c) { return { id: String(c.teamId || ''), name: c.name, abbr: c.abbr, logo: c.logo, score: c.score, shootout: c.shootout, winner: !!c.winner }; }
    return { id: String(m.id), date: m.date, state: m.state, detail: m.statusDetail || '', clock: m.displayClock || '', home: side(m.home), away: side(m.away),
             goals: { home: [], away: [] }, events: [], lineups: {}, stats: [], form: {}, probs: null, venue: null, attendance: null, round: '' };
  }

  function statusLine(d) {
    if (d.state === 'in') return '<span class="mp-live"><i></i>' + esc(/HT|Half/i.test(d.detail) ? T('Mi-temps', 'Half-time') : (d.clock || d.detail || T('En direct', 'Live'))) + '</span>';
    if (d.state === 'post') return '<span class="mp-ft">' + esc(T('Terminé', 'Full time')) + (d.detail && !/^FT$|Full Time/i.test(d.detail) ? ' · ' + esc(d.detail) : '') + '</span>';
    if (!d.date) return '';
    var dt = new Date(d.date);
    return '<span class="mp-ko">' + esc(dt.toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + dt.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' })) + '</span>';
  }
  function scorers(list) {
    return list.map(function (g) {
      return '<li>' + esc(g.player || '?') + (g.pen ? ' <abbr title="' + esc(T('penalty', 'penalty')) + '">' + esc(T('(p)', '(pen)')) + '</abbr>' : '') +
        (g.own ? ' <abbr title="' + esc(T('contre son camp', 'own goal')) + '">' + esc(T('(csc)', '(og)')) + '</abbr>' : '') + ' <span>' + esc(g.minute) + '</span></li>';
    }).join('');
  }
  function header(d) {
    var pre = d.state === 'pre', pen = d.home.shootout != null && d.away.shootout != null && (d.home.shootout || d.away.shootout);
    function team(t, cls) { return '<div class="mp-team ' + cls + '">' + crest(t.logo, 'mp-crest') + '<span class="mp-tname">' + esc(t.name) + '</span></div>'; }
    return '<header class="mp-head">' +
      '<div class="mp-comp">' + esc(compName(state.espn)) + (d.round ? ' · ' + esc(d.round) : '') + '</div>' +
      '<button type="button" class="mp-close" data-mp-close aria-label="' + esc(T('Fermer', 'Close')) + '">×</button>' +
      '<div class="mp-board">' + team(d.home, 'home') +
        '<div class="mp-score' + (d.state === 'in' ? ' is-live' : '') + '">' + (pre ? '<span class="mp-vs">–</span>' : d.home.score + '<span class="mp-sep">–</span>' + d.away.score) +
          (pen ? '<div class="mp-pens">' + esc(T('t.a.b.', 'pens')) + ' ' + d.home.shootout + '–' + d.away.shootout + '</div>' : '') + '</div>' +
        team(d.away, 'away') + '</div>' +
      '<div class="mp-status">' + statusLine(d) + '</div>' +
      ((d.goals.home.length || d.goals.away.length) ? '<div class="mp-scorers"><ul>' + scorers(d.goals.home) + '</ul><span class="mp-ball" aria-hidden="true">⚽</span><ul class="r">' + scorers(d.goals.away) + '</ul></div>' : '') +
      (d.venue ? '<div class="mp-venue">🏟 ' + esc(d.venue.name) + (d.venue.city ? ', ' + esc(d.venue.city) : '') +
        (d.attendance ? ' · ' + esc(Number(d.attendance).toLocaleString(loc())) + ' ' + esc(T('spectateurs', 'spectators')) : '') + '</div>' : '') +
    '</header>';
  }

  var ICON = { goal: '⚽', yellow: '🟨', red: '🟥', 'second-yellow': '🟨🟥', sub: '🔄', 'pen-miss': '❌' };
  function tabEvents(d) {
    var list = d.events.filter(function (e) { return e.kind !== 'ht'; });
    if (!list.length) return '<p class="mp-empty">' + esc(d.state === 'pre' ? T('Le match n’a pas commencé.', 'The match has not started.') : T('Aucun événement pour l’instant.', 'No event yet.')) + '</p>';
    return '<ol class="mp-tl">' + d.events.map(function (e) {
      if (e.kind === 'ht') return '<li class="mp-tl-ht"><span>' + esc(T('Mi-temps', 'Half-time')) + '</span></li>';
      var what;
      if (e.kind === 'goal') what = '<b>' + esc(e.player || T('But', 'Goal')) + '</b>' + (e.pen ? ' · ' + esc(T('penalty', 'penalty')) : '') + (e.own ? ' · ' + esc(T('contre son camp', 'own goal')) : '') + (e.assist ? '<small>' + esc(T('passe de ', 'assist: ') + e.assist) + '</small>' : '');
      else if (e.kind === 'sub') what = '<span class="mp-in">▲ ' + esc(e.player) + '</span><span class="mp-out">▼ ' + esc(e.out) + '</span>';
      else if (e.kind === 'pen-miss') what = esc(e.player) + ' · ' + esc(T('penalty manqué', 'penalty missed'));
      else what = esc(e.player) + (e.kind === 'second-yellow' ? ' · ' + esc(T('2e jaune', '2nd yellow')) : '');
      return '<li class="mp-tl-' + (e.side || 'mid') + ' k-' + e.kind + '"><span class="mp-tl-min">' + esc(e.minute) + '</span><span class="mp-tl-ico" aria-hidden="true">' + (ICON[e.kind] || '•') + '</span><span class="mp-tl-what">' + what + '</span></li>';
    }).join('') + '</ol>';
  }
  function tabLineups(d) {
    var L = d.lineups;
    if (!L.home && !L.away) return '<p class="mp-empty">' + esc(T('Compositions publiées environ une heure avant le coup d’envoi.', 'Line-ups are published about an hour before kick-off.')) + '</p>';
    var marks = {};
    d.events.forEach(function (e) {
      if (!e.player) return;
      var k = e.kind === 'goal' && !e.own ? '⚽' : (e.kind === 'yellow' ? '🟨' : (e.kind === 'red' || e.kind === 'second-yellow' ? '🟥' : ''));
      if (k) marks[e.player] = (marks[e.player] || '') + k;
    });
    function player(p) {
      return '<li><span class="mp-num">' + esc(p.jersey) + '</span><span class="mp-pname">' + esc(p.name) + '</span>' +
        (marks[p.name] ? '<span class="mp-mk" aria-hidden="true">' + marks[p.name] + '</span>' : '') +
        (p.subbedOut ? '<span class="mp-out" title="' + esc(T('remplacé', 'subbed off')) + '">▼</span>' : '') + (p.subbedIn ? '<span class="mp-in" title="' + esc(T('entré en jeu', 'came on')) + '">▲</span>' : '') +
        '<span class="mp-pos">' + esc(p.pos) + '</span></li>';
    }
    function col(side, t) {
      var l = L[side]; if (!l) return '<div class="mp-lu"></div>';
      return '<div class="mp-lu"><div class="mp-lu-h">' + crest(t.logo, 'mp-mini') + esc(t.abbr || t.name) + (l.formation ? ' <span class="mp-form">' + esc(l.formation) + '</span>' : '') + '</div>' +
        '<ul class="mp-xi">' + l.starters.map(player).join('') + '</ul>' +
        (l.bench.length ? '<div class="mp-lu-s">' + esc(T('Remplaçants', 'Substitutes')) + '</div><ul class="mp-bench">' + l.bench.map(player).join('') + '</ul>' : '') + '</div>';
    }
    return '<div class="mp-lus">' + col('home', d.home) + col('away', d.away) + '</div>';
  }
  function tabStats(d) {
    if (!d.stats.length) return '<p class="mp-empty">' + esc(d.state === 'pre' ? T('Statistiques disponibles pendant le match.', 'Statistics available during the match.') : T('Pas de statistiques publiées par ESPN pour ce match.', 'ESPN has published no statistics for this match.')) + '</p>';
    return '<div class="mp-stats">' + d.stats.map(function (x) {
      var tot = x.home + x.away, ph = tot ? x.home / tot * 100 : 50;
      var hw = x.home > x.away, aw = x.away > x.home;
      return '<div class="mp-st"><div class="mp-st-row"><b class="' + (hw ? 'lead' : '') + '">' + x.home + x.unit + '</b><span>' + esc(T(x.fr, x.en)) + '</span><b class="' + (aw ? 'lead' : '') + '">' + x.away + x.unit + '</b></div>' +
        '<div class="mp-bar" role="img" aria-label="' + esc(T(x.fr, x.en) + ' : ' + x.home + x.unit + ' – ' + x.away + x.unit) + '"><i class="h" style="width:' + ph.toFixed(1) + '%"></i><i class="a" style="width:' + (100 - ph).toFixed(1) + '%"></i></div></div>';
    }).join('') + '</div>';
  }
  function tabPre(d) {
    var html = '';
    if (d.probs) {
      html += '<div class="mp-box"><div class="mp-box-t">' + esc(T('Probabilités du marché', 'Market probabilities')) + '</div>' +
        '<div class="mp-probs"><div style="flex:' + d.probs.home + '" class="h"><b>' + d.probs.home + ' %</b><span>' + esc(d.home.abbr || d.home.name) + '</span></div>' +
        '<div style="flex:' + d.probs.draw + '" class="d"><b>' + d.probs.draw + ' %</b><span>' + esc(T('Nul', 'Draw')) + '</span></div>' +
        '<div style="flex:' + d.probs.away + '" class="a"><b>' + d.probs.away + ' %</b><span>' + esc(d.away.abbr || d.away.name) + '</span></div></div>' +
        '<p class="mp-note">' + esc(T('Déduites des cotes ' + (d.probs.provider || '') + ' publiées par ESPN, marge du bookmaker retirée. Indicatif.',
                                     'Derived from ' + (d.probs.provider || '') + ' odds published by ESPN, bookmaker margin removed. Indicative.')) + '</p></div>';
    }
    function formCol(side, t) {
      var f = d.form[side]; if (!f || !f.length) return '';
      return '<div class="mp-fcol"><div class="mp-lu-h">' + crest(t.logo, 'mp-mini') + esc(t.name) + '</div><ul class="mp-fl">' + f.map(function (g) {
        var r = g.result === 'W' ? 'w' : (g.result === 'L' ? 'l' : 'd');
        return '<li><span class="cp-badge ' + r + '">' + esc(r === 'w' ? T('V', 'W') : (r === 'l' ? T('D', 'L') : T('N', 'D'))) + '</span>' +
          '<span class="mp-fo">' + esc((g.at ? T('à ', 'at ') : T('vs ', 'vs ')) + g.opp) + '<small>' + esc(g.comp) + '</small></span><b>' + esc(g.score) + '</b></li>';
      }).join('') + '</ul></div>';
    }
    var forms = formCol('home', d.home) + formCol('away', d.away);
    if (forms) html += '<div class="mp-box"><div class="mp-box-t">' + esc(T('Forme : 5 derniers matchs, toutes compétitions', 'Form: last 5 matches, all competitions')) + '</div><div class="mp-fcols">' + forms + '</div></div>';
    return html || '<p class="mp-empty">' + esc(T('Pas d’informations d’avant-match.', 'No pre-match information.')) + '</p>';
  }

  var TABS = [
    { key: 'events', fr: 'Résumé', en: 'Summary', render: tabEvents },
    { key: 'lineups', fr: 'Compositions', en: 'Line-ups', render: tabLineups },
    { key: 'stats', fr: 'Statistiques', en: 'Stats', render: tabStats },
    { key: 'pre', fr: 'Avant-match', en: 'Preview', render: tabPre }
  ];
  function render() {
    var d = state.data || state.base; if (!d || !body) return;
    /* Onglet par défaut : Avant-match avant le coup d'envoi, Résumé ensuite ;
       recalculé à l'arrivée du résumé tant que le visiteur n'a rien choisi. */
    if (!state.tabChosen) state.tab = d.state === 'pre' ? 'pre' : 'events';
    /* Le contenu est réécrit à chaque rafraîchissement : on garde le focus. */
    var a = document.activeElement, keep = a && panel.contains(a) ? (a.getAttribute('data-mp-tab') ? '[data-mp-tab="' + a.getAttribute('data-mp-tab') + '"]' : (a.classList.contains('mp-close') ? '.mp-close' : null)) : null;
    var tab = TABS.filter(function (t) { return t.key === state.tab; })[0] || TABS[0];
    body.innerHTML = header(d) +
      '<div class="mp-tabs" role="tablist">' + TABS.map(function (t) {
        var on = t.key === tab.key;
        return '<button type="button" role="tab" id="mp-tab-' + t.key + '" aria-selected="' + on + '" aria-controls="mp-pane" tabindex="' + (on ? 0 : -1) + '" data-mp-tab="' + t.key + '" class="' + (on ? 'on' : '') + '">' + esc(T(t.fr, t.en)) + '</button>';
      }).join('') + '</div>' +
      '<div class="mp-pane" id="mp-pane" role="tabpanel" aria-labelledby="mp-tab-' + tab.key + '">' +
        (state.data ? tab.render(d) : (state.err ? '<p class="mp-empty">' + esc(T('Détails indisponibles : ESPN ne répond pas.', 'Details unavailable: ESPN is not responding.')) + '</p>' : '<p class="mp-empty">' + esc(T('Chargement…', 'Loading…')) + '</p>')) +
      '</div>';
    panel.setAttribute('aria-label', d.home.name + ' – ' + d.away.name);
    if (keep) { var k = panel.querySelector(keep); if (k) k.focus(); }
  }

  function load() {
    clearTimeout(state.timer);
    var id = state.id, espn = state.espn;
    if (document.hidden) { state.timer = setTimeout(load, LIVE_REFRESH); return; }
    espn.fetchSummary(id, { ttl: 15000 }).then(function (s) {
      if (state.id !== id) return;
      state.data = parseSummary(s); state.err = false;
      render();
      if (state.data.state === 'in' || (state.data.state === 'pre' && state.data.date && Date.parse(state.data.date) - Date.now() < 15 * 60000)) state.timer = setTimeout(load, LIVE_REFRESH);
    }, function () {
      if (state.id !== id) return;
      state.err = true; render();
      state.timer = setTimeout(load, LIVE_REFRESH);
    });
  }

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.className = 'mp-host'; host.hidden = true;
    host.innerHTML = '<div class="mp-backdrop" data-mp-close></div><div class="mp-panel" role="dialog" aria-modal="true" tabindex="-1"><div class="mp-body"></div></div>';
    document.body.appendChild(host);
    panel = host.querySelector('.mp-panel'); body = host.querySelector('.mp-body');
    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-mp-close]')) { close(); return; }
      var t = e.target.closest('[data-mp-tab]'); if (t) { state.tab = t.getAttribute('data-mp-tab'); state.tabChosen = true; render(); var b = panel.querySelector('[data-mp-tab="' + state.tab + '"]'); if (b) b.focus(); }
    });
    host.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      var t = e.target.closest && e.target.closest('[data-mp-tab]');
      if (t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        var keys = TABS.map(function (x) { return x.key; }), i = keys.indexOf(state.tab);
        state.tab = keys[(i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length]; state.tabChosen = true; render();
        panel.querySelector('[data-mp-tab="' + state.tab + '"]').focus(); e.preventDefault(); return;
      }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(panel.querySelectorAll('button,[href],[tabindex="0"]'), function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    document.addEventListener('visibilitychange', function () { if (!host.hidden && !document.hidden && state.data && state.data.state === 'in') load(); });
    /* Échap ferme la fiche de match, même si le focus est sorti du panneau,
       sans fermer la fiche club ouverte dessous (capture, puis arrêt). */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || host.hidden) return;
      e.preventDefault(); e.stopImmediatePropagation(); close();
    }, true);
  }

  function open(eventId, opts) {
    opts = opts || {};
    ensureHost();
    state.lastFocus = document.activeElement;
    state.id = String(eventId); state.espn = opts.espn || window.ESPN;
    state.data = null; state.err = false; state.tab = opts.tab || null; state.tabChosen = !!opts.tab;
    state.base = opts.match ? fromMatch(opts.match) : { id: state.id, state: 'pre', home: { name: '…' }, away: { name: '…' }, goals: { home: [], away: [] }, events: [], lineups: {}, stats: [], form: {} };
    host.hidden = false;
    document.documentElement.classList.add('mp-open');
    render();
    var c = panel.querySelector('.mp-close'); if (c) c.focus();
    load();
  }
  function close() {
    if (!host || host.hidden) return;
    clearTimeout(state.timer); state.id = null;
    host.hidden = true;
    document.documentElement.classList.remove('mp-open');
    if (state.lastFocus && document.body.contains(state.lastFocus)) state.lastFocus.focus();
  }

  /* Délégation : tout élément [data-mp-open="ID"] ouvre la fiche du match ;
     [data-mp-league] choisit la compétition (sinon celle de la page). Phase
     de capture : le clic ne déclenche pas en plus l'action de la carte. */
  function trigger(e) {
    var b = e.target.closest && e.target.closest('[data-mp-open]');
    if (!b || (host && host.contains(b))) return false;
    var lg = b.getAttribute('data-mp-league');
    var espn = (lg && window.ESPN && ESPN.forLeague) ? ESPN.forLeague(lg) : window.ESPN;
    e.preventDefault(); e.stopPropagation();
    open(b.getAttribute('data-mp-open'), { espn: espn, match: b._mpMatch || null });
    return true;
  }
  document.addEventListener('click', trigger, true);
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-mp-open]:not(button)')) trigger(e);
  }, true);
  window.addEventListener('ldc:langchange', function () { if (host && !host.hidden) render(); });

  api.open = open; api.close = close;
  api.isOpen = function () { return !!(host && !host.hidden); };
  return api;
});
