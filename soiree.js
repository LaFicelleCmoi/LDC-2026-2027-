/* =========================================================================
   soiree.js — Page « Soirée européenne » (soiree.html)
   -------------------------------------------------------------------------
   Tous les matchs d'un jour dans les trois coupes (Ligue des Champions,
   Europa League, Conference League), regroupés par heure de coup d'envoi,
   matchs en cours en tête. Filtres : une coupe, ou les clubs français.
   Navigation de jour de match en jour de match. Rafraîchi toutes les 20 s
   pendant le direct (score qui clignote à chaque but). Clic : fiche du match.
   ========================================================================= */
(function(){
  'use strict';
  I18N.mountToggle('#langSwitch');
  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function en(){ return I18N.getLang()==='en'; }
  function T(fr,e){ return en()?e:fr; }
  function loc(){ return en()?'en-GB':'fr-FR'; }
  function pad(n){ return n<10?'0'+n:''+n; }
  function hm(d){ return pad(d.getHours())+':'+pad(d.getMinutes()); }
  function crest(src,cls){ return src?'<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="'+cls+'"></span>'; }
  function dayKey(d){ return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate()); }

  var COMPS=[
    { slug:'uefa.champions', key:'ucl', icon:'logo.svg?v=4', color:'#f5b50a' },
    { slug:'uefa.europa', key:'uel', icon:'europa.svg?v=2', color:'#ff7a1a' },
    { slug:'uefa.europa.conf', key:'uecl', icon:'conference.svg?v=1', color:'#19c44f' }
  ];
  COMPS.forEach(function(c){ c.E=ESPN.forLeague(c.slug); c.matches=[]; });
  var q=new URLSearchParams(location.search);
  var filter=q.get('f')||'all', day=q.get('d')||null, picked=!!day, timer=null, lastScores={};

  function french(c){
    if(c.key==='ucl') return c.E.qualifiedClubs().filter(function(x){ return x.country==='FRA'; }).map(function(x){ return String(x.id); });
    var m=(window.LDCCupClubs2026||{})[c.slug]||{}; return Object.keys(m).filter(function(id){ return m[id]==='FRA'; });
  }
  COMPS.forEach(function(c){ c.fr=french(c); });
  function all(){ var out=[]; COMPS.forEach(function(c){ c.matches.forEach(function(m){ if(m.round!=='qualifying' && m.dateObj) out.push({ c:c, m:m }); }); }); return out; }
  function isFr(x){ return x.c.fr.indexOf(String(x.m.home.teamId))!==-1 || x.c.fr.indexOf(String(x.m.away.teamId))!==-1; }
  function keep(x){ return filter==='all' || (filter==='fr'?isFr(x):x.c.key===filter); }

  /* Jours de match (selon le filtre) et jour affiché par défaut : aujourd'hui
     s'il y a des matchs, sinon le prochain, sinon le dernier. */
  function days(){ var s={}; all().filter(keep).forEach(function(x){ s[dayKey(x.m.dateObj)]=1; }); return Object.keys(s).sort(); }
  function defaultDay(ds){
    var today=dayKey(new Date());
    if(ds.indexOf(today)!==-1) return today;
    var next=ds.filter(function(d){ return d>today; })[0];
    return next||ds[ds.length-1]||today;
  }
  function dayLabel(k){ var d=new Date(+k.slice(0,4),+k.slice(4,6)-1,+k.slice(6,8)); var t=dayKey(new Date());
    var s=d.toLocaleDateString(loc(),{weekday:'long',day:'numeric',month:'long'});
    return (k===t?T('Ce soir · ','Tonight · '):'')+s.charAt(0).toUpperCase()+s.slice(1); }

  function row(x){
    var m=x.m, c=x.c, st=m.state, key=m.home.score+'-'+m.away.score, goal=st==='in' && lastScores[m.id] && lastScores[m.id]!==key;
    lastScores[m.id]=key;
    var mid = st==='pre' ? '<span class="fr-ko">'+hm(m.dateObj)+'</span>'
      : '<b class="fr-sc'+(st==='in'?' live':'')+(goal?' sr-goal':'')+'">'+m.home.score+' – '+m.away.score+'</b>'+
        '<span class="fr-min">'+esc(st==='in'?(/HT|Half/i.test(m.statusDetail)?T('MT','HT'):(m.displayClock||'')):(m.home.shootout!=null&&m.away.shootout!=null?T('t.a.b. ','pens ')+m.home.shootout+'–'+m.away.shootout:T('Terminé','FT')))+'</span>';
    function side(t,cls){ var fr=c.fr.indexOf(String(t.teamId))!==-1;
      return '<span class="fr-side '+cls+(fr?' fr':'')+'">'+(cls==='h'?'<span class="nm">'+esc(t.name)+'</span>'+crest(t.logo,'fr-mlogo'):crest(t.logo,'fr-mlogo')+'<span class="nm">'+esc(t.name)+'</span>')+'</span>'; }
    return '<button type="button" class="fr-match sr-row'+(st==='in'?' is-live':'')+'" style="--c:'+c.color+'" data-mp-open="'+esc(m.id)+'" data-mp-league="'+c.slug+'" title="'+esc(T('Fiche du match','Match details'))+'">'+
      '<img class="fr-comp" src="'+c.icon+'" alt="'+esc(T(c.E.COMP.fr,c.E.COMP.en))+'" title="'+esc(T(c.E.COMP.fr,c.E.COMP.en))+'">'+side(m.home,'h')+'<span class="fr-mid">'+mid+'</span>'+side(m.away,'a')+(window.LDCMatchPanel&&LDCMatchPanel.probBar&&m.state==='pre'&&m.odds?'<div class="fr-probs">'+LDCMatchPanel.probBar(m.odds, m.home.abbr||m.home.name, m.away.abbr||m.away.name, 'sm')+'</div>':'')+'</button>';
  }

  function render(){
    var ds=days(); if(!picked || ds.indexOf(day)===-1) day=defaultDay(ds);
    var i=ds.indexOf(day);
    el('srPrev').disabled=i<=0; el('srNext').disabled=i===-1||i>=ds.length-1;
    el('srDay').textContent=dayLabel(day);
    var list=all().filter(function(x){ return keep(x) && dayKey(x.m.dateObj)===day; });
    var live=list.filter(function(x){ return x.m.state==='in'; });
    /* Créneaux : en direct d'abord, puis par heure de coup d'envoi. */
    var slots={}, order=[];
    list.sort(function(a,b){ return (a.m.dateObj-b.m.dateObj) || COMPS.indexOf(a.c)-COMPS.indexOf(b.c) || a.m.home.name.localeCompare(b.m.home.name); })
      .forEach(function(x){ var k=x.m.state==='in'?'live':hm(x.m.dateObj); if(!slots[k]){ slots[k]=[]; order.push(k); } slots[k].push(x); });
    order.sort(function(a,b){ return a==='live'?-1:(b==='live'?1:a.localeCompare(b)); });
    el('srList').innerHTML=order.length?order.map(function(k){
      var head=k==='live'?'<span class="sr-live"><i></i>'+esc(T('En direct','Live'))+'</span>':esc(k);
      var byComp={}; slots[k].forEach(function(x){ byComp[x.c.key]=(byComp[x.c.key]||0)+1; });
      return '<section class="sr-slot"><h2 class="sr-h">'+head+'<small>'+slots[k].length+' '+esc(T('match'+(slots[k].length>1?'s':''),'match'+(slots[k].length>1?'es':'')))+'</small></h2>'+
        '<div class="fr-list">'+slots[k].map(row).join('')+'</div></section>';
    }).join(''):'<p class="fr-empty">'+esc(T('Aucun match ce jour-là pour ce filtre.','No match that day for this filter.'))+'</p>';
    /* Résumé du jour */
    var goals=0, done=0; list.forEach(function(x){ if(x.m.state!=='pre'){ goals+=x.m.home.score+x.m.away.score; done++; } });
    el('srSum').textContent=list.length?(list.length+' '+T('matchs','matches')+(live.length?' · '+live.length+' '+T('en direct','live'):'')+(done?' · '+goals+' '+T('buts','goals'):'')):'';
    Array.prototype.forEach.call(document.querySelectorAll('.sr-chip'),function(b){ var on=b.getAttribute('data-f')===filter; b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); });
    el('liveFlag').style.display=all().some(function(x){ return x.m.state==='in'; })?'inline-flex':'none';
    writeUrl();
  }
  function writeUrl(){ try{ history.replaceState(null,'',location.pathname+'?d='+day+(filter!=='all'?'&f='+filter:'')); }catch(e){} }
  function renderStatic(){
    var X={ srTitle:['Soirée européenne','European night'], srSub:['Tous les matchs du jour en Ligue des Champions, Europa League et Conference League.','Every match of the day in the Champions League, Europa League and Conference League.'],
      navSr:['Soirée européenne','European night'], navFr:['Clubs français','French clubs'], navCmp:['Comparateur','Compare clubs'], navUcl:['Ligue des Champions','Champions League'] };
    Object.keys(X).forEach(function(k){ var n=el(k); if(n) n.textContent=T(X[k][0],X[k][1]); });
    var lab={ all:T('Toutes','All'), ucl:'LDC', uel:'Europa League', uecl:'Conference League', fr:T('Clubs français','French clubs') };
    Array.prototype.forEach.call(document.querySelectorAll('.sr-chip'),function(b){ b.querySelector('span').textContent=lab[b.getAttribute('data-f')]; });
    el('srPrev').setAttribute('aria-label',T('Jour de match précédent','Previous match day')); el('srNext').setAttribute('aria-label',T('Jour de match suivant','Next match day'));
    document.title=T('Soirée européenne','European night')+' — Tracker';
  }

  el('srChips').addEventListener('click',function(e){ var b=e.target.closest('.sr-chip'); if(!b) return; filter=b.getAttribute('data-f'); picked=false; render(); });
  el('srPrev').addEventListener('click',function(){ var ds=days(), i=ds.indexOf(day); if(i>0){ day=ds[i-1]; picked=true; render(); } });
  el('srNext').addEventListener('click',function(){ var ds=days(), i=ds.indexOf(day); if(i<ds.length-1){ day=ds[i+1]; picked=true; render(); } });

  function load(){
    if(document.hidden){ clearTimeout(timer); timer=setTimeout(load,60000); return; }
    Promise.all(COMPS.map(function(c){
      return c.E.fetchSeasonEvents({ ttl:20000 }).then(function(evs){ c.matches=evs.map(c.E.normalizeEvent).filter(Boolean); }).catch(function(){});
    })).then(function(){
      render();
      var live=all().some(function(x){ return x.m.state==='in'; });
      clearTimeout(timer); timer=setTimeout(load, live?20000:300000);
    });
  }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) load(); });
  window.addEventListener('ldc:langchange',function(){ renderStatic(); render(); });
  renderStatic();
  load();
})();
