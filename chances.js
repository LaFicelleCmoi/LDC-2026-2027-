/* =========================================================================
   chances.js — Chances de qualification (top 8, top 24), trois coupes
   -------------------------------------------------------------------------
   ESTIMATION, pas une certitude. On rejoue N fois la fin de la phase de
   ligue :
   1. force de chaque club : buts marqués et encaissés par match, rapprochés
      de la moyenne de la compétition tant que peu de matchs ont été joués
      (équivalent de PRIOR matchs « moyens » ajoutés à chaque club) ;
   2. chaque match restant : buts tirés selon une loi de Poisson,
      espérance = moyenne × attaque × défense adverse × avantage du terrain ;
      un match en cours repart du score affiché, pour le temps restant ;
   3. classement de chaque simulation : points, différence de buts, buts
      marqués, victoires, puis tirage au sort (les critères UEFA suivants,
      force du calendrier et fair-play, ne sont pas simulés) ;
   4. pourcentage de simulations où le club finit 1-8 / 1-24.
   Générateur pseudo-aléatoire à graine fixe : mêmes données, mêmes chiffres
   à chaque rafraîchissement.
   API : window.LDCChances = { simulate, backtest, PARAMS } (et require()).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCChances = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* prior 6 et avantage du terrain 1,12 : meilleurs réglages au contrôle sur
     les cinq phases de ligue 2024-2026 (voir tests/chances.test.js). */
  var PARAMS = { runs: 4000, prior: 6, home: 1.12, seed: 20262027 };

  function rng(seed) {                         // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function poisson(lambda, rand, L) {          // Knuth : lambda < 5 ici ; L = exp(-lambda) précalculé
    if (L == null) L = Math.exp(-lambda);
    var k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  /* Minute jouée d'un match en cours (« 67' », « 90'+3' », « HT »). */
  function minuteOf(m) {
    var c = String(m.displayClock || m.clock || ''), d = String(m.statusDetail || m.detail || '');
    if (/HT|Half/i.test(d) || /HT/i.test(c)) return 45;
    var n = parseInt(c, 10);
    return isNaN(n) ? 45 : Math.min(90, n);
  }
  function id(c) { return String(c.teamId != null ? c.teamId : c.id); }

  /* matches : matchs de phase de ligue (format ESPN.normalizeEvent ou
     leagueMatches) ; clubs : liste { id | teamId } des participants. */
  function simulate(matches, clubs, opts) {
    opts = opts || {};
    var runs = opts.runs || PARAMS.runs, prior = opts.prior != null ? opts.prior : PARAMS.prior, HOME = opts.home || PARAMS.home;
    var rand = rng(opts.seed || PARAMS.seed);
    var ids = [], idx = {};
    function add(t) { var k = id(t); if (!(k in idx)) { idx[k] = ids.length; ids.push(k); } return idx[k]; }
    (clubs || []).forEach(add);
    var n0 = { pts: [], gd: [], gf: [], w: [], pld: [], ga: [] }, done = [], left = [], gTot = 0, mTot = 0;
    (matches || []).forEach(function (m) {
      if (!m || !m.home || !m.away) return;
      var h = add(m.home), a = add(m.away);
      if (m.state === 'post') { done.push([h, a, +m.home.score || 0, +m.away.score || 0]); gTot += (+m.home.score || 0) + (+m.away.score || 0); mTot++; }
      else left.push([h, a, m.state === 'in' ? (+m.home.score || 0) : 0, m.state === 'in' ? (+m.away.score || 0) : 0, m.state === 'in' ? (90 - minuteOf(m)) / 90 : 1]);
    });
    var N = ids.length;
    if (!N) return {};
    for (var i = 0; i < N; i++) { n0.pts[i] = 0; n0.gd[i] = 0; n0.gf[i] = 0; n0.w[i] = 0; n0.pld[i] = 0; n0.ga[i] = 0; }
    done.forEach(function (x) {
      var h = x[0], a = x[1], hg = x[2], ag = x[3];
      n0.pld[h]++; n0.pld[a]++; n0.gf[h] += hg; n0.gf[a] += ag; n0.ga[h] += ag; n0.ga[a] += hg;
      n0.gd[h] += hg - ag; n0.gd[a] += ag - hg;
      if (hg > ag) { n0.pts[h] += 3; n0.w[h]++; } else if (ag > hg) { n0.pts[a] += 3; n0.w[a]++; } else { n0.pts[h]++; n0.pts[a]++; }
    });
    /* Force : buts par match, rétrécis vers la moyenne (prior matchs moyens). */
    var avg = mTot ? gTot / (2 * mTot) : 1.4;
    var att = [], def = [];
    for (i = 0; i < N; i++) {
      att[i] = ((n0.gf[i] + prior * avg) / (n0.pld[i] + prior)) / avg;
      def[i] = ((n0.ga[i] + prior * avg) / (n0.pld[i] + prior)) / avg;
    }
    var lam = left.map(function (x) {
      var lh = avg * att[x[0]] * def[x[1]] * HOME * x[4], la = avg * att[x[1]] * def[x[0]] / HOME * x[4];
      return [lh, la, Math.exp(-lh), Math.exp(-la)];
    });
    var top8 = new Array(N).fill(0), top24 = new Array(N).fill(0), first = new Array(N).fill(0), ptsSum = new Array(N).fill(0);
    var pts = new Array(N), gd = new Array(N), gf = new Array(N), w = new Array(N), key = new Float64Array(N);
    for (var r = 0; r < runs; r++) {
      for (i = 0; i < N; i++) { pts[i] = n0.pts[i]; gd[i] = n0.gd[i]; gf[i] = n0.gf[i]; w[i] = n0.w[i]; }
      for (var j = 0; j < left.length; j++) {
        var x = left[j], h = x[0], a = x[1];
        var hg = x[2] + poisson(lam[j][0], rand, lam[j][2]), ag = x[3] + poisson(lam[j][1], rand, lam[j][3]);
        gf[h] += hg; gf[a] += ag; gd[h] += hg - ag; gd[a] += ag - hg;
        if (hg > ag) { pts[h] += 3; w[h]++; } else if (ag > hg) { pts[a] += 3; w[a]++; } else { pts[h]++; pts[a]++; }
      }
      /* Une clé numérique par club (points, diff, buts, victoires, puis
         tirage) ; rang = nombre de clubs devant. Plus rapide qu'un tri. */
      for (i = 0; i < N; i++) key[i] = pts[i] * 1e9 + (gd[i] + 500) * 1e6 + gf[i] * 1e3 + w[i] * 10 + rand();
      for (i = 0; i < N; i++) {
        var ahead = 0, ki = key[i];
        for (var q = 0; q < N; q++) if (key[q] > ki) ahead++;
        if (ahead < 8) top8[i]++;
        if (ahead < 24) top24[i]++;
        if (ahead === 0) first[i]++;
        ptsSum[i] += pts[i];
      }
    }
    var out = {};
    for (i = 0; i < N; i++) out[ids[i]] = { top8: top8[i] / runs, top24: top24[i] / runs, first: first[i] / runs, pts: ptsSum[i] / runs };
    out._meta = { runs: runs, remaining: left.length, played: done.length };
    return out;
  }

  /* Contrôle sur une phase de ligue terminée : on ne garde que les matchs
     joués avant `cut` (horodatage), on simule, puis on compare au classement
     final réel. Renvoie le score de Brier (0 = parfait ; plus petit = mieux)
     du modèle et d'une référence naïve « le classement actuel est final ». */
  function backtest(matches, clubs, finalOrder, cut, opts) {
    var before = matches.map(function (m) {
      var t = m.time || (m.dateObj && m.dateObj.getTime()) || 0;
      return t < cut ? m : { home: m.home, away: m.away, state: 'pre', time: t };
    });
    var sim = simulate(before, clubs, opts);
    var rank = {}; finalOrder.forEach(function (t, i) { rank[id(t)] = i + 1; });
    /* référence : rang actuel (points, diff, buts) */
    var cur = {}; clubs.forEach(function (c) { cur[id(c)] = { pts: 0, gd: 0, gf: 0 }; });
    before.forEach(function (m) {
      if (m.state !== 'post') return;
      var h = cur[id(m.home)], a = cur[id(m.away)], hg = +m.home.score, ag = +m.away.score;
      h.gf += hg; a.gf += ag; h.gd += hg - ag; a.gd += ag - hg;
      if (hg > ag) h.pts += 3; else if (ag > hg) a.pts += 3; else { h.pts++; a.pts++; }
    });
    var naive = Object.keys(cur).sort(function (x, y) { return (cur[y].pts - cur[x].pts) || (cur[y].gd - cur[x].gd) || (cur[y].gf - cur[x].gf); });
    var nrank = {}; naive.forEach(function (k, i) { nrank[k] = i + 1; });
    var b = { model: 0, naive: 0, n: 0 };
    Object.keys(rank).forEach(function (k) {
      [[8, 'top8'], [24, 'top24']].forEach(function (z) {
        var real = rank[k] <= z[0] ? 1 : 0, p = sim[k] ? sim[k][z[1]] : 0, q = nrank[k] <= z[0] ? 1 : 0;
        b.model += (p - real) * (p - real); b.naive += (q - real) * (q - real); b.n++;
      });
    });
    return { model: b.model / b.n, naive: b.naive / b.n, played: sim._meta.played };
  }

  /* Même calcul, mémorisé : refait seulement quand un score, un état de
     match ou la liste des clubs change (les pages se rafraîchissent toutes
     les 20-30 s). matches : matchs normalisés, toutes phases (filtrés ici). */
  var memo = [];
  function cached(matches, clubs, opts) {
    var lg = (matches || []).filter(function (m) { return m && m.round === 'league' && m.home && m.away; });
    if (!lg.length || !lg.some(function (m) { return m.state === 'post'; }) || !lg.some(function (m) { return m.state !== 'post'; })) return null;
    var key = lg.map(function (m) { return m.id + ':' + m.state + ':' + m.home.score + '-' + m.away.score + (m.state === 'in' ? ':' + minuteOf(m) : ''); }).join('|') +
              '#' + (clubs || []).map(id).join(',');
    for (var i = 0; i < memo.length; i++) if (memo[i].key === key) return memo[i].val;
    var val = simulate(lg, clubs, Object.assign({ runs: 3000 }, opts || {}));
    memo.unshift({ key: key, val: val }); memo.length = Math.min(memo.length, 4);
    return val;
  }
  /* « 87 % », « > 99 % », « < 1 % » : jamais 0 ni 100, c'est une estimation. */
  function pct(p) {
    if (p == null) return '—';
    if (p >= 0.995) return '> 99 %';
    if (p <= 0.005) return '< 1 %';
    return Math.round(p * 100) + ' %';
  }

  return { simulate: simulate, backtest: backtest, cached: cached, pct: pct, PARAMS: PARAMS, _poisson: poisson, _rng: rng };
});
