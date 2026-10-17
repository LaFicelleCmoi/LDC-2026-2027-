/* Tests du calcul de la fiche club.  Lancer : node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clubData, matchdayMap, mergeFresh, followsLive, BEFORE_KICKOFF } = require('../clubpanel.js');
const fx = require('./fixtures/league-phase-2024-25.json');

const PSG = '160';
/* La fixture ne contient que des matchs de phase de ligue, sans le champ
   `round` qu'ajoute ESPN.normalizeEvent en conditions réelles. */
fx.matches = fx.matches.map(m => Object.assign({ round: 'league' }, m));

test('bilan réel du PSG, phase de ligue 2024-25 : 4 V, 1 N, 3 D, 14–9', () => {
  const d = clubData(PSG, fx.matches, []);
  assert.equal(d.team.name, 'Paris Saint-Germain');
  assert.deepEqual(d.summary, { pld: 8, w: 4, d: 1, l: 3, gf: 14, ga: 9 });
  assert.equal(d.played.length, 8);
  assert.equal(d.last.length, 5);
  assert.equal(d.next, null);
});

test('derniers matchs du plus récent au plus ancien, journées 8 → 4, 4 à domicile et 4 à l’extérieur', () => {
  const d = clubData(PSG, fx.matches, []);
  assert.deepEqual(d.last.map(r => r.md), [8, 7, 6, 5, 4]);
  for (let i = 1; i < d.played.length; i++) assert.ok(d.played[i - 1].time > d.played[i].time);
  assert.equal(d.played.filter(r => r.home).length, 4);
});

test('score et résultat toujours du point de vue du club', () => {
  const d = clubData(PSG, fx.matches, []);
  d.played.forEach(r => {
    const m = fx.matches.find(x => x.id === r.id);
    const me = r.home ? m.home : m.away, opp = r.home ? m.away : m.home;
    assert.equal(r.gf, +me.score); assert.equal(r.ga, +opp.score);
    assert.equal(r.result, r.gf > r.ga ? 'w' : r.gf < r.ga ? 'l' : 'd');
    assert.equal(String(r.opp.id), String(opp.teamId));
  });
});

test('8 journées numérotées sur toute la phase, 18 matchs chacune', () => {
  const map = matchdayMap(fx.matches.map(m => Object.assign({ round: 'league' }, m)));
  const per = {}; Object.values(map).forEach(md => { per[md] = (per[md] || 0) + 1; });
  assert.deepEqual(Object.keys(per).map(Number), [1, 2, 3, 4, 5, 6, 7, 8]);
  Object.values(per).forEach(n => assert.equal(n, 18));
});

test('saison en cours : prochain match, calendrier restant et match en direct', () => {
  const ms = fx.matches.map(m => Object.assign({}, m));
  const mine = ms.filter(m => m.home.teamId === PSG || m.away.teamId === PSG).sort((a, b) => a.time - b.time);
  mine[2].state = 'in';                           // J3 en cours
  mine.slice(3).forEach(m => { m.state = 'pre'; });
  const d = clubData(PSG, ms, [{ teamId: PSG, name: 'PSG', pos: 9, rank: 9, pts: 4 }]);
  assert.equal(d.summary.pld, 2, 'le match en cours ne compte pas dans le bilan');
  assert.equal(d.live.id, mine[2].id, 'le match en cours est mis à part');
  assert.ok(d.last.every(r => !r.live), 'et absent des 5 derniers matchs');
  assert.equal(d.last.length, 2);
  assert.equal(d.next.id, mine[3].id);
  assert.equal(d.upcoming.length, 5);
  assert.deepEqual(d.standing, { rank: 9, pos: 9, pts: 4, zone: 'po' });
});

test('club inconnu ou sans match : fiche vide sans erreur', () => {
  const d = clubData('999999', fx.matches, []);
  assert.equal(d.team, null);
  assert.equal(d.played.length, 0);
  assert.equal(d.next, null);
});

test('le tableau du jour prime sur les données de saison, sans doublon', () => {
  const base = [{ id: '1', state: 'pre', home: { score: null } }, { id: '2', state: 'post' }];
  const fresh = [{ id: '1', state: 'in', home: { score: 1 } }, { id: '3', state: 'pre' }];
  const out = mergeFresh(base, fresh);
  assert.deepEqual(Array.from(out, m => m.id + ':' + m.state), ['1:in', '2:post', '3:pre']);
  assert.equal(base[0].state, 'pre', 'les données de saison ne sont pas modifiées');
});

test('suivi en direct : match en cours ou coup d’envoi dans moins de 15 min', () => {
  const now = Date.UTC(2026, 9, 21, 19, 0);
  assert.equal(followsLive({ live: {}, next: null }, now), true);
  assert.equal(followsLive({ live: null, next: { time: now + BEFORE_KICKOFF } }, now), true);
  assert.equal(followsLive({ live: null, next: { time: now + BEFORE_KICKOFF + 60000 } }, now), false);
  assert.equal(followsLive({ live: null, next: { time: now - 60000 } }, now), true, 'coup d’envoi passé, pas encore marqué en cours');
  assert.equal(followsLive({ live: null, next: null }, now), false);
  assert.equal(followsLive(null, now), false);
});
