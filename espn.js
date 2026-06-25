/* =========================================================================
   espn.js — Couche d'accès aux données ESPN (API publique non officielle)
   Tracker LIGUE DES CHAMPIONS
   -------------------------------------------------------------------------
   ⚑ LE SEUL paramètre qui change la compétition est le slug ci-dessous.
     Pour suivre une autre compétition ESPN, change UNIQUEMENT LEAGUE_SLUG.
   -------------------------------------------------------------------------
   Robustesse :
   - timeout sur CHAQUE fetch (AbortSignal.timeout + fallback AbortController)
   - cache court sur scoreboard & summary (limite le volume de requêtes)
   - parsing défensif : un match malformé est ignoré, pas de crash global
   API globale : window.ESPN
   ========================================================================= */
(function (global) {
  'use strict';

  /* ===== LA constante de compétition ===================================== */
  var LEAGUE_SLUG = 'uefa.champions';
  /* ======================================================================= */

  var BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + LEAGUE_SLUG;
  var BASE_CORE = 'https://site.api.espn.com/apis/v2/sports/soccer/' + LEAGUE_SLUG;

  var DEFAULT_TIMEOUT = 10000; // 10 s

  /* ---- Caches mémoire ---------------------------------------------------- */
  var scoreboardCache = {};  // url -> { ts, data }
  var summaryCache = {};     // eventId -> { ts, data }
  var SCOREBOARD_TTL = 15000; // 15 s
  var SUMMARY_TTL = 20000;    // 20 s

  /* ---- Utilitaires date -------------------------------------------------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); }

  /* Saison UEFA : août (année N) -> juillet (N+1).
     Surcharge possible via ?season=YYYY (année de DÉBUT). */
  function seasonStartYear() {
    try {
      var p = new URLSearchParams(global.location.search);
      var s = parseInt(p.get('season'), 10);
      if (!isNaN(s) && s > 2000 && s < 2100) return s;
    } catch (e) {}
    var now = new Date();
    var y = now.getFullYear();
    // À partir d'août on bascule sur la nouvelle saison
    return now.getMonth() >= 7 ? y : y - 1;
  }

  function seasonRange() {
    var y = seasonStartYear();
    return { start: y + '0801', end: (y + 1) + '0731', startYear: y };
  }

  /* ---- fetch avec timeout robuste --------------------------------------- */
  function fetchJSON(url, timeout) {
    timeout = timeout || DEFAULT_TIMEOUT;

    // 1) AbortSignal.timeout (moderne)
    if (global.AbortSignal && typeof global.AbortSignal.timeout === 'function') {
      return fetch(url, { signal: global.AbortSignal.timeout(timeout), cache: 'no-store' })
        .then(checkOk);
    }

    // 2) Fallback : AbortController + setTimeout
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var opts = { cache: 'no-store' };
    if (ctrl) opts.signal = ctrl.signal;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeout);

    return fetch(url, opts).then(function (r) {
      clearTimeout(timer);
      return checkOk(r);
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function checkOk(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ---- Scoreboard -------------------------------------------------------- */
  function scoreboardURL(dates, limit) {
    var u = BASE + '/scoreboard';
    var q = [];
    if (dates) q.push('dates=' + dates);
    if (limit) q.push('limit=' + limit);
    return q.length ? u + '?' + q.join('&') : u;
  }

  function getCached(store, key, ttl) {
    var hit = store[key];
    if (hit && (Date.now() - hit.ts) < ttl) return hit.data;
    return null;
  }

  /* Scoreboard du jour (ou d'une plage). Renvoie la liste d'events bruts. */
  function fetchScoreboard(dates, opts) {
    opts = opts || {};
    var url = scoreboardURL(dates, opts.limit);
    var cached = getCached(scoreboardCache, url, opts.ttl || SCOREBOARD_TTL);
    if (cached && !opts.force) return Promise.resolve(cached);

    return fetchJSON(url, opts.timeout).then(function (data) {
      var events = (data && data.events) ? data.events : [];
      scoreboardCache[url] = { ts: Date.now(), data: events };
      return events;
    });
  }

  /* Tous les matchs de la saison courante (plage de dates). */
  function fetchSeasonEvents(opts) {
    var r = seasonRange();
    return fetchScoreboard(r.start + '-' + r.end, Object.assign({ limit: 500, ttl: 20000 }, opts || {}));
  }

  /* ---- Summary (buteurs, cartons, etc.) --------------------------------- */
  function fetchSummary(eventId, opts) {
    opts = opts || {};
    var cached = getCached(summaryCache, eventId, opts.ttl || SUMMARY_TTL);
    if (cached && !opts.force) return Promise.resolve(cached);

    var url = BASE + '/summary?event=' + encodeURIComponent(eventId);
    return fetchJSON(url, opts.timeout).then(function (data) {
      summaryCache[eventId] = { ts: Date.now(), data: data };
      return data;
    });
  }

  /* =======================================================================
     PARSING DÉFENSIF
     ======================================================================= */

  /* Retourne un objet "match" normalisé, ou null si l'event est malformé. */
  function normalizeEvent(ev) {
    try {
      if (!ev || !ev.competitions || !ev.competitions.length) return null;
      var comp = ev.competitions[0];
      if (!comp || !comp.status || !comp.status.type) return null;

      var st = comp.status;
      var type = st.type;
      var competitors = comp.competitors || [];
      if (competitors.length < 2) return null;

      var home = competitors.filter(function (c) { return c.homeAway === 'home'; })[0] || competitors[0];
      var away = competitors.filter(function (c) { return c.homeAway === 'away'; })[0] || competitors[1];
      if (!home || !away) return null;

      return {
        id: ev.id,
        date: ev.date || comp.date || null,
        dateObj: parseDate(ev.date || comp.date),
        name: ev.name || '',
        shortName: ev.shortName || '',
        state: type.state || 'pre',                  // pre | in | post
        statusName: type.name || '',                  // STATUS_*
        statusDetail: type.shortDetail || type.detail || type.description || '',
        completed: !!type.completed,
        displayClock: st.displayClock || '',
        period: st.period || 0,
        notes: extractNotes(comp, ev),
        round: classifyRound(comp, ev),
        seasonSlug: (ev.season && ev.season.slug) ? String(ev.season.slug) : '',
        leg: (comp.leg && comp.leg.value) || null,
        series: comp.series || null,
        home: normalizeCompetitor(home),
        away: normalizeCompetitor(away),
        competition: comp
      };
    } catch (e) {
      return null;
    }
  }

  function normalizeCompetitor(c) {
    var team = c.team || {};
    return {
      id: c.id || team.id || '',
      teamId: team.id || '',
      homeAway: c.homeAway || '',
      score: toInt(c.score),
      scoreRaw: c.score,
      shootoutScore: (c.shootoutScore != null && c.shootoutScore !== '') ? toInt(c.shootoutScore) : null,
      winner: !!c.winner,
      name: team.displayName || team.name || team.shortDisplayName || '—',
      shortName: team.shortDisplayName || team.name || team.displayName || '—',
      abbr: (team.abbreviation || '').toUpperCase(),
      logo: team.logo || (team.logos && team.logos[0] && team.logos[0].href) || '',
      color: team.color ? ('#' + team.color) : null
    };
  }

  function toInt(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function extractNotes(comp, ev) {
    var out = [];
    try {
      (comp.notes || []).forEach(function (n) { if (n && n.headline) out.push(n.headline); });
    } catch (e) {}
    if (ev && ev.season && ev.season.slug) out.push(ev.season.slug);
    return out.join(' | ');
  }

  /* Mapping fiable depuis ev.season.slug (signal officiel ESPN). */
  var SLUG_ROUND = {
    'league-phase': 'league',
    'knockout-round-playoffs': 'po',
    'round-of-16': 'r16',
    'quarterfinals': 'qf',
    'semifinals': 'sf',
    'final': 'final'
  };

  /* Classe un match : 'league' (phase de ligue) ou 'po'/'r16'/'qf'/'sf'/'final' */
  function classifyRound(comp, ev) {
    // 1) Signal fiable : le slug de saison ESPN
    var slug = (ev && ev.season && ev.season.slug) ? String(ev.season.slug).toLowerCase() : '';
    if (SLUG_ROUND[slug]) return SLUG_ROUND[slug];
    if (slug) {
      if (/playoff|barrage|knockout/.test(slug)) return 'po';
      if (/round-of-16|eighth|1-8/.test(slug)) return 'r16';
      if (/quarter/.test(slug)) return 'qf';
      if (/semi/.test(slug)) return 'sf';
      if (/final/.test(slug)) return 'final';
      if (/league|group/.test(slug)) return 'league';
    }

    // 2) Repli : titres de notes / nom du match
    var hay = (extractNotes(comp, ev) + ' ' + (ev && ev.name ? ev.name : '') + ' ' +
               (ev && ev.shortName ? ev.shortName : '')).toLowerCase();
    if (/play-?off|barrage|knockout round/.test(hay)) return 'po';
    if (/round of 16|1\/8|eighth|huiti/.test(hay)) return 'r16';
    if (/quarter|1\/4|quart/.test(hay)) return 'qf';
    if (/semi|1\/2|demi/.test(hay)) return 'sf';
    if (/final/.test(hay)) return 'final';
    if (/league phase|matchday|journ[ée]e|group|league stage/.test(hay)) return 'league';

    // 3) Dernier repli : par date (phase de ligue ~ août -> fin janvier)
    var d = parseDate(ev && ev.date);
    if (d) {
      var m = d.getMonth(); // 0=jan
      if (m >= 7 || m === 0) return 'league';
      return 'po';
    }
    return 'league';
  }

  function isKnockout(round) { return round && round !== 'league'; }

  /* =======================================================================
     CLASSEMENT — phase de ligue (36)
     Compte les matchs de phase de ligue. Les matchs 'in' (en cours) comptent
     de façon PROVISOIRE avec le score courant => classement vivant.
     ======================================================================= */
  function computeStandings(events) {
    var teams = {}; // teamId -> ligne

    function row(c) {
      var k = c.teamId || c.name;
      if (!teams[k]) {
        teams[k] = {
          teamId: c.teamId, name: c.name, shortName: c.shortName,
          abbr: c.abbr, logo: c.logo,
          pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, live: false
        };
      }
      return teams[k];
    }

    (events || []).forEach(function (ev) {
      var m = normalizeEvent(ev);
      if (!m) return;
      if (m.round !== 'league') return;             // phase de ligue uniquement
      if (m.state === 'pre') return;                 // pas encore joué
      var counted = (m.state === 'post') || (m.state === 'in');
      if (!counted) return;

      var H = row(m.home), A = row(m.away);
      H.pld++; A.pld++;
      H.gf += m.home.score; H.ga += m.away.score;
      A.gf += m.away.score; A.ga += m.home.score;
      if (m.state === 'in') { H.live = true; A.live = true; }

      if (m.home.score > m.away.score) { H.w++; A.l++; H.pts += 3; }
      else if (m.home.score < m.away.score) { A.w++; H.l++; A.pts += 3; }
      else { H.d++; A.d++; H.pts += 1; A.pts += 1; }
    });

    var arr = Object.keys(teams).map(function (k) {
      var t = teams[k];
      t.gd = t.gf - t.ga;
      return t;
    });

    // Tri : pts, diff, BP, nom (départage UEFA simplifié)
    arr.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name);
    });

    arr.forEach(function (t, i) { t.pos = i + 1; });
    return arr;
  }

  /* =======================================================================
     BRACKET — phase finale
     Regroupe les matchs knockout par tour, puis par paire d'équipes (2 manches).
     ======================================================================= */
  var ROUND_ORDER = ['po', 'r16', 'qf', 'sf', 'final'];

  function buildBracket(events) {
    var byRound = { po: [], r16: [], qf: [], sf: [], final: [] };

    (events || []).forEach(function (ev) {
      var m = normalizeEvent(ev);
      if (!m || !isKnockout(m.round)) return;
      if (byRound[m.round]) byRound[m.round].push(m);
    });

    var rounds = ROUND_ORDER.map(function (key) {
      return { key: key, ties: groupTies(byRound[key]) };
    }).filter(function (r) { return r.ties.length > 0; });

    return rounds;
  }

  /* Regroupe une liste de matchs en "ties" (confrontations, 1 ou 2 manches). */
  function groupTies(matches) {
    var map = {};
    matches.sort(function (a, b) {
      return (a.dateObj ? a.dateObj.getTime() : 0) - (b.dateObj ? b.dateObj.getTime() : 0);
    });

    matches.forEach(function (m) {
      var ids = [m.home.teamId || m.home.name, m.away.teamId || m.away.name].sort();
      var key = ids.join('::');
      if (!map[key]) map[key] = { legs: [], teamA: null, teamB: null };
      map[key].legs.push(m);
    });

    return Object.keys(map).map(function (key) {
      return aggregateTie(map[key].legs);
    });
  }

  /* Agrège 1 ou 2 manches en une confrontation avec vainqueur. */
  function aggregateTie(legs) {
    // Référentiel d'équipes basé sur la 1re manche
    var first = legs[0];
    var aId = first.home.teamId || first.home.name;
    var teamA = first.home, teamB = first.away;

    var aggA = 0, aggB = 0, penA = null, penB = null, hasLive = false, anyPost = false, anyStarted = false;
    var seriesWinner = null, seriesCompleted = false;

    legs.forEach(function (leg) {
      var legAisHome = (leg.home.teamId || leg.home.name) === aId;
      var sa = legAisHome ? leg.home.score : leg.away.score;
      var sb = legAisHome ? leg.away.score : leg.home.score;
      if (leg.state !== 'pre') { aggA += sa; aggB += sb; anyStarted = true; }
      if (leg.state === 'in') hasLive = true;
      if (leg.state === 'post') anyPost = true;
      // tirs au but (sur la manche décisive)
      var soa = legAisHome ? leg.home.shootoutScore : leg.away.shootoutScore;
      var sob = legAisHome ? leg.away.shootoutScore : leg.home.shootoutScore;
      if (soa != null || sob != null) { penA = soa; penB = sob; }
      // mise à jour des crests/abbr depuis la manche la plus récente connue
      if (legAisHome) { if (leg.home.logo) teamA = leg.home; if (leg.away.logo) teamB = leg.away; }
      else { if (leg.away.logo) teamA = leg.away; if (leg.home.logo) teamB = leg.home; }
      // signal officiel ESPN : series.competitors[].winner
      if (leg.series && leg.series.competitors) {
        if (leg.series.completed) seriesCompleted = true;
        leg.series.competitors.forEach(function (sc) {
          if (sc && sc.winner) {
            if (String(sc.id) === String(aId)) seriesWinner = 'A';
            else seriesWinner = 'B';
          }
        });
      }
    });

    // Vainqueur : priorité au signal "series" d'ESPN, sinon calcul.
    var winner = null; // 'A' | 'B' | null
    var allPost = anyPost && legs.every(function (l) { return l.state === 'post'; });
    var decided = seriesCompleted || allPost;
    if (seriesWinner) {
      winner = seriesWinner;
    } else if (allPost) {
      if (aggA !== aggB) winner = aggA > aggB ? 'A' : 'B';
      else if (penA != null && penB != null && penA !== penB) winner = penA > penB ? 'A' : 'B';
      else {
        var last = legs[legs.length - 1];
        var lastAisHome = (last.home.teamId || last.home.name) === aId;
        if (last.home.winner) winner = lastAisHome ? 'A' : 'B';
        else if (last.away.winner) winner = lastAisHome ? 'B' : 'A';
      }
    }

    return {
      teamA: teamA, teamB: teamB,
      aggA: aggA, aggB: aggB,
      penA: penA, penB: penB,
      legs: legs,
      twoLegs: legs.length > 1,
      started: anyStarted,
      live: hasLive,
      decided: decided,
      winner: winner
    };
  }

  /* Le champion : vainqueur de la finale, si décidée. */
  function findChampion(rounds) {
    var fin = rounds.filter(function (r) { return r.key === 'final'; })[0];
    if (!fin || !fin.ties.length) return null;
    var t = fin.ties[0];
    if (!t.decided || !t.winner) return null;
    return t.winner === 'A' ? t.teamA : t.teamB;
  }

  /* =======================================================================
     KEY EVENTS (summary) — normalisation
     ======================================================================= */
  function normalizeKeyEvents(summary) {
    var raw = (summary && (summary.keyEvents || summary.plays)) || [];
    var out = [];
    raw.forEach(function (e) {
      try {
        var typeText = (e.type && e.type.text) || '';
        var participant = (e.participants && e.participants[0] && e.participants[0].athlete) || null;
        out.push({
          typeText: typeText,
          typeId: (e.type && e.type.id) || '',
          clock: (e.clock && e.clock.displayValue) || '',
          period: (e.period && e.period.number) || 0,
          teamId: (e.team && e.team.id) || '',
          scoringPlay: !!e.scoringPlay,
          text: e.text || e.shortText || '',
          player: participant ? participant.displayName : ''
        });
      } catch (err) {}
    });
    return out;
  }

  /* =======================================================================
     ÉTATS / HELPERS PUBLICS
     ======================================================================= */
  function isLive(m) { return m && m.state === 'in'; }
  function isUpcoming(m) { return m && m.state === 'pre'; }
  function isFinished(m) { return m && m.state === 'post'; }

  function isInterrupted(m) {
    if (!m) return false;
    return /STATUS_(DELAYED|SUSPENDED|ABANDONED|POSTPONED|CANCELED|CANCELLED)/.test(m.statusName || '');
  }

  /* Sépare "90'+3'" en { base:"90'", extra:"+3'" } pour mise en valeur. */
  function splitClock(displayClock) {
    if (!displayClock) return { base: '', extra: '' };
    var idx = displayClock.indexOf('+');
    if (idx === -1) return { base: displayClock, extra: '' };
    return { base: displayClock.slice(0, idx).trim(), extra: displayClock.slice(idx).trim() };
  }

  /* Correspondance équipe (nom anglais OU abréviation 3 lettres). */
  function matchesTeam(m, query) {
    if (!m || !query) return false;
    var q = query.trim().toLowerCase();
    function hit(c) {
      return c && (
        (c.abbr && c.abbr.toLowerCase() === q) ||
        (c.name && c.name.toLowerCase().indexOf(q) !== -1) ||
        (c.shortName && c.shortName.toLowerCase().indexOf(q) !== -1)
      );
    }
    return hit(m.home) || hit(m.away);
  }

  global.ESPN = {
    LEAGUE_SLUG: LEAGUE_SLUG,
    BASE: BASE,
    DEFAULT_TIMEOUT: DEFAULT_TIMEOUT,
    // dates / saison
    ymd: ymd,
    seasonRange: seasonRange,
    seasonStartYear: seasonStartYear,
    // fetch
    fetchJSON: fetchJSON,
    fetchScoreboard: fetchScoreboard,
    fetchSeasonEvents: fetchSeasonEvents,
    fetchSummary: fetchSummary,
    scoreboardURL: scoreboardURL,
    // parsing
    normalizeEvent: normalizeEvent,
    normalizeKeyEvents: normalizeKeyEvents,
    computeStandings: computeStandings,
    buildBracket: buildBracket,
    findChampion: findChampion,
    classifyRound: classifyRound,
    isKnockout: isKnockout,
    // états
    isLive: isLive, isUpcoming: isUpcoming, isFinished: isFinished,
    isInterrupted: isInterrupted,
    splitClock: splitClock,
    matchesTeam: matchesTeam,
    ROUND_ORDER: ROUND_ORDER
  };

})(window);
