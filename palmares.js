/* =========================================================================
   palmares.js — Pages Palmarès, partagées par la Ligue des Champions
   (palmares.html), l'Europa League (europa-palmares.html) et la Conference
   League (conference-palmares.html). Le palmarès vient de espn.js
   (ESPN.palmaresRanking, table vérifiée de la compétition de la page).
   ========================================================================= */

(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function el(id){ return document.getElementById(id); }
  var currentView='palmares', palCountStr='';
  if(window.I18N) I18N.mountToggle('#langSwitch');
  var COMP=ESPN.COMP, KEY=COMP.key;
  function T(fr,en){ return (window.I18N&&I18N.getLang()==='en')?en:fr; }
  /* Textes propres à chaque compétition ; la LDC garde ses clés i18n. */
  var TXT={
    ucl:{ title:function(){ return (window.I18N&&I18N.t('pal.pageTitle'))||'Palmarès de la Ligue des Champions'; },
          sub:function(){ return (window.I18N&&I18N.t('pal.pageSub'))||'Classement des clubs par nombre de titres'; },
          wall:function(y){ return T('Vainqueurs de la Coupe d’Europe / Ligue des champions, année par année · ','European Cup / Champions League winners, year by year · ')+y; } },
    uel:{ title:function(){ return T('Palmarès de l’Europa League','Europa League honours'); },
          sub:function(){ return T('Classement des clubs par nombre de titres (Coupe UEFA / Europa League)','Clubs ranked by number of titles (UEFA Cup / Europa League)'); },
          wall:function(y){ return T('Vainqueurs de la Coupe UEFA / Europa League, année par année · ','UEFA Cup / Europa League winners, year by year · ')+y; } },
    uecl:{ title:function(){ return T('Palmarès de la Conference League','Conference League honours'); },
          sub:function(){ return T('Les vainqueurs depuis la création en 2022','Winners since the first edition in 2022'); },
          wall:function(y){ return T('Vainqueurs de la Conference League, année par année · ','Conference League winners, year by year · ')+y; } }
  }[KEY];
  function span(){ var ys=[].concat.apply([],ESPN.palmaresRanking().map(function(c){ return c.years; })); return Math.min.apply(null,ys)+'–'+Math.max.apply(null,ys); }
  if(window.ESPN){ ESPN.mountSeasonMenu('#seasonDD',COMP.standings); ESPN.preserveSeasonLinks(document); }

  function render(){
    var rows=(window.ESPN&&ESPN.palmaresRanking)?ESPN.palmaresRanking():[];
    var yearsLbl=(window.I18N&&I18N.t('pal.colYears'))||'Années';
    // Podium des 3 premiers (égalités regroupées) — cliquable pour révéler les années
    var pod=document.getElementById('podium');
    if(pod){
      var byRank={};
      rows.forEach(function(r){ if(r.rank<=3){ (byRank[r.rank]=byRank[r.rank]||[]).push(r); } });
      var lbl=(window.I18N&&I18N.t('pal.colTitles'))||'titres';
      function block(rk,cls,medal){
        var cl=byRank[rk]; if(!cl||!cl.length) return '';
        var names=cl.map(function(c){return '<div class="pname">'+esc(c.name)+'</div>';}).join('');
        var years=cl.map(function(c){
          var nm=cl.length>1?'<span class="py-club">'+esc(c.name)+'</span>':'';
          return '<div class="py-line">'+nm+c.years.join(' · ')+'</div>';
        }).join('');
        return '<div class="pod '+cls+' has-detail" role="button" tabindex="0" aria-expanded="false">'+
          '<div class="medal">'+medal+'</div>'+names+
          '<div class="ptitles">🏆 <span class="pt-n" data-n="'+cl[0].n+'">'+cl[0].n+'</span> <small>'+esc(cl[0].n>1?lbl:T('titre','title'))+'</small></div>'+
          '<div class="pod-years"><span class="pdl">'+esc(yearsLbl)+'</span>'+years+'</div>'+
          '<div class="prank">'+rk+'</div></div>';
      }
      pod.innerHTML=block(2,'p2','🥈')+block(1,'p1','👑')+block(3,'p3','🥉');
      animatePodium();
    }
    var body=document.getElementById('palBody'); if(!body) return;
    // Le tableau exclut le podium (top 3) — aucune répétition
    body.innerHTML=rows.filter(function(e){ return e.rank>3; }).map(function(e){
      var medal = e.rank===1?'m1':(e.rank===2?'m2':(e.rank===3?'m3':''));
      var yrs=e.years.join(' · ');
      return '<tr class="pal-row has-detail'+(e.rank<=3?' top':'')+'">'+
        '<td class="pal-rank '+medal+'">'+e.rank+'</td>'+
        '<td class="pal-club"><span class="star">★</span>'+esc(e.name)+'<span class="pal-chev" aria-hidden="true">▼</span></td>'+
        '<td class="pal-titles"><span class="cup">🏆</span> <b>'+e.n+'</b></td>'+
        '<td class="pal-years">'+yrs+'</td>'+
      '</tr>'+
      '<tr class="pal-detail"><td colspan="4"><div class="pal-detail-in"><span class="pdl">'+esc(yearsLbl)+'</span>'+yrs+'</div></td></tr>';
    }).join('');
    /* Tableau masqué quand tout le palmarès tient sur le podium (Conference League). */
    var card=body.closest('.card'); if(card) card.style.display=body.children.length?'':'none';
    palCountStr=rows.length+' '+((window.I18N&&I18N.t('pal.total'))||'clubs');
    refreshTexts();
  }
  function applyFavAccent(){ if(!window.ESPN||!ESPN.favAccent) return; var a=ESPN.favAccent(), root=document.documentElement; if(a) root.style.setProperty('--fav-rgb',a); else root.style.removeProperty('--fav-rgb'); }
  function renderWall(){
    var host=document.getElementById('champWall'); if(!host) return;
    var titleEl=document.getElementById('wallTitle'); if(titleEl) titleEl.textContent=(window.I18N&&I18N.getLang()==='en')?'Hall of champions':'Mur des champions';
    var ranking=(window.ESPN&&ESPN.palmaresRanking)?ESPN.palmaresRanking():[];
    var map={}; ranking.forEach(function(c){ c.years.forEach(function(y){ map[y]={name:c.name, logo:c.logo}; }); });
    var years=Object.keys(map).map(Number).sort(function(a,b){ return b-a; });
    var fav=(window.ESPN&&ESPN.getFav)?ESPN.getFav():null, favName=fav?fav.name.toLowerCase():'';
    host.innerHTML=years.map(function(y){
      var c=map[y], low=c.name.toLowerCase();
      var isFav=favName && (low.indexOf(favName)!==-1 || favName.indexOf(low)!==-1);
      var logo=c.logo?'<img class="cw-logo" src="'+esc(c.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="cw-logo"></span>';
      return '<div class="cw-item'+(isFav?' fav':'')+'">'+logo+'<div class="cw-txt"><span class="yr">'+y+'</span><span class="cl">'+esc(c.name)+'</span></div></div>';
    }).join('');
  }
  function setLabels(){
    var en=window.I18N&&I18N.getLang()==='en';
    var p=el('vsPalmares'), w=el('vsWall');
    if(p) p.textContent=(window.I18N&&I18N.t('nav.palmares'))||'Palmarès';
    if(w) w.textContent=en?'Hall of Champions':'Mur des champions';
  }
  function moveThumb(){
    var sw=el('viewSwitch'); if(!sw) return;
    var a=sw.querySelector('.vs-opt.active'), th=sw.querySelector('.vs-thumb');
    if(!a||!th) return;
    th.style.left=a.offsetLeft+'px'; th.style.width=a.offsetWidth+'px';
  }
  function refreshTexts(){
    var en=window.I18N&&I18N.getLang()==='en';
    if(currentView==='palmares'){
      el('palTitle').textContent=TXT.title();
      el('palSub').textContent=TXT.sub()+' — '+palCountStr;
    } else {
      el('palTitle').textContent=en?'Hall of Champions':'Mur des champions';
      el('palSub').textContent=TXT.wall(span());
    }
  }
  function setView(v){
    currentView=v;
    el('viewPalmares').style.display=(v==='palmares')?'':'none';
    el('viewWall').style.display=(v==='wall')?'':'none';
    Array.prototype.forEach.call(el('viewSwitch').querySelectorAll('.vs-opt'),function(b){ b.classList.toggle('active', b.getAttribute('data-view')===v); });
    refreshTexts(); moveThumb();
  }
  applyFavAccent();
  render();
  renderWall();
  setLabels();
  setView('palmares');
  requestAnimationFrame(moveThumb);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(moveThumb);
  window.addEventListener('resize', moveThumb);
  (function bindSwitch(){
    var sw=el('viewSwitch'); if(!sw) return;
    sw.addEventListener('click', function(ev){ var b=ev.target.closest('.vs-opt'); if(b) setView(b.getAttribute('data-view')); });
  })();
  // Mobile : révéler les années de victoire au clic sur la ligne d'un club
  (function bindExpand(){
    var body=document.getElementById('palBody'); if(!body) return;
    body.addEventListener('click', function(ev){
      var row=ev.target.closest('.pal-row.has-detail');
      if(row && body.contains(row)) row.classList.toggle('open');
    });
  })();
  // Podium cliquable : révéler les années de victoire des 3 premiers
  (function bindPodium(){
    var pod=document.getElementById('podium'); if(!pod) return;
    pod.addEventListener('click', function(ev){
      var b=ev.target.closest('.pod.has-detail');
      if(b && pod.contains(b)){ var op=b.classList.toggle('open'); b.setAttribute('aria-expanded', op?'true':'false'); }
    });
  })();

  /* Compteurs animés du podium (0 -> n titres, easing, repli garanti) */
  function animatePodium(){
    var reduce=false; try{ reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}
    Array.prototype.forEach.call(document.querySelectorAll('#podium .pt-n'), function(sp){
      var target=parseInt(sp.getAttribute('data-n'),10)||0;
      if(reduce || !window.requestAnimationFrame){ sp.textContent=String(target); return; }
      var t0=null, dur=900;
      sp.textContent='0';
      requestAnimationFrame(function step(ts){
        if(t0==null) t0=ts;
        var p=Math.min(1,(ts-t0)/dur), e=1-Math.pow(1-p,3);
        sp.textContent=String(Math.round(e*target));
        if(p<1) requestAnimationFrame(step);
      });
      setTimeout(function(){ sp.textContent=String(target); }, dur+400);  // filet (onglet caché)
    });
  }

  /* Inclinaison 3D des cartes du podium au survol (souris uniquement) */
  (function podiumTilt(){
    var fine=false, reduce=false;
    try{ fine=window.matchMedia&&matchMedia('(pointer:fine)').matches; }catch(e){}
    try{ reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}
    if(!fine || reduce) return;
    var pod=document.getElementById('podium'); if(!pod) return;
    pod.addEventListener('pointermove', function(e){
      var card=e.target.closest('.pod'); if(!card||!pod.contains(card)) return;
      var r=card.getBoundingClientRect();
      var rx=((e.clientY-r.top)/r.height-.5)*-7, ry=((e.clientX-r.left)/r.width-.5)*9;
      card.style.transform='perspective(700px) rotateX('+rx.toFixed(2)+'deg) rotateY('+ry.toFixed(2)+'deg) translateY(-3px)';
    }, {passive:true});
    pod.addEventListener('pointerout', function(e){
      var card=e.target.closest('.pod');
      if(card && !card.contains(e.relatedTarget)) card.style.transform='';
    });
  })();
  if(window.I18N) window.addEventListener('ldc:langchange',function(){ render(); renderWall(); applyFavAccent(); setLabels(); requestAnimationFrame(moveThumb); if(window.ESPN) ESPN.mountSeasonMenu('#seasonDD',COMP.standings); });

  /* Starfield (fond étoilé partagé) */
  (function starfield(){
    var c=document.getElementById('starfield'); if(!c||!c.getContext) return; var ctx=c.getContext('2d'); var stars=[], W=0, H=0;
    function resize(){ var dpr=Math.min(2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight; c.width=W*dpr; c.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); build(); }
    function build(){ stars=[]; var n=Math.min(110,Math.floor(W*H/14000)); for(var i=0;i<n;i++) stars.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.2+0.3,vy:0.04+Math.random()*0.16,tw:Math.random()*6.28}); }
    function loop(){ if(document.visibilityState==='hidden'){ setTimeout(function(){requestAnimationFrame(loop);},700); return; } ctx.clearRect(0,0,W,H); for(var i=0;i<stars.length;i++){ var s=stars[i]; s.y+=s.vy; s.tw+=0.03; if(s.y>H+2){ s.y=-2; s.x=Math.random()*W; } var a=0.16+0.28*Math.sin(s.tw); if(a<0)a=0; ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,6.28); ctx.fillStyle='rgba(150,170,210,'+a.toFixed(2)+')'; ctx.fill(); } requestAnimationFrame(loop); }
    window.addEventListener('resize',resize); resize(); if(!(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)) requestAnimationFrame(loop);
  })();
})();
