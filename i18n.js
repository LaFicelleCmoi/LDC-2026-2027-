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
    'dash.lastMatch':      { fr: 'Dernier match',        en: 'Last match' },
    'leg.first':           { fr: 'Aller',                en: '1st leg' },
    'leg.second':          { fr: 'Retour',               en: '2nd leg' },
    'leg.firstShort':      { fr: 'A',                    en: '1' },
    'leg.secondShort':     { fr: 'R',                    en: '2' },
    'pal.titlesN':         { fr: 'titres',               en: 'titles' },
    'pal.title1':          { fr: 'titre',                en: 'title' },
    'pal.label':           { fr: 'Vainqueur de la Ligue des Champions', en: 'Champions League winner' },
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
    'season.current':      { fr: 'Actuelle',             en: 'Current' },
    'nav.seasons':         { fr: 'Saisons',              en: 'Seasons' },
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
    'legal.contact':       { fr: 'Pour toute demande de retrait ou question, contactez l’auteur du projet.', en: 'For any takedown request or question, please contact the project author.' },

    /* --- Légal : page enrichie --- */
    'legal.subtitle':      { fr: 'Projet de fan non officiel — transparence totale.', en: 'Unofficial fan project — full transparency.' },
    'legal.updatedAt':     { fr: 'Dernière mise à jour : juin 2026', en: 'Last updated: June 2026' },
    'legal.toc':           { fr: 'Sommaire',              en: 'Contents' },
    'legal.h.project':     { fr: '1 · Le projet',         en: '1 · The project' },
    'legal.b.project':     { fr: 'Ce site est un tracker et simulateur live de la Ligue des Champions réalisé par un fan, à but non lucratif, éducatif et de divertissement (notamment comme overlay de stream). Il n’est ni officiel, ni affilié, ni sponsorisé par une quelconque organisation.', en: 'This site is a live Champions League tracker and simulator built by a fan on a non-commercial, educational and entertainment basis (notably as a stream overlay). It is neither official nor affiliated with, nor sponsored by, any organisation.' },
    'legal.h.uefa':        { fr: '2 · UEFA & marques',    en: '2 · UEFA & trademarks' },
    'legal.h.data':        { fr: '3 · Données',           en: '3 · Data' },
    'legal.h.logos':       { fr: '4 · Logos',             en: '4 · Logos' },
    'legal.h.ip':          { fr: '5 · Propriété intellectuelle', en: '5 · Intellectual property' },
    'legal.b.ip':          { fr: 'L’ensemble des marques, noms, logos et contenus appartiennent à leurs détenteurs respectifs. Ils sont cités à des fins purement descriptives et d’information, sans intention de nuire ni de laisser croire à une quelconque affiliation.', en: 'All trademarks, names, logos and content belong to their respective owners. They are referenced for purely descriptive and informational purposes, with no intent to harm or to imply any affiliation.' },
    'legal.h.privacy':     { fr: '6 · Données personnelles', en: '6 · Personal data' },
    'legal.b.privacy':     { fr: 'Ce site ne collecte aucune donnée personnelle et ne possède pas de base d’utilisateurs : aucun compte, aucun formulaire, aucun traceur publicitaire. La seule information conservée localement dans votre navigateur est votre préférence de langue (clé « ldc_lang ») ; elle reste sur votre appareil et n’est jamais transmise.', en: 'This site collects no personal data and has no user database: no account, no form, no advertising tracker. The only information kept locally in your browser is your language preference (key “ldc_lang”); it stays on your device and is never transmitted.' },
    'legal.h.cookies':     { fr: '7 · Stockage local & cookies', en: '7 · Local storage & cookies' },
    'legal.b.cookies':     { fr: 'Aucun cookie de suivi n’est utilisé. Le site recourt uniquement au stockage local (localStorage) pour mémoriser la langue. L’hébergeur (Vercel) peut générer des journaux techniques standards à des fins de fonctionnement et de sécurité.', en: 'No tracking cookies are used. The site only uses local storage (localStorage) to remember the language. The host (Vercel) may generate standard technical logs for operation and security purposes.' },
    'legal.h.cgu':         { fr: '8 · Conditions d’utilisation', en: '8 · Terms of use' },
    'legal.b.cgu':         { fr: 'Le service est fourni « tel quel », sans garantie d’exactitude, de disponibilité ni d’absence d’erreur. Les scores et classements sont indicatifs et peuvent différer des sources officielles. En utilisant ce site, vous acceptez un usage personnel et non commercial.', en: 'The service is provided “as is”, without warranty of accuracy, availability or freedom from error. Scores and standings are indicative and may differ from official sources. By using this site you agree to personal, non-commercial use.' },
    'legal.h.liability':   { fr: '9 · Responsabilité',    en: '9 · Liability' },
    'legal.b.liability':   { fr: 'L’auteur ne saurait être tenu responsable d’un dommage direct ou indirect résultant de l’utilisation du site ou de l’indisponibilité des données. Les éventuels liens externes ne relèvent pas de sa responsabilité.', en: 'The author cannot be held liable for any direct or indirect damage resulting from use of the site or unavailability of data. Any external links are beyond the author’s responsibility.' },
    'legal.h.credits':     { fr: '10 · Crédits',          en: '10 · Credits' },
    'legal.b.credits':     { fr: 'Données : <a href="https://www.espn.com" target="_blank" rel="noopener">ESPN</a> (API publique non officielle). Polices : Bebas Neue & Inter (Google Fonts). Arbre de la phase finale : brackets-viewer. Dates : Day.js. Effets d’interface inspirés de <a href="https://reactbits.dev" target="_blank" rel="noopener">ReactBits</a> et <a href="https://uiverse.io" target="_blank" rel="noopener">Uiverse</a>, réécrits en JavaScript vanilla.', en: 'Data: <a href="https://www.espn.com" target="_blank" rel="noopener">ESPN</a> (unofficial public API). Fonts: Bebas Neue & Inter (Google Fonts). Knockout tree: brackets-viewer. Dates: Day.js. UI effects inspired by <a href="https://reactbits.dev" target="_blank" rel="noopener">ReactBits</a> and <a href="https://uiverse.io" target="_blank" rel="noopener">Uiverse</a>, rewritten in vanilla JavaScript.' },
    'legal.h.contact':     { fr: '11 · Contact',          en: '11 · Contact' }
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
