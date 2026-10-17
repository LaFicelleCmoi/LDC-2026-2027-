/* =========================================================================
   thresholds.js — Seuils réels des phases de ligue précédentes
   -------------------------------------------------------------------------
   Combien de points a-t-il fallu pour finir dans le top 8 (huitièmes directs)
   ou dans le top 24 (barrages) ? Valeurs RÉELLES, pas des estimations :
   points du 8e et du 24e (et du premier non qualifié) au classement final.

   Sources, recoupées :
   - 2024-25 : classement officiel, reproduit à l'identique par le moteur
     (tests/fixtures/league-phase-2024-25.json) ;
   - 2025-26 : 144 matchs ESPN classés par standings-engine.js, comparés le
     18/10/2026 au classement final publié (8e Manchester City 16 pts, 9e Real
     Madrid 15 ; 24e Benfica 9, 25e Marseille 9, départagé à la différence de
     buts) :
     https://en.wikipedia.org/wiki/2025%E2%80%9326_UEFA_Champions_League_league_phase

   API : window.LDCThresholds (et require() dans Node).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCThresholds = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEASONS = [
    { season: '2024-25', top8: 16, ninth: 15, top24: 11, twentyFifth: 11 },
    { season: '2025-26', top8: 16, ninth: 15, top24: 9, twentyFifth: 9 }
  ];

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

  return { SEASONS: SEASONS, MAX_MATCHES: MAX_MATCHES, reference: reference, objective: objective, objectives: objectives };
});
