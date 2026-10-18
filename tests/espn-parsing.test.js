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
function loadESPN(search, storage, league) {
  const LS = Object.assign({}, storage || {});
  const sandbox = {
    LDC_LEAGUE: league,
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

/* ======================================================================= */
test('fetchSeasonEvents : jamais de plage de dates (rejetée par ESPN depuis le 16/09/2026), saison fusionnée sur deux années', async () => {
  const calls = [];
  const ev = (id, date, year, slug) => ({ id, date, season: { year, slug: slug || 'league-phase' } });
  const byYear = {
    2024: [ev('q', '2024-08-20T19:00Z', 2024, 'qualifying'), ev('a', '2024-09-17T19:00Z', 2024), ev('old', '2024-03-12T20:00Z', 2023, 'round-of-16')],
    2025: [ev('b', '2025-01-29T20:00Z', 2024), ev('f', '2025-05-31T19:00Z', 2024, 'final'), ev('next', '2025-09-16T19:00Z', 2025)]
  };
  const LS = {};
  const sandbox = {
    location: { search: '?season=2024' },
    localStorage: { getItem: k => LS[k] || null, setItem: (k, v) => { LS[k] = v; }, removeItem: k => { delete LS[k]; } },
    document: {}, console: { info() {}, warn() {}, log() {} }, setTimeout, clearTimeout, URLSearchParams,
    fetch: u => {
      calls.push(String(u));
      if (/dates=\d{8}-\d{8}/.test(u)) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ code: 400 }) });
      const y = (String(u).match(/dates=(\d{4})(?:&|$)/) || [])[1];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ events: byYear[y] || [] }) });
    }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'espn.js'), 'utf8'), sandbox);

  const out = await sandbox.ESPN.fetchSeasonEvents();
  assert.ok(calls.length === 2 && calls.every(u => !/dates=\d{8}-\d{8}/.test(u)), 'requêtes : ' + calls.join(' '));
  assert.deepEqual(Array.from(out, e => e.id), ['a', 'b', 'f'], 'qualifs d’août, saison précédente et saison suivante écartées, ordre chronologique');
  assert.ok(sandbox.ESPN.lastSeasonSync(), 'date de synchronisation enregistrée');
});

/* ======================================================================= */
/* Chargement de la saison en cours par mois, mémoire locale, secours.     */
function seasonSandbox({ now, LS, fetchImpl }) {
  const calls = [];
  const clock = { now };
  class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(clock.now); }
    static now() { return clock.now; }
  }
  const sandbox = {
    location: { search: '' },
    localStorage: {
      getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); }, removeItem: k => { delete LS[k]; },
      key: i => Object.keys(LS)[i], get length() { return Object.keys(LS).length; }
    },
    document: undefined, console: { info() {}, warn() {}, log() {} }, setTimeout, clearTimeout, URLSearchParams, Date: FakeDate,
    fetch: u => { calls.push(String(u)); return fetchImpl(String(u)); }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'espn.js'), 'utf8'), sandbox);
  return { ESPN: sandbox.ESPN, calls, clock };
}
const NOW = Date.UTC(2026, 9, 18, 12);                 // 18/10/2026, entre deux journées
const evt = (id, iso, state) => ({ id, date: iso, season: { year: 2026, slug: 'league-phase' },
  competitions: [{ status: { type: { state } }, competitors: [
    { homeAway: 'home', score: '1', team: { id: 'H' + id, displayName: 'H' + id } },
    { homeAway: 'away', score: '0', team: { id: 'A' + id, displayName: 'A' + id } }] }] });
const MONTHS = {
  '202609': [evt('s1', '2026-09-08T19:00Z', 'post')],
  '202610': [evt('o1', '2026-10-13T19:00Z', 'post'), evt('o2', '2026-10-21T19:00Z', 'pre')],
  '202611': [evt('n1', '2026-11-03T20:00Z', 'pre')]
};
const okFetch = u => {
  if (/dates=\d{8}-\d{8}/.test(u)) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({}) });
  const k = (u.match(/dates=(\d{6})(?:&|$)/) || [])[1];
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ events: MONTHS[k] || [] }) });
};

test('saison en cours : un appel par mois, jamais de plage ni d’appel annuel', async () => {
  const { ESPN, calls } = seasonSandbox({ now: NOW, LS: {}, fetchImpl: okFetch });
  const ev = await ESPN.fetchSeasonEvents();
  assert.deepEqual(Array.from(ev, e => e.id), ['s1', 'o1', 'o2', 'n1']);
  assert.equal(calls.length, 12);
  assert.ok(calls.every(u => /dates=\d{6}&/.test(u)), calls.join(' '));
  assert.equal(ESPN.staleSince(), null);
});

test('nouvelle visite : les mois passés et à venir viennent de la mémoire locale, seul le mois actif est redemandé', async () => {
  const LS = {};
  await seasonSandbox({ now: NOW, LS, fetchImpl: okFetch }).ESPN.fetchSeasonEvents();
  const second = seasonSandbox({ now: NOW + 60000, LS, fetchImpl: okFetch });
  const ev = await second.ESPN.fetchSeasonEvents();
  assert.equal(ev.length, 4);
  assert.deepEqual(second.calls.map(u => u.match(/dates=(\d+)/)[1]), ['202610']);
});

test('mois actif sans match proche : rechargé toutes les 10 min, pas toutes les 20 s', async () => {
  const s = seasonSandbox({ now: NOW, LS: {}, fetchImpl: okFetch });
  await s.ESPN.fetchSeasonEvents();
  s.calls.length = 0;
  s.clock.now += 61000;
  await s.ESPN.fetchSeasonEvents();
  assert.equal(s.calls.length, 0, 'aucun match en cours ni proche : pas de rechargement après 1 min');
  s.clock.now += 10 * 60000;
  await s.ESPN.fetchSeasonEvents();
  assert.deepEqual(s.calls.map(u => u.match(/dates=(\d+)/)[1]), ['202610']);
});

test('mois actif avec un match proche : rechargé à l’intervalle demandé', async () => {
  const s = seasonSandbox({ now: Date.UTC(2026, 9, 21, 17), LS: {}, fetchImpl: okFetch });   // 2 h avant o2
  await s.ESPN.fetchSeasonEvents();
  s.calls.length = 0;
  s.clock.now += 25000;
  await s.ESPN.fetchSeasonEvents();
  assert.deepEqual(s.calls.map(u => u.match(/dates=(\d+)/)[1]), ['202610']);
});

test('ESPN injoignable : la dernière copie locale prend le relais, avec sa date', async () => {
  const LS = {};
  await seasonSandbox({ now: NOW, LS, fetchImpl: okFetch }).ESPN.fetchSeasonEvents();
  const down = seasonSandbox({ now: NOW + 3 * 86400000, LS, fetchImpl: () => Promise.reject(new Error('réseau coupé')) });
  const ev = await down.ESPN.fetchSeasonEvents();
  assert.equal(ev.length, 4, 'la saison reste affichée');
  assert.equal(down.ESPN.staleSince().getTime(), NOW, 'date des données = dernière synchronisation réussie');
  assert.equal(down.ESPN.lastSeasonSync().getTime(), NOW);
  const day = await down.ESPN.fetchDayEvents('20261013');
  assert.deepEqual(Array.from(day, e => e.id), ['o1'], 'matchs du jour retrouvés dans la copie du mois');
});

test('ESPN injoignable sans aucune copie : l’erreur remonte (rien n’est inventé)', async () => {
  const s = seasonSandbox({ now: NOW, LS: {}, fetchImpl: () => Promise.reject(new Error('réseau coupé')) });
  await assert.rejects(s.ESPN.fetchSeasonEvents());
});

test('aucune page ni aucun script ne demande de plage de dates (rejetées par ESPN depuis le 16/09/2026)', () => {
  const root = path.join(__dirname, '..');
  const files = fs.readdirSync(root).filter(f => /\.(html|js)$/.test(f));
  const bad = [];
  files.forEach(f => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (/fetchScoreboard\(\s*['"]\d{8}-\d{8}|fetchScoreboard\([^)]*['"]0901-['"]|dates=['"]?\s*\+[^;]*['"]-['"]/.test(line)) bad.push(f + ':' + (i + 1));
    });
  });
  assert.deepEqual(bad, []);
});

/* ======================================================================= */
/* Compétition choisie par la page (window.LDC_LEAGUE). */
function ev(id, home, away, slug, state) {
  return { id, date: '2026-10-22T19:00Z', season: { year: 2026, slug },
    competitions: [{ status: { type: { state: state || 'pre' } }, competitors: [
      { homeAway: 'home', score: '0', team: { id: home[0], displayName: home[1], abbreviation: home[1].slice(0, 3) } },
      { homeAway: 'away', score: '0', team: { id: away[0], displayName: away[1], abbreviation: away[1].slice(0, 3) } }] }] };
}

test('compétition : Ligue des Champions par défaut, clés locales historiques inchangées', () => {
  const ESPN = loadESPN('');
  assert.equal(ESPN.LEAGUE_SLUG, 'uefa.champions');
  assert.match(ESPN.BASE, /\/uefa\.champions$/);
  assert.equal(ESPN.STORE_NS, '');
  assert.equal(ESPN.COMP.standings, 'tracker.html');
  assert.equal(ESPN.clubTitlesById(86).n, 15);
  assert.equal(ESPN.qualifiedClubs().length, 36);
});

test('compétition : Europa League, sans le palmarès ni les qualifiés de la LDC', () => {
  const ESPN = loadESPN('', {}, 'uefa.europa');
  assert.equal(ESPN.LEAGUE_SLUG, 'uefa.europa');
  assert.match(ESPN.BASE, /\/uefa\.europa$/);
  assert.equal(ESPN.STORE_NS, 'uel_');
  assert.deepEqual([ESPN.COMP.home, ESPN.COMP.standings], ['europa.html', 'europa-classement.html']);
  assert.equal(ESPN.clubTitlesById(86), null, 'pas de titres LDC dans le classement Europa League');
  assert.equal(ESPN.championOfSeason(2025), null);
  assert.equal(ESPN.qualifiedClubs().length, 0);
  assert.equal(ESPN.EARLIEST_SEASON, 2024, 'seules les phases de ligue à 36 sont proposées');
});

test('compétition : slug inconnu -> Ligue des Champions', () => {
  assert.equal(loadESPN('', {}, 'uefa.inconnue').LEAGUE_SLUG, 'uefa.champions');
});

test('leagueClubs : clubs de la phase de ligue (matchs à venir compris), sans doublon ni phase finale', () => {
  const ESPN = loadESPN('', {}, 'uefa.europa');
  const clubs = ESPN.leagueClubs([
    ev('1', ['10', 'Lyon'], ['20', 'Roma'], 'league-phase'),
    ev('2', ['20', 'Roma'], ['30', 'Porto'], 'league-phase', 'post'),
    ev('3', ['40', 'Betis'], ['10', 'Lyon'], 'round-of-16')
  ]);
  assert.deepEqual(Array.from(clubs, c => c.id + ':' + c.name), ['10:Lyon', '30:Porto', '20:Roma']);
});

test('favori : un par compétition, sans toucher celui de la LDC ni sa proposition de choix', () => {
  const LS = { ldc_fav: JSON.stringify({ id: '160', name: 'PSG' }) };
  const UEL = loadESPN('', LS, 'uefa.europa');
  assert.equal(UEL.getFav(), null, 'le favori LDC n’est pas repris en Europa League');
  UEL.setFav({ id: '167', name: 'Lyon' });
  assert.equal(UEL.getFav().name, 'Lyon');
  assert.equal(UEL.favSeen(), true);
  const UCL = loadESPN('', { ldc_fav: LS.ldc_fav });
  assert.equal(UCL.getFav().id, '160');
  assert.equal(UCL.favSeen(), false, 'l’accueil LDC propose toujours de choisir');
});
