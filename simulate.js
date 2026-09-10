/* =========================================================================
   simulate.js — Moteur « What-If » de la phase de ligue
   -------------------------------------------------------------------------
   LOGIQUE MÉTIER PURE : aucune dépendance au DOM, à I18N ou à ESPN.
   Tout entre par les arguments, tout sort par la valeur de retour — ce qui
   rend le module testable en Node sans navigateur.

   On saisit le score exact d'un match à venir. Le classement simulé est
   recalculé par le MÊME moteur réglementaire que le classement réel
   (standings-engine.js, article 18.01), à partir de la liste complète des
   matchs dans laquelle les scores saisis ont été injectés.

   Pourquoi ne pas simplement ajouter des points ligne par ligne : les
   critères 6 à 8 (force du calendrier) dépendent des résultats de TOUTES les
   équipes. Un score saisi pour Real Madrid - Roma modifie aussi la force du
   calendrier de chaque adversaire passé ou futur de ces deux clubs.

   API : window.LDCSim
   ========================================================================= */
(function (global) {
  'use strict';

  /* Tri de REPLI, utilisé seulement si l'appelant ne fournit pas la liste des
     matchs : points, différence de buts, buts marqués, puis nom. Ce n'est PAS
     le règlement UEFA complet ; le tableau de bord passe toujours par le
     moteur réglementaire. */
  function compareFallback(a, b) {
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

  function validScore(s) {
    return s && s.match && s.hg != null && s.ag != null && s.hg !== '' && s.ag !== '';
  }
  function goals(v) { return Math.max(0, parseInt(v, 10) || 0); }

  /* Applique UN score à une table de lignes (chemin de repli uniquement). */
  function applyScore(map, match, hg, ag) {
    hg = goals(hg); ag = goals(ag);
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

  /* Injecte les scores saisis dans une COPIE de la liste des matchs : le match
     simulé devient « terminé » avec le score saisi. */
  function injectScores(matches, sims) {
    var byId = {};
    sims.forEach(function (s) { byId[String(s.match.id)] = s; });
    return (matches || []).map(function (m) {
      var s = byId[String(m.id)];
      if (!s) return m;
      return {
        id: m.id, dateObj: m.dateObj, state: 'post',
        home: Object.assign({}, m.home, { score: goals(s.hg) }),
        away: Object.assign({}, m.away, { score: goals(s.ag) })
      };
    });
  }

  /* -----------------------------------------------------------------------
     simulateStandings(currentStandings, sims, opts)

     currentStandings : le classement réel (sert de référence pour les deltas)
     sims             : un objet { match, hg, ag } ou un TABLEAU de ces objets
     opts.matches     : tous les matchs de la phase (format du moteur)
     opts.rank        : function(matches) -> lignes classées selon le règlement

     Avec opts.matches et opts.rank : recalcul réglementaire complet.
     Sans : tri de repli (voir compareFallback).

     Chaque ligne retournée porte :
       pos       — rang simulé
       basePos   — rang réel avant simulation
       delta     — basePos - pos  (>0 = monte, <0 = descend, 0 = inchangé)
       simulated — l'équipe joue au moins un des matchs simulés
     ----------------------------------------------------------------------- */
  function simulateStandings(currentStandings, sims, opts) {
    if (!sims) sims = [];
    if (!Array.isArray(sims)) sims = [sims];
    sims = sims.filter(validScore);                // saisie incomplète : ignorée
    opts = opts || {};

    var base = currentStandings || [];
    var basePos = {};
    base.forEach(function (t) { basePos[String(t.teamId || t.name)] = t.pos; });

    var touched = {};
    sims.forEach(function (s) {
      touched[String(s.match.home.teamId || s.match.home.name)] = true;
      touched[String(s.match.away.teamId || s.match.away.name)] = true;
    });

    var arr;
    if (opts.matches && typeof opts.rank === 'function') {
      arr = opts.rank(injectScores(opts.matches, sims)).slice();
    } else {
      var map = {};
      base.forEach(function (t) { map[String(t.teamId || t.name)] = cloneRow(t); });
      sims.forEach(function (s) { applyScore(map, s.match, s.hg, s.ag); });
      arr = Object.keys(map).map(function (k) {
        var t = map[k]; t.gd = t.gf - t.ga; t.form = t.form.slice(-5); return t;
      });
      arr.sort(compareFallback);
      arr.forEach(function (t, i) { t.pos = i + 1; t.rank = i + 1; });
    }

    arr.forEach(function (t, i) {
      var k = String(t.teamId || t.name);
      t.basePos = (basePos[k] != null) ? basePos[k] : t.pos;
      t.delta = t.basePos - t.pos;          // +2 = a gagné deux places
      t.simulated = !!touched[k];
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
    compareFallback: compareFallback,
    applyScore: applyScore,
    injectScores: injectScores,
    simulateStandings: simulateStandings,
    zoneOf: zoneOf,
    changedZone: changedZone,
    _cloneRow: cloneRow
  };
})(typeof window !== 'undefined' ? window : globalThis);
