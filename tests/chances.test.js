/* Tests des chances de qualification.  Lancer : node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../chances.js');
const E = require('../standings-engine.js');
const ucl = require('./fixtures/league-phase-2024-25.json');
const uel = require('./fixtures/uel-league-phases.json');
const uecl = require('./fixtures/uecl-league-phases.json');

const clubsOf = ms => [...new Set(ms.flatMap(m => [m.home.teamId, m.away.teamId]))].map(id => ({ id }));
const starts = ms => { const t = [...new Set(ms.map(m => m.time))].sort((a, b) => a - b), g = []; let l = null; t.forEach(x => { if (l === null || x - l > 5 * 864e5) g.push(x); l = x; }); return g; };
const cutAt = (ms, md) => { const c = starts(ms)[md]; return ms.map(m => m.time < c ? m : { id: m.id, round: 'league', home: m.home, away: m.away, state: 'pre', time: m.time }); };

test('8 places de top 8 et 24 de top 24 réparties entre les clubs', () => {
  const ms = cutAt(uel.seasons['2025-26'], 3), r = C.simulate(ms, clubsOf(ms), { runs: 800 });
  const ids = Object.keys(r).filter(k => k !== '_meta');
  assert.equal(ids.length, 36);
  assert.ok(Math.abs(ids.reduce((s, k) => s + r[k].top8, 0) - 8) < 1e-9);
  assert.ok(Math.abs(ids.reduce((s, k) => s + r[k].top24, 0) - 24) < 1e-9);
  ids.forEach(k => assert.ok(r[k].top8 <= r[k].top24, k));
});

test('mêmes données, mêmes chiffres (graine fixe)', () => {
  const ms = cutAt(uecl.seasons['2024-25'], 2), cl = clubsOf(ms);
  assert.deepEqual(C.simulate(ms, cl, { runs: 300 }), C.simulate(ms, cl, { runs: 300 }));
});

test('club déjà hors d’atteinte : 0 % ; club assuré : 100 %', () => {
  /* 2 matchs restants : 4 clubs ; A a 9 pts d'avance */
  const t = (id) => ({ teamId: id });
  const m = (h, a, hs, as, st) => ({ round: 'league', state: st, home: Object.assign(t(h), { score: hs }), away: Object.assign(t(a), { score: as }) });
  const ms = [m('A', 'B', 3, 0, 'post'), m('A', 'C', 3, 0, 'post'), m('A', 'D', 3, 0, 'post'), m('B', 'C', 0, 0, 'pre')];
  const r = C.simulate(ms, ['A', 'B', 'C', 'D'].map(id => ({ id })), { runs: 200 });
  assert.equal(r.A.first, 1);
});

test('affichage : jamais 0 ni 100 %', () => {
  assert.equal(C.pct(1), '> 99 %'); assert.equal(C.pct(0), '< 1 %'); assert.equal(C.pct(0.873), '87 %'); assert.equal(C.pct(null), '—');
});

test('phase finie ou pas commencée : pas de calcul', () => {
  const done = uel.seasons['2024-25'].map(m => Object.assign({ round: 'league' }, m));
  assert.equal(C.cached(done, clubsOf(done)), null);
});

test('contrôle sur les phases passées : meilleur que « le classement actuel est final », à mi-parcours', () => {
  for (const ms of [ucl.matches, uel.seasons['2024-25'], uel.seasons['2025-26'], uecl.seasons['2024-25'], uecl.seasons['2025-26']]) {
    const fin = E.rankLeaguePhase(ms).map(r => ({ id: r.teamId }));
    const md = starts(ms).length === 8 ? 4 : 3;
    const r = C.backtest(ms, clubsOf(ms), fin, starts(ms)[md], { runs: 800 });
    assert.ok(r.model < r.naive, 'J' + md + ' : modèle ' + r.model.toFixed(3) + ' vs naïf ' + r.naive.toFixed(3));
  }
});
