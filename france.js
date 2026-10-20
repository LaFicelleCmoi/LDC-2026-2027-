/* =========================================================================
   france.js — Page « Clubs français en Europe » (france.html)
   -------------------------------------------------------------------------
   Les clubs français des trois coupes sur une page : matchs du jour (en
   direct), carte de chaque club (place, bilan, forme, match en cours,
   prochain ou dernier match), bilan commun de la saison, résultats récents
   et prochaines affiches.
   Clubs français : 36 qualifiés LDC (espn.js, pays UEFA) et pays des clubs
   Europa / Conference League (cupclubs2026.js). Données : une instance ESPN
   par compétition (ESPN.forLeague). Clic : fiche club ou fiche de match.
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

  var COMPS=[
    { slug:'uefa.champions', key:'ucl', icon:'logo.svg?v=4', color:'#f5b50a', page:'dashboard.html' },
    { slug:'uefa.europa', key:'uel', icon:'europa.svg?v=2', color:'#ff7a1a', page:'europa.html' },
    { slug:'uefa.europa.conf', key:'uecl', icon:'conference.svg?v=1', color:'#19c44f', page:'conference.html' }
  ];
  var DAY=86400000, timer=null;
  COMPS.forEach(function(c){ c.E=ESPN.forLeague(c.slug); c.matches=[]; c.standings=[]; c.ok=false; });
  function compName(c){ return T(c.E.COMP.fr,c.E.COMP.en); }

  /* Ids des clubs français d'une compétition. */
  function frenchIds(c){
    if(c.key==='ucl') return c.E.qualifiedClubs().filter(function(x){ return x.country==='FRA'; }).map(function(x){ return String(x.id); });
    var m=(window.LDCCupClubs2026||{})[c.slug]||{};
    return Object.keys(m).filter(function(id){ return m[id]==='FRA'; });
  }
  function isFr(c,id){ return c.fr.indexOf(String(id))!==-1; }
  function frMatches(c){ return c.matches.filter(function(m){ return m.round!=='qualifying' && (isFr(c,m.home.teamId)||isFr(c,m.away.teamId)); }); }
  function t(m){ return m.dateObj?m.dateObj.getTime():0; }
  function ordinal(n){ return n+(en()?(n===1?'st':n===2?'nd':n===3?'rd':'th'):(n===1?'er':'e')); }
  function ctxOf(c){ return { matches:c.matches, standings:c.standings, espn:c.E, thresholds:(window.LDCThresholds&&LDCThresholds.forLeague)?LDCThresholds.forLeague(c.slug):null }; }

  /* ---- Ligne de match (matchs du jour, résultats, affiches) ---- */
  function matchRow(c,m,withDate){
    var st=m.state, score;
    if(st==='pre') score='<span class="fr-ko">'+esc(withDate?m.dateObj.toLocaleDateString(loc(),{weekday:'short',day:'numeric',month:'short'})+' · '+hm(m.dateObj):hm(m.dateObj))+'</span>';
    else score='<b class="fr-sc'+(st==='in'?' live':'')+'">'+m.home.score+' – '+m.away.score+'</b>'+(st==='in'?'<span class="fr-min">'+esc(/HT|Half/i.test(m.statusDetail)?T('MT','HT'):(m.displayClock||''))+'</span>':(withDate?'<span class="fr-min">'+esc(m.dateObj.toLocaleDateString(loc(),{day:'numeric',month:'short'}))+'</span>':''));
    function side(x,cls){ return '<span class="fr-side '+cls+(isFr(c,x.teamId)?' fr':'')+'">'+(cls==='h'?'<span class="nm">'+esc(x.name)+'</span>'+crest(x.logo,'fr-mlogo'):crest(x.logo,'fr-mlogo')+'<span class="nm">'+esc(x.name)+'</span>')+'</span>'; }
    return '<button type="button" class="fr-match'+(st==='in'?' is-live':'')+'" data-mp-open="'+esc(m.id)+'" data-mp-league="'+c.slug+'" title="'+esc(T('Fiche du match','Match details'))+'">'+
      '<img class="fr-comp" src="'+c.icon+'" alt="'+esc(compName(c))+'" title="'+esc(compName(c))+'">'+side(m.home,'h')+'<span class="fr-mid">'+score+'</span>'+side(m.away,'a')+'</button>';
  }

  /* ---- Carte d'un club ---- */
  function clubCard(c,id){
    var d=LDCClubPanel.clubData(id, c.matches, c.standings), team=d.team; if(!team) return '';
    var st=d.standing, s=d.summary, r=d.live||d.next||d.last[0];
    var zone=st?{ q:T('Top 8','Top 8'), po:T('Barrages','Play-offs'), out:T('Hors top 24','Outside top 24') }[st.zone]:'';
    var line='';
    if(d.live) line='<span class="fr-pill live"><i></i>'+esc(T('En direct','Live'))+'</span> <b>'+d.live.gf+'–'+d.live.ga+'</b> '+esc((d.live.home?T('vs ','vs '):T('à ','at '))+d.live.opp.name)+' · '+esc(d.live.clock||'');
    else if(d.next) line='<span class="fr-pill">'+esc(T('Prochain','Next'))+'</span> '+esc((d.next.home?T('vs ','vs '):T('à ','at '))+d.next.opp.name)+' · '+esc(new Date(d.next.time).toLocaleDateString(loc(),{weekday:'short',day:'numeric',month:'short'})+' '+hm(new Date(d.next.time)));
    else if(d.last[0]) line='<span class="fr-pill post">'+esc(T('Dernier','Last'))+'</span> <b>'+d.last[0].gf+'–'+d.last[0].ga+'</b> '+esc((d.last[0].home?T('vs ','vs '):T('à ','at '))+d.last[0].opp.name);
    /* Score en direct (sinon dernier résultat) entre le bilan et la forme :
       buts du club d'abord, puis l'adversaire (domicile / extérieur : voir
       la ligne du bas de carte). */
    var sm=d.live||d.last[0], mid='';
    if(sm){
      var op=esc(sm.opp.abbr||sm.opp.name), lv=!!d.live;
      var sc='<b>'+sm.gf+'–'+sm.ga+'</b><i>'+op+'</i>';
      var min=lv?(/HT|Half/i.test(sm.detail||'')?T('MT','HT'):(sm.clock||'')):'';
      /* Score final : vert si le club a gagné, rouge s'il a perdu, blanc si nul. */
      var res=lv?'':(sm.result==='w'?' win':sm.result==='l'?' loss':sm.result==='d'?' draw':'');
      mid='<span class="fr-livesc'+(lv?' live':res)+'" data-mp-open="'+esc(sm.id)+'" data-mp-league="'+c.slug+'" tabindex="0" role="button" title="'+esc(lv?T('En direct — fiche du match','Live — match details'):T('Dernier résultat — fiche du match','Last result — match details'))+'">'+
        (lv?'<span class="fr-ldot" aria-hidden="true"></span>':'')+sc+(min?'<small>'+esc(min)+'</small>':'')+'</span>';
    }
    var form=d.played.filter(function(x){ return x.result; }).slice(0,5).reverse().map(function(x){ return '<span class="cp-badge '+x.result+'">'+(x.result==='w'?T('V','W'):x.result==='d'?T('N','D'):T('D','L'))+'</span>'; }).join('');
    return '<article class="fr-card" style="--c:'+c.color+'">'+
      '<button type="button" class="fr-card-main" data-club="'+esc(id)+'" data-comp="'+c.key+'" aria-label="'+esc(T('Fiche du club : ','Club card: ')+team.name)+'">'+
        crest(team.logo,'fr-crest')+
        '<span class="fr-ctxt"><span class="fr-cname">'+esc(team.name)+'</span>'+
          '<span class="fr-ccomp"><img src="'+c.icon+'" alt="">'+esc(compName(c))+'</span></span>'+
        (st?'<span class="fr-rank"><b>'+st.rank+'<sup>'+esc(ordinal(st.rank).replace(/^\d+/,''))+'</sup></b><small>'+st.pts+' pts · '+esc(zone)+'</small></span>':'')+
      '</button>'+
      '<div class="fr-rec"><span>'+s.pld+' '+esc(T('j.','pl'))+'</span><span class="w">'+s.w+' '+esc(T('V','W'))+'</span><span>'+s.d+' '+esc(T('N','D'))+'</span><span class="l">'+s.l+' '+esc(T('D','L'))+'</span><span>'+s.gf+'–'+s.ga+'</span>'+mid+'<span class="fr-form">'+form+'</span></div>'+
      (line?'<div class="fr-next"'+(r?' data-mp-open="'+esc(r.id)+'" data-mp-league="'+c.slug+'" tabindex="0" role="button"':'')+'>'+line+'</div>':'')+
    '</article>';
  }

  function renderStatic(){
    var X={ frBrand:['Clubs français en Europe','French clubs in Europe'], frTitle:['Clubs français en Europe','French clubs in Europe'],
      navFr:['Clubs français','French clubs'], navSr:['Soirée européenne','European night'], navUcl:['Ligue des Champions','Champions League'], navCmp:['Comparateur','Compare clubs'],
      frClubsT:['Les clubs','The clubs'], frTotT:['La saison des clubs français','The French clubs’ season'],
      frRecT:['Résultats des 7 derniers jours','Results, last 7 days'], frUpT:['Prochaines affiches','Coming up'] };
    Object.keys(X).forEach(function(id){ var n=el(id); if(n) n.textContent=T(X[id][0],X[id][1]); });
    document.title=T('Clubs français en Europe','French clubs in Europe')+' — Tracker';
  }
  function render(){
    renderStatic();
    var loaded=COMPS.filter(function(c){ return c.ok; });
    el('frSub').textContent=T('Les clubs français des trois coupes d’Europe, en direct.','French clubs in the three European competitions, live.');
    /* Aujourd'hui (et en direct) */
    var now=Date.now(), today=new Date().toDateString(), todays=[], recent=[], upcoming=[];
    loaded.forEach(function(c){ frMatches(c).forEach(function(m){
      if(m.state==='in' || (m.dateObj && m.dateObj.toDateString()===today)) todays.push([c,m]);
      else if(m.state==='post' && now-t(m)<7*DAY) recent.push([c,m]);
      else if(m.state==='pre' && t(m)-now<14*DAY) upcoming.push([c,m]);
    }); });
    todays.sort(function(a,b){ return (b[1].state==='in')-(a[1].state==='in') || t(a[1])-t(b[1]); });
    recent.sort(function(a,b){ return t(b[1])-t(a[1]); });
    upcoming.sort(function(a,b){ return t(a[1])-t(b[1]); });
    el('frToday').innerHTML=todays.length?todays.map(function(x){ return matchRow(x[0],x[1],false); }).join('')
      :'<p class="fr-empty">'+esc(T('Pas de club français en coupe d’Europe aujourd’hui.','No French club in European action today.'))+(upcoming[0]?' '+esc(T('Prochain : ','Next: ')+upcoming[0][1].dateObj.toLocaleDateString(loc(),{weekday:'long',day:'numeric',month:'long'})):'')+'</p>';
    el('frTodayT').textContent=todays.some(function(x){ return x[1].state==='in'; })?T('En direct et aujourd’hui','Live and today'):T('Aujourd’hui','Today');
    /* Clubs, par compétition */
    el('frClubs').innerHTML=COMPS.map(function(c){
      if(!c.ok) return '';
      return c.fr.map(function(id){ return clubCard(c,id); }).join('');
    }).join('') || '<p class="fr-empty">'+esc(I18N.t('common.loading')||'…')+'</p>';
    /* Bilan commun */
    var tot={ pld:0, w:0, d:0, l:0, gf:0, ga:0 };
    loaded.forEach(function(c){ c.fr.forEach(function(id){ var s=LDCClubPanel.clubData(id,c.matches,c.standings).summary; ['pld','w','d','l','gf','ga'].forEach(function(k){ tot[k]+=s[k]; }); }); });
    function tile(v,l){ return '<div class="fr-tot"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>'; }
    el('frTotals').innerHTML=tile(loaded.reduce(function(n,c){ return n+c.fr.length; },0),T('clubs engagés','clubs involved'))+tile(tot.pld,T('matchs joués','matches played'))+
      tile(tot.w,T('victoires','wins'))+tile(tot.d,T('nuls','draws'))+tile(tot.l,T('défaites','defeats'))+tile(tot.gf+'–'+tot.ga,T('buts','goals'))+
      tile(tot.pld?Math.round(tot.w/tot.pld*100)+' %':'—',T('de victoires','win rate'));
    el('frRecent').innerHTML=recent.length?recent.map(function(x){ return matchRow(x[0],x[1],true); }).join(''):'<p class="fr-empty">'+esc(T('Aucun match ces 7 derniers jours.','No match in the last 7 days.'))+'</p>';
    el('frUpcoming').innerHTML=upcoming.length?upcoming.map(function(x){ return matchRow(x[0],x[1],true); }).join(''):'<p class="fr-empty">'+esc(T('Aucun match dans les 14 prochains jours.','No match in the next 14 days.'))+'</p>';
    var sync=ESPN.lastSeasonSync&&ESPN.lastSeasonSync();
    el('frSync').textContent=sync?(I18N.t('sync.espn')||'Synchro ESPN')+' · '+sync.toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'}):'';
  }

  el('frClubs').addEventListener('click',function(e){
    var b=e.target.closest('[data-club]'); if(!b) return;
    var c=COMPS.filter(function(x){ return x.key===b.getAttribute('data-comp'); })[0];
    LDCClubPanel.open(b.getAttribute('data-club'), ctxOf(c));
  });

  /* Chargement des trois compétitions ; 30 s pendant les matchs, 5 min sinon. */
  function load(){
    if(document.hidden){ clearTimeout(timer); timer=setTimeout(load,60000); return; }
    Promise.all(COMPS.map(function(c){
      return c.E.fetchSeasonEvents({ ttl:20000 }).then(function(evs){
        c.matches=evs.map(c.E.normalizeEvent).filter(Boolean);
        var seed=c.key==='ucl'?c.E.qualifiedClubs():c.E.leagueClubs(evs);
        c.standings=c.E.computeStandings(evs, seed);
        c.fr=frenchIds(c); c.ok=true;
      }).catch(function(){ if(!c.fr) c.fr=frenchIds(c); });
    })).then(function(){
      render();
      var live=COMPS.some(function(c){ return frMatches(c).some(function(m){ return m.state==='in'; }); });
      clearTimeout(timer); timer=setTimeout(load, live?30000:300000);
    });
  }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) load(); });
  window.addEventListener('ldc:langchange',render);
  COMPS.forEach(function(c){ c.fr=frenchIds(c); });
  load();
})();
