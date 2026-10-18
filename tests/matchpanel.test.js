/* Tests de la fiche de match (lecture du résumé ESPN).  Lancer : node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSummary, implied } = require('../matchpanel.js');
const fx = require('./fixtures/summary-401915848.json');   // Fribourg 3-2 Jablonec, Conference League

const d = parseSummary(fx);

test('score, état et équipes', () => {
  assert.equal(d.state, 'post');
  assert.deepEqual([d.home.name, d.home.score, d.away.name, d.away.score], ['SC Freiburg', 3, 'Jablonec', 2]);
});

test('buteurs : 3 pour Fribourg dont un contre son camp, 2 pour Jablonec', () => {
  assert.equal(d.goals.home.length, 3);
  assert.equal(d.goals.away.length, 2);
  const og = d.goals.home.filter(g => g.own);
  assert.equal(og.length, 1, 'le csc de Jablonec compte pour Fribourg');
  assert.equal(og[0].player, 'Dusan Pavlovic');
  assert.equal(og[0].assist, '', 'pas de passeur sur un csc');
  assert.equal(d.goals.home.length + d.goals.away.length, d.home.score + d.away.score, 'buteurs = score');
});

test('frise : ordre chronologique, mi-temps, cartons et remplacements', () => {
  const kinds = d.events.map(e => e.kind);
  assert.ok(kinds.includes('ht') && kinds.includes('yellow') && kinds.includes('sub'));
  const ht = kinds.indexOf('ht');
  assert.ok(d.events.slice(0, ht).every(e => e.period === 1), 'la mi-temps sépare les deux périodes');
  for (let i = 1; i < d.events.length; i++) {
    const a = d.events[i - 1], b = d.events[i];
    assert.ok(a.period < b.period || (a.period === b.period && a.t <= b.t), 'ordre ' + i);
  }
});

test('compositions : 11 titulaires par équipe, dans l’ordre du système', () => {
  for (const side of ['home', 'away']) {
    const l = d.lineups[side];
    assert.equal(l.starters.length, 11, side);
    assert.ok(l.formation, side + ' : système');
    assert.equal(l.starters[0].pos, 'G', side + ' : le gardien d’abord');
  }
});

test('statistiques : possession à 100 %, passes réussies en pourcentage', () => {
  const pos = d.stats.find(s => s.key === 'possessionPct');
  assert.ok(Math.abs(pos.home + pos.away - 100) < 0.5);
  const pass = d.stats.find(s => s.key === 'passPct');
  assert.ok(pass.home > 1 && pass.home <= 100, 'converti en %');
});

test('probabilités du marché : marge retirée, somme 100 ± 1', () => {
  assert.ok(d.probs);
  const sum = d.probs.home + d.probs.draw + d.probs.away;
  assert.ok(sum >= 99 && sum <= 101, String(sum));
  assert.equal(Math.round(implied(-120) * 1000), 545);
  assert.equal(Math.round(implied(320) * 1000), 238);
  assert.equal(implied(null), null);
});

test('forme : score du point de vue du club, cohérent avec le résultat', () => {
  for (const side of ['home', 'away']) {
    for (const g of d.form[side]) {
      const [me, them] = g.score.split('-').map(Number);
      const r = me > them ? 'W' : me < them ? 'L' : 'D';
      assert.equal(r, g.result, side + ' ' + g.opp + ' ' + g.score);
    }
  }
});

test('résumé vide ou incomplet : aucune erreur', () => {
  const e = parseSummary({});
  assert.equal(e.state, 'pre');
  assert.deepEqual([e.events.length, e.stats.length, e.probs], [0, 0, null]);
});
