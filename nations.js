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
        var n=nat(code); n.clubs.push({ id:id, name:t.name, logo:t.logo, comp:c }); n.comps[c.key]=(n.comps[c.key]||0)+1;
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
      ntPagesT:['Les pages pays','Country pages'], ntRankT:['Classement des nations','Nations ranking'],
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
      return '<a class="nt-page" href="'+PAGES[code]+'">'+flag(code,'nt-pflag')+
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
      var clubs=n.clubs.map(function(x){ return '<button type="button" class="nt-club" data-club="'+esc(x.id)+'" data-comp="'+x.comp.key+'" title="'+esc(x.name+' · '+T(x.comp.E.COMP.fr,x.comp.E.COMP.en))+'" aria-label="'+esc(T('Fiche du club : ','Club card: ')+x.name)+'" style="--c:'+x.comp.color+'">'+crest(x.logo,'nt-clogo')+'</button>'; }).join('');
      var name='<span class="nt-name">'+flag(n.code,'nt-flag')+'<span>'+esc(cname(n.code))+'</span>'+(n.live?'<i class="nt-live" title="'+esc(T('Match en direct','Live match'))+'"></i>':'')+'</span>';
      return '<tr'+(page?' class="has-page"':'')+'>'+
        '<td class="c nt-rk">'+n.rank+'</td>'+
        '<td>'+(page?'<a href="'+page+'">'+name+'</a>':name)+'</td>'+
        '<td><span class="nt-clubs">'+clubs+'</span></td>'+
        '<td class="c hide-s">'+n.pld+'</td><td class="c hide-s w">'+n.w+'</td><td class="c hide-s">'+n.d+'</td><td class="c hide-s l">'+n.l+'</td>'+
        '<td class="c hide-m">'+n.gf+'–'+n.ga+'</td><td class="c">'+n.pts+'</td>'+
        '<td class="r nt-coef"><b>'+f3(n.coef)+'</b><span class="nt-bar"><i style="width:'+Math.max(2,Math.round(n.coef/maxCoef*100))+'%"></i></span></td></tr>';
    }).join('');
    var sync=ESPN.lastSeasonSync&&ESPN.lastSeasonSync();
    el('ntSync').textContent=sync?(I18N.t('sync.espn')||'Synchro ESPN')+' · '+sync.toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'}):'';
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
