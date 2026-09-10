/* =========================================================================
   standings-engine.js — Classement de la phase de ligue (UEFA Champions League)
   -------------------------------------------------------------------------
   LOGIQUE PURE : ni DOM, ni réseau, ni ESPN. Des matchs entrent, un classement
   sort. Chargeable tel quel dans le navigateur (window.LDCStandings) et dans
   Node (require) pour les tests unitaires.

   Référence : Règlement de l'UEFA Champions League 2026/27
     - article 18.01 « Égalité de points – phase de ligue »
       https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Article-18-Equality-of-points-league-phase-Online
     - annexe D.4 (coefficient club) et D.8 (coefficients égaux)

   Deux listes de critères selon l'avancement de la phase :

   ▸ PHASE EN COURS (avant la fin de la dernière journée)
       points, puis 1. différence de buts · 2. buts marqués · 3. buts marqués à
       l'extérieur · 4. victoires · 5. victoires à l'extérieur.
       Toujours à égalité : même rang, ordre alphabétique.

   ▸ PHASE TERMINÉE (tous les matchs de la phase joués)
       les cinq ci-dessus, puis
        6. points cumulés par les adversaires affrontés
        7. différence de buts cumulée des adversaires
        8. buts marqués cumulés par les adversaires
        9. total de points disciplinaires le plus BAS
           (carton rouge direct ou expulsion sur deux jaunes = 3, jaune = 1)
       10. coefficient club le plus élevé (annexe D.4), et en cas d'égalité de
           coefficient l'annexe D.8 : saison la plus récente, puis les saisons
           précédentes, puis coefficient de l'association.

   CE QUE LE RÈGLEMENT NE CONTIENT PAS : la confrontation directe. Dans ce
   format les équipes à égalité ne se sont en général pas affrontées, et
   l'article 18.01 ne la mentionne pas. Elle n'existe ici qu'en OPTION
   EXPLICITEMENT NON UEFA ({ headToHead: true }), désactivée par défaut.

   « On ne saute jamais un critère » : si une donnée manque pour départager un
   groupe (cartons pas encore chargés, coefficient inconnu), le classement de ce
   groupe s'arrête là et ses lignes sont marquées `unresolved`. Appliquer le
   critère suivant produirait un ordre que le règlement ne produit pas.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCStandings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MATCHES_PER_TEAM = 8;

  function toInt(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function idOf(c) { return String((c && (c.teamId || c.id || c.name)) || ''); }
  function lookup(map, id) { return (map && map[id] != null) ? map[id] : null; }

  /* Un match compte dès qu'il a commencé : un match EN COURS compte de façon
     provisoire avec son score du moment, comme le fait l'UEFA en direct. */
  function counted(m) {
    return !!(m && m.home && m.away && (m.state === 'post' || m.state === 'in') &&
      m.home.score != null && m.home.score !== '' && m.away.score != null && m.away.score !== '');
  }

  /* =======================================================================
     1. STATISTIQUES PAR ÉQUIPE
     matches : [{ id, state:'pre'|'in'|'post', dateObj?, home:{teamId,name,score,…}, away:{…} }]
               — UNIQUEMENT des matchs de phase de ligue (le filtrage du tour
               appartient à la couche de données).
     seed    : clubs à faire figurer même sans match joué ({ id, name, abbr, logo })
     ======================================================================= */
  function buildTeamStats(matches, seed) {
    var map = {};
    function row(c) {
      var k = idOf(c);
      if (!map[k]) {
        map[k] = {
          teamId: k, name: c.name || '', shortName: c.shortName || c.name || '',
          abbr: c.abbr || '', logo: c.logo || '',
          pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
          awayGf: 0, awayW: 0,
          oppPts: 0, oppGd: 0, oppGf: 0,
          live: false, results: [], form: []
        };
      } else if (!map[k].logo && c.logo) {
        map[k].logo = c.logo;
      }
      return map[k];
    }

    (seed || []).forEach(function (c) { if (c && (c.id || c.teamId)) row(c); });

    (matches || []).forEach(function (m) {
      if (!counted(m)) return;
      var H = row(m.home), A = row(m.away);
      /* Le nom affiché reste celui de l'amorce ; le nom ESPN (anglais) sert à
         l'ordre alphabétique, le plus proche disponible des noms UEFA. */
      if (m.home.name) H.sortName = m.home.name;
      if (m.away.name) A.sortName = m.away.name;

      var hg = toInt(m.home.score), ag = toInt(m.away.score);
      H.pld++; A.pld++;
      H.gf += hg; H.ga += ag;
      A.gf += ag; A.ga += hg;
      A.awayGf += ag;                                  // critère 3

      var rH, rA;
      if (hg > ag)      { H.w++; A.l++; H.pts += 3; rH = 'w'; rA = 'l'; }
      else if (hg < ag) { A.w++; A.awayW++; H.l++; A.pts += 3; rH = 'l'; rA = 'w'; }   // critère 5
      else              { H.d++; A.d++; H.pts += 1; A.pts += 1; rH = 'd'; rA = 'd'; }
      if (m.state === 'in') { H.live = true; A.live = true; }

      var t = (m.time != null) ? m.time : (m.dateObj && m.dateObj.getTime ? m.dateObj.getTime() : 0);
      H.results.push({ matchId: m.id, t: t, oppId: idOf(m.away), home: true,  gf: hg, ga: ag, r: rH });
      A.results.push({ matchId: m.id, t: t, oppId: idOf(m.home), home: false, gf: ag, ga: hg, r: rA });
    });

    Object.keys(map).forEach(function (k) {
      var t = map[k];
      t.gd = t.gf - t.ga;
      if (!t.sortName) t.sortName = t.name;
      t.results.sort(function (a, b) { return a.t - b.t; });
      t.form = t.results.slice(-5).map(function (x) { return x.r; });
    });

    /* Critères 6 à 8 : totaux de la phase de ligue de CHAQUE adversaire
       affronté, additionnés. Calculé après coup, une fois les totaux de toutes
       les équipes connus. */
    Object.keys(map).forEach(function (k) {
      var t = map[k], seen = {};
      t.oppPts = 0; t.oppGd = 0; t.oppGf = 0;
      t.results.forEach(function (r) {
        if (seen[r.oppId]) return;
        seen[r.oppId] = true;
        var o = map[r.oppId];
        if (!o) return;
        t.oppPts += o.pts; t.oppGd += o.gd; t.oppGf += o.gf;
      });
    });
    return map;
  }

  /* =======================================================================
     2. CASCADE DE DÉPARTAGE
     ======================================================================= */
  function stat(key) { return function (t) { return t[key]; }; }

  var CRIT = {
    pts:    { key: 'pts',    better: 'high', get: stat('pts'),    label: 'Points' },
    h2h:    { key: 'h2h',    better: 'high', subset: true,        label: 'Confrontations directes (option HORS règlement UEFA)' },
    gd:     { key: 'gd',     better: 'high', get: stat('gd'),     label: 'Différence de buts' },
    gf:     { key: 'gf',     better: 'high', get: stat('gf'),     label: 'Buts marqués' },
    awayGf: { key: 'awayGf', better: 'high', get: stat('awayGf'), label: "Buts marqués à l'extérieur" },
    w:      { key: 'w',      better: 'high', get: stat('w'),      label: 'Victoires' },
    awayW:  { key: 'awayW',  better: 'high', get: stat('awayW'),  label: "Victoires à l'extérieur" },
    oppPts: { key: 'oppPts', better: 'high', get: stat('oppPts'), label: 'Points cumulés des adversaires' },
    oppGd:  { key: 'oppGd',  better: 'high', get: stat('oppGd'),  label: 'Différence de buts cumulée des adversaires' },
    oppGf:  { key: 'oppGf',  better: 'high', get: stat('oppGf'),  label: 'Buts marqués cumulés des adversaires' },
    disc:   { key: 'disc',   better: 'low',
              get: function (t, ctx) { return lookup(ctx.disciplinary, t.teamId); },
              label: 'Points disciplinaires (le plus bas)' },
    coef:   { key: 'coef',   better: 'high',
              get: function (t, ctx) { var c = lookup(ctx.coefficients, t.teamId); return c == null ? null : c.coefficient; },
              label: 'Coefficient club (annexe D.4)' }
  };

  var IN_PROGRESS = ['pts', 'gd', 'gf', 'awayGf', 'w', 'awayW'];
  var COMPLETE = IN_PROGRESS.concat(['oppPts', 'oppGd', 'oppGf', 'disc', 'coef']);

  /* Annexe D.8 — coefficients égaux : la saison la plus récente, puis la
     suivante où ils diffèrent (ce qui revient à parcourir les saisons de la
     plus récente à la plus ancienne), puis le coefficient de l'association.
     Une saison sans participation vaut 0 point (annexe D.4 : le coefficient de
     saison est la somme des points obtenus cette saison-là). */
  function d8Criteria(ctx) {
    var seasons = (ctx.coefficientSeasons || []).slice().reverse();
    var list = seasons.map(function (s) {
      return {
        key: 'coef:' + s, better: 'high', label: 'Coefficient de la saison ' + s + ' (annexe D.8)',
        get: function (t, c) {
          var r = lookup(c.coefficients, t.teamId);
          if (r == null) return null;
          var v = r.seasons ? r.seasons[s] : null;
          return v == null ? 0 : v;
        }
      };
    });
    list.push({
      key: 'coef:association', better: 'high', label: "Coefficient de l'association (annexe D.8)",
      get: function (t, c) {
        var r = lookup(c.coefficients, t.teamId);
        return (r == null || r.countryPart == null) ? null : r.countryPart;
      }
    });
    return list;
  }

  function criteriaFor(ctx) {
    var list = (ctx.complete ? COMPLETE : IN_PROGRESS).map(function (k) { return CRIT[k]; });
    if (ctx.headToHead) list.splice(1, 0, CRIT.h2h);
    if (ctx.complete) list = list.concat(d8Criteria(ctx));
    return list;
  }

  /* Option NON UEFA : points pris dans les matchs joués ENTRE les équipes du
     groupe à égalité. Ne s'applique que si au moins deux d'entre elles se sont
     réellement affrontées (voir metWithin). */
  function h2hPoints(t, group) {
    var ids = {};
    group.forEach(function (g) { ids[g.teamId] = true; });
    var p = 0;
    t.results.forEach(function (r) {
      if (ids[r.oppId]) p += (r.r === 'w') ? 3 : (r.r === 'd' ? 1 : 0);
    });
    return p;
  }
  function metWithin(group) {
    var ids = {};
    group.forEach(function (g) { ids[g.teamId] = true; });
    return group.some(function (t) { return t.results.some(function (r) { return ids[r.oppId]; }); });
  }

  function valueOf(crit, t, group, ctx) {
    var v = crit.subset ? h2hPoints(t, group) : crit.get(t, ctx);
    return (typeof v !== 'number' || isNaN(v)) ? null : v;
  }

  /* Répartit un groupe à égalité en paquets ordonnés selon UN critère.
     Retourne null si la valeur manque pour au moins une équipe du groupe. */
  function partition(group, crit, ctx) {
    var vals = [];
    for (var i = 0; i < group.length; i++) {
      var v = valueOf(crit, group[i], group, ctx);
      if (v == null) return null;
      vals.push({ t: group[i], v: v });
    }
    vals.sort(function (a, b) { return crit.better === 'low' ? a.v - b.v : b.v - a.v; });
    var buckets = [], cur = null;
    vals.forEach(function (x) {
      if (!cur || cur.v !== x.v) { cur = { v: x.v, teams: [] }; buckets.push(cur); }
      cur.teams.push(x.t);
    });
    return buckets.map(function (b) { return b.teams; });
  }

  function byName(a, b) {
    return String(a.sortName || a.name).localeCompare(String(b.sortName || b.name), 'en', { sensitivity: 'base' });
  }
  function byId(a, b) { return a.teamId < b.teamId ? -1 : (a.teamId > b.teamId ? 1 : 0); }

  /* Phase en cours, égalité persistante après les critères 1 à 5 :
     rang partagé, ordre alphabétique. */
  function equalRank(group) {
    return group.slice().sort(byName).map(function (t, i) {
      return { team: t, sep: i ? 'alphabetical' : null, shared: i > 0 };
    });
  }
  /* Donnée manquante, ou critères épuisés (le dernier critère de l'annexe D.8,
     le rang en championnat national, n'est pas disponible) : ordre
     déterministe par identifiant, lignes signalées. */
  function unresolved(group, missing) {
    return group.slice().sort(byId).map(function (t, i) {
      return { team: t, sep: i ? 'unresolved' : null, shared: i > 0, unresolved: true, missing: missing };
    });
  }

  /* -----------------------------------------------------------------------
     Algorithme de la cascade

     On part de toutes les équipes, vues comme UN groupe à égalité. Pour chaque
     critère, dans l'ordre :
       - s'il ne distingue personne dans le groupe, on passe au suivant ;
       - s'il sépare le groupe, on obtient des paquets ordonnés ; chaque paquet
         encore à égalité est à son tour départagé à partir du critère SUIVANT.
     C'est l'arrêt « dès qu'un critère sépare les équipes ».

     Pour les critères absolus (tous ceux du règlement), la valeur d'une équipe
     ne dépend pas du groupe : la cascade équivaut alors à un tri
     lexicographique. Elle n'est indispensable que pour l'option confrontation
     directe, dont la valeur dépend des équipes concernées : quand elle
     n'isole qu'une partie du groupe, elle est réappliquée au sous-groupe
     restant avant de passer au critère suivant.

     Chaque entrée garde `sep` : le critère qui la sépare de l'équipe placée
     juste au-dessus d'elle.
     ----------------------------------------------------------------------- */
  function rankGroup(group, list, from, ctx) {
    if (group.length === 1) return [{ team: group[0], sep: null }];
    for (var j = from; j < list.length; j++) {
      var crit = list[j];
      if (crit.subset && !metWithin(group)) continue;   // jamais affrontées : critère sans objet
      var buckets = partition(group, crit, ctx);
      if (buckets === null) return unresolved(group, crit.key);
      if (buckets.length === 1) continue;
      var out = [];
      for (var b = 0; b < buckets.length; b++) {
        var sub = buckets[b];
        var next = (crit.subset && sub.length > 1) ? j : j + 1;
        var ranked = rankGroup(sub, list, next, ctx);
        if (b > 0) ranked[0].sep = crit.key;
        out = out.concat(ranked);
      }
      return out;
    }
    return ctx.complete ? unresolved(group, 'domestic-position') : equalRank(group);
  }

  function isPhaseComplete(matches, teamsCount) {
    var list = matches || [];
    var expected = (teamsCount || 36) * MATCHES_PER_TEAM / 2;
    if (list.length < expected) return false;
    return list.every(function (m) { return m && m.state === 'post'; });
  }

  /* -----------------------------------------------------------------------
     rankLeaguePhase(matches, opts) -> lignes triées

     opts.seed               clubs à inclure même sans match (les 36 qualifiés)
     opts.complete           force l'état de la phase ; sinon déduit des matchs
     opts.teamsCount         36 par défaut (sert à déduire l'état de la phase)
     opts.disciplinary       { teamId: points }        — critère 9
     opts.coefficients       { teamId: { coefficient, countryPart, seasons } } — critère 10
     opts.coefficientSeasons ['2021/22', …, '2025/26'] — pour l'annexe D.8
     opts.headToHead         true = option NON UEFA (désactivée par défaut)

     Chaque ligne porte, en plus des statistiques :
       pos         rang de 1 à n (ordre d'affichage)
       rank        rang officiel : PARTAGÉ en cas d'égalité persistante
       decidedBy   critère qui l'a séparée de l'équipe juste au-dessus
       unresolved  vrai si une donnée manquait pour aller au bout
       missing     clé du critère dont la donnée manquait
     ----------------------------------------------------------------------- */
  function rankLeaguePhase(matches, opts) {
    opts = opts || {};
    var map = buildTeamStats(matches, opts.seed);
    var teams = Object.keys(map).map(function (k) { return map[k]; });
    var teamsCount = opts.teamsCount || (opts.seed && opts.seed.length) || 36;
    var complete = (typeof opts.complete === 'boolean') ? opts.complete : isPhaseComplete(matches, teamsCount);
    var ctx = {
      complete: complete,
      headToHead: !!opts.headToHead,
      disciplinary: opts.disciplinary || null,
      coefficients: opts.coefficients || null,
      coefficientSeasons: opts.coefficientSeasons || null
    };

    var entries = rankGroup(teams, criteriaFor(ctx), 0, ctx);
    var rows = entries.map(function (e, i) {
      var t = e.team;
      t.pos = i + 1;
      t.decidedBy = e.sep;
      t.sharedRank = !!e.shared;
      t.unresolved = !!e.unresolved;
      t.missing = e.missing || null;
      return t;
    });
    rows.forEach(function (t, i) { t.rank = (t.sharedRank && i > 0) ? rows[i - 1].rank : t.pos; });
    rows.meta = { complete: complete, criteria: criteriaFor(ctx).map(function (c) { return c.key; }), headToHead: ctx.headToHead };
    return rows;
  }

  function criterionLabel(key) {
    if (!key) return '';
    if (CRIT[key]) return CRIT[key].label;
    if (key === 'alphabetical') return 'Égalité persistante : rang partagé, ordre alphabétique';
    if (key === 'unresolved') return 'Égalité non départagée : donnée manquante';
    if (key === 'coef:association') return "Coefficient de l'association (annexe D.8)";
    if (key.indexOf('coef:') === 0) return 'Coefficient de la saison ' + key.slice(5) + ' (annexe D.8)';
    return key;
  }

  /* =======================================================================
     3. MAPPING VERS LES ZONES D'AFFICHAGE
     Séparé du tri : le moteur classe, cette partie ne fait que découper.
     ======================================================================= */
  var ZONES = [
    { key: 'q',   from: 1,  to: 8,  label: 'Huitièmes directs' },
    { key: 'po',  from: 9,  to: 24, label: 'Barrages' },
    { key: 'out', from: 25, to: 36, label: 'Éliminés' }
  ];
  function zoneOf(pos) {
    for (var i = 0; i < ZONES.length; i++) if (pos >= ZONES[i].from && pos <= ZONES[i].to) return ZONES[i].key;
    return null;
  }
  function toZones(rows) {
    return ZONES.map(function (z) {
      return {
        key: z.key, from: z.from, to: z.to, label: z.label,
        rows: (rows || []).filter(function (t) { return t.pos >= z.from && t.pos <= z.to; })
      };
    });
  }

  return {
    rankLeaguePhase: rankLeaguePhase,
    buildTeamStats: buildTeamStats,
    isPhaseComplete: isPhaseComplete,
    criterionLabel: criterionLabel,
    CRITERIA_IN_PROGRESS: IN_PROGRESS.slice(),
    CRITERIA_COMPLETE: COMPLETE.slice(),
    ZONES: ZONES,
    zoneOf: zoneOf,
    toZones: toZones
  };
});
