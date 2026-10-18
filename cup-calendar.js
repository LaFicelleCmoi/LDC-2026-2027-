/* =========================================================================
   cup-calendar.js — Calendrier des coupes européennes
   UN SEUL script pour europa-calendrier.html et conference-calendrier.html :
   la compétition vient de espn.js (window.LDC_LEAGUE). Reprend la page
   Calendrier de la LDC (calendrier.html) :
   - « Calendrier des rencontres » : tous les matchs par journée puis par tour,
     scores et direct, cumul des confrontations aller/retour, filtre par club,
     « Mon équipe », bouton « Prochain match », export .ics ;
   - « Adversaires » : les adversaires de chaque club en phase de ligue, à
     domicile et à l'extérieur. Le tirage officiel n'est pas embarqué pour ces
     coupes : la vue est tirée du calendrier ESPN, qui en est le résultat
     (sans les chapeaux, qu'ESPN ne publie pas).
   Un clic sur un club ouvre sa fiche (clubpanel.js).
   ========================================================================= */
(function(){
  'use strict';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function el(id){ return document.getElementById(id); }
  function pad(n){ return n<10?'0'+n:''+n; }
  function dm(d){ return pad(d.getDate())+'/'+pad(d.getMonth()+1); }
  function hm(d){ return pad(d.getHours())+':'+pad(d.getMinutes()); }
  function en(){ return I18N.getLang()==='en'; }
  function T(fr,e){ return en()?e:fr; }
  var COMP=ESPN.COMP;
  function compName(){ return T(COMP.fr,COMP.en); }

  I18N.mountToggle('#langSwitch');

  var events=[], allMatches=[], standings=[], filterTeam='', timer=null;
  var VIEW_KEY='ldcCalendarView_'+COMP.key;
  var viewMode=location.hash==='#adversaires'?'draw':'matches';
  if(viewMode!=='draw'){ try{ if(localStorage.getItem(VIEW_KEY)==='draw') viewMode='draw'; }catch(e){} }

  function applyFavAccent(){ var a=ESPN.favAccent(), r=document.documentElement; if(a) r.style.setProperty('--fav-rgb',a); else r.style.removeProperty('--fav-rgb'); }

  function applySeasonUI(){
    applyFavAccent();
    el('season-chip').textContent=ESPN.seasonLabel();
    var banner=el('souvenir-banner');
    if(ESPN.isArchive()){ banner.classList.add('show'); el('souvenir-banner-label').textContent=I18N.t('souvenir.badge')+' '+ESPN.seasonLabel(); }
    else banner.classList.remove('show');
    ESPN.mountSeasonMenu('#seasonDD', COMP.calendar);
    ESPN.preserveSeasonLinks(document);
    el('calIcsLbl').textContent=T('Exporter (.ics)','Export (.ics)');
    el('calNextLbl').textContent=T('Prochain match','Next match');
    el('cal-view-draw').textContent=T('◆ Adversaires','◆ Opponents');
    el('cal-view-matches').textContent=T('📅 Calendrier des rencontres','📅 Match calendar');
    el('calSub').textContent=T('Tous les matchs de la saison de '+compName()+', par journée','All '+compName()+' matches of the season, by matchday');
  }

  function syncViewUI(){
    var available=allMatches.some(function(m){ return m.round==='league'; });
    if(!available) viewMode='matches';
    el('cal-view-switch').style.display=available?'inline-grid':'none';
    ['draw','matches'].forEach(function(k){
      var b=el('cal-view-'+k); b.classList.toggle('active',viewMode===k); b.setAttribute('aria-pressed',viewMode===k?'true':'false');
    });
    el('cal-ics').style.display=viewMode==='draw'?'none':'inline-flex';
  }
  function setView(mode){
    viewMode=mode==='draw'?'draw':'matches';
    try{ localStorage.setItem(VIEW_KEY,viewMode); }catch(e){}
    history.replaceState(null,'',location.pathname+location.search+(viewMode==='draw'?'#adversaires':''));
    syncViewUI(); render();
  }

  /* ---- Rencontres ---- */
  function logo(c){ return c.logo?'<img src="'+esc(c.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="nl"></span>'; }
  function side(c,cls){ return '<button type="button" class="cal-side '+cls+'" data-team="'+esc(c.teamId)+'" aria-label="'+esc(T('Fiche du club : ','Club card: ')+c.name)+'">'+logo(c)+'<span class="nm">'+esc(c.shortName||c.name)+'</span></button>'; }
  function tieKey(m){ var ids=[m.home.teamId,m.away.teamId].sort(); return m.round+'|'+ids.join('::'); }
  /* Cumul des deux manches d'une confrontation aller/retour. */
  function computeAggregates(){
    var agg={};
    allMatches.forEach(function(m){
      if(!m.leg) return;
      var k=tieKey(m); if(!agg[k]) agg[k]={};
      if(m.state!=='pre'){ agg[k][m.home.teamId]=(agg[k][m.home.teamId]||0)+m.home.score; agg[k][m.away.teamId]=(agg[k][m.away.teamId]||0)+m.away.score; }
    });
    return agg;
  }
  function matchRow(m,fid,aggMap){
    var isFav=fid && (m.home.teamId===fid || m.away.teamId===fid);
    var pen=(m.home.shootout!=null && m.away.shootout!=null);
    var leg=m.leg===1?'<span class="cal-leg a">'+esc(I18N.t('leg.first'))+'</span>':(m.leg===2?'<span class="cal-leg r">'+esc(I18N.t('leg.second'))+'</span>':'');
    var aggLine='';
    if(m.leg===2 && m.state!=='pre'){
      var a=aggMap[tieKey(m)];
      if(a && a[m.home.teamId]!=null && a[m.away.teamId]!=null) aggLine='<span class="cal-agg">'+T('Cumul','Agg.')+' '+a[m.home.teamId]+'–'+a[m.away.teamId]+'</span>';
    }
    var score, status;
    if(m.state==='pre'){
      score='<span class="cal-vs">–</span>';
      status='<span class="cal-time">'+(m.dateObj?hm(m.dateObj):'')+'</span>';
    } else {
      score=m.home.score+'<span class="cal-sep">–</span>'+m.away.score+(pen?'<span class="pen">'+esc(I18N.t('common.pen'))+' '+m.home.shootout+'–'+m.away.shootout+'</span>':'');
      status=m.state==='in'?'<span class="live">'+esc(/HT|Half/i.test(m.statusDetail)?T('MT','HT'):(m.displayClock||I18N.t('common.live')))+'</span>'
                           :'<span class="ft">'+esc(ESPN.isInterrupted(m)?m.statusDetail:(I18N.t('common.finished')||'FT'))+'</span>';
    }
    return '<div class="cal-match'+(isFav?' is-fav':'')+(m.state==='in'?' live-row':'')+'">'+
      '<div class="cal-date">'+(m.dateObj?dm(m.dateObj):'—')+leg+'</div>'+
      side(m.home,'home')+'<div class="cal-score">'+score+aggLine+'</div>'+side(m.away,'away')+
      '<div class="cal-status">'+status+'</div></div>';
  }

  /* ---- Adversaires de phase de ligue (d'après le calendrier) ---- */
  function renderOpponents(){
    var fav=ESPN.getFav(), fid=fav?String(fav.id):null, by={};
    allMatches.filter(function(m){ return m.round==='league'; }).forEach(function(m){
      [[m.home,m.away,'home'],[m.away,m.home,'away']].forEach(function(x){
        var id=String(x[0].teamId); if(!id) return;
        if(!by[id]) by[id]={ club:x[0], home:[], away:[] };
        if(x[0].logo) by[id].club=x[0];
        by[id][x[2]].push({ c:x[1], m:m });
      });
    });
    var ids=Object.keys(by).sort(function(a,b){ return by[a].club.name.localeCompare(by[b].club.name); });
    if(filterTeam) ids=ids.filter(function(id){ return id===String(filterTeam); });
    function opp(o){
      var m=o.m, res='';
      if(m.state!=='pre'){
        var me=String(m.home.teamId)===String(o.c.teamId)?m.away:m.home, gf=me.score, ga=(me===m.home?m.away:m.home).score;
        res='<b class="draw-res '+(gf>ga?'w':(gf<ga?'l':'d'))+'">'+gf+'–'+ga+'</b>';
      } else if(m.dateObj) res='<span class="draw-when">'+dm(m.dateObj)+'</span>';
      return '<button type="button" class="draw-opp" data-team="'+esc(o.c.teamId)+'">'+logo(o.c)+'<span>'+esc(o.c.name)+'</span>'+res+'</button>';
    }
    function byDate(a,b){ return (a.m.dateObj?a.m.dateObj.getTime():0)-(b.m.dateObj?b.m.dateObj.getTime():0); }
    var n=Math.max.apply(null, ids.map(function(id){ return by[id].home.length+by[id].away.length; }).concat([0]));
    var cards=ids.map(function(id){
      var e=by[id], c=e.club;
      return '<article class="draw-card'+(fid===id?' is-fav':'')+'">'+
        '<button type="button" class="draw-team" data-team="'+esc(id)+'">'+logo(c)+'<span>'+esc(c.name)+'</span></button>'+
        '<div class="draw-venues"><div class="draw-venue"><div class="draw-venue-title">⌂ '+esc(T('Domicile','Home'))+'</div>'+e.home.sort(byDate).map(opp).join('')+'</div>'+
        '<div class="draw-venue"><div class="draw-venue-title">✈ '+esc(T('Extérieur','Away'))+'</div>'+e.away.sort(byDate).map(opp).join('')+'</div></div></article>';
    }).join('');
    return '<section id="adversaires"><div class="draw-intro"><div><strong>'+esc(T('Adversaires de la phase de ligue','League phase opponents'))+'</strong>'+
      '<span>'+esc(T(n+' adversaires par club, d’après le calendrier publié par ESPN (résultat du tirage). Score une fois le match joué.',
                     n+' opponents per club, from the schedule published by ESPN (the outcome of the draw). Score once the match is played.'))+'</span></div></div>'+
      '<div class="draw-grid">'+(cards||'<div class="empty-state">'+esc(I18N.t('cal.empty'))+'</div>')+'</div></section>';
  }

  /* ---- Export .ics ---- */
  function icsEscape(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
  function icsDT(d){ return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+'T'+pad(d.getUTCHours())+pad(d.getUTCMinutes())+'00Z'; }
  function exportICS(){
    var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LDC Tracker//'+COMP.key.toUpperCase()+'//FR','CALSCALE:GREGORIAN'], now=icsDT(new Date()), count=0;
    var fav=ESPN.getFav(), scope=filterTeam || (fav?String(fav.id):'');
    var ms=allMatches.filter(function(m){ return m.round!=='qualifying' && m.dateObj; });
    if(scope){ var sc=ms.filter(function(m){ return m.home.teamId===scope || m.away.teamId===scope; }); if(sc.length) ms=sc; }
    ms.forEach(function(m){
      L.push('BEGIN:VEVENT','UID:'+COMP.key+'-'+m.id+'@ldc-tracker','DTSTAMP:'+now,'DTSTART:'+icsDT(m.dateObj),'DTEND:'+icsDT(new Date(m.dateObj.getTime()+2*3600000)),
        'SUMMARY:'+icsEscape('⚽ '+m.home.name+' – '+m.away.name),'DESCRIPTION:'+icsEscape(compName()+T(' (tracker non officiel)',' (unofficial tracker)')),'END:VEVENT');
      count++;
    });
    L.push('END:VCALENDAR');
    if(!count) return;
    try{
      var url=URL.createObjectURL(new Blob([L.join('\r\n')],{type:'text/calendar;charset=utf-8'})), a=document.createElement('a');
      a.href=url; a.download=COMP.key+'-calendrier.ics'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} },3000);
    }catch(e){}
  }

  /* ---- Rendu ---- */
  function render(){
    var host=el('cal-body'), nextBtn=el('cal-next'), fav=ESPN.getFav(), fid=fav?String(fav.id):null;
    nextBtn.style.display='none';
    syncViewUI();
    if(viewMode==='draw'){ host.innerHTML=renderOpponents(); return; }
    var ms=allMatches.filter(function(m){ return m.round!=='qualifying'; });
    if(filterTeam) ms=ms.filter(function(m){ return m.home.teamId===filterTeam || m.away.teamId===filterTeam; });
    if(!ms.length){ host.innerHTML='<div class="empty-state">'+esc(I18N.t('cal.empty'))+'</div>'; return; }
    var now=Date.now(), nextId=null, nextTs=Infinity;
    ms.forEach(function(m){ if(m.state==='pre' && m.dateObj && m.dateObj.getTime()>now && m.dateObj.getTime()<nextTs){ nextTs=m.dateObj.getTime(); nextId=m.id; } });
    var groups=[], aggMap=computeAggregates();
    ESPN.clusterMatchdays(ms.filter(function(m){ return m.round==='league'; })).forEach(function(md,i){ groups.push({ title:I18N.t('cal.matchday')+' '+(i+1), matches:md }); });
    var RL={ po:'trk.round.po', r16:'trk.round.r16', qf:'trk.round.qf', sf:'trk.round.sf', final:'trk.round.final' };
    ['po','r16','qf','sf','final'].forEach(function(rk){
      var r=ms.filter(function(m){ return m.round===rk; }).sort(function(a,b){ return (a.dateObj?a.dateObj.getTime():0)-(b.dateObj?b.dateObj.getTime():0); });
      if(r.length) groups.push({ title:I18N.t(RL[rk])||rk, matches:r });
    });
    host.innerHTML=groups.map(function(g){
      return '<div class="cal-group"><div class="cal-group-head">'+esc(g.title)+' <span class="cal-count">'+g.matches.length+'</span></div>'+
        g.matches.map(function(m){ return (nextId && m.id===nextId?'<div id="nextMatchAnchor"></div>':'')+matchRow(m,fid,aggMap); }).join('')+'</div>';
    }).join('');
    if(nextId) nextBtn.style.display='inline-flex';
  }

  function buildFilter(){
    var sel=el('cal-team'), map={};
    allMatches.forEach(function(m){ [m.home,m.away].forEach(function(c){ if(c.teamId && !map[c.teamId]) map[c.teamId]={ id:c.teamId, name:c.name }; }); });
    var teams=Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return a.name.localeCompare(b.name); });
    sel.innerHTML='<option value="">'+esc(I18N.t('cal.allClubs'))+'</option>'+
      teams.map(function(t){ return '<option value="'+esc(t.id)+'"'+(t.id===filterTeam?' selected':'')+'>'+esc(t.name)+'</option>'; }).join('');
    var fav=ESPN.getFav(), btn=el('cal-myteam');
    if(fav && map[fav.id]){ btn.style.display='inline-flex'; btn.classList.toggle('active', filterTeam===String(fav.id)); }
    else btn.style.display='none';
  }

  el('cal-team').addEventListener('change',function(){ filterTeam=this.value; var fav=ESPN.getFav(); if(fav) el('cal-myteam').classList.toggle('active', filterTeam===String(fav.id)); render(); });
  el('cal-myteam').addEventListener('click',function(){
    var fav=ESPN.getFav(); if(!fav) return;
    filterTeam=(filterTeam===String(fav.id))?'':String(fav.id);
    el('cal-team').value=filterTeam; this.classList.toggle('active', !!filterTeam); render();
  });
  el('cal-ics').addEventListener('click', exportICS);
  el('cal-view-draw').addEventListener('click',function(){ setView('draw'); });
  el('cal-view-matches').addEventListener('click',function(){ setView('matches'); });
  el('cal-next').addEventListener('click',function(){ var a=el('nextMatchAnchor'); if(a) a.scrollIntoView({ behavior:'smooth', block:'center' }); });
  el('cal-body').addEventListener('click',function(e){
    var b=e.target.closest('[data-team]'); if(b && window.LDCClubPanel) LDCClubPanel.open(b.getAttribute('data-team'), { matches:allMatches, standings:standings });
  });

  /* Rafraîchi toutes les 30 s pendant les matchs, toutes les 5 min sinon. */
  function load(){
    if(document.visibilityState==='hidden'){ clearTimeout(timer); timer=setTimeout(load,60000); return; }
    ESPN.fetchSeasonEvents({ ttl:20000 }).then(function(evs){
      events=evs||[];
      allMatches=events.map(ESPN.normalizeEvent).filter(Boolean);
      standings=ESPN.computeStandings(events, ESPN.isArchive()?null:ESPN.leagueClubs(events));
      buildFilter(); render();
      if(window.LDCClubPanel) LDCClubPanel.refresh({ matches:allMatches, standings:standings });
      var live=allMatches.some(function(m){ return m.state==='in'; });
      clearTimeout(timer); if(!ESPN.isArchive()) timer=setTimeout(load, live?30000:300000);
    }).catch(function(){
      if(!allMatches.length) el('cal-body').innerHTML='<div class="empty-state">'+esc(I18N.t('common.offline')||'—')+'</div>';
      clearTimeout(timer); timer=setTimeout(load,60000);
    });
  }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible' && !ESPN.isArchive()) load(); });
  window.addEventListener('ldc:langchange',function(){ applySeasonUI(); buildFilter(); render(); });
  applySeasonUI();
  syncViewUI();
  load();
})();
