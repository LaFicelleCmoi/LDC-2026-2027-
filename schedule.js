/* =========================================================================
   schedule.js — Calendrier : recherche de la prochaine date de matchs
   -------------------------------------------------------------------------
   LOGIQUE PURE : ni DOM, ni réseau, ni ESPN. Chargeable dans le navigateur
   (window.LDCSchedule) et dans Node (require) pour les tests.

   Pourquoi ce module : la Ligue des Champions laisse des trous de plusieurs
   semaines entre deux journées. « Aujourd'hui + 1 jour » tombe alors presque
   toujours sur un jour vide. On cherche plutôt, dans tout le calendrier, la
   prochaine date qui a réellement des matchs.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCSchedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Instant du coup d'envoi (ms), quel que soit le format du match :
     `dateObj` (Date, format d'espn.js), `time` (ms) ou `date` (chaîne ISO).
     NaN si aucune date exploitable. */
  function kickoff(m) {
    if (!m) return NaN;
    if (m.dateObj && typeof m.dateObj.getTime === 'function') return m.dateObj.getTime();
    if (typeof m.time === 'number') return m.time;
    if (m.date != null) return new Date(m.date).getTime();
    return NaN;
  }

  function toTime(v) {
    if (v == null) return Date.now();
    if (typeof v.getTime === 'function') return v.getTime();
    return new Date(v).getTime();
  }

  /* Jour CIVIL dans le fuseau de l'utilisateur, sous forme de nombre
     AAAAMMJJ (comparable directement). Un match à 21 h appartient au jour où
     l'utilisateur le regarde, pas au jour UTC. */
  function localDayKey(t) {
    var d = new Date(t);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /* -----------------------------------------------------------------------
     getNextMatchDate(schedule, currentDate)

     schedule    : tableau de matchs (formats acceptés : voir kickoff)
     currentDate : Date, horodatage ou chaîne ISO ; maintenant par défaut

     1. Filtre les matchs dont la DATE est strictement postérieure à celle de
        currentDate.
     2. Les trie par ordre chronologique.
     3. Retourne le bloc de matchs de la date la plus proche :
          { key: 20261014, date: <Date à minuit local>, matches: [...] }
        ou null s'il n'y a plus aucun match à venir.

     « Strictement postérieure » se juge au JOUR, pas à la milliseconde. À
     14 h un soir de match, les rencontres de 21 h sont bien postérieures à
     l'instant présent, mais elles appartiennent à « Aujourd'hui ». Comparer
     les horodatages renverrait ce même soir, et « À venir » répéterait
     l'onglet « Aujourd'hui » au lieu d'avancer.

     L'entrée n'est jamais modifiée ; les objets retournés sont ceux du
     calendrier d'origine.
     ----------------------------------------------------------------------- */
  function getNextMatchDate(schedule, currentDate) {
    var now = toTime(currentDate);
    if (isNaN(now)) throw new TypeError('getNextMatchDate : currentDate invalide');
    var today = localDayKey(now);

    // 1. Filtre : jour strictement postérieur au jour courant
    var future = [];
    (schedule || []).forEach(function (m) {
      var t = kickoff(m);
      if (isNaN(t)) return;                         // match sans date : ignoré
      if (localDayKey(t) > today) future.push({ m: m, t: t });
    });
    if (!future.length) return null;

    // 2. Tri chronologique (id en départage, pour un ordre stable)
    future.sort(function (a, b) {
      return (a.t - b.t) || String(a.m && a.m.id).localeCompare(String(b.m && b.m.id));
    });

    // 3. Bloc de la date la plus proche : le tableau est trié, ce bloc est en
    //    tête — on s'arrête au premier match d'un autre jour.
    var key = localDayKey(future[0].t);
    var matches = [];
    for (var i = 0; i < future.length && localDayKey(future[i].t) === key; i++) matches.push(future[i].m);

    var first = new Date(future[0].t);
    return {
      key: key,
      date: new Date(first.getFullYear(), first.getMonth(), first.getDate()),
      matches: matches
    };
  }

  return {
    getNextMatchDate: getNextMatchDate,
    localDayKey: localDayKey,
    kickoff: kickoff
  };
});
