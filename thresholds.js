/* =========================================================================
   thresholds.js — Seuils réels des phases de ligue précédentes
   -------------------------------------------------------------------------
   Combien de points a-t-il fallu pour finir dans le top 8 (huitièmes directs)
   ou dans le top 24 (barrages) ? Valeurs RÉELLES, pas des estimations :
   points du 8e et du 24e (et du premier non qualifié) au classement final.

   LIGUE DES CHAMPIONS — sources, recoupées :
   - 2024-25 : classement officiel, reproduit à l'identique par le moteur
     (tests/fixtures/league-phase-2024-25.json) ;
   - 2025-26 : 144 matchs ESPN classés par standings-engine.js, comparés le
     18/10/2026 au classement final publié (8e Manchester City 16 pts, 9e Real
     Madrid 15 ; 24e Benfica 9, 25e Marseille 9, départagé à la différence de
     buts) :
     https://en.wikipedia.org/wiki/2025%E2%80%9326_UEFA_Champions_League_league_phase

   EUROPA LEAGUE — les 144 matchs ESPN de chaque phase classés par
   standings-engine.js le 18/10/2026 :
   - 2024-25 : 8e Rangers 14 pts, 9e Bodø/Glimt 14 (différence de buts) ;
     24e Fenerbahçe 10, 25e Braga 10 ;
   - 2025-26 : 8e AS Roma 16, 9e Genk 16 ; 24e Brann 9, 25e Young Boys 9.
     Haut du tableau recoupé avec la presse (Lyon 1er, Aston Villa 2e à
     21 pts, Roma 8e à 16).

   La compétition suit window.LDC_LEAGUE (voir espn.js) ; forLeague(slug)
   donne les seuils d'une autre.
   API : window.LDCThresholds (et require() dans Node : Ligue des Champions).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.LDCThresholds = factory(root.LDC_LEAGUE);
})(typeof self !== 'undefined' ? self : this, function (league) {
  'use strict';

  var DATA = {
    'uefa.champions': [
      { season: '2024-25', top8: 16, ninth: 15, top24: 11, twentyFifth: 11 },
      { season: '2025-26', top8: 16, ninth: 15, top24: 9, twentyFifth: 9 }
    ],
    'uefa.europa': [
      { season: '2024-25', top8: 14, ninth: 14, top24: 10, twentyFifth: 10 },
      { season: '2025-26', top8: 16, ninth: 16, top24: 9, twentyFifth: 9 }
    ]
  };

  return make(DATA[league] ? league : 'uefa.champions');

  function make(slug) {
    var SEASONS = DATA[slug];

    var MAX_MATCHES = 8;

    /* Objectif de référence : le seuil le PLUS ÉLEVÉ des saisons connues, celui
       qui aurait suffi chaque fois. */
    function reference(key) {
      return Math.max.apply(null, SEASONS.map(function (s) { return s[key]; }));
    }

    /* Où en est un club par rapport à un seuil.
       pts : points actuels · remaining : matchs de phase de ligue restants.
       status : 'reached' (seuil atteint), 'open' (atteignable), 'out' (même en
       gagnant tout, impossible). */
    function objective(pts, remaining, target) {
      var max = pts + 3 * remaining;
      if (pts >= target) return { target: target, pts: pts, max: max, missing: 0, wins: 0, status: 'reached' };
      var missing = target - pts;
      return { target: target, pts: pts, max: max, missing: missing,
               wins: Math.ceil(missing / 3), status: max >= target ? 'open' : 'out' };
    }

    function objectives(pts, remaining) {
      return { top8: objective(pts, remaining, reference('top8')),
               top24: objective(pts, remaining, reference('top24')) };
    }

    /* « 16 pts en 2024-25 comme en 2025-26 » / « 11 pts en 2024-25, puis 9 en
       2025-26 » : l'évolution d'un seuil sur les saisons connues. */
    function trend(key, en) {
      var a = SEASONS[0], b = SEASONS[SEASONS.length - 1];
      if (a[key] === b[key]) return en ? a[key] + ' pts in both ' + a.season + ' and ' + b.season
                                       : a[key] + ' pts en ' + a.season + ' comme en ' + b.season;
      return en ? a[key] + ' pts in ' + a.season + ', then ' + b[key] + ' in ' + b.season
                : a[key] + ' pts en ' + a.season + ', puis ' + b[key] + ' en ' + b.season;
    }

    /* Précision quand la dernière saison a demandé moins que l'objectif de
       référence : « (9 pts ont suffi en 2025-26) ». Vide sinon. */
    function lastNote(key, en) {
      var b = SEASONS[SEASONS.length - 1];
      if (b[key] >= reference(key)) return '';
      return en ? '(' + b[key] + ' pts were enough in ' + b.season + ')' : '(' + b[key] + ' pts ont suffi en ' + b.season + ')';
    }

    return { LEAGUE: slug, SEASONS: SEASONS, MAX_MATCHES: MAX_MATCHES, reference: reference, objective: objective,
             objectives: objectives, trend: trend, lastNote: lastNote, forLeague: function (s) { return make(DATA[s] ? s : 'uefa.champions'); } };
  }
});
