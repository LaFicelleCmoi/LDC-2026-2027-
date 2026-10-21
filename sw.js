/* =========================================================================
   sw.js — Service worker de l'application (installable, hors-ligne)
   -------------------------------------------------------------------------
   - Pages (navigation) : réseau d'abord, sinon la copie en cache, sinon
     offline.html.
   - Fichiers du site (js, css, svg, png…) : versionnés par ?v=N, donc cache
     d'abord puis réseau.
   - API ESPN : réseau d'abord, copie en cache en secours (derniers scores
     hors ligne).
   - Images ESPN (blasons, drapeaux) : NON interceptées. La CSP du site
     (connect-src) n'autorise pas fetch() vers a.espncdn.com : les relayer
     ici les bloquait toutes ; le navigateur les charge et les met en cache
     lui-même (img-src l'autorise).
   Changer VERSION invalide les anciens caches.
   ========================================================================= */
var VERSION = 'ldc-v2';
var CORE = 'core-' + VERSION, PAGES = 'pages-' + VERSION, API = 'api-' + VERSION;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(PAGES).then(function (c) { return c.addAll(['offline.html', 'icon-192.png']); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf(VERSION) === -1; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(name, req, res) { if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(name).then(function (c) { c.put(req, copy); }); } return res; }

self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) { return put(PAGES, req, res); }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('offline.html'); });
    }));
    return;
  }
  if (url.origin === location.origin) {
    if (/\.(js|css|svg|png|jpg|webp|woff2?)$/.test(url.pathname)) {
      e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (res) { return put(CORE, req, res); }); }));
    }
    return;
  }
  if (url.hostname === 'site.api.espn.com') {
    e.respondWith(fetch(req).then(function (res) { return put(API, req, res); }).catch(function () { return caches.match(req); }));
    return;
  }
});
