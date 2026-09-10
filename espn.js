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

  /* Saison "actuelle" du projet = 2026-27 (année de DÉBUT 2026).
     Surcharge possible via ?season=YYYY (utilisé pour l'onglet « Souvenir »). */
  var CURRENT_SEASON = 2026;
  // ESPN fournit les saisons depuis 2001-02 (endpoint /seasons). Année de DÉBUT.
  var EARLIEST_SEASON = 2001;
  // Saisons archivées, de la plus récente à la plus ancienne.
  var ARCHIVE_SEASONS = (function () {
    var a = [];
    for (var y = CURRENT_SEASON - 1; y >= EARLIEST_SEASON; y--) a.push(y);
    return a;
  })();
  // Format « phase de ligue » à 36 (à partir de 2024-25). Avant : phase de groupes.
  function isLeaguePhaseFormat(year) { return (year == null ? seasonStartYear() : year) >= 2024; }

  function seasonParam() {
    try {
      var p = new URLSearchParams(global.location.search);
      var s = parseInt(p.get('season'), 10);
      if (!isNaN(s) && s > 2000 && s < 2100) return s;
    } catch (e) {}
    return null;
  }

  function seasonStartYear() {
    var s = seasonParam();
    return s != null ? s : CURRENT_SEASON;
  }

  /* True si on consulte une saison archivée (≠ saison actuelle). */
  function isArchive() {
    var s = seasonParam();
    return s != null && s !== CURRENT_SEASON;
  }

  /* "2026–27" */
  function seasonLabel(y) {
    if (y == null) y = seasonStartYear();
    return y + '–' + String(y + 1).slice(2);
  }

  function seasonRange() {
    var y = seasonStartYear();
    // Fenêtre sept -> août suivant (~365 j, max autorisé par ESPN). La phase de poules/ligue
    // commence toujours mi-septembre ; cette fenêtre capte aussi les finales décalées
    // (ex. 2019-20, finale en août 2020 — COVID). Le filtre par season.year écarte la saison voisine.
    return { start: y + '0901', end: (y + 1) + '0831', startYear: y };
  }

  /* En mode archive, propage ?season=N sur les liens internes (.html). */
  function preserveSeasonLinks(root) {
    var s = seasonParam();
    if (s == null) return;
    root = root || document;
    var links = root.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].hasAttribute('data-noseason')) continue;
      var href = links[i].getAttribute('href');
      if (!href || /^(https?:|#|mailto:)/.test(href)) continue;
      if (!/\.html(\?|#|$)/.test(href) && href !== '') continue;
      if (/[?&]season=/.test(href)) continue;
      links[i].setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'season=' + s);
    }
  }

  /* =======================================================================
     PALMARÈS — vainqueurs de la Coupe d'Europe / Ligue des Champions
     (données historiques vérifiées ; PSG sacré en 2025 et 2026)
     ======================================================================= */
  var UCL_PALMARES = [
    { name: 'Real Madrid',            id: 86,   keys: ['real madrid'],            n: 15, years: [1956,1957,1958,1959,1960,1966,1998,2000,2002,2014,2016,2017,2018,2022,2024] },
    { name: 'AC Milan',               id: 103,  keys: ['ac milan'],               n: 7,  years: [1963,1969,1989,1990,1994,2003,2007] },
    { name: 'Bayern Munich',          id: 132,  keys: ['bayern'],                 n: 6,  years: [1974,1975,1976,2001,2013,2020] },
    { name: 'Liverpool FC',           id: 364,  keys: ['liverpool'],              n: 6,  years: [1977,1978,1981,1984,2005,2019] },
    { name: 'FC Barcelona',           id: 83,   keys: ['barcelona'],              n: 5,  years: [1992,2006,2009,2011,2015] },
    { name: 'Ajax',                   id: 139,  keys: ['ajax'],                   n: 4,  years: [1971,1972,1973,1995] },
    { name: 'Inter Milan',            id: 110,  keys: ['inter','internazionale'], n: 3,  years: [1964,1965,2010] },
    { name: 'Manchester United',      id: 360,  keys: ['manchester united'],      n: 3,  years: [1968,1999,2008] },
    { name: 'Paris Saint-Germain',    id: 160,  keys: ['paris saint-germain'],    n: 2,  years: [2025,2026] },
    { name: 'Chelsea FC',             id: 363,  keys: ['chelsea'],                n: 2,  years: [2012,2021] },
    { name: 'FC Porto',               id: 437,  keys: ['porto'],                  n: 2,  years: [1987,2004] },
    { name: 'Juventus',               id: 111,  keys: ['juventus'],               n: 2,  years: [1985,1996] },
    { name: 'Nottingham Forest',      id: 393,  keys: ['nottingham forest'],      n: 2,  years: [1979,1980] },
    { name: 'Benfica',                id: 1929, keys: ['benfica'],                n: 2,  years: [1961,1962] },
    { name: 'Manchester City',        id: 382,  keys: ['manchester city'],        n: 1,  years: [2023] },
    { name: 'Borussia Dortmund',      id: 124,  keys: ['borussia dortmund'],      n: 1,  years: [1997] },
    { name: 'Olympique de Marseille', id: 176,  keys: ['marseille'],              n: 1,  years: [1993] },
    { name: 'Red Star Belgrade',      id: 2290, keys: ['red star','crvena'],      n: 1,  years: [1991] },
    { name: 'PSV Eindhoven',          id: 148,  keys: ['psv'],                    n: 1,  years: [1988] },
    { name: 'Steaua București',       id: 484,  keys: ['steaua','fcsb'],          n: 1,  years: [1986] },
    { name: 'Hamburger SV',           id: 127,  keys: ['hamburg'],                n: 1,  years: [1983] },
    { name: 'Aston Villa',            id: 362,  keys: ['aston villa'],            n: 1,  years: [1982] },
    { name: 'Feyenoord',              id: 142,  keys: ['feyenoord'],              n: 1,  years: [1970] },
    { name: 'Celtic FC',              id: 256,  keys: ['celtic'],                 n: 1,  years: [1967] }
  ];

  /* 36 qualifiés officiels pour la phase de ligue 2026-27 (UEFA, 27/08/2026).
     Les identifiants, abréviations, couleurs et logos ont été recoupés avec les
     fiches équipes ESPN. La qualification reste une donnée UEFA : l'API ESPN
     ne publie pas encore la saison 2026-27 au moment du tirage. */
  var QUALIFIED_CLUBS_2026 = [
    { pot: 1, id: 160,   name: 'Paris Saint-Germain', abbr: 'PSG',  color: '011F68', co: 'FRA' },
    { pot: 1, id: 132,   name: 'Bayern München',      abbr: 'MUN',  color: 'dc052d', co: 'GER' },
    { pot: 1, id: 86,    name: 'Real Madrid',         abbr: 'RMA',  color: 'ffffff', co: 'ESP' },
    { pot: 1, id: 364,   name: 'Liverpool',           abbr: 'LIV',  color: 'd11317', co: 'ENG' },
    { pot: 1, id: 110,   name: 'Inter',               abbr: 'INT',  color: '00239c', co: 'ITA' },
    { pot: 1, id: 382,   name: 'Manchester City',     abbr: 'MNC',  color: '99c5ea', co: 'ENG' },
    { pot: 1, id: 359,   name: 'Arsenal',             abbr: 'ARS',  color: 'e20520', co: 'ENG' },
    { pot: 1, id: 83,    name: 'Barcelona',           abbr: 'BAR',  color: '990000', co: 'ESP' },
    { pot: 1, id: 1068,  name: 'Atlético de Madrid',  abbr: 'ATM',  color: 'ca3624', co: 'ESP' },
    { pot: 2, id: 124,   name: 'Borussia Dortmund',   abbr: 'DOR',  color: 'ffee00', co: 'GER' },
    { pot: 2, id: 104,   name: 'AS Roma',             abbr: 'ROMA', color: '990a2c', co: 'ITA' },
    { pot: 2, id: 2250,  name: 'Sporting CP',         abbr: 'SCP',  color: '008127', co: 'POR' },
    { pot: 2, id: 362,   name: 'Aston Villa',         abbr: 'AVL',  color: '660e36', co: 'ENG' },
    { pot: 2, id: 437,   name: 'FC Porto',            abbr: 'FCP',  color: '0000dd', co: 'POR' },
    { pot: 2, id: 360,   name: 'Manchester United',   abbr: 'MAN',  color: 'da020e', co: 'ENG' },
    { pot: 2, id: 570,   name: 'Club Brugge',         abbr: 'BRU',  color: '0081ff', co: 'BEL' },
    { pot: 2, id: 244,   name: 'Real Betis',          abbr: 'BET',  color: '288A00', co: 'ESP' },
    { pot: 2, id: 148,   name: 'PSV Eindhoven',       abbr: 'PSV',  color: 'ef2f24', co: 'NED' },
    { pot: 3, id: 142,   name: 'Feyenoord',           abbr: 'FEY',  color: 'ef2f24', co: 'NED' },
    { pot: 3, id: 166,   name: 'Lille',               abbr: 'LILL', color: 'c2051b', co: 'FRA' },
    { pot: 3, id: 2980,  name: 'Bodø/Glimt',          abbr: 'BODO', color: 'FCEE33', co: 'NOR' },
    { pot: 3, id: 114,   name: 'Napoli',              abbr: 'NAP',  color: '0677d2', co: 'ITA' },
    { pot: 3, id: 11420, name: 'RB Leipzig',          abbr: 'RBL',  color: 'ffffff', co: 'GER' },
    { pot: 3, id: 102,   name: 'Villarreal',          abbr: 'VIL',  color: 'ffff00', co: 'ESP' },
    { pot: 3, id: 436,   name: 'Fenerbahçe',          abbr: 'FEN',  color: 'ffff00', co: 'TUR' },
    { pot: 3, id: 493,   name: 'Shakhtar Donetsk',    abbr: 'SHK',  color: 'ff5900', co: 'UKR' },
    { pot: 3, id: 432,   name: 'Galatasaray',         abbr: 'GAL',  color: 'aa0031', co: 'TUR' },
    { pot: 4, id: 494,   name: 'Slavia Prague',       abbr: 'SLP',  color: 'dc1f26', co: 'CZE' },
    { pot: 4, id: 521,   name: 'Slovan Bratislava',   abbr: 'SLB',  color: '81c0ff', co: 'SVK' },
    { pot: 4, id: 134,   name: 'VfB Stuttgart',       abbr: 'VFB',  color: 'ffffff', co: 'GER' },
    { pot: 4, id: 887,   name: 'AEK Athens',          abbr: 'AEK',  color: 'ffff00', co: 'GRE' },
    { pot: 4, id: 4411,  name: 'LASK',                abbr: 'LAS',  color: 'ffffff', co: 'AUT' },
    { pot: 4, id: 2572,  name: 'Como',                abbr: 'COMO', color: '4169E1', co: 'ITA' },
    { pot: 4, id: 175,   name: 'Lens',                abbr: 'RCL',  color: 'E91514', co: 'FRA' },
    { pot: 4, id: 510,   name: 'Viking',              abbr: 'VIK',  color: '000080', co: 'NOR' },
    { pot: 4, id: 21922, name: 'Sabah',               abbr: 'SAB',  color: '000000', co: 'AZE' }
  ];
  /* Logo officiel ESPN d'un club du palmarès (par id). */
  function palmaresLogo(id) { return id ? 'https://a.espncdn.com/i/teamlogos/soccer/500/' + id + '.png' : ''; }

  /* Classement des clubs par nombre de titres (rang à égalités). Ordre intra-égalité : titre le plus récent d'abord. */
  function palmaresRanking() {
    var arr = UCL_PALMARES.map(function (e) {
      return { name: e.name, id: e.id, logo: palmaresLogo(e.id), n: e.n, years: e.years.slice(), last: Math.max.apply(null, e.years) };
    });
    arr.sort(function (a, b) { return (b.n - a.n) || (b.last - a.last); });
    var rank = 1;
    for (var i = 0; i < arr.length; i++) {
      if (i > 0 && arr[i].n !== arr[i - 1].n) rank = i + 1;
      arr[i].rank = rank;
    }
    return arr;
  }

  /* Champion d'une saison via le palmarès (utile quand ESPN n'expose pas le vainqueur,
     ex. vieilles finales aux tirs au but comme 2002-03). startYear -> titre l'année startYear+1. */
  function championOfSeason(startYear) {
    if (startYear == null) startYear = seasonStartYear();
    var ty = startYear + 1;
    for (var i = 0; i < UCL_PALMARES.length; i++) {
      if (UCL_PALMARES[i].years.indexOf(ty) !== -1) return { name: UCL_PALMARES[i].name, keys: UCL_PALMARES[i].keys };
    }
    return null;
  }

  /* Renvoie { n, years } si le club a gagné la C1/LDC, sinon null. */
  function clubTitles(name) {
    if (!name) return null;
    var nm = ('' + name).toLowerCase();
    for (var i = 0; i < UCL_PALMARES.length; i++) {
      var e = UCL_PALMARES[i];
      for (var k = 0; k < e.keys.length; k++) {
        if (nm.indexOf(e.keys[k]) !== -1) return { n: e.n, years: e.years };
      }
    }
    return null;
  }

  /* Titres par identifiant ESPN — à préférer à clubTitles(name), dont la
     recherche par sous-chaîne attribue à tort des titres à des noms voisins
     (« Real Madrid Castilla » -> 15, « Inter Turku » -> 3, « Benfica B » -> 2).
     Les trophées ne viennent pas de l'API ESPN, qui n'en expose aucun : c'est
     la table UCL_PALMARES, vérifiée contre les 71 finales 1956-2026. */
  function clubTitlesById(id) {
    if (id == null || id === '') return null;
    for (var i = 0; i < UCL_PALMARES.length; i++) {
      if (String(UCL_PALMARES[i].id) === String(id)) return { n: UCL_PALMARES[i].n, years: UCL_PALMARES[i].years };
    }
    return null;
  }

  /* Liste des saisons : { year, current }. Actuelle d'abord, puis archives. */
  function seasonOptions() {
    var opts = [{ year: CURRENT_SEASON, current: true }];
    for (var i = 0; i < ARCHIVE_SEASONS.length; i++) opts.push({ year: ARCHIVE_SEASONS[i], current: false });
    return opts;
  }

  /* Monte un menu déroulant de saisons dans `host`. basePage = page cible (ex. 'tracker.html'). */
  function mountSeasonMenu(host, basePage) {
    host = (typeof host === 'string') ? document.querySelector(host) : host;
    if (!host) return;
    function t(k, f) { try { var v = global.I18N && global.I18N.t(k); return v != null ? v : f; } catch (e) { return f; } }

    var activeYear = (seasonParam() != null) ? seasonParam() : CURRENT_SEASON;
    var items = seasonOptions().map(function (o) {
      var href = o.current ? basePage : basePage + '?season=' + o.year;
      var attrs = (o.current ? ' data-noseason' : '') + (o.year === activeYear ? ' class="active"' : '');
      var tag = o.current ? t('season.current', 'Actuelle') : t('nav.souvenir', 'Souvenir');
      return '<a href="' + href + '"' + attrs + ' role="menuitem">' + seasonLabel(o.year) + ' · ' + tag + '</a>';
    }).join('');

    host.classList.add('season-dd');
    host.innerHTML =
      '<button type="button" class="season-dd-btn" aria-haspopup="true" aria-expanded="false">' +
        '🏆 <span class="sdd-cur">' + seasonLabel(activeYear) + '</span> <span class="sdd-caret">▾</span>' +
      '</button>' +
      '<div class="season-dd-menu" role="menu">' + items + '</div>';

    var btn = host.querySelector('.season-dd-btn');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = host.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Fermeture au clic extérieur (un seul listener global, partagé)
    if (!mountSeasonMenu._bound) {
      mountSeasonMenu._bound = true;
      document.addEventListener('click', function () {
        var open = document.querySelectorAll('.season-dd.open');
        for (var i = 0; i < open.length; i++) {
          open[i].classList.remove('open');
          var b = open[i].querySelector('.season-dd-btn');
          if (b) b.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var open = document.querySelectorAll('.season-dd.open');
          for (var i = 0; i < open.length; i++) open[i].classList.remove('open');
        }
      });
    }
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
  /* Horodatage de la dernière réponse RÉSEAU de l'API pour la saison (un
     service depuis le cache mémoire ne compte pas comme une synchronisation). */
  var _seasonSyncAt = null;
  function lastSeasonSync() { return _seasonSyncAt ? new Date(_seasonSyncAt) : null; }

  function fetchSeasonEvents(opts) {
    var r = seasonRange();
    var o = Object.assign({ limit: 500, ttl: 20000 }, opts || {});
    var url = scoreboardURL(r.start + '-' + r.end, o.limit);
    return fetchScoreboard(r.start + '-' + r.end, o)
      .then(function (events) {
        var hit = scoreboardCache[url];
        if (hit && hit.ts !== _seasonSyncAt) {
          _seasonSyncAt = hit.ts;
          try { console.info('[LDC] Synchronisation API ESPN (saison ' + seasonLabel() + ') : ' + new Date(hit.ts).toISOString()); } catch (e) {}
        }
        // La plage de dates récupère parfois les qualifs de la saison SUIVANTE (juin-juillet).
        // On ne garde que les matchs de la saison demandée (ev.season.year).
        return (events || []).filter(function (e) {
          return !e || !e.season || e.season.year == null || e.season.year === r.startYear;
        });
      });
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
      shootout: (c.shootoutScore != null && c.shootoutScore !== '') ? toInt(c.shootoutScore) : null,
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
    'group-stage': 'league',
    'knockout-round-playoffs': 'po',
    'round-of-16': 'r16',
    'quarterfinals': 'qf',
    'quarter-finals': 'qf',
    'semifinals': 'sf',
    'semi-finals': 'sf',
    'final': 'final'
  };

  /* Classe un match : 'qualifying' / 'league' (poule ou phase de ligue) / 'po'/'r16'/'qf'/'sf'/'final'.
     Couvre toutes les ères ESPN (phase de ligue 2024+, phase de groupes 2003-2024, first/second-phase 2001-2003). */
  function classifyRound(comp, ev) {
    // 1) Signal fiable : le slug de saison ESPN
    var slug = (ev && ev.season && ev.season.slug) ? String(ev.season.slug).toLowerCase() : '';
    if (SLUG_ROUND[slug]) return SLUG_ROUND[slug];
    if (slug) {
      if (/qualif|play-?off-round|preliminary/.test(slug)) return 'qualifying'; // tours préliminaires : exclus
      if (/knockout.*play|knockout-round/.test(slug)) return 'po';              // barrages (nouveau format)
      if (/league-phase|group|first-phase|second-phase|league/.test(slug)) return 'league';
      if (/round-of-16|round-of-32|eighth|1-8/.test(slug)) return 'r16';
      if (/quarter/.test(slug)) return 'qf';
      if (/semi/.test(slug)) return 'sf';
      if (/final/.test(slug)) return 'final';
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

     `seedClubs` (optionnel) : liste { id, name, abbr, logo } amorcée à 0 pt, pour
     que les 36 qualifiés soient TOUS présents dès avant leur premier match
     (sinon le tableau n'a que 24 lignes après la 1re journée, ce qui rend la
     légende « 25–36 : éliminés » incohérente).
     ======================================================================= */
  /* Matchs de phase de ligue au format attendu par le moteur (couche 1 -> 2). */
  function leagueMatches(events) {
    return (events || []).map(normalizeEvent).filter(function (m) { return m && m.round === 'league'; })
      .map(function (m) { return { id: m.id, state: m.state, dateObj: m.dateObj, home: m.home, away: m.away }; });
  }

  /* Classe des matchs de phase de ligue selon l'article 18.01, avec les
     données annexes disponibles : fair-play depuis le cache des résumés,
     coefficients uniquement pour la saison qu'ils couvrent (2026/27). */
  function rankLeagueMatches(matches, seedClubs) {
    var coef = (seasonStartYear() === 2026 && global.LDCCoefficients2026) ? global.LDCCoefficients2026 : null;
    return global.LDCStandings.rankLeaguePhase(matches, {
      seed: seedClubs || null,
      disciplinary: disciplinaryFor(matches),
      coefficients: coef ? coef.clubs : null,
      coefficientSeasons: coef ? coef.seasons : null
    });
  }

  var _warnedEngine = false;
  function computeStandings(events, seedClubs) {
    /* Format phase de ligue (2024-25 et après) : moteur réglementaire. */
    if (isLeaguePhaseFormat()) {
      if (global.LDCStandings) return rankLeagueMatches(leagueMatches(events), seedClubs);
      if (!_warnedEngine && global.console) {
        _warnedEngine = true;
        console.warn('[LDC] standings-engine.js non chargé : classement de repli sans les critères UEFA complets.');
      }
    }
    /* Anciennes phases de groupes (avant 2024-25) : leurs règles de départage
       sont différentes (confrontation directe en tête) et ne sont pas
       implémentées ici — ce tri reste celui d'origine. */
    var teams = {}; // teamId -> ligne

    function row(c) {
      var k = c.teamId || c.name;
      if (!teams[k]) {
        teams[k] = {
          teamId: c.teamId, name: c.name, shortName: c.shortName,
          abbr: c.abbr, logo: c.logo,
          pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, live: false,
          results: []
        };
      }
      return teams[k];
    }

    (seedClubs || []).forEach(function (c) {
      if (!c || !c.id) return;
      row({ teamId: String(c.id), name: c.name, shortName: c.name, abbr: c.abbr, logo: c.logo });
    });

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

      var rH, rA;
      if (m.home.score > m.away.score) { H.w++; A.l++; H.pts += 3; rH = 'w'; rA = 'l'; }
      else if (m.home.score < m.away.score) { A.w++; H.l++; A.pts += 3; rH = 'l'; rA = 'w'; }
      else { H.d++; A.d++; H.pts += 1; A.pts += 1; rH = 'd'; rA = 'd'; }
      var _t = m.dateObj ? m.dateObj.getTime() : 0;
      H.results.push({ t: _t, r: rH }); A.results.push({ t: _t, r: rA });
    });

    var arr = Object.keys(teams).map(function (k) {
      var t = teams[k];
      t.gd = t.gf - t.ga;
      t.results.sort(function (a, b) { return a.t - b.t; });
      t.form = t.results.slice(-5).map(function (x) { return x.r; });   // 5 derniers : 'w'|'d'|'l'
      return t;
    });

    // Tri de repli : pts, diff, BP, nom — PAS le règlement UEFA (voir plus haut)
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
        /* participants[1] = le passeur (« Assisted by … »), quand il y en a un. */
        var assister = (e.participants && e.participants[1] && e.participants[1].athlete) || null;
        out.push({
          typeText: typeText,
          typeSlug: (e.type && e.type.type) || '',
          typeId: (e.type && e.type.id) || '',
          assist: assister ? assister.displayName : '',
          assistId: assister ? String(assister.id || '') : '',
          playerId: participant ? String(participant.id || '') : '',
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

  /* =======================================================================
     ÉQUIPE FAVORITE — stockage local + liste des clubs pour le sélecteur
     ======================================================================= */
  var FAV_KEY = 'ldc_fav', FAV_SEEN_KEY = 'ldc_fav_seen';

  function getFav() {
    try { var s = localStorage.getItem(FAV_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function setFav(obj) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(obj)); markFavSeen(); } catch (e) {}
  }
  function clearFav() {
    try { localStorage.removeItem(FAV_KEY); } catch (e) {}
  }
  function favSeen() {
    try { return localStorage.getItem(FAV_SEEN_KEY) === '1'; } catch (e) { return false; }
  }
  function markFavSeen() {
    try { localStorage.setItem(FAV_SEEN_KEY, '1'); } catch (e) {}
  }

  /* Liste du sélecteur de favori : les qualifiés officiels d'abord, puis les
     anciens vainqueurs absents de cette édition. Les événements ESPN, lorsqu'ils
     existent, ne servent qu'à rafraîchir les métadonnées des équipes. */
  var _clubListCache = null;
  function _clubsFromEvents(events) {
    var map = {};
    (events || []).forEach(function (ev) {
      var m = normalizeEvent(ev); if (!m) return;
      [m.home, m.away].forEach(function (c) {
        if (!c || !c.teamId) return;
        var ex = map[c.teamId];
        if (!ex) map[c.teamId] = { id: c.teamId, name: c.name, abbr: c.abbr, logo: c.logo, color: c.color };
        else { if (!ex.logo && c.logo) ex.logo = c.logo; if (!ex.color && c.color) ex.color = c.color; }
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function _officialAndHistoricClubs() {
    var qualifiedIds = {};
    var official = QUALIFIED_CLUBS_2026.map(function (c) {
      qualifiedIds[String(c.id)] = true;
      var titles = clubTitles(c.name);
      return {
        id: String(c.id), name: c.name, abbr: c.abbr,
        logo: palmaresLogo(c.id), color: c.color,
        qualified: true, pot: c.pot, country: c.co, historical: !!titles,
        titles: titles ? titles.n : 0
      };
    });
    var historic = UCL_PALMARES.filter(function (c) {
      return !qualifiedIds[String(c.id)];
    }).map(function (c) {
      return {
        id: String(c.id), name: c.name, abbr: '',
        logo: palmaresLogo(c.id), color: '',
        qualified: false, pot: null, country: null, historical: true, titles: c.n
      };
    });
    return official.concat(historic);
  }
  function _mergeLiveClubMetadata(base, events) {
    var live = _clubsFromEvents(events), byId = {};
    live.forEach(function (c) { byId[String(c.id)] = c; });
    return base.map(function (c) {
      var x = byId[String(c.id)];
      if (!x) return c;
      return {
        id: c.id, name: c.name, abbr: x.abbr || c.abbr,
        logo: x.logo || c.logo, color: x.color || c.color,
        qualified: c.qualified, pot: c.pot, country: c.country,
        historical: c.historical, titles: c.titles
      };
    });
  }
  function fetchClubList() {
    if (_clubListCache) return Promise.resolve(_clubListCache);
    var base = _officialAndHistoricClubs();
    return fetchSeasonEvents({ ttl: 300000 }).then(function (ev) {
      _clubListCache = _mergeLiveClubMetadata(base, ev);
      return _clubListCache;
    }).catch(function () {
      _clubListCache = base;
      return _clubListCache;
    });
  }

  /* =======================================================================
     JOURNÉES — regroupement des matchs de phase de ligue
     ESPN ne numérote pas les journées. Elles se déduisent des dates : la phase
     de ligue se joue par salves de 18 matchs séparées de plusieurs semaines,
     donc un écart de plus de 5 jours ouvre une nouvelle journée. Vérifié sur
     2026-27 : 8 journées de 18 matchs, 144/144 répartis.
     ======================================================================= */
  function clusterMatchdays(matches) {
    var withDate = (matches || []).filter(function (m) { return m && m.dateObj; })
      .sort(function (a, b) { return a.dateObj - b.dateObj; });
    var groups = [], cur = null, last = null;
    withDate.forEach(function (m) {
      var t = m.dateObj.getTime();
      if (last === null || (t - last) > 5 * 86400000) { cur = []; groups.push(cur); }
      cur.push(m); last = t;
    });
    var noDate = (matches || []).filter(function (m) { return m && !m.dateObj; });
    if (noDate.length) groups.push(noDate);
    return groups;
  }

  /* Numéro de journée (1-based) d'un match, ou null. */
  function matchdayOf(match, matches) {
    var g = clusterMatchdays(matches);
    for (var i = 0; i < g.length; i++) {
      for (var j = 0; j < g[i].length; j++) if (g[i][j].id === match.id) return i + 1;
    }
    return null;
  }

  /* =======================================================================
     STATISTIQUES INDIVIDUELLES — buteurs et passeurs
     Endpoint /statistics : ESPN renvoie deux classements de 50 joueurs
     (goalsLeaders, assistsLeaders). Aucune photo de joueur n'est publiée pour
     le football (les URLs /headshots/soccer/ renvoient 404) : on affiche donc
     le blason du club et le numéro de maillot.
     ======================================================================= */
  var leadersCache = null;
  var LEADERS_TTL = 300000; // 5 min — ces classements bougent lentement

  function normalizeLeader(entry) {
    try {
      var a = entry && entry.athlete; if (!a) return null;
      var team = a.team || {};
      var logo = (team.logos && team.logos[0] && team.logos[0].href) || palmaresLogo(team.id);
      /* entry.value porte le total (buts ou passes) ; entry.displayValue est une
         phrase ("Matches: 1, Goals: 2") inutilisable telle quelle. */
      var v = (entry.value != null) ? Number(entry.value) : null;
      if (v == null || isNaN(v)) return null;
      return {
        id: String(a.id || ''), name: a.displayName || a.shortName || '—',
        shortName: a.shortName || a.displayName || '—',
        jersey: a.jersey || '',
        value: v,
        teamId: String(team.id || ''), teamName: team.displayName || team.name || '',
        teamAbbr: (team.abbreviation || '').toUpperCase(), logo: logo
      };
    } catch (e) { return null; }
  }

  /* -> { goals: [...], assists: [...] }, triés décroissant. */
  function fetchLeaders(opts) {
    opts = opts || {};
    if (leadersCache && (Date.now() - leadersCache.ts) < (opts.ttl || LEADERS_TTL) && !opts.force) {
      return Promise.resolve(leadersCache.data);
    }
    return fetchJSON(BASE + '/statistics', opts.timeout).then(function (data) {
      var out = { goals: [], assists: [] };
      ((data && data.stats) || []).forEach(function (cat) {
        var key = /assist/i.test(cat.name || '') ? 'assists' : (/goal/i.test(cat.name || '') ? 'goals' : null);
        if (!key) return;
        out[key] = (cat.leaders || []).map(normalizeLeader).filter(Boolean)
          .sort(function (a, b) { return b.value - a.value; });
      });
      leadersCache = { ts: Date.now(), data: out };
      return out;
    });
  }

  /* =======================================================================
     BUTEURS & PASSEURS — dérivés des résumés de match
     -----------------------------------------------------------------------
     Pourquoi ne PAS utiliser /statistics : cet endpoint est un agrégat
     recalculé périodiquement, et il est faux entre deux recalculs. Constaté le
     10/09/2026 : il annonçait Haaland en tête avec 2 buts alors que Demirovic
     et Ferran Torres avaient déjà inscrit un triplé chacun — tous deux étaient
     purement absents du classement.

     Les keyEvents des résumés, eux, sont la donnée de terrain : 46 actions de
     but sur 46 portent un joueur identifié. On les agrège donc nous-mêmes.
     Contrôle : 46 buts marqués - 3 csc = 43 buts crédités à un joueur.

     Coût maîtrisé : un match TERMINÉ ne change plus, son agrégat est donc mis
     en cache définitivement (mémoire + localStorage). Seuls les matchs encore
     inconnus sont téléchargés, par petits lots, pour ne pas lancer 144 requêtes
     simultanées en fin de phase de ligue.
     ======================================================================= */
  var GOAL_SLUG = /^(goal|penalty---scored)/;   // goal, goal---header/free-kick/volley, penalty---scored
  var scorerAgg = {};                            // eventId -> { g:{}, a:{}, t:{} }
  /* v2 : chaque entrée porte aussi les points disciplinaires (`c`). Changer de
     clé invalide proprement les entrées v1, qui en sont dépourvues. */
  var SCORER_LS = 'ldc_match_agg_v2_';

  function _scorerLSKey() { return SCORER_LS + seasonStartYear(); }
  function _loadScorerCache() {
    try {
      var o = JSON.parse(global.localStorage.getItem(_scorerLSKey()) || 'null');
      if (o && typeof o === 'object') scorerAgg = o;
    } catch (e) {}
  }
  function _saveScorerCache() {
    try { global.localStorage.setItem(_scorerLSKey(), JSON.stringify(scorerAgg)); } catch (e) {}
  }

  /* Agrège UN résumé : buts et passes décisives par joueur, avec son club. */
  /* =======================================================================
     FAIR-PLAY — critère 9 de l'article 18.01 (phase de ligue terminée)
     « lower disciplinary points total (red card = 3 points, yellow card =
       1 point, expulsion for two yellow cards in one match = 3 points) »

     Source : les keyEvents du résumé de match, PAS le boxscore. Le boxscore
     d'ESPN est incohérent sur les expulsions : sur la phase 2024-25, un joueur
     ayant reçu un jaune puis un rouge sur second avertissement apparaît en
     « jaunes 0, rouges 1 » (Danilo, Juventus).

     Représentation ESPN d'une expulsion sur deux jaunes, vérifiée sur les
     23 expulsions de la phase 2024-25 : le PREMIER jaune est un événement
     `yellow-card`, puis un unique `red-card` au texte « Second yellow card to
     … ». Les 10 rouges précédés d'un jaune du même joueur portent tous ce
     texte ; aucun rouge direct n'en était précédé.

     Par joueur et par match :
       expulsion sur deux jaunes  -> 3   (le premier jaune est inclus)
       rouge direct               -> 3 + ses jaunes antérieurs (1 chacun)
       sinon                      -> 1 par jaune
     Un carton sans joueur identifié compte 1 (jaune) ou 3 (rouge).
     Retourne { teamId: points } pour les DEUX équipes du match, 0 compris :
     une équipe absente de la table serait une donnée manquante, pas un zéro.
     ======================================================================= */
  function disciplinaryFromSummary(summary) {
    var out = {};
    try {
      var comp = summary && summary.header && summary.header.competitions && summary.header.competitions[0];
      (comp && comp.competitors || []).forEach(function (c) {
        var id = String(c.id || (c.team && c.team.id) || ''); if (id) out[id] = 0;
      });
      ((summary && summary.boxscore && summary.boxscore.teams) || []).forEach(function (b) {
        var id = String((b.team && b.team.id) || ''); if (id && out[id] == null) out[id] = 0;
      });
    } catch (e) {}

    var players = {};
    normalizeKeyEvents(summary).forEach(function (ev) {
      var slug = ev.typeSlug || '', tx = ev.typeText || '';
      var yellow = slug === 'yellow-card' || (!slug && /yellow card/i.test(tx));
      var red = slug === 'red-card' || (!slug && /red card/i.test(tx));
      if (!yellow && !red) return;
      var team = String(ev.teamId || '');
      if (!team) return;
      if (out[team] == null) out[team] = 0;
      if (!ev.playerId) { out[team] += red ? 3 : 1; return; }
      var k = team + '|' + ev.playerId;
      var p = players[k] || (players[k] = { team: team, y: 0, red: null });
      if (yellow) p.y++;
      else {
        var second = /second yellow/i.test(ev.text || '') || (!ev.text && p.y > 0);
        p.red = second ? 'second-yellow' : 'direct';
      }
    });
    Object.keys(players).forEach(function (k) {
      var p = players[k];
      out[p.team] += p.red === 'second-yellow' ? 3 : (p.red === 'direct' ? 3 + p.y : p.y);
    });
    return out;
  }

  function aggregateMatchScorers(summary) {
    var g = {}, a = {}, t = {};
    normalizeKeyEvents(summary).forEach(function (ev) {
      if (!ev.scoringPlay) return;
      if (ev.typeSlug === 'own-goal') return;              // jamais crédité au joueur
      /* Repli sur le texte si ESPN n'a pas rempli type.type. */
      var isGoal = ev.typeSlug ? GOAL_SLUG.test(ev.typeSlug)
                 : (/goal/i.test(ev.typeText) && !/own goal/i.test(ev.typeText));
      if (!isGoal) return;
      if (ev.player) { g[ev.player] = (g[ev.player] || 0) + 1; if (ev.teamId) t[ev.player] = ev.teamId; }
      if (ev.assist) { a[ev.assist] = (a[ev.assist] || 0) + 1; if (ev.teamId) t[ev.assist] = ev.teamId; }
    });
    return { g: g, a: a, t: t, c: disciplinaryFromSummary(summary) };
  }

  function _mergeBoards(ids) {
    var G = {}, A = {}, T = {};
    ids.forEach(function (id) {
      var e = scorerAgg[id]; if (!e) return;
      Object.keys(e.g || {}).forEach(function (n) { G[n] = (G[n] || 0) + e.g[n]; });
      Object.keys(e.a || {}).forEach(function (n) { A[n] = (A[n] || 0) + e.a[n]; });
      Object.keys(e.t || {}).forEach(function (n) { T[n] = e.t[n]; });
    });
    function rank(obj) {
      return Object.keys(obj).map(function (n) { return { name: n, value: obj[n], teamId: T[n] || '' }; })
        .sort(function (x, y) { return (y.value - x.value) || x.name.localeCompare(y.name); });
    }
    return { goals: rank(G), assists: rank(A) };
  }

  /* fetchScorerBoard(matches, { onProgress, batch })
     -> Promise<{ goals:[{name,value,teamId}], assists:[...] }>
     onProgress reçoit un tableau partiel dès qu'un lot est agrégé, pour que
     l'interface se remplisse au fil de l'eau au lieu d'attendre le dernier match. */
  /* Points disciplinaires cumulés sur la phase, par équipe, depuis le cache.
     Une équipe n'a de valeur QUE si tous ses matchs comptés sont en cache :
     une somme partielle serait fausse, et le moteur doit alors savoir que la
     donnée manque (il s'arrête au lieu d'appliquer le critère suivant). */
  function disciplinaryFor(matches) {
    _loadScorerCache();
    var total = {}, incomplete = {};
    (matches || []).forEach(function (m) {
      if (!m || m.state !== 'post' || !m.home || !m.away) return;
      var e = scorerAgg[String(m.id)];
      [m.home.teamId, m.away.teamId].forEach(function (id) {
        id = String(id);
        if (!e || !e.c || e.c[id] == null) { incomplete[id] = true; return; }
        total[id] = (total[id] || 0) + e.c[id];
      });
    });
    Object.keys(incomplete).forEach(function (id) { delete total[id]; });
    return total;
  }

  /* Charge les résumés manquants (buteurs + cartons) puis rend le fair-play. */
  function ensureMatchAggregates(matches) {
    return fetchScorerBoard(matches).then(function () { return disciplinaryFor(matches); });
  }

  function fetchScorerBoard(matches, opts) {
    opts = opts || {};
    _loadScorerCache();
    var done = (matches || []).filter(function (m) { return m && m.state === 'post'; });
    var ids = done.map(function (m) { return String(m.id); });
    var todo = ids.filter(function (id) { return !scorerAgg[id] || !scorerAgg[id].c; });

    if (!todo.length) return Promise.resolve(_mergeBoards(ids));
    if (opts.onProgress && ids.length > todo.length) opts.onProgress(_mergeBoards(ids));

    var size = opts.batch || 6;
    function step(i) {
      if (i >= todo.length) { _saveScorerCache(); return _mergeBoards(ids); }
      var slice = todo.slice(i, i + size);
      return Promise.all(slice.map(function (id) {
        return fetchSummary(id, { ttl: 3600000 })
          .then(function (sum) { scorerAgg[id] = aggregateMatchScorers(sum); })
          .catch(function () { /* un match manquant ne doit pas casser le tableau */ });
      })).then(function () {
        _saveScorerCache();
        if (opts.onProgress) opts.onProgress(_mergeBoards(ids));
        return step(i + size);
      });
    }
    return step(0);
  }

  /* =======================================================================
     CLEAN SHEETS — « murailles »
     ESPN ne publie pas cette statistique : elle se calcule depuis les matchs
     déjà joués (un match terminé sans but encaissé = un clean sheet).
     Donnée réelle, dérivée — pas une estimation.
     ======================================================================= */
  function computeCleanSheets(events) {
    var map = {};
    function row(c) {
      var k = c.teamId || c.name;
      if (!map[k]) map[k] = { teamId: c.teamId, name: c.name, abbr: c.abbr, logo: c.logo, cs: 0, pld: 0, ga: 0 };
      return map[k];
    }
    (events || []).forEach(function (ev) {
      var m = normalizeEvent(ev);
      if (!m || m.round !== 'league' || m.state !== 'post') return;
      var H = row(m.home), A = row(m.away);
      H.pld++; A.pld++;
      H.ga += m.away.score; A.ga += m.home.score;
      if (m.away.score === 0) H.cs++;
      if (m.home.score === 0) A.cs++;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) {
        if (b.cs !== a.cs) return b.cs - a.cs;      // plus de clean sheets d'abord
        if (a.ga !== b.ga) return a.ga - b.ga;       // puis le moins encaissé
        return a.name.localeCompare(b.name);
      });
  }

  /* Couleur d'accent du club favori, ajustée pour rester lisible sur fond sombre.
     Renvoie "r, g, b" (utilisable dans rgb()/rgba()) ou null (repli sur l'or). */
  function _hexToRgb(hex) {
    if (!hex) return null;
    hex = ('' + hex).trim().replace(/^#/, '');
    if (hex.length === 3) hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    if (hex.length < 6) return null;
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return { r: r, g: g, b: b };
  }
  function _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h, s, l = (mx + mn) / 2;
    if (mx === mn) { h = s = 0; }
    else {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      switch (mx) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return { h: h, s: s, l: l };
  }
  function _hslToRgb(h, s, l) {
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      function hue(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  function _legibleRGB(hex) {
    var c = _hexToRgb(hex); if (!c) return null;
    var hsl = _rgbToHsl(c.r, c.g, c.b);
    hsl.s = Math.max(hsl.s, 0.5);                    // assez saturé
    hsl.l = Math.min(Math.max(hsl.l, 0.52), 0.7);    // ni trop sombre ni trop clair
    var o = _hslToRgb(hsl.h, hsl.s, hsl.l);
    return o.r + ', ' + o.g + ', ' + o.b;
  }
  function favAccent() {
    var f = getFav();
    if (f && f.color) { var rgb = _legibleRGB(f.color); if (rgb) return rgb; }
    return null;
  }

  global.ESPN = {
    LEAGUE_SLUG: LEAGUE_SLUG,
    BASE: BASE,
    DEFAULT_TIMEOUT: DEFAULT_TIMEOUT,
    // dates / saison
    ymd: ymd,
    seasonRange: seasonRange,
    seasonStartYear: seasonStartYear,
    CURRENT_SEASON: CURRENT_SEASON,
    ARCHIVE_SEASONS: ARCHIVE_SEASONS,
    seasonParam: seasonParam,
    isArchive: isArchive,
    seasonLabel: seasonLabel,
    isLeaguePhaseFormat: isLeaguePhaseFormat,
    EARLIEST_SEASON: EARLIEST_SEASON,
    seasonOptions: seasonOptions,
    mountSeasonMenu: mountSeasonMenu,
    clubTitles: clubTitles,
    championOfSeason: championOfSeason,
    palmaresRanking: palmaresRanking,
    qualifiedClubs: function () { return _officialAndHistoricClubs().filter(function (c) { return c.qualified; }); },
    preserveSeasonLinks: preserveSeasonLinks,
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
    clusterMatchdays: clusterMatchdays,
    matchdayOf: matchdayOf,
    fetchLeaders: fetchLeaders,
    computeCleanSheets: computeCleanSheets,
    disciplinaryFromSummary: disciplinaryFromSummary,
    disciplinaryFor: disciplinaryFor,
    ensureMatchAggregates: ensureMatchAggregates,
    leagueMatches: leagueMatches,
    rankLeagueMatches: rankLeagueMatches,
    lastSeasonSync: lastSeasonSync,
    clubTitlesById: clubTitlesById,
    fetchScorerBoard: fetchScorerBoard,
    aggregateMatchScorers: aggregateMatchScorers,
    buildBracket: buildBracket,
    findChampion: findChampion,
    classifyRound: classifyRound,
    isKnockout: isKnockout,
    // états
    isLive: isLive, isUpcoming: isUpcoming, isFinished: isFinished,
    isInterrupted: isInterrupted,
    splitClock: splitClock,
    matchesTeam: matchesTeam,
    ROUND_ORDER: ROUND_ORDER,
    // équipe favorite
    getFav: getFav,
    setFav: setFav,
    clearFav: clearFav,
    favSeen: favSeen,
    markFavSeen: markFavSeen,
    fetchClubList: fetchClubList,
    favAccent: favAccent
  };

})(window);
