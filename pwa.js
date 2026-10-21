/* =========================================================================
   pwa.js — Application installable : enregistre le service worker (sw.js)
   et propose « 📲 Installer l'app » dans le pied de page quand le
   navigateur le permet (événement beforeinstallprompt : Chrome, Edge,
   Android). Rien ne s'affiche une fois l'app installée.
   ========================================================================= */
(function (g) {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    g.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  function T(fr, e) { try { return g.I18N && I18N.getLang() === 'en' ? e : fr; } catch (x) { return fr; } }
  var deferred = null;
  function button() {
    var f = document.querySelector('.site-footer'); if (!f || !deferred || f.querySelector('.pwa-install')) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pwa-install';
    b.textContent = '📲 ' + T('Installer l’app', 'Install the app');
    b.style.cssText = 'border:1px solid rgba(245,181,10,.5);background:rgba(245,181,10,.12);color:#f5b50a;font:800 12px Inter,system-ui,sans-serif;padding:7px 12px;border-radius:999px;cursor:pointer';
    b.addEventListener('click', function () {
      if (!deferred) return; deferred.prompt();
      deferred.userChoice.finally(function () { deferred = null; b.remove(); });
    });
    f.appendChild(b);
  }
  g.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; button(); });
  g.addEventListener('appinstalled', function () { deferred = null; var b = document.querySelector('.pwa-install'); if (b) b.remove(); });
})(window);
