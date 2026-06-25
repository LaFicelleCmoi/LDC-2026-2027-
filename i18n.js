/* =========================================================================
   i18n.js — Module de traduction partagé FR / EN
   Tracker LIGUE DES CHAMPIONS (projet de fan NON officiel)
   -------------------------------------------------------------------------
   - Langue stockée dans localStorage sous la clé "ldc_lang"
   - Traduction des éléments porteurs de l'attribut data-i18n
   - Fallback ROBUSTE : si la clé manque, on GARDE le texte HTML existant
   - Cache-busté via ?v=N dans la balise <script src="i18n.js?v=N">
   - API globale : window.I18N = { t, getLang, setLang, apply, toggle }
   ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'ldc_lang';
  var SUPPORTED = ['fr', 'en'];
  var DEFAULT_LANG = 'fr';

  /* -----------------------------------------------------------------------
     Dictionnaire. Clé -> { fr, en }
     N'importe quelle clé absente => on garde le texte HTML d'origine.
     ----------------------------------------------------------------------- */
  var DICT = {
    /* --- Navigation / commun --- */
    'nav.dashboard':   { fr: 'Accueil',        en: 'Home' },
    'nav.tracker':     { fr: 'Classement',     en: 'Standings' },
    'nav.overlay':     { fr: 'Overlay OBS',    en: 'OBS Overlay' },
    'nav.legal':       { fr: 'Mentions légales', en: 'Legal' },
    'app.title':       { fr: 'Tracker Ligue des Champions', en: 'Champions League Tracker' },
    'app.subtitle':    { fr: 'Suivi live non officiel — données ESPN', en: 'Unofficial live tracker — ESPN data' },
    'common.loading':  { fr: 'Chargement…',    en: 'Loading…' },
    'common.live':     { fr: 'EN DIRECT',      en: 'LIVE' },
    'common.upcoming': { fr: 'À VENIR',        en: 'UPCOMING' },
    'common.finished': { fr: 'TERMINÉ',        en: 'FINISHED' },
    'common.today':    { fr: "Aujourd'hui",    en: 'Today' },
    'common.noMatch':  { fr: 'Aucun match',    en: 'No match' },
    'common.refresh':  { fr: 'Rafraîchir',     en: 'Refresh' },
    'common.retry':    { fr: 'Réessayer',      en: 'Retry' },
    'common.offline':  { fr: 'Données indisponibles — dernier affichage conservé', en: 'Data unavailable — keeping last view' },
    'common.updated':  { fr: 'Mis à jour',     en: 'Updated' },
    'common.vs':       { fr: 'vs',             en: 'vs' },
    'common.pen':      { fr: 'tab',            en: 'pens' },
    'common.back':     { fr: '← Retour',       en: '← Back' },

    /* --- Dashboard --- */
    'dash.todayMatches':   { fr: 'Matchs du jour',       en: "Today's matches" },
    'dash.liveNow':        { fr: 'En direct maintenant', en: 'Live now' },
    'dash.upcomingToday':  { fr: 'À venir aujourd’hui',  en: 'Upcoming today' },
    'dash.finishedToday':  { fr: 'Terminés',             en: 'Finished' },
    'dash.exploreClub':    { fr: 'Explorer un club',     en: 'Explore a club' },
    'dash.clubPlaceholder':{ fr: 'Tape un club (ex. PSG, Real Madrid, BAR)…', en: 'Type a club (e.g. PSG, Real Madrid, BAR)…' },
    'dash.clubPath':       { fr: 'Parcours du club',     en: 'Club journey' },
    'dash.clubScorers':    { fr: 'Buteurs du club',      en: 'Club scorers' },
    'dash.nextOpponents':  { fr: 'Prochains adversaires', en: 'Next opponents' },
    'dash.seeStandings':   { fr: 'Voir le classement →', en: 'See standings →' },
    'dash.noClub':         { fr: 'Club introuvable dans la saison en cours.', en: 'Club not found in the current season.' },
    'dash.searchHint':     { fr: 'Recherche un club pour afficher son parcours, ses buteurs et ses prochains matchs.', en: 'Search a club to show its journey, scorers and upcoming matches.' },
    'dash.played':         { fr: 'Joués',                en: 'Played' },
    'dash.goals':          { fr: 'buts',                 en: 'goals' },
    'dash.subtitle2':      { fr: 'Scores en direct · Classement · Phase finale', en: 'Live scores · Standings · Knockouts' },
    'dash.liveToday':      { fr: "AUJOURD'HUI",          en: 'TODAY' },
    'dash.liveNoMatch':    { fr: 'Pas de match en direct', en: 'No live match' },
    'dash.zonesTitle':     { fr: '🏆 Le classement par zone', en: '🏆 Standings by zone' },
    'dash.zonesTitle2':    { fr: 'Le classement par zone', en: 'Standings by zone' },
    'dash.zoneQ':          { fr: '1–8 · Huitièmes directs', en: '1–8 · Direct to R16' },
    'dash.zonePO':         { fr: '9–24 · Barrages',      en: '9–24 · Play-offs' },
    'dash.zoneOut':        { fr: '25–36 · Éliminés',     en: '25–36 · Eliminated' },
    'dash.marqueeLabel':   { fr: '⚽ Les clubs · clique sur un logo', en: '⚽ The clubs · click a crest' },
    'dash.empersToday':    { fr: 'Aucun match aujourd’hui', en: 'No match today' },
    'dash.toTracker':      { fr: 'Classement →',         en: 'Standings →' },
    'dash.rank':           { fr: 'classé',               en: 'ranked' },
    'nav.souvenir':        { fr: 'Souvenir',             en: 'Memories' },
    'souvenir.badge':      { fr: 'Souvenir · Saison',    en: 'Memories · Season' },
    'souvenir.back':       { fr: '← Saison actuelle',    en: '← Current season' },
    'season.label':        { fr: 'Saison',               en: 'Season' },
    'dash.notStarted':     { fr: 'La saison 2026-27 n’a pas encore commencé. En attendant, replonge dans le Souvenir 2025-26.', en: 'The 2026-27 season hasn’t started yet. Meanwhile, dive back into the 2025-26 Memories.' },
    'dash.seeSouvenir':    { fr: 'Voir le Souvenir 2025-26 →', en: 'See the 2025-26 Memories →' },
    'stats.clubs':         { fr: 'Clubs',                en: 'Clubs' },
    'stats.matches':       { fr: 'Matchs joués',         en: 'Matches' },
    'stats.goals':         { fr: 'Buts',                 en: 'Goals' },
    'stats.leader':        { fr: 'En tête',              en: 'Leader' },
    'foot.disclaimer':     { fr: 'Projet indépendant réalisé par un fan — <strong>non affilié à l’UEFA</strong> ni à aucun organisme officiel. « UEFA Champions League » et les marques associées appartiennent à leurs propriétaires. Scores fournis par ESPN (source non officielle), à titre indicatif.', en: 'Independent fan project — <strong>not affiliated with UEFA</strong> or any official body. “UEFA Champions League” and related marks belong to their owners. Scores provided by ESPN (unofficial source), for information only.' },

    /* --- Tracker --- */
    'trk.leaguePhase':     { fr: 'Phase de ligue',       en: 'League phase' },
    'trk.leaguePhaseSub':  { fr: 'Classement unique — 36 clubs', en: 'Single table — 36 clubs' },
    'trk.knockout':        { fr: 'Phase finale',         en: 'Knockout phase' },
    'trk.viewCards':       { fr: 'Vue cartes',           en: 'Cards view' },
    'trk.viewTree':        { fr: 'Vue arbre',            en: 'Tree view' },
    'trk.col.pos':         { fr: '#',                    en: '#' },
    'trk.col.club':        { fr: 'Club',                 en: 'Club' },
    'trk.col.pld':         { fr: 'J',                    en: 'P' },
    'trk.col.w':           { fr: 'V',                    en: 'W' },
    'trk.col.d':           { fr: 'N',                    en: 'D' },
    'trk.col.l':           { fr: 'D',                    en: 'L' },
    'trk.col.gf':          { fr: 'BP',                   en: 'GF' },
    'trk.col.ga':          { fr: 'BC',                   en: 'GA' },
    'trk.col.gd':          { fr: 'Diff',                 en: 'GD' },
    'trk.col.pts':         { fr: 'Pts',                  en: 'Pts' },
    'trk.legend.q8':       { fr: '1–8 : qualifiés directs (8es)', en: '1–8: direct to Round of 16' },
    'trk.legend.po':       { fr: '9–24 : barrages',      en: '9–24: knockout play-offs' },
    'trk.legend.out':      { fr: '25–36 : éliminés',     en: '25–36: eliminated' },
    'trk.round.po':        { fr: 'Barrages',             en: 'Play-offs' },
    'trk.round.r16':       { fr: 'Huitièmes',            en: 'Round of 16' },
    'trk.round.qf':        { fr: 'Quarts',               en: 'Quarter-finals' },
    'trk.round.sf':        { fr: 'Demies',               en: 'Semi-finals' },
    'trk.round.final':     { fr: 'Finale',               en: 'Final' },
    'trk.champion':        { fr: 'Champion d’Europe',    en: 'European Champion' },
    'trk.noKnockout':      { fr: 'La phase finale n’a pas encore commencé.', en: 'The knockout phase has not started yet.' },
    'trk.treeNote':        { fr: 'Arbre disponible à partir des 8es de finale. Les barrages sont en vue cartes.', en: 'Tree view available from the Round of 16. Play-offs are in the cards view.' },
    'trk.widget.title':    { fr: 'Live & à venir',       en: 'Live & upcoming' },

    /* --- Overlay --- */
    'ov.interrupted':      { fr: 'Interrompu',           en: 'Interrupted' },
    'ov.drinks':           { fr: 'Pause fraîcheur',      en: 'Cooling break' },
    'ov.noLive':           { fr: 'Aucun match en direct', en: 'No live match' },
    'ov.waiting':          { fr: 'En attente de matchs…', en: 'Waiting for matches…' },

    /* --- Légal --- */
    'legal.title':         { fr: 'Mentions légales',     en: 'Legal notice' },
    'legal.intro':         { fr: 'Projet de fan, non officiel.', en: 'Unofficial fan project.' },
    'legal.uefa':          { fr: 'Ce site n’est ni affilié, ni approuvé, ni soutenu par l’UEFA. « UEFA Champions League », « Ligue des Champions » et les logos associés sont des marques de l’UEFA, utilisées ici uniquement à des fins descriptives. Aucune licence n’est détenue.', en: 'This site is not affiliated with, endorsed or sponsored by UEFA. “UEFA Champions League” and associated logos are trademarks of UEFA, used here for descriptive purposes only. No licence is held.' },
    'legal.data':          { fr: 'Les données (scores, événements, logos) proviennent de l’API publique non officielle d’ESPN. Elles sont fournies à titre purement indicatif, sans garantie d’exactitude ni de disponibilité, et peuvent comporter des erreurs ou des retards.', en: 'Data (scores, events, logos) comes from the unofficial public ESPN API. It is provided for information only, without any guarantee of accuracy or availability, and may contain errors or delays.' },
    'legal.logos':         { fr: 'Les logos des clubs et de la compétition sont servis par ESPN et restent la propriété de leurs détenteurs respectifs.', en: 'Club and competition logos are served by ESPN and remain the property of their respective owners.' },
    'legal.purpose':       { fr: 'Ce projet est réalisé à but non lucratif, éducatif et de divertissement (overlay de stream).', en: 'This is a non-commercial, educational and entertainment project (stream overlay).' },
    'legal.contact':       { fr: 'Pour toute demande de retrait, contactez l’auteur du projet.', en: 'For any takedown request, please contact the project author.' }
  };

  /* ----------------------------------------------------------------------- */

  function readStored() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s && SUPPORTED.indexOf(s) !== -1) return s;
    } catch (e) {}
    return null;
  }

  function getLang() {
    var stored = readStored();
    if (stored) return stored;
    var nav = '';
    try { nav = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase(); } catch (e) {}
    return SUPPORTED.indexOf(nav) !== -1 ? nav : DEFAULT_LANG;
  }

  /* t(key) : renvoie la traduction, ou `fallback`, ou null si introuvable */
  function t(key, fallback) {
    var lang = getLang();
    var entry = DICT[key];
    if (entry && entry[lang] != null) return entry[lang];
    if (fallback != null) return fallback;
    if (entry && entry[DEFAULT_LANG] != null) return entry[DEFAULT_LANG]; // dernier recours
    return null; // clé inconnue -> on signale "rien" (le HTML d'origine est conservé)
  }

  function apply(root) {
    root = root || document;
    var lang = getLang();
    try { document.documentElement.setAttribute('lang', lang); } catch (e) {}

    // Texte
    var nodes = root.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var val = t(el.getAttribute('data-i18n'));
      if (val != null) el.textContent = val; // sinon : on garde le HTML existant
    }
    // HTML autorisé (libellés contenant du balisage de confiance, ex. <strong>)
    var htmlNodes = root.querySelectorAll('[data-i18n-html]');
    for (var h = 0; h < htmlNodes.length; h++) {
      var hv = t(htmlNodes[h].getAttribute('data-i18n-html'));
      if (hv != null) htmlNodes[h].innerHTML = hv;
    }
    // Attributs courants
    applyAttr(root, 'data-i18n-placeholder', 'placeholder');
    applyAttr(root, 'data-i18n-title', 'title');
    applyAttr(root, 'data-i18n-aria-label', 'aria-label');

    // État visuel des boutons de langue
    var btns = root.querySelectorAll('[data-lang-btn]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].classList.toggle('active', btns[j].getAttribute('data-lang-btn') === lang);
      btns[j].setAttribute('aria-pressed', btns[j].getAttribute('data-lang-btn') === lang ? 'true' : 'false');
    }
  }

  function applyAttr(root, dataAttr, targetAttr) {
    var nodes = root.querySelectorAll('[' + dataAttr + ']');
    for (var i = 0; i < nodes.length; i++) {
      var v = t(nodes[i].getAttribute(dataAttr));
      if (v != null) nodes[i].setAttribute(targetAttr, v);
    }
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply(document);
    try {
      global.dispatchEvent(new CustomEvent('ldc:langchange', { detail: { lang: lang } }));
    } catch (e) {
      // CustomEvent non supporté (très vieux navigateur) : on ignore.
    }
  }

  function toggle() {
    setLang(getLang() === 'fr' ? 'en' : 'fr');
  }

  /* Crée un petit toggle FR/EN et l'insère dans `container` (élément ou sélecteur). */
  function mountToggle(container) {
    var host = typeof container === 'string' ? document.querySelector(container) : container;
    if (!host) return;
    host.innerHTML = '';
    SUPPORTED.forEach(function (lng) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-btn';
      b.setAttribute('data-lang-btn', lng);
      b.textContent = lng.toUpperCase();
      b.addEventListener('click', function () { setLang(lng); });
      host.appendChild(b);
    });
    apply(host.ownerDocument || document);
  }

  global.I18N = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    apply: apply,
    toggle: toggle,
    mountToggle: mountToggle,
    SUPPORTED: SUPPORTED
  };

  // Application automatique dès que le DOM est prêt
  if (document.readyState !== 'loading') apply(document);
  else document.addEventListener('DOMContentLoaded', function () { apply(document); });

})(window);
