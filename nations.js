/* =========================================================================
   nations.js — Page « Club des Nations » (nations.html)
   -------------------------------------------------------------------------
   Classement des pays sur la saison en cours des trois coupes d'Europe :
   points de matchs façon coefficient UEFA (2 par victoire, 1 par nul, phase
   de ligue et phase finale, hors tours préliminaires et hors bonus de
   participation / de classement), divisés par le nombre de clubs engagés.
   Accès aux pages pays (France, Allemagne, Angleterre, Espagne, Italie).
   Pays des clubs : qualifiés LDC (espn.js) et cupclubs2026.js (UEL, UECL).
   Drapeaux : a.espncdn.com/i/teamlogos/countries/500/{code}.png
   ========================================================================= */
(function(){
  'use strict';
  I18N.mountToggle('#langSwitch');
  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function en(){ return I18N.getLang()==='en'; }
  function T(fr,e){ return en()?e:fr; }
  function loc(){ return en()?'en-GB':'fr-FR'; }

  var COMPS=[
    { slug:'uefa.champions', key:'ucl', icon:'logo.svg?v=4', color:'#f5b50a' },
    { slug:'uefa.europa', key:'uel', icon:'europa.svg?v=2', color:'#ff7a1a' },
    { slug:'uefa.europa.conf', key:'uecl', icon:'conference.svg?v=1', color:'#19c44f' }
  ];
  COMPS.forEach(function(c){ c.E=ESPN.forLeague(c.slug); c.matches=[]; c.standings=[]; c.ok=false; });

  /* Pays UEFA présents dans les phases de ligue 2026-27 : [nom FR, nom EN]. */
  var NAMES={ ALB:['Albanie','Albania'], AND:['Andorre','Andorra'], ARM:['Arménie','Armenia'], AUT:['Autriche','Austria'], AZE:['Azerbaïdjan','Azerbaijan'],
    BEL:['Belgique','Belgium'], BIH:['Bosnie-Herzégovine','Bosnia and Herzegovina'], BUL:['Bulgarie','Bulgaria'], CRO:['Croatie','Croatia'], CYP:['Chypre','Cyprus'],
    CZE:['Tchéquie','Czechia'], DEN:['Danemark','Denmark'], ENG:['Angleterre','England'], ESP:['Espagne','Spain'], FIN:['Finlande','Finland'], FRA:['France','France'],
    GEO:['Géorgie','Georgia'], GER:['Allemagne','Germany'], GIB:['Gibraltar','Gibraltar'], GRE:['Grèce','Greece'], HUN:['Hongrie','Hungary'], ISR:['Israël','Israel'],
    ITA:['Italie','Italy'], KAZ:['Kazakhstan','Kazakhstan'], LTU:['Lituanie','Lithuania'], LVA:['Lettonie','Latvia'], NED:['Pays-Bas','Netherlands'], NOR:['Norvège','Norway'],
    POL:['Pologne','Poland'], POR:['Portugal','Portugal'], ROU:['Roumanie','Romania'], SCO:['Écosse','Scotland'], SRB:['Serbie','Serbia'], SUI:['Suisse','Switzerland'],
    SVK:['Slovaquie','Slovakia'], SVN:['Slovénie','Slovenia'], SWE:['Suède','Sweden'], TUR:['Turquie','Türkiye'], UKR:['Ukraine','Ukraine'] };
  /* Pays qui ont leur page (même gabarit que la page France). */
  var PAGES={ FRA:'france.html', GER:'allemagne.html', ENG:'angleterre.html', ESP:'espagne.html', ITA:'italie.html' };
  function cname(code){ var n=NAMES[code]; return n?T(n[0],n[1]):code; }
  function flag(code,cls){ return '<img class="'+cls+'" src="https://a.espncdn.com/i/teamlogos/countries/500/'+esc(code.toLowerCase())+'.png" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'; }
  function crest(src,cls){ return src?'<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="'+cls+'"></span>'; }
  function isFav(c,id){ return !!(window.LDCFavs && LDCFavs.isFav(c.slug,id)); }
  function f3(x){ return x.toLocaleString(loc(),{ minimumFractionDigits:3, maximumFractionDigits:3 }); }

  /* Pays de chaque club, par compétition : { teamId: code }. */
  function countryMap(c){
    if(c.key==='ucl'){ var o={}; c.E.qualifiedClubs().forEach(function(x){ if(x.country) o[String(x.id)]=x.country; }); return o; }
    return (window.LDCCupClubs2026||{})[c.slug]||{};
  }

  /* Agrégat par pays : clubs, bilan, points (2 V + 1 N), coefficient. */
  function aggregate(){
    var N={};
    function nat(code){ return N[code]||(N[code]={ code:code, clubs:[], ids:{}, pld:0, w:0, d:0, l:0, gf:0, ga:0, pts:0, live:0, comps:{} }); }
    COMPS.forEach(function(c){
      if(!c.ok) return;
      var map=countryMap(c), seen={};
      /* clubs engagés : tous ceux du pays dans la phase de ligue */
      c.matches.forEach(function(m){ if(m.round==='qualifying') return; [m.home,m.away].forEach(function(t){
        var id=String(t.teamId), code=map[id]; if(!code || seen[id]) return; seen[id]=1;
        var n=nat(code), fv=isFav(c,id); n.clubs.push({ id:id, name:t.name, logo:t.logo, comp:c, fav:fv }); n.comps[c.key]=(n.comps[c.key]||0)+1; if(fv) n.fav=true;
      }); });
      c.matches.forEach(function(m){
        if(m.round==='qualifying') return;
        [[m.home,m.away],[m.away,m.home]].forEach(function(p){
          var code=map[String(p[0].teamId)]; if(!code) return; var n=nat(code);
          if(m.state==='in'){ n.live++; return; }
          if(m.state!=='post') return;
          var gf=+p[0].score||0, ga=+p[1].score||0;
          n.pld++; n.gf+=gf; n.ga+=ga;
          /* Règle UEFA : une séance de tirs au but compte comme un nul. */
          if(gf>ga){ n.w++; n.pts+=2; } else if(gf<ga) n.l++; else { n.d++; n.pts+=1; }
        });
      });
    });
    var arr=Object.keys(N).map(function(k){ var n=N[k]; n.coef=n.clubs.length?n.pts/n.clubs.length:0; return n; });
    arr.sort(function(a,b){ return (b.coef-a.coef) || (b.pts-a.pts) || (b.clubs.length-a.clubs.length) || cname(a.code).localeCompare(cname(b.code)); });
    arr.forEach(function(n,i){ n.rank=(i>0 && arr[i-1].coef===n.coef && arr[i-1].pts===n.pts)?arr[i-1].rank:i+1; });
    return arr;
  }

  function renderStatic(){
    var X={ ntTitle:['Club des Nations','Club of Nations'], ntSub:['Le classement des pays sur les trois coupes d’Europe, et leurs clubs.','How each country is doing across the three European competitions, and its clubs.'],
      ntPagesT:['Les pages pays','Country pages'], ntRankT:['Classement des nations','Nations ranking'], ntRaceT:['La course des nations','The nations race'],
      navNt:['Club des Nations','Club of Nations'], navFr:['France','France'], navDe:['Allemagne','Germany'], navEn:['Angleterre','England'], navEs:['Espagne','Spain'], navIt:['Italie','Italy'],
      navSr:['Soirée européenne','European night'], navUcl:['Ligue des Champions','Champions League'], navCmp:['Comparateur','Compare clubs'],
      thNation:['Nation','Nation'], thClubs:['Clubs','Clubs'], thPld:['J','P'], thW:['V','W'], thD:['N','D'], thL:['D','L'], thG:['Buts','Goals'], thPts:['Pts','Pts'], thCoef:['Coef.','Coef.'] };
    Object.keys(X).forEach(function(id){ var n=el(id); if(n) n.textContent=T(X[id][0],X[id][1]); });
    el('ntNote').textContent=T('Coefficient de la saison : 2 points par victoire et 1 par nul en phase de ligue et en phase finale des trois coupes, divisés par le nombre de clubs du pays. Calcul indicatif : sans les tours préliminaires ni les points de bonus de l’UEFA.',
      'Season coefficient: 2 points per win and 1 per draw in the league and knockout phases of the three competitions, divided by the number of clubs from the country. Indicative: qualifying rounds and UEFA bonus points are not included.');
    document.title=T('Club des Nations','Club of Nations')+' — Tracker';
  }

  function render(){
    renderStatic();
    var arr=aggregate();
    /* Pages pays : drapeau, rang, coefficient, clubs, direct */
    el('ntPages').innerHTML=Object.keys(PAGES).map(function(code){
      var n=arr.filter(function(x){ return x.code===code; })[0];
      return '<a class="nt-page" href="'+PAGES[code]+'">'+(n&&n.fav&&window.LDCFavs?LDCFavs.badge():'')+flag(code,'nt-pflag')+
        '<span class="nt-ptxt"><b>'+esc(cname(code))+'</b><small>'+(n?esc(n.clubs.length+' '+T('clubs','clubs')):'—')+'</small>'+
          (n?'<small class="nt-pcoef">'+esc(T('Coef. ','Coef. '))+'<b>'+f3(n.coef)+'</b></small>':'')+'</span>'+
        (n?'<span class="nt-prank">'+n.rank+'<sup>'+esc(en()?(n.rank===1?'st':n.rank===2?'nd':n.rank===3?'rd':'th'):(n.rank===1?'er':'e'))+'</sup></span>':'')+
        (n&&n.live?'<span class="nt-plive"><i></i>'+esc(T('En direct','Live'))+'</span>':'')+'</a>';
    }).join('');
    /* Classement */
    if(!arr.length){ el('ntBody').innerHTML='<tr><td colspan="10" class="nt-empty">'+esc(I18N.t('common.loading')||'…')+'</td></tr>'; return; }
    var maxCoef=arr[0].coef||1;
    el('ntBody').innerHTML=arr.map(function(n){
      var page=PAGES[n.code];
      var clubs=n.clubs.slice().sort(function(a,b){ return b.fav-a.fav; }).map(function(x){ return '<button type="button" class="nt-club'+(x.fav?' is-fav':'')+'" data-club="'+esc(x.id)+'" data-comp="'+x.comp.key+'" title="'+esc(x.name+' · '+T(x.comp.E.COMP.fr,x.comp.E.COMP.en))+'" aria-label="'+esc(T('Fiche du club : ','Club card: ')+x.name)+'" style="--c:'+x.comp.color+'">'+crest(x.logo,'nt-clogo')+'</button>'; }).join('');
      var name='<span class="nt-name">'+flag(n.code,'nt-flag')+'<span>'+esc(cname(n.code))+'</span>'+(n.fav?'<span class="fav-star" style="color:#f5b50a" title="'+esc(T('Pays de mon club','My club’s country'))+'">★</span>':'')+(n.live?'<i class="nt-live" title="'+esc(T('Match en direct','Live match'))+'"></i>':'')+'</span>'+
        '<small class="nt-ncount">'+esc(n.clubs.length+' '+T(n.clubs.length>1?'clubs':'club',n.clubs.length>1?'clubs':'club'))+'</small>';
      return '<tr class="'+(page?'has-page':'')+(n.fav?' is-fav':'')+'">'+
        '<td class="c nt-rk">'+n.rank+'</td>'+
        '<td>'+(page?'<a href="'+page+'">'+name+'</a>':name)+'</td>'+
        '<td class="hide-s"><span class="nt-clubs">'+clubs+'</span></td>'+
        '<td class="c hide-s">'+n.pld+'</td><td class="c hide-s w">'+n.w+'</td><td class="c hide-s">'+n.d+'</td><td class="c hide-s l">'+n.l+'</td>'+
        '<td class="c hide-m">'+n.gf+'–'+n.ga+'</td><td class="c">'+n.pts+'</td>'+
        '<td class="r nt-coef"><b>'+f3(n.coef)+'</b><span class="nt-bar"><i style="width:'+Math.max(2,Math.round(n.coef/maxCoef*100))+'%"></i></span></td></tr>';
    }).join('');
    renderRace(arr);
    var sync=ESPN.lastSeasonSync&&ESPN.lastSeasonSync();
    el('ntSync').textContent=sync?(I18N.t('sync.espn')||'Synchro ESPN')+' · '+sync.toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'}):'';
  }

  /* ---- La course des nations : coefficient cumulé, jour de match par jour
     de match, top 10 animé (translation des lignes + largeur des barres). ---- */
  var COLORS={ FRA:'#3b6fe0', GER:'#ffce00', ENG:'#e8344a', ESP:'#f1bf00', ITA:'#1fae5b', POR:'#d4202e', NED:'#ff7f1f', BEL:'#e8343f', TUR:'#e30a17',
    GRE:'#2f6fd6', SCO:'#2b5fd0', CRO:'#e5333f', UKR:'#ffd500', HUN:'#3aa65a', SUI:'#e53935', AUT:'#ef3340', DEN:'#d61f36', NOR:'#d0283a', CZE:'#2a5bd7',
    POL:'#e22b44', SWE:'#ffcd00', SRB:'#c6363c', CYP:'#e98a2b', ISR:'#2f6fd6', ROU:'#fcd116', BUL:'#2ea05a', AZE:'#36a2d8', KAZ:'#00afca' };
  var race={ steps:[], idx:0, timer:null, rows:{}, played:false, sig:'' };
  var ROW_H=38, TOP=10;
  function dayKey(d){ return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function buildRace(arr){
    var clubsN={}; arr.forEach(function(n){ clubsN[n.code]=n.clubs.length; });
    var ev=[];
    COMPS.forEach(function(c){ if(!c.ok) return; var map=countryMap(c);
      c.matches.forEach(function(m){ if(m.round==='qualifying' || m.state!=='post' || !m.dateObj) return;
        [[m.home,m.away],[m.away,m.home]].forEach(function(p){ var code=map[String(p[0].teamId)]; if(!code) return;
          var gf=+p[0].score||0, ga=+p[1].score||0; ev.push({ t:m.dateObj, code:code, pts:gf>ga?2:(gf===ga?1:0) }); }); }); });
    ev.sort(function(a,b){ return a.t-b.t; });
    var steps=[], cum={}, last=null;
    ev.forEach(function(e){ var k=dayKey(e.t); if(k!==last){ steps.push({ date:e.t, cum:null }); last=k; } cum[e.code]=(cum[e.code]||0)+e.pts; steps[steps.length-1].cum=JSON.parse(JSON.stringify(cum)); });
    steps.forEach(function(st){ st.coef={}; Object.keys(clubsN).forEach(function(code){ st.coef[code]=clubsN[code]?(st.cum[code]||0)/clubsN[code]:0; }); });
    return steps;
  }
  function raceRows(arr){
    var host=el('nrRace'); if(!host) return;
    host.style.height=(TOP*ROW_H)+'px';
    arr.forEach(function(n){
      if(race.rows[n.code]) return;
      var r=document.createElement('div'); r.className='nr-row';
      r.style.setProperty('--nc', COLORS[n.code]||'#8aa4d6');
      r.innerHTML='<span class="nr-rk"></span>'+flag(n.code,'nr-flag')+'<span class="nr-nm"></span><span class="nr-track"><i class="nr-bar"></i></span><b class="nr-val">0,000</b>';
      host.appendChild(r); race.rows[n.code]=r;
    });
    Object.keys(race.rows).forEach(function(code){ race.rows[code].querySelector('.nr-nm').textContent=cname(code); });
  }
  function paintStep(i){
    var st=race.steps[i]; if(!st) return; race.idx=i;
    var codes=Object.keys(race.rows).sort(function(a,b){ return (st.coef[b]||0)-(st.coef[a]||0) || cname(a).localeCompare(cname(b)); });
    var max=st.coef[codes[0]]||1;
    codes.forEach(function(code,k){
      var r=race.rows[code], v=st.coef[code]||0, on=k<TOP;
      r.style.transform='translateY('+(Math.min(k,TOP)*ROW_H)+'px)';
      r.classList.toggle('off', !on);
      r.querySelector('.nr-rk').textContent=k+1;
      r.querySelector('.nr-bar').style.width=Math.max(1.5, v/max*100)+'%';
      r.querySelector('.nr-val').textContent=f3(v);
    });
    el('nrRange').value=i;
    el('nrDate').textContent=st.date.toLocaleDateString(loc(),{ weekday:'short', day:'numeric', month:'long' })+' · '+T('jour ','day ')+(i+1)+'/'+race.steps.length;
  }
  function setPlaying(on){
    var b=el('nrPlay'); clearInterval(race.timer); race.timer=null;
    b.classList.toggle('on',on); b.firstChild.textContent=on?'❚❚':'▶'; b.setAttribute('aria-label',on?T('Pause','Pause'):T('Lecture','Play'));
    if(!on) return;
    if(race.idx>=race.steps.length-1) paintStep(0);
    race.timer=setInterval(function(){ if(race.idx>=race.steps.length-1){ setPlaying(false); return; } paintStep(race.idx+1); }, 1100);
  }
  function renderRace(arr){
    if(!el('nrRace')) return;
    race.steps=buildRace(arr);
    el('ntRaceSub').textContent=T('La saison rejouée jour de match par jour de match (top 10)','The season replayed match day by match day (top 10)');
    var sig=race.steps.length+'|'+arr.length+'|'+(en()?'en':'fr');
    if(!race.steps.length){ el('nrRace').innerHTML='<p class="nt-empty">'+esc(T('La course démarre au premier match.','The race starts with the first match.'))+'</p>'; return; }
    raceRows(arr);
    el('nrRange').max=race.steps.length-1;
    if(sig===race.sig){ paintStep(Math.min(race.idx, race.steps.length-1)); return; }
    var first=!race.sig; race.sig=sig;
    paintStep(race.steps.length-1);
    /* Lecture automatique, une fois, quand la course entre à l'écran. */
    if(first && !RB_REDUCE && 'IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){ if(es[0].isIntersecting && !race.played){ race.played=true; io.disconnect(); paintStep(0); setTimeout(function(){ setPlaying(true); }, 500); } }, { threshold:.35 });
      io.observe(el('nrRace'));
    }
  }
  var RB_REDUCE=false; try{ RB_REDUCE=matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}
  if(el('nrPlay')){
    el('nrPlay').addEventListener('click',function(){ setPlaying(!race.timer); });
    el('nrRange').addEventListener('input',function(){ setPlaying(false); paintStep(+this.value); });
  }

  el('ntBody').addEventListener('click',function(e){
    var b=e.target.closest('[data-club]'); if(!b) return;
    var c=COMPS.filter(function(x){ return x.key===b.getAttribute('data-comp'); })[0];
    LDCClubPanel.open(b.getAttribute('data-club'), { matches:c.matches, standings:c.standings, espn:c.E, thresholds:(window.LDCThresholds&&LDCThresholds.forLeague)?LDCThresholds.forLeague(c.slug):null });
  });

  /* Chargement des trois compétitions ; 30 s pendant les matchs, 5 min sinon. */
  var timer=null;
  function load(){
    if(document.hidden){ clearTimeout(timer); timer=setTimeout(load,60000); return; }
    Promise.all(COMPS.map(function(c){
      return c.E.fetchSeasonEvents({ ttl:20000 }).then(function(evs){
        c.matches=evs.map(c.E.normalizeEvent).filter(Boolean);
        c.standings=c.E.computeStandings(evs, c.key==='ucl'?c.E.qualifiedClubs():c.E.leagueClubs(evs));
        c.ok=true;
      }).catch(function(){});
    })).then(function(){
      render();
      var live=COMPS.some(function(c){ return c.matches.some(function(m){ return m.state==='in'; }); });
      clearTimeout(timer); timer=setTimeout(load, live?30000:300000);
    });
  }
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) load(); });
  window.addEventListener('ldc:langchange',render);
  renderStatic(); load();
})();
