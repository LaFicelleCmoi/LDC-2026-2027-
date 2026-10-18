/* Tests des seuils de qualification.  Lancer : node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../thresholds.js');
const E = require('../standings-engine.js');
const fx = require('./fixtures/league-phase-2024-25.json');

test('seuils 2024-25 = points réels du 8e, 9e, 24e et 25e au classement officiel', () => {
  const r = E.rankLeaguePhase(fx.matches);
  const s = T.SEASONS.find(x => x.season === '2024-25');
  assert.deepEqual([r[7].pts, r[8].pts, r[23].pts, r[24].pts], [s.top8, s.ninth, s.top24, s.twentyFifth]);
  // cohérent avec la fixture officielle (8e Aston Villa 16, 24e Club Brugge 11)
  assert.equal(fx.officialOrder[7].pts, s.top8);
  assert.equal(fx.officialOrder[23].pts, s.top24);
});

test('référence = seuil le plus élevé des saisons connues (celui qui a toujours suffi)', () => {
  assert.equal(T.reference('top8'), 16);
  assert.equal(T.reference('top24'), 11);
});

test('objectif ouvert : points manquants et victoires nécessaires', () => {
  assert.deepEqual(T.objective(4, 6, 16), { target: 16, pts: 4, max: 22, missing: 12, wins: 4, status: 'open' });
});

test('objectif atteint et objectif hors de portée', () => {
  assert.equal(T.objective(16, 2, 16).status, 'reached');
  assert.equal(T.objective(17, 0, 16).missing, 0);
  const out = T.objective(3, 2, 16);                   // 3 + 2×3 = 9 < 16
  assert.equal(out.status, 'out');
  assert.equal(out.max, 9);
});

test('objectives : top 8 et top 24 d’un coup', () => {
  const o = T.objectives(6, 6);
  assert.equal(o.top8.missing, 10);
  assert.equal(o.top8.wins, 4);
  assert.equal(o.top24.missing, 5);
  assert.equal(o.top24.wins, 2);
});

/* ---- Europa League ------------------------------------------------------ */
const UEL = T.forLeague('uefa.europa');
const uelFx = require('./fixtures/uel-league-phases.json');

test('Europa League : seuils = points réels du 8e, 9e, 24e et 25e des deux phases de ligue', () => {
  for (const s of UEL.SEASONS) {
    const ms = uelFx.seasons[s.season];
    assert.equal(ms.length, 144, s.season + ' : 144 matchs');
    const r = E.rankLeaguePhase(ms);
    assert.deepEqual([r[7].pts, r[8].pts, r[23].pts, r[24].pts], [s.top8, s.ninth, s.top24, s.twentyFifth], s.season);
  }
  // recoupement presse 2025-26 : Lyon 1er, Aston Villa 2e (21 pts), Roma 8e (16)
  const r = E.rankLeaguePhase(uelFx.seasons['2025-26']);
  assert.deepEqual([r[0].name, r[1].name, r[1].pts, r[7].name, r[7].pts], ['Lyon', 'Aston Villa', 21, 'AS Roma', 16]);
});

test('Europa League : référence 16 / 10 pts, textes de repère tirés des données', () => {
  assert.equal(UEL.LEAGUE, 'uefa.europa');
  assert.equal(UEL.reference('top8'), 16);
  assert.equal(UEL.reference('top24'), 10);
  assert.equal(UEL.trend('top8'), '14 pts en 2024-25, puis 16 en 2025-26');
  assert.equal(UEL.lastNote('top8'), '', 'le dernier seuil est la référence : pas de précision');
  assert.equal(UEL.lastNote('top24'), '(9 pts ont suffi en 2025-26)');
  assert.equal(T.trend('top8', true), '16 pts in both 2024-25 and 2025-26');
  assert.equal(T.LEAGUE, 'uefa.champions', 'Ligue des Champions par défaut');
  assert.equal(T.forLeague('inconnue').LEAGUE, 'uefa.champions');
});
