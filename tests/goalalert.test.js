/* Tests des alertes but : détection des changements d'un match.  Lancer : node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { diff, COMPS } = require('../goalalert.js');

const types = l => l.map(e => e.type + (e.type === 'goal' ? (e.mine ? '+' : '-') : ''));

test('trois compétitions suivies', () => {
  assert.deepEqual(COMPS.map(c => c.key), ['ucl', 'uel', 'uecl']);
});

test('ouverture de la page en plein match : aucune alerte', () => {
  assert.deepEqual(diff(null, { state: 'in', h: 2, a: 1 }, true), []);
});

test('coup d’envoi, but pour, but contre, score final (club à domicile)', () => {
  assert.deepEqual(types(diff({ state: 'pre', h: 0, a: 0 }, { state: 'in', h: 0, a: 0 }, true)), ['kickoff']);
  assert.deepEqual(types(diff({ state: 'in', h: 0, a: 0 }, { state: 'in', h: 1, a: 0 }, true)), ['goal+']);
  assert.deepEqual(types(diff({ state: 'in', h: 1, a: 0 }, { state: 'in', h: 1, a: 1 }, true)), ['goal-']);
  assert.deepEqual(types(diff({ state: 'in', h: 1, a: 1 }, { state: 'post', h: 1, a: 1 }, true)), ['final']);
});

test('club à l’extérieur : un but de l’équipe visiteuse est « pour »', () => {
  assert.deepEqual(types(diff({ state: 'in', h: 0, a: 0 }, { state: 'in', h: 0, a: 1 }, false)), ['goal+']);
});

test('deux buts entre deux passages, puis fin : tout est signalé dans l’ordre', () => {
  assert.deepEqual(types(diff({ state: 'in', h: 0, a: 0 }, { state: 'post', h: 2, a: 0 }, true)), ['goal+', 'goal+', 'final']);
});

test('but annulé (score qui baisse) : rien', () => {
  assert.deepEqual(diff({ state: 'in', h: 1, a: 0 }, { state: 'in', h: 0, a: 0 }, true), []);
});
