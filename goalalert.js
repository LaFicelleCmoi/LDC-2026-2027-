/* =========================================================================
   goalalert.js — Alertes but du club favori, trois compétitions
   -------------------------------------------------------------------------
   Pour chaque compétition où l'alerte est activée (Ligue des Champions,
   Europa League, Conference League), suit le match du jour du club favori de
   CETTE compétition (ESPN.forLeague(slug).getFav()) et signale :
   coup d'envoi, chaque but (pour ou contre, buteur et minute), score final.
   - notification système si l'autorisation est donnée, sinon (et toujours
     quand la page est visible) bandeau dans la page, annoncé aux lecteurs
     d'écran ;
   - sans serveur d'envoi : fonctionne tant qu'un onglet du site est ouvert ;
   - plusieurs onglets ouverts : un seul prévient (dernier état connu de
     chaque match partagé dans localStorage) ;
   - à l'ouverture de la page en plein match, le score courant est noté sans
     alerte : seules les nouveautés sont signalées.
   Rythme : toutes les 30 s pendant le match (et dans les 20 min qui le
   précèdent), sinon réveil 15 min avant le coup d'envoi, sinon toutes les
   30 min.
   API : window.LDCGoalAlerts = { COMPS, isOn, toggle, diff, refresh }
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.LDCGoalAlerts = factory(root);
})(typeof self !== 'undefined' ? self : this, function (global) {
  'use strict';

  var COMPS = [
    { slug: 'uefa.champions', key: 'ucl', fr: 'Ligue des Champions', en: 'Champions League', icon: 'logo.svg?v=4' },
    { slug: 'uefa.europa', key: 'uel', fr: 'Europa League', en: 'Europa League', icon: 'europa.svg?v=2' },
    { slug: 'uefa.europa.conf', key: 'uecl', fr: 'Conference League', en: 'Conference League', icon: 'conference.svg?v=1' }
  ];

  /* Ce qui a changé entre deux états d'un match, du point de vue du club.
     prev / cur : { state, h, a } (h = buts domicile, a = buts extérieur).
     Renvoie une liste : { type:'kickoff' } | { type:'goal', mine:bool, h, a }
     | { type:'final', h, a }. Sans état précédent : rien (pas d'alerte à
     l'ouverture de la page). Un score qui baisse (but annulé par la VAR) ne
     déclenche rien et devient la nouvelle référence. */
  function diff(prev, cur, isHome) {
    var out = [];
    if (!prev || !cur) return out;
    if (prev.state === 'pre' && cur.state !== 'pre') out.push({ type: 'kickoff' });
    var dh = (cur.h || 0) - (prev.h || 0), da = (cur.a || 0) - (prev.a || 0), i;
    for (i = 0; i < dh; i++) out.push({ type: 'goal', mine: !!isHome, h: cur.h, a: cur.a });
    for (i = 0; i < da; i++) out.push({ type: 'goal', mine: !isHome, h: cur.h, a: cur.a });
    if (prev.state !== 'post' && cur.state === 'post') out.push({ type: 'final', h: cur.h, a: cur.a });
    return out;
  }

  var api = { COMPS: COMPS, diff: diff };
  if (!global || typeof document === 'undefined') return api;

  var PREF = 'ldc_goal_alerts_v1', SEEN = 'ldc_goal_seen_v1';
  var timer = null, running = false;

  function read(k) { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function en() { try { return global.I18N && I18N.getLang() === 'en'; } catch (e) { return false; } }
  function T(fr, e) { return en() ? e : fr; }
  function espnFor(slug) {
    if (!global.ESPN) return null;
    if (ESPN.LEAGUE_SLUG === slug) return ESPN;
    return ESPN.forLeague ? ESPN.forLeague(slug) : null;
  }
  function compOf(slug) { return COMPS.filter(function (c) { return c.slug === slug; })[0]; }
  function isOn(slug) { return !!read(PREF)[compOf(slug).key]; }
  function notifState() { return ('Notification' in global) ? Notification.permission : 'unsupported'; }

  /* Active / désactive. À l'activation, demande l'autorisation des
     notifications si elle n'a jamais été demandée ; sans elle, l'alerte reste
     un bandeau dans la page. */
  function toggle(slug) {
    var p = read(PREF), k = compOf(slug).key, on = !p[k];
    p[k] = on; write(PREF, p);
    var ask = (on && notifState() === 'default') ? Promise.resolve(Notification.requestPermission()).catch(function () {}) : Promise.resolve();
    return ask.then(function () { schedule(1000); return { on: on, permission: notifState() }; });
  }
  /* Phrase d'état pour l'interface. */
  function hint(slug) {
    if (!isOn(slug)) return T('Désactivées', 'Off');
    var p = notifState();
    if (p === 'granted') return T('Activées · notifications', 'On · notifications');
    if (p === 'denied') return T('Activées · dans la page (notifications bloquées)', 'On · in the page (notifications blocked)');
    return T('Activées · dans la page', 'On · in the page');
  }

  /* ---- Bandeau dans la page ---- */
  var box = null;
  function ensureBox() {
    if (box) return;
    var css = document.createElement('style');
    css.textContent =
      '.ga-box{position:fixed;left:16px;bottom:16px;z-index:130;display:flex;flex-direction:column;gap:10px;max-width:min(380px,calc(100vw - 32px));pointer-events:none}' +
      '.ga-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:#0d1426;color:#e6eaf5;' +
      'border:1px solid rgba(255,255,255,.14);border-left:4px solid var(--ga,#f5b50a);box-shadow:0 18px 40px rgba(0,0,0,.5);font:600 14px/1.35 system-ui,sans-serif;animation:gaIn .3s ease-out}' +
      '.ga-toast img{width:36px;height:36px;object-fit:contain;flex:none}.ga-toast b{display:block;color:#fff;font-size:15px}.ga-toast small{color:#9aa3c4;font-weight:600}' +
      '.ga-toast button{margin-left:auto;align-self:flex-start;border:0;background:none;color:#9aa3c4;font-size:18px;cursor:pointer;line-height:1}' +
      '@keyframes gaIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
      '@media (prefers-reduced-motion:reduce){.ga-toast{animation:none}}';
    document.head.appendChild(css);
    box = document.createElement('div');
    box.className = 'ga-box'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  function toast(t, color) {
    ensureBox();
    var el = document.createElement('div');
    el.className = 'ga-toast'; if (color) el.style.setProperty('--ga', color);
    el.innerHTML = (t.icon ? '<img src="' + t.icon + '" alt="">' : '') + '<div><b></b><span></span><br><small></small></div><button type="button" aria-label="' + T('Fermer', 'Close') + '">×</button>';
    el.querySelector('b').textContent = t.title; el.querySelector('span').textContent = t.body; el.querySelector('small').textContent = t.comp;
    el.querySelector('button').addEventListener('click', function () { el.remove(); });
    box.appendChild(el);
    /* Onglet masqué sans notifications : le bandeau attend le retour. */
    if (!document.hidden) setTimeout(function () { el.remove(); }, 12000);
  }
  function notify(t, color) {
    if (!document.hidden || notifState() !== 'granted') toast(t, color);
    if (notifState() === 'granted' && document.hidden) {
      try { var n = new Notification(t.title, { body: t.body + ' · ' + t.comp, icon: t.icon, tag: t.tag }); n.onclick = function () { global.focus(); n.close(); }; } catch (e) { toast(t, color); }
    }
  }

  /* Buteur du dernier but de l'équipe, d'après le résumé du match. */
  function scorer(E, matchId, teamId) {
    if (!E.fetchSummary) return Promise.resolve(null);
    return E.fetchSummary(matchId, { ttl: 10000 }).then(function (s) {
      var g = (s.keyEvents || []).filter(function (k) { return k.scoringPlay && k.team && String(k.team.id) === String(teamId); }).pop();
      if (!g) return null;
      var who = g.participants && g.participants[0] && g.participants[0].athlete && g.participants[0].athlete.displayName;
      return { who: who || '', minute: (g.clock && g.clock.displayValue) || '', own: g.type && g.type.type === 'own-goal' };
    }).catch(function () { return null; });
  }

  function message(ev, c, m, fav, isHome) {
    var me = isHome ? m.home : m.away, opp = isHome ? m.away : m.home;
    var line = m.home.name + ' ' + m.home.score + '–' + m.away.score + ' ' + m.away.name;
    var comp = T(c.fr, c.en);
    if (ev.type === 'kickoff') return { title: T('C’est parti ! ', 'Kick-off! ') + fav.name, body: me.name + ' – ' + opp.name, comp: comp };
    if (ev.type === 'final') {
      var gf = me.score, ga = opp.score;
      return { title: (gf > ga ? T('Victoire ! ', 'Win! ') : gf < ga ? T('Défaite · ', 'Defeat · ') : T('Match nul · ', 'Draw · ')) + fav.name, body: T('Score final : ', 'Full time: ') + line, comp: comp };
    }
    return { title: ev.mine ? '⚽ ' + T('BUT pour ', 'GOAL for ') + fav.name + ' !' : '⚽ ' + T('But de ', 'Goal for ') + opp.name, body: line, comp: comp, goalTeam: ev.mine ? me.teamId : opp.teamId };
  }

  function ymd(d) { return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }

  /* Un passage : pour chaque compétition suivie, le match du jour du favori. */
  function tick() {
    if (running) return Promise.resolve();
    running = true;
    var now = Date.now(), next = 30 * 60000, prefs = read(PREF);
    var jobs = COMPS.filter(function (c) { return prefs[c.key]; }).map(function (c) {
      var E = espnFor(c.slug); if (!E) return null;
      var fav = E.getFav(); if (!fav) return null;
      /* Après minuit, le match de la veille au soir peut encore être en cours. */
      var days = [ymd(new Date())]; if (new Date().getHours() < 3) days.unshift(ymd(new Date(now - 86400000)));
      return Promise.all(days.map(function (d) { return E.fetchDayEvents(d, { ttl: 20000 }).catch(function () { return []; }); })).then(function (lists) {
        var ms = [].concat.apply([], lists).map(E.normalizeEvent).filter(function (m) {
          return m && (String(m.home.teamId) === String(fav.id) || String(m.away.teamId) === String(fav.id));
        });
        var seen = read(SEEN), chain = Promise.resolve();
        ms.forEach(function (m) {
          var isHome = String(m.home.teamId) === String(fav.id);
          var cur = { state: m.state, h: m.home.score, a: m.away.score, t: now };
          var prev = seen[m.id], evs = diff(prev, cur, isHome);
          seen[m.id] = cur;
          if (m.state === 'in') next = Math.min(next, 30000);
          else if (m.state === 'pre' && m.dateObj) {
            var dt = m.dateObj.getTime() - now;
            next = Math.min(next, dt < 20 * 60000 ? 30000 : Math.max(60000, dt - 15 * 60000));
          }
          evs.forEach(function (ev) {
            var msg = message(ev, c, m, fav, isHome);
            msg.icon = fav.logo || c.icon; msg.tag = 'ldc-ga-' + m.id + '-' + ev.type + '-' + m.home.score + '-' + m.away.score;
            var color = fav.color ? '#' + String(fav.color).replace('#', '') : null;
            chain = chain.then(function () {
              if (ev.type !== 'goal') return notify(msg, color);
              return scorer(E, m.id, msg.goalTeam).then(function (s) {
                if (s && s.who) msg.body += ' · ' + s.who + (s.own ? T(' (csc)', ' (og)') : '') + (s.minute ? ' ' + s.minute : '');
                notify(msg, color);
              });
            });
          });
        });
        /* Ménage : on oublie les matchs de plus de 3 jours. */
        Object.keys(seen).forEach(function (id) { if (now - (seen[id].t || 0) > 3 * 86400000) delete seen[id]; });
        write(SEEN, seen);
        return chain;
      });
    }).filter(Boolean);
    return Promise.all(jobs).catch(function () {}).then(function () { running = false; schedule(next); });
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }

  api.isOn = isOn; api.toggle = toggle; api.hint = hint; api.refresh = function () { schedule(500); };
  /* Démarrage discret, après le chargement de la page. */
  if (document.readyState === 'complete') schedule(2000); else global.addEventListener('load', function () { schedule(2000); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) schedule(1500); });
  return api;
});
