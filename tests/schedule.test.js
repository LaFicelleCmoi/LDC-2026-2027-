/* Tests de la recherche de la prochaine date de matchs.
   Lancer :  node --test tests/*.test.js */
'use strict';
/* Fuseau fixé AVANT toute manipulation de date : le « jour » d'un match
   dépend du fuseau, et les tests doivent donner le même résultat partout. */
process.env.TZ = 'Europe/Paris';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { getNextMatchDate } = require('../schedule.js');

let n = 0;
/* Match au format d'espn.js ; mois de 1 à 12. */
const match = (y, mo, d, h, mi, extra) => Object.assign({ id: 'm' + (++n), dateObj: new Date(y, mo - 1, d, h, mi || 0) }, extra);
const moment = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi || 0);

test('exemple de la spécification : le 02/10, « À venir » saute directement au 14/10', () => {
  const schedule = [match(2026, 9, 30, 21), match(2026, 10, 14, 18, 45), match(2026, 10, 14, 21), match(2026, 10, 15, 21)];
  const r = getNextMatchDate(schedule, moment(2026, 10, 2, 12));
  assert.equal(r.key, 20261014);
  assert.equal(r.matches.length, 2);
  assert.deepEqual([r.date.getFullYear(), r.date.getMonth() + 1, r.date.getDate(), r.date.getHours()], [2026, 10, 14, 0]);
});

test('le jour courant est exclu, même si ses matchs ne sont pas encore joués', () => {
  // 14 h un soir de match : les rencontres de 21 h appartiennent à « Aujourd'hui »
  const tonight = match(2026, 10, 14, 21);
  const next = match(2026, 10, 15, 18, 45);
  const r = getNextMatchDate([tonight, next], moment(2026, 10, 14, 14));
  assert.equal(r.key, 20261015);
  assert.deepEqual(r.matches, [next]);
});

test('renvoie TOUS les matchs de la date, triés, même si le calendrier est dans le désordre', () => {
  const late = match(2026, 10, 14, 21), early = match(2026, 10, 14, 18, 45), other = match(2026, 10, 15, 21);
  const r = getNextMatchDate([other, late, early], moment(2026, 10, 1, 9));
  assert.deepEqual(r.matches, [early, late]);
});

test('passage de minuit : 23 h 30 et 0 h 15 ne sont pas le même jour', () => {
  const beforeMidnight = match(2026, 10, 14, 23, 30), afterMidnight = match(2026, 10, 15, 0, 15);
  const r = getNextMatchDate([afterMidnight, beforeMidnight], moment(2026, 10, 13, 20));
  assert.equal(r.key, 20261014);
  assert.deepEqual(r.matches, [beforeMidnight]);
});

test('plus aucun match à venir : null (et jamais d’erreur sur un calendrier vide)', () => {
  assert.equal(getNextMatchDate([match(2026, 5, 30, 21)], moment(2026, 6, 1, 12)), null);
  assert.equal(getNextMatchDate([], moment(2026, 6, 1, 12)), null);
  assert.equal(getNextMatchDate(undefined, moment(2026, 6, 1, 12)), null);
});

test('formats de date : Date, horodatage (time) et chaîne ISO ; matchs sans date ignorés', () => {
  const iso = { id: 'iso', date: '2026-10-20T19:00:00Z' };           // 21 h à Paris
  const ts = { id: 'ts', time: Date.UTC(2026, 9, 20, 16, 45) };      // 18 h 45 à Paris
  const broken = { id: 'x', date: 'pas une date' }, none = { id: 'y' };
  const r = getNextMatchDate([broken, iso, none, ts], moment(2026, 10, 19, 12));
  assert.equal(r.key, 20261020);
  assert.deepEqual(r.matches.map(m => m.id), ['ts', 'iso']);
});

test('le calendrier d’entrée n’est pas modifié', () => {
  const schedule = [match(2026, 10, 15, 21), match(2026, 10, 14, 21)];
  const snapshot = schedule.slice();
  getNextMatchDate(schedule, moment(2026, 10, 1, 12));
  assert.deepEqual(schedule, snapshot);
});

test('date courante invalide : erreur explicite', () => {
  assert.throws(() => getNextMatchDate([], 'n’importe quoi'), TypeError);
});

test('données réelles 2024-25 : les vrais trous du calendrier', async (t) => {
  const fx = require(path.join(__dirname, 'fixtures', 'league-phase-2024-25.json'));
  /* Attendu calculé INDÉPENDAMMENT de schedule.js, avec Intl en fuseau Paris. */
  const parisDay = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
  const onDay = iso => fx.matches.filter(m => parisDay.format(new Date(m.time)) === iso);

  await t.test('lendemain de la J2 (03/10/2024) : la J3 du 22/10, 20 jours plus tard', () => {
    const r = getNextMatchDate(fx.matches, moment(2024, 10, 3, 12));
    assert.equal(r.key, 20241022);
    assert.equal(r.matches.length, onDay('2024-10-22').length);
    assert.ok(r.matches.length > 0);
  });
  await t.test('trêve hivernale (12/12/2024) : la J7 du 21/01/2025, par-delà le changement d’année', () => {
    const r = getNextMatchDate(fx.matches, moment(2024, 12, 12, 12));
    assert.equal(r.key, 20250121);
    assert.equal(r.matches.length, onDay('2025-01-21').length);
  });
  await t.test('après la dernière journée : null', () => {
    assert.equal(getNextMatchDate(fx.matches, moment(2025, 2, 1, 12)), null);
  });
});

/* ======================================================================= */
const { getNextKickoff, getLiveMatches, countdownParts } = require('../schedule.js');

test('getNextKickoff : vise l’instant, donc les matchs de ce soir comptent', () => {
  // Même situation que plus haut, résultat opposé à getNextMatchDate — et c'est voulu.
  const tonight = match(2026, 10, 14, 21), tomorrow = match(2026, 10, 15, 18, 45);
  const r = getNextKickoff([tomorrow, tonight], moment(2026, 10, 14, 14));
  assert.equal(r.match, tonight);
  assert.equal(r.time, tonight.dateObj.getTime());
  assert.equal(r.dayKey, 20261014);
});

test('getNextKickoff : ignore les matchs en cours ou terminés, garde les matchs sans état', () => {
  const live = match(2026, 10, 14, 21, 0, { state: 'in' });
  const done = match(2026, 10, 15, 21, 0, { state: 'post' });
  const noState = match(2026, 10, 16, 21);
  const r = getNextKickoff([live, done, noState], moment(2026, 10, 14, 12));
  assert.equal(r.match, noState);
});

test('getNextKickoff : tolérance après l’heure officielle (ESPN en retard sur le coup d’envoi)', () => {
  const kick = match(2026, 10, 14, 18, 45, { state: 'pre' }), later = match(2026, 10, 14, 21, 0, { state: 'pre' });
  const at = moment(2026, 10, 14, 18, 50);
  assert.equal(getNextKickoff([kick, later], at).match, later, 'sans tolérance : le match de 18 h 45 est dépassé');
  assert.equal(getNextKickoff([kick, later], at, { graceMs: 15 * 60000 }).match, kick, 'avec 15 min : encore « imminent »');
});

test('getNextKickoff : sameDay liste les matchs restants du même jour, triés', () => {
  const a = match(2026, 10, 14, 21), b = match(2026, 10, 14, 18, 45), c = match(2026, 10, 15, 21);
  const r = getNextKickoff([c, a, b], moment(2026, 10, 14, 9));
  assert.deepEqual(r.sameDay, [b, a]);
  assert.equal(getNextKickoff([], moment(2026, 10, 14, 9)), null);
});

test('getLiveMatches : uniquement les matchs en cours, par heure de coup d’envoi', () => {
  const l2 = match(2026, 10, 14, 21, 0, { state: 'in' }), l1 = match(2026, 10, 14, 18, 45, { state: 'in' });
  assert.deepEqual(getLiveMatches([match(2026, 10, 14, 12, 0, { state: 'post' }), l2, l1]), [l1, l2]);
  assert.deepEqual(getLiveMatches(undefined), []);
});

test('countdownParts : arrondi à la minute supérieure, jamais « 0 min » avant le coup d’envoi', () => {
  assert.deepEqual(countdownParts(30 * 1000), { days: 0, hours: 0, minutes: 1, total: 1 });
  assert.deepEqual(countdownParts(61 * 60000), { days: 0, hours: 1, minutes: 1, total: 61 });
  assert.deepEqual(countdownParts((26 * 60 + 3) * 60000), { days: 1, hours: 2, minutes: 3, total: 1563 });
  assert.deepEqual(countdownParts(0), { days: 0, hours: 0, minutes: 0, total: 0 });
  assert.deepEqual(countdownParts(-5000), { days: 0, hours: 0, minutes: 0, total: 0 });
});

test('getNextKickoff sur données réelles 2024-25 : le lendemain de la J2, premier coup d’envoi de la J3', () => {
  const fx = require(path.join(__dirname, 'fixtures', 'league-phase-2024-25.json'));
  const upcoming = fx.matches.map(m => Object.assign({}, m, { state: 'pre' }));   // rejoué « avant » les matchs
  const parisDay = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
  const firstJ3 = Math.min(...upcoming.filter(m => parisDay.format(new Date(m.time)) === '2024-10-22').map(m => m.time));
  const r = getNextKickoff(upcoming, moment(2024, 10, 3, 12));
  assert.equal(r.time, firstJ3);
  assert.equal(r.sameDay.length, upcoming.filter(m => parisDay.format(new Date(m.time)) === '2024-10-22').length);
});
