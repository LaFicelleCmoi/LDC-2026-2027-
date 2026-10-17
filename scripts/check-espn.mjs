/* =========================================================================
   scripts/check-espn.mjs — Vérifie que les sources du site répondent encore
   -------------------------------------------------------------------------
   Lancé toutes les heures par GitHub Actions (.github/workflows/espn-health.yml).
   Interroge l'API ESPN EXACTEMENT comme le site, contrôle la forme des
   réponses (pas seulement le code HTTP), puis vérifie le site lui-même.
   Code de sortie 1 au premier contrat rompu : GitHub envoie alors un e-mail.

   Contexte : le 16/09/2026, ESPN s'est mis à refuser les plages de dates ;
   le site est resté vide plusieurs jours sans que personne ne soit prévenu.

   Usage local :  node scripts/check-espn.mjs
   ========================================================================= */
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions';
const SITE = 'https://ldc-2026-2027.vercel.app';
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const ym = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1);
const ymd = d => ym(d) + pad(d.getUTCDate());
/* Saison courante : année de début = année de septembre. */
const season = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;

const failures = [];
const log = (ok, label, detail) => console.log((ok ? '✅' : '❌') + ' ' + label + (detail ? ' — ' + detail : ''));

/* Les réseaux flanchent : 3 essais espacés avant de conclure à une panne. */
async function get(url, asJson = true) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'ldc-health-check (+https://github.com/LaFicelleCmoi/LDC-2026-2027-)' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return asJson ? await r.json() : await r.text();
      last = 'HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120).replace(/\s+/g, ' ');
    } catch (e) { last = e.message; }
    await new Promise(res => setTimeout(res, 4000 * (i + 1)));
  }
  throw new Error(last);
}

async function check(label, fn) {
  try { const detail = await fn(); log(true, label, detail); }
  catch (e) { log(false, label, e.message); failures.push(label + ' : ' + e.message); }
}

/* Contrat minimal d'un match, tel que espn.js le lit (normalizeEvent). */
function assertEvent(e) {
  const c = e && e.competitions && e.competitions[0];
  if (!e.id || !e.date) throw new Error('match sans id ou date');
  if (!c || !c.status || !c.status.type || !c.status.type.state) throw new Error('statut du match absent (' + e.id + ')');
  const cs = c.competitors || [];
  if (cs.length !== 2) throw new Error('il faut 2 équipes (' + e.id + ')');
  if (!cs.some(x => x.homeAway === 'home') || !cs.some(x => x.homeAway === 'away')) throw new Error('domicile/extérieur absent (' + e.id + ')');
  cs.forEach(x => { if (!x.team || !x.team.id || !x.team.displayName) throw new Error('équipe incomplète (' + e.id + ')'); });
  if (!e.season || e.season.year == null) throw new Error('season.year absent (' + e.id + ')');
}

let seasonEvents = [];

await check('ESPN · saison ' + season + '-' + (season + 1) + ' (dates=' + season + ' et ' + (season + 1) + ')', async () => {
  const parts = await Promise.all([get(`${BASE}/scoreboard?dates=${season}&limit=1000`), get(`${BASE}/scoreboard?dates=${season + 1}&limit=1000`)]);
  parts.forEach(p => { if (!Array.isArray(p.events)) throw new Error('champ « events » absent'); });
  seasonEvents = parts.flatMap(p => p.events).filter(e => e.season && e.season.year === season);
  seasonEvents.forEach(assertEvent);
  const league = seasonEvents.filter(e => e.season.slug === 'league-phase').length;
  if (now.getUTCMonth() >= 8 || now.getUTCMonth() <= 5) {
    if (league < 144) throw new Error('phase de ligue incomplète : ' + league + ' matchs au lieu de 144');
  }
  return seasonEvents.length + ' matchs, dont ' + league + ' de phase de ligue';
});

await check('ESPN · mois en cours (dates=' + ym(now) + ')', async () => {
  const d = await get(`${BASE}/scoreboard?dates=${ym(now)}&limit=1000`);
  if (!Array.isArray(d.events)) throw new Error('champ « events » absent');
  d.events.forEach(assertEvent);
  return d.events.length + ' matchs';
});

await check('ESPN · jour (dates=' + ymd(now) + ')', async () => {
  const d = await get(`${BASE}/scoreboard?dates=${ymd(now)}`);
  if (!Array.isArray(d.events)) throw new Error('champ « events » absent');
  return d.events.length + ' match(s) aujourd’hui';
});

await check('ESPN · résumé d’un match terminé (summary)', async () => {
  const done = seasonEvents.filter(e => e.competitions[0].status.type.state === 'post').sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!done) return 'aucun match terminé pour l’instant, contrôle sauté';
  const s = await get(`${BASE}/summary?event=${done.id}`);
  if (!Array.isArray(s.keyEvents)) throw new Error('keyEvents absent : buteurs et fair-play ne peuvent plus être calculés');
  if (!s.boxscore || !Array.isArray(s.boxscore.teams)) throw new Error('boxscore absent');
  return s.keyEvents.length + ' événements (' + done.name + ')';
});

for (const page of ['/', '/tracker.html', '/calendrier.html', '/espn.js']) {
  await check('Site · ' + page, async () => {
    const html = await get(SITE + page, false);
    if (page.endsWith('.js')) { if (!/fetchSeasonEvents/.test(html)) throw new Error('espn.js inattendu'); return html.length + ' octets'; }
    if (!/<script src="espn\.js/.test(html)) throw new Error('page servie sans espn.js');
    return html.length + ' octets';
  });
}

if (failures.length) {
  console.log('\n' + failures.length + ' contrôle(s) en échec :\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('\nTout est opérationnel.');
