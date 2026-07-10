/* =======================================================================
   ui.js — micro-interactions partagées (100 % vanilla, auto-contenu)
   Inspiré des galeries UI (ReactBits : SpotlightCard / ScrollReveal,
   uiverse.io : ripple), réécrit sur mesure pour ce site.
   Effets :
     1. Barre de progression de lecture (haut de page, couleur du club)
     2. Révélation des cartes au défilement (IntersectionObserver)
     3. Halo « spotlight » qui suit la souris sur les cartes
     4. Ondulation (ripple) au clic des boutons
     5. Focus clavier visible + défilement doux vers les ancres
   Tout respecte prefers-reduced-motion (aucun effet si activé) et
   n'a AUCUNE dépendance : le CSS nécessaire est injecté par ce fichier.
   API : window.UIFX = { scan() }  (re-scanne le DOM pour le reveal)
   ======================================================================= */
(function(){
  'use strict';
  var d = document;
  var reduce = false, fine = false;
  try{ reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}
  try{ fine   = window.matchMedia && matchMedia('(pointer:fine)').matches; }catch(e){}

  /* ---- 0. CSS injecté (suit --fav-rgb : thème du club favori, or par défaut) ---- */
  var css =
    '#uifx-progress{position:fixed;top:0;left:0;height:3px;width:0;z-index:90;pointer-events:none;'+
      'background:linear-gradient(90deg,rgb(var(--fav-rgb,245,181,10)),rgba(var(--fav-rgb,245,181,10),.45));'+
      'box-shadow:0 0 12px rgba(var(--fav-rgb,245,181,10),.5);}'+
    '.uifx-rv{opacity:0;transform:translateY(14px);}'+
    '.uifx-rv.uifx-in{opacity:1;transform:none;transition:opacity .55s ease,transform .55s cubic-bezier(.22,1,.36,1);}'+
    '.uifx-spot{position:relative;}'+
    '.uifx-spot::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;'+
      'opacity:0;transition:opacity .25s;z-index:1;'+
      'background:radial-gradient(240px circle at var(--uifx-mx,50%) var(--uifx-my,50%),rgba(var(--fav-rgb,245,181,10),.11),transparent 65%);}'+
    '.uifx-spot:hover::after{opacity:1;}'+
    '.uifx-ripple{position:absolute;border-radius:50%;pointer-events:none;transform:scale(0);'+
      'background:rgba(255,255,255,.35);animation:uifxRip .55s ease-out forwards;}'+
    '@keyframes uifxRip{to{transform:scale(1);opacity:0;}}'+
    ':where(a,button,[role="button"],input,select,textarea):focus-visible{outline:2px solid rgba(var(--fav-rgb,245,181,10),.85);outline-offset:2px;}';
  if(!reduce) css += 'html{scroll-behavior:smooth;}';
  var tag = d.createElement('style'); tag.id = 'uifx-css'; tag.textContent = css;
  (d.head || d.documentElement).appendChild(tag);

  /* ---- 1. Barre de progression de lecture ---- */
  (function(){
    if(!d.body) return;
    var bar = d.createElement('div'); bar.id = 'uifx-progress';
    d.body.appendChild(bar);
    function update(){
      var doc = d.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 60 ? Math.min(1, Math.max(0, (window.scrollY || doc.scrollTop || 0) / max)) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', update, {passive:true});
    window.addEventListener('resize', update, {passive:true});
    update();
  })();

  /* ---- 2. Révélation au défilement ---- */
  var SEL_RV = '.card,.fav-card,.os-card,.live-card,.zone-card,.stat-card,.quiz-card,.game-modes,.score-bar,.mc-hero,.mc-camp,.podium';
  var io = null, batch = 0;
  function markReveal(){
    if(reduce || !('IntersectionObserver' in window)) return;
    if(!io){
      io = new IntersectionObserver(function(entries){
        for(var i=0;i<entries.length;i++){
          if(entries[i].isIntersecting){ entries[i].target.classList.add('uifx-in'); io.unobserve(entries[i].target); }
        }
      }, {threshold:.06, rootMargin:'0px 0px -4% 0px'});
    }
    var els = d.querySelectorAll(SEL_RV);
    for(var i=0;i<els.length;i++){
      var el = els[i];
      if(el.__uifx) continue; el.__uifx = 1;
      el.classList.add('uifx-rv');
      el.style.transitionDelay = ((batch % 5) * 60) + 'ms';
      batch++;
      io.observe(el);
    }
  }
  markReveal();
  /* Contenu rendu en différé (fetch) : on capte les ajouts pendant 12 s,
     le MutationObserver s'exécute avant le rendu -> pas de flash. */
  if(!reduce && 'IntersectionObserver' in window && window.MutationObserver && d.body){
    var mo = new MutationObserver(function(){ markReveal(); });
    mo.observe(d.body, {childList:true, subtree:true});
    setTimeout(function(){ try{ mo.disconnect(); }catch(e){} }, 12000);
  }

  /* ---- 3. Spotlight au survol des cartes ---- */
  var SEL_SPOT = '.card,.fav-card,.os-card,.live-card,.zone-card,.stat-card,.quiz-card,.mc-hero';
  if(fine && !reduce){
    d.addEventListener('pointermove', function(e){
      var t = e.target && e.target.closest ? e.target.closest(SEL_SPOT) : null;
      if(!t) return;
      if(!t.classList.contains('uifx-spot')) t.classList.add('uifx-spot');
      var r = t.getBoundingClientRect();
      t.style.setProperty('--uifx-mx', (e.clientX - r.left).toFixed(1) + 'px');
      t.style.setProperty('--uifx-my', (e.clientY - r.top).toFixed(1) + 'px');
    }, {passive:true});
  }

  /* ---- 4. Ripple au clic des boutons ---- */
  var SEL_RIP = '.btn,.gm-btn,.opt,.fav-btn,.quiz-next,.pm-pick,.run-row';
  if(!reduce){
    d.addEventListener('click', function(e){
      var t = e.target && e.target.closest ? e.target.closest(SEL_RIP) : null;
      if(!t || t.classList.contains('star-border')) return;
      var cs; try{ cs = getComputedStyle(t); }catch(err){ return; }
      if(cs.position === 'static') t.style.position = 'relative';
      if(cs.overflow !== 'hidden') t.style.overflow = 'hidden';
      var r = t.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 2;
      var s = d.createElement('span');
      s.className = 'uifx-ripple';
      s.style.width = s.style.height = size + 'px';
      s.style.left = (e.clientX - r.left - size/2) + 'px';
      s.style.top  = (e.clientY - r.top  - size/2) + 'px';
      t.appendChild(s);
      setTimeout(function(){ try{ s.remove(); }catch(err){} }, 600);
    }, true);
  }

  window.UIFX = { scan: markReveal };
})();
