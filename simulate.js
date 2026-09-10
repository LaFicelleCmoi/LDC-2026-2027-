/* =========================================================================
   simulate.js — Moteur « What-If » de la phase de ligue
   -------------------------------------------------------------------------
   LOGIQUE MÉTIER PURE : aucune dépendance au DOM, à I18N ou à ESPN.
   Tout entre par les arguments, tout sort par la valeur de retour — ce qui
   rend le module testable en Node sans navigateur.

   Différence avec le mode prédiction du tracker : celui-ci raisonne en
   1 / N / 2 et invente un score (1-0 ou 1-1), ce qui fausse la différence de
   buts. Ici on saisit le score exact, donc la DB et les buts marqués sont
   justes — or ce sont précisément les deux premiers départages UEFA.

   API : window.LDCSim
   ========================================================================= */
(function (global) {
  'use strict';

  /* -----------------------------------------------------------------------
     TRI UEFA (article 17.01 du règlement, départages applicables au classement
     unique de la phase de ligue, dans cet ordre) :
       1. points
       2. différence de buts
       3. buts marqués
     Les départages suivants (confrontations, buts à l'extérieur, discipline,
     coefficient) demandent des données que l'API ne fournit pas : on retombe
     sur l'ordre alphabétique, exactement comme computeStandings() d'espn.js,
     pour que classement réel et classement simulé restent comparables.
     ----------------------------------------------------------------------- */
  function compareUEFA(a, b) {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return String(a.name).localeCompare(String(b.name));
  }

  /* Copie défensive : la simulation ne doit JAMAIS muter le classement réel,
     sinon un aller-retour simulation/réel corromprait les données affichées. */
  function cloneRow(t) {
    return {
      teamId: t.teamId, name: t.name, shortName: t.shortName, abbr: t.abbr, logo: t.logo,
      pld: t.pld || 0, w: t.w || 0, d: t.d || 0, l: t.l || 0,
      gf: t.gf || 0, ga: t.ga || 0, gd: t.gd || 0, pts: t.pts || 0,
      form: (t.form || []).slice(), live: false, simulated: false
    };
  }

  function emptyRow(c) {
    return { teamId: c.teamId, name: c.name, shortName: c.shortName, abbr: c.abbr, logo: c.logo,
             pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [], live: false, simulated: false };
  }

  /* -----------------------------------------------------------------------
     Applique UN score à la table. Mute `map` (déjà cloné par l'appelant).
     hg/ag = buts marqués par le domicile / l'extérieur.
     ----------------------------------------------------------------------- */
  function applyScore(map, match, hg, ag) {
    hg = Math.max(0, parseInt(hg, 10) || 0);
    ag = Math.max(0, parseInt(ag, 10) || 0);

    var hk = match.home.teamId || match.home.name;
    var ak = match.away.teamId || match.away.name;
    var H = map[hk] || (map[hk] = emptyRow(match.home));
    var A = map[ak] || (map[ak] = emptyRow(match.away));

    H.pld++; A.pld++;
    H.gf += hg; H.ga += ag;
    A.gf += ag; A.ga += hg;

    if (hg > ag)      { H.w++; A.l++; H.pts += 3; H.form.push('w'); A.form.push('l'); }
    else if (hg < ag) { A.w++; H.l++; A.pts += 3; A.form.push('w'); H.form.push('l'); }
    else              { H.d++; A.d++; H.pts += 1; A.pts += 1; H.form.push('d'); A.form.push('d'); }

    H.simulated = true; A.simulated = true;
    return map;
  }

  /* -----------------------------------------------------------------------
     simulateStandings(currentStandings, sims)

     currentStandings : le classement réel (tableau de lignes computeStandings)
     sims             : un objet { match, hg, ag } ou un TABLEAU de ces objets
                        (plusieurs matchs peuvent être simulés en même temps)

     Retourne un NOUVEAU tableau trié, chaque ligne portant :
       pos       — rang simulé
       basePos   — rang réel avant simulation
       delta     — basePos - pos  (>0 = monte, <0 = descend, 0 = inchangé)
       simulated — la ligne a été touchée par au moins un score saisi

     Le delta est calculé AVANT le tri, à partir d'un index des rangs réels :
     recalculer après coup obligerait à retrouver chaque équipe dans les deux
     tableaux, en O(n²).
     ----------------------------------------------------------------------- */
  function simulateStandings(currentStandings, sims) {
    if (!sims) sims = [];
    if (!Array.isArray(sims)) sims = [sims];

    var base = currentStandings || [];
    var basePos = {};                       // teamId -> rang réel, pour le delta
    var map = {};
    base.forEach(function (t) {
      var k = t.teamId || t.name;
      basePos[k] = t.pos;
      map[k] = cloneRow(t);
    });

    sims.forEach(function (s) {
      if (!s || !s.match) return;
      if (s.hg == null || s.ag == null || s.hg === '' || s.ag === '') return;  // saisie incomplète : ignorée
      applyScore(map, s.match, s.hg, s.ag);
    });

    var arr = Object.keys(map).map(function (k) {
      var t = map[k];
      t.gd = t.gf - t.ga;
      t.form = t.form.slice(-5);
      return t;
    });

    arr.sort(compareUEFA);

    arr.forEach(function (t, i) {
      var k = t.teamId || t.name;
      t.pos = i + 1;
      t.basePos = (basePos[k] != null) ? basePos[k] : (i + 1);
      t.delta = t.basePos - t.pos;          // +2 = a gagné deux places
    });
    return arr;
  }

  /* Zone de qualification d'un rang, format phase de ligue à 36.
     1-8 : huitièmes directs · 9-24 : barrages · 25-36 : éliminés */
  function zoneOf(pos) { return pos <= 8 ? 'q' : (pos <= 24 ? 'po' : 'out'); }

  /* Vrai si la simulation fait changer de zone — le saut visuellement notable. */
  function changedZone(row) {
    return row.basePos != null && zoneOf(row.basePos) !== zoneOf(row.pos);
  }

  global.LDCSim = {
    compareUEFA: compareUEFA,
    applyScore: applyScore,
    simulateStandings: simulateStandings,
    zoneOf: zoneOf,
    changedZone: changedZone,
    _cloneRow: cloneRow
  };
})(typeof window !== 'undefined' ? window : globalThis);
