/* Tests de la couche de données (espn.js) : fair-play et palmarès.
   Lancer :  node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* espn.js est un script navigateur : on l'exécute dans un contexte isolé
   qui imite le strict nécessaire de `window`. */
function loadESPN(search, storage) {
  const LS = Object.assign({}, storage || {});
  const sandbox = {
    location: { search: search || '' },
    localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; } },
    document: {}, console, setTimeout, clearTimeout, URLSearchParams
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'espn.js'), 'utf8'), sandbox);
  return sandbox.ESPN;
}
const cards = require('./fixtures/cards-2024-25.json');
const athlete = k => (((k.participants || [])[0] || {}).athlete || {});

/* ======================================================================= */
test('fair-play : expulsion sur deux jaunes = 3 points (le premier jaune est inclus)', () => {
  const ESPN = loadESPN('?season=2024');
  const s = cards.secondYellow;
  const red = s.keyEvents.find(k => k.type.type === 'red-card');
  assert.match(red.text, /second yellow/i, 'la fixture doit bien contenir une expulsion sur 2e jaune');
  const team = red.team.id, player = athlete(red).id;

  // Calcul indépendant : 3 pour l'expulsé + 1 par jaune d'un AUTRE joueur de l'équipe
  const others = s.keyEvents.filter(k => k.type.type === 'yellow-card' && k.team.id === team && athlete(k).id !== player).length;
  const pts = ESPN.disciplinaryFromSummary(s);
  assert.equal(pts[team], 3 + others);
});

test('fair-play : rouge direct = 3 points', () => {
  const ESPN = loadESPN('?season=2024');
  const s = cards.directRed;
  const red = s.keyEvents.find(k => k.type.type === 'red-card');
  assert.doesNotMatch(red.text, /second yellow/i);
  const team = red.team.id;
  const yellows = s.keyEvents.filter(k => k.type.type === 'yellow-card' && k.team.id === team).length;
  assert.equal(ESPN.disciplinaryFromSummary(s)[team], 3 + yellows);
});

test('fair-play : cas construits (aucun exemple réel en 2024-25)', async (t) => {
  const ESPN = loadESPN('?season=2024');
  const summary = (events) => ({
    header: { competitions: [{ competitors: [{ id: 'H', team: { id: 'H' } }, { id: 'A', team: { id: 'A' } }] }] },
    keyEvents: events
  });
  const card = (type, team, player, text) => ({
    type: { type: type, text: type === 'red-card' ? 'Red Card' : 'Yellow Card' },
    team: { id: team }, text: text || '',
    participants: player ? [{ athlete: { id: player, displayName: player } }] : []
  });

  await t.test('jaune puis rouge DIRECT pour le même joueur : 1 + 3 = 4', () => {
    const pts = ESPN.disciplinaryFromSummary(summary([
      card('yellow-card', 'H', 'p1', 'p1 is shown the yellow card'),
      card('red-card', 'H', 'p1', 'p1 is shown the red card for violent conduct')
    ]));
    assert.equal(pts.H, 4);
  });
  await t.test('équipe sans carton : 0 explicite, pas une donnée manquante', () => {
    const pts = ESPN.disciplinaryFromSummary(summary([card('yellow-card', 'H', 'p1')]));
    assert.equal(pts.A, 0);
    assert.equal(pts.H, 1);
  });
  await t.test('carton sans joueur identifié : 1 (jaune) ou 3 (rouge)', () => {
    const pts = ESPN.disciplinaryFromSummary(summary([card('yellow-card', 'H', null), card('red-card', 'A', null)]));
    assert.deepEqual([pts.H, pts.A], [1, 3]);
  });
});

test('fair-play cumulé : une équipe dont un match n’est pas chargé n’a PAS de valeur', () => {
  const key = 'ldc_match_agg_v2_2024';
  const cache = { m1: { g: {}, a: {}, t: {}, c: { A: 2, B: 1 } } };        // m2 absent du cache
  const ESPN = loadESPN('?season=2024', { [key]: JSON.stringify(cache) });
  const matches = [
    { id: 'm1', state: 'post', home: { teamId: 'A' }, away: { teamId: 'B' } },
    { id: 'm2', state: 'post', home: { teamId: 'B' }, away: { teamId: 'C' } }
  ];
  const d = ESPN.disciplinaryFor(matches);
  assert.equal(d.A, 2, 'A : tous ses matchs sont chargés');
  assert.equal(d.B, undefined, 'B : un match manque, une somme partielle serait fausse');
  assert.equal(d.C, undefined);
});

/* ======================================================================= */
test('palmarès : 71 finales 1956-2026, une seule par an, titres cohérents', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'espn.js'), 'utf8');
  const pal = vm.runInNewContext(src.match(/var UCL_PALMARES = (\[[\s\S]*?\n  \]);/)[1]);
  const years = pal.flatMap(p => p.years);
  assert.equal(years.length, 71);
  assert.equal(new Set(years).size, 71, 'deux vainqueurs la même année');
  for (let y = 1956; y <= 2026; y++) assert.ok(years.includes(y), 'année manquante : ' + y);
  pal.forEach(p => assert.equal(p.n, p.years.length, p.name));
});

test('titres par identifiant : exacts, et sans les faux positifs de la recherche par nom', () => {
  const ESPN = loadESPN('');
  assert.equal(ESPN.clubTitlesById(86).n, 15);           // Real Madrid
  assert.equal(ESPN.clubTitlesById('160').n, 2);         // PSG : 2025, 2026
  // Array.from : le tableau vient du contexte vm d'espn.js, dont le prototype
  // Array diffère de celui du test ; on compare le contenu, pas le prototype.
  assert.deepEqual(Array.from(ESPN.clubTitlesById(160).years), [2025, 2026]);
  assert.equal(ESPN.clubTitlesById(2250), null);         // Sporting CP : aucun titre
  assert.equal(ESPN.clubTitlesById(''), null);
  // L'ancienne recherche par nom se trompe sur des noms voisins : c'est pour cela qu'elle n'est plus utilisée
  assert.equal(ESPN.clubTitles('Real Madrid Castilla').n, 15);
});

/* ======================================================================= */
test('preserveSeasonLinks : la saison se place avant l’ancre, pas après', () => {
  const ESPN = loadESPN('?season=2024');
  const link = href => {
    const a = { attrs: { href } };
    return Object.assign(a, {
      getAttribute: k => a.attrs[k], setAttribute: (k, v) => { a.attrs[k] = v; }, hasAttribute: k => k in a.attrs
    });
  };
  const links = [link('dashboard.html#widgets'), link('tracker.html'), link('calendrier.html?x=1#draw-results'),
                 link('https://www.uefa.com/'), link('#local'), link('palmares.html?season=2019')];
  ESPN.preserveSeasonLinks({ querySelectorAll: () => links });
  assert.deepEqual(links.map(l => l.attrs.href), [
    'dashboard.html?season=2024#widgets',
    'tracker.html?season=2024',
    'calendrier.html?x=1&season=2024#draw-results',
    'https://www.uefa.com/',
    '#local',
    'palmares.html?season=2019'
  ]);
});
