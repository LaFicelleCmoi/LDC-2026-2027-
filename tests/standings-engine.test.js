/* Tests unitaires du moteur de classement de la phase de ligue.
   Lancer :  node --test tests/
   Aucune dépendance : node:test et node:assert sont intégrés à Node (≥ 18). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const E = require('../standings-engine.js');

/* --- Aides ------------------------------------------------------------- */
let seq = 0;
/* m('A', 2, 'X', 0) : A reçoit X et gagne 2-0. */
function m(home, hg, away, ag, state) {
  seq++;
  return { id: 'm' + seq, state: state || 'post', time: seq,
    home: { teamId: home, name: home, score: hg }, away: { teamId: away, name: away, score: ag } };
}
const order = rows => rows.map(t => t.teamId);
const row = (rows, id) => rows.find(t => t.teamId === id);
/* Position relative de deux équipes, sans dépendre du reste du tableau. */
function above(rows, a, b) { return row(rows, a).pos < row(rows, b).pos; }

/* ======================================================================= */
test('points : victoire 3, nul 1, défaite 0', () => {
  const r = E.rankLeaguePhase([m('A', 2, 'B', 0), m('C', 1, 'D', 1)]);
  assert.equal(row(r, 'A').pts, 3);
  assert.equal(row(r, 'B').pts, 0);
  assert.equal(row(r, 'C').pts, 1);
  assert.equal(row(r, 'D').pts, 1);
});

test('statistiques : buts et victoires à l’extérieur attribués à l’équipe visiteuse', () => {
  const r = E.rankLeaguePhase([m('X', 1, 'A', 3)]);
  const a = row(r, 'A');
  assert.deepEqual([a.gf, a.ga, a.gd, a.awayGf, a.w, a.awayW], [3, 1, 2, 3, 1, 1]);
  const x = row(r, 'X');
  assert.deepEqual([x.awayGf, x.awayW], [0, 0]);
});

/* ======================================================================= */
test('égalité totale sur les points : la cascade 1 à 5 s’applique dans l’ordre', async (t) => {
  await t.test('1. différence de buts', () => {
    const r = E.rankLeaguePhase([m('A', 2, 'X', 0), m('B', 1, 'Y', 0)]);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'gd');
  });
  await t.test('2. buts marqués (différence égale)', () => {
    const r = E.rankLeaguePhase([m('A', 3, 'X', 1), m('B', 2, 'Y', 0)]);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'gf');
  });
  await t.test('3. buts marqués à l’extérieur (buts égaux)', () => {
    // A gagne 2-1 à l'extérieur, B gagne 2-1 à domicile
    const r = E.rankLeaguePhase([m('X', 1, 'A', 2), m('B', 2, 'Y', 1)]);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'awayGf');
  });
  await t.test('4. victoires (buts à l’extérieur égaux)', () => {
    // A : 1 victoire + 1 défaite = 3 pts, 1-1 ; B : 3 nuls = 3 pts, 1-1
    const r = E.rankLeaguePhase([
      m('A', 1, 'X', 0), m('A', 0, 'Y', 1),
      m('B', 0, 'Z', 0), m('B', 0, 'W', 0), m('B', 1, 'V', 1)
    ]);
    assert.equal(row(r, 'A').pts, row(r, 'B').pts);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'w');
  });
  await t.test('5. victoires à l’extérieur (victoires égales)', () => {
    // A gagne dehors et perd à domicile ; B gagne à domicile et perd dehors.
    // Mêmes points, DB, buts, buts à l'extérieur, victoires.
    const r = E.rankLeaguePhase([
      m('X', 0, 'A', 1), m('A', 1, 'Y', 2),
      m('B', 1, 'Z', 0), m('W', 2, 'B', 1)
    ]);
    const a = row(r, 'A'), b = row(r, 'B');
    assert.deepEqual([a.pts, a.gd, a.gf, a.awayGf, a.w], [b.pts, b.gd, b.gf, b.awayGf, b.w]);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(b.decidedBy, 'awayW');
  });
  await t.test('phase en cours, toujours à égalité : rang partagé et ordre alphabétique', () => {
    const r = E.rankLeaguePhase([m('Zeta', 1, 'X', 0), m('Alpha', 1, 'Y', 0)]);
    assert.ok(above(r, 'Alpha', 'Zeta'));
    assert.equal(row(r, 'Zeta').decidedBy, 'alphabetical');
    assert.equal(row(r, 'Zeta').rank, row(r, 'Alpha').rank);
    assert.equal(row(r, 'Zeta').unresolved, false);
  });
  await t.test('phase en cours : les critères 6 à 10 ne sont PAS appliqués', () => {
    const r = E.rankLeaguePhase([m('A', 1, 'X', 0), m('B', 1, 'Y', 0), m('X', 5, 'Z', 0)]);
    assert.equal(r.meta.complete, false);
    assert.deepEqual(r.meta.criteria, ['pts', 'gd', 'gf', 'awayGf', 'w', 'awayW']);
    assert.equal(row(r, 'B').decidedBy, 'alphabetical');   // A et B restent à égalité malgré X plus fort
  });
});

/* ======================================================================= */
test('confrontation directe : absente du règlement UEFA, disponible en option', async (t) => {
  // A bat B, mais B a une meilleure différence de buts générale.
  const fixture = () => [m('A', 1, 'B', 0), m('X', 1, 'A', 0), m('B', 4, 'Y', 0)];

  await t.test('règles UEFA (par défaut) : la victoire dans le match direct ne départage pas', () => {
    const r = E.rankLeaguePhase(fixture());
    assert.equal(row(r, 'A').pts, row(r, 'B').pts);
    assert.ok(above(r, 'B', 'A'), 'B doit passer devant A à la différence de buts');
    assert.equal(row(r, 'A').decidedBy, 'gd');
    assert.ok(!r.meta.criteria.includes('h2h'));
  });
  await t.test('option headToHead (hors règlement) : A passe devant grâce au match direct', () => {
    const r = E.rankLeaguePhase(fixture(), { headToHead: true });
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'h2h');
  });
  await t.test('option headToHead : sans rencontre entre elles, le critère est sans objet', () => {
    const r = E.rankLeaguePhase([m('A', 2, 'X', 0), m('B', 1, 'Y', 0)], { headToHead: true });
    assert.equal(row(r, 'B').decidedBy, 'gd');
  });
  await t.test('option headToHead à trois : réappliqué au sous-groupe restant', () => {
    // A, B, C à 3 pts. Entre eux : A bat B ; B et C ne se sont pas rencontrés, C et A non plus.
    const r = E.rankLeaguePhase([
      m('A', 1, 'B', 0), m('X', 1, 'A', 0),
      m('B', 2, 'Y', 0), m('C', 3, 'Z', 0)
    ], { headToHead: true });
    assert.ok(above(r, 'A', 'B'));
  });
});

/* ======================================================================= */
test('force du calendrier (phase terminée) : critères 6, 7, 8', async (t) => {
  /* A et B strictement identiques sur les critères 1 à 5 : chacun a battu
     1-0 à domicile un adversaire différent. Seuls ces adversaires diffèrent. */
  await t.test('6. points cumulés des adversaires', () => {
    const r = E.rankLeaguePhase([m('A', 1, 'X', 0), m('B', 1, 'Y', 0), m('X', 2, 'Z', 0)], { complete: true });
    assert.equal(row(r, 'A').oppPts, 3);
    assert.equal(row(r, 'B').oppPts, 0);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'oppPts');
  });
  await t.test('7. différence de buts cumulée des adversaires', () => {
    const r = E.rankLeaguePhase([m('A', 1, 'X', 0), m('B', 1, 'Y', 0), m('X', 3, 'Z', 0), m('Y', 1, 'W', 0)], { complete: true });
    assert.equal(row(r, 'A').oppPts, row(r, 'B').oppPts);
    assert.ok(row(r, 'A').oppGd > row(r, 'B').oppGd);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(row(r, 'B').decidedBy, 'oppGd');
  });
  await t.test('8. buts marqués cumulés des adversaires', () => {
    const r = E.rankLeaguePhase([m('A', 1, 'X', 0), m('B', 1, 'Y', 0), m('X', 3, 'Z', 1), m('Y', 2, 'W', 0)], { complete: true });
    const a = row(r, 'A'), b = row(r, 'B');
    assert.deepEqual([a.oppPts, a.oppGd], [b.oppPts, b.oppGd]);
    assert.ok(a.oppGf > b.oppGf);
    assert.ok(above(r, 'A', 'B'));
    assert.equal(b.decidedBy, 'oppGf');
  });
});

/* ======================================================================= */
test('fair-play et coefficient (phase terminée) : critères 9 et 10', async (t) => {
  const twins = () => [m('A', 1, 'X', 0), m('B', 1, 'Y', 0)];   // A et B identiques sur 1 à 8

  await t.test('9. le total disciplinaire le plus BAS passe devant', () => {
    const r = E.rankLeaguePhase(twins(), { complete: true, disciplinary: { A: 5, B: 3, X: 0, Y: 0 } });
    assert.ok(above(r, 'B', 'A'));
    assert.equal(row(r, 'A').decidedBy, 'disc');
  });
  await t.test('9. donnée manquante : on s’arrête, on ne saute PAS au coefficient', () => {
    const r = E.rankLeaguePhase(twins(), { complete: true, disciplinary: { A: 5 },
      coefficients: { A: { coefficient: 99 }, B: { coefficient: 1 } } });
    assert.equal(row(r, 'A').unresolved, true);
    assert.equal(row(r, 'A').missing, 'disc');
    assert.equal(row(r, 'B').missing, 'disc');
  });
  await t.test('10. coefficient club le plus élevé', () => {
    const r = E.rankLeaguePhase(twins(), { complete: true, disciplinary: { A: 3, B: 3, X: 0, Y: 0 },
      coefficients: { A: { coefficient: 50 }, B: { coefficient: 60 } } });
    assert.ok(above(r, 'B', 'A'));
    assert.equal(row(r, 'A').decidedBy, 'coef');
  });
  await t.test('10. annexe D.8 : coefficients égaux, la saison la plus récente départage', () => {
    const seasons = ['2024/25', '2025/26'];
    const r = E.rankLeaguePhase(twins(), { complete: true, disciplinary: { A: 3, B: 3, X: 0, Y: 0 },
      coefficientSeasons: seasons,
      coefficients: {
        A: { coefficient: 40, countryPart: 10, seasons: { '2024/25': 25, '2025/26': 15 } },
        B: { coefficient: 40, countryPart: 10, seasons: { '2024/25': 20, '2025/26': 20 } }
      } });
    assert.ok(above(r, 'B', 'A'));
    assert.equal(row(r, 'A').decidedBy, 'coef:2025/26');
  });
  await t.test('tous critères épuisés : signalé, jamais inventé', () => {
    const same = { coefficient: 40, countryPart: 10, seasons: { '2025/26': 20 } };
    const r = E.rankLeaguePhase(twins(), { complete: true, disciplinary: { A: 3, B: 3, X: 0, Y: 0 },
      coefficientSeasons: ['2025/26'], coefficients: { A: same, B: same } });
    assert.equal(row(r, 'A').unresolved, true);
    assert.equal(row(r, 'A').missing, 'domestic-position');
  });
});

/* ======================================================================= */
test('zones d’affichage : 1-8 huitièmes, 9-24 barrages, 25-36 éliminés', () => {
  assert.deepEqual([1, 8, 9, 24, 25, 36].map(E.zoneOf), ['q', 'q', 'po', 'po', 'out', 'out']);
  const seed = Array.from({ length: 36 }, (_, i) => ({ id: 'T' + String(i).padStart(2, '0'), name: 'T' + i }));
  const z = E.toZones(E.rankLeaguePhase([], { seed }));
  assert.deepEqual(z.map(x => [x.key, x.rows.length]), [['q', 8], ['po', 16], ['out', 12]]);
});

test('match en cours : compté provisoirement ; match à venir : ignoré', () => {
  const r = E.rankLeaguePhase([m('A', 1, 'B', 0, 'in'), m('C', 5, 'D', 0, 'pre')]);
  assert.equal(row(r, 'A').pts, 3);
  assert.equal(row(r, 'A').live, true);
  assert.equal(row(r, 'C'), undefined);
});

/* ======================================================================= */
test('données réelles : phase de ligue 2024-25 — ordre final officiel reproduit à l’identique', () => {
  const fx = require(path.join(__dirname, 'fixtures', 'league-phase-2024-25.json'));
  const r = E.rankLeaguePhase(fx.matches);
  assert.equal(fx.matches.length, 144);
  assert.equal(r.meta.complete, true, 'les 144 matchs sont joués : liste complète des critères');
  assert.deepEqual(order(r), fx.officialOrder.map(o => o.teamId));
  // La note officielle : Real Madrid devant le Bayern aux victoires à l'extérieur
  const real = r.find(t => t.name === 'Real Madrid');
  const bayern = r.find(t => /Bayern/.test(t.name));
  assert.equal(real.pos, 11);
  assert.equal(bayern.pos, 12);
  assert.equal(bayern.decidedBy, 'awayW');
  assert.equal(r.filter(t => t.unresolved).length, 0);
});

test('coefficients 2026/27 : 36 clubs, règle de l’annexe D.4 respectée', () => {
  const C = require('../coefficients2026.js');
  const clubs = Object.values(C.clubs);
  assert.equal(clubs.length, 36);
  assert.deepEqual(C.seasons, ['2021/22', '2022/23', '2023/24', '2024/25', '2025/26']);
  clubs.forEach(c => {
    assert.equal(c.coefficient, Math.max(c.sum, c.countryPart), c.name);
  });
});
