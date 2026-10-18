/* =========================================================================
   cup.js — Accueil des coupes européennes (Europa League, Conference League)
   UN SEUL script pour les deux pages (europa.html, conference.html) : la
   compétition vient de espn.js (window.LDC_LEAGUE). Journée en cours avec
   scores en direct, classement par zones dynamique (recherche, pays,
   simulateur de scores), meilleurs joueurs, chiffres de la saison, défilé
   des logos, club favori. Tout vient du calendrier ESPN de la saison ; la
   fiche club est celle du classement (clubpanel.js).
   ========================================================================= */
(function(){
  'use strict';
  I18N.mountToggle('#langSwitch');

  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function en(){ return I18N.getLang()==='en'; }
  function T(fr,e){ return en()?e:fr; }
  function loc(){ return en()?'en-GB':'fr-FR'; }
  var COMP=ESPN.COMP;
  function compName(){ return T(COMP.fr,COMP.en); }

  var DAY=86400000;
  var events=[], matches=[], standings=[], groups=[], cur=null, picked=false, timer=null;

  /* ---- Groupes : journées de phase de ligue, puis tours à élimination ---- */
  var ROUND={ po:['Barrages','Play-offs'], r16:['Huitièmes','Round of 16'], qf:['Quarts','Quarter-finals'], sf:['Demies','Semi-finals'], final:['Finale','Final'] };
  function buildGroups(ms){
    var out=[];
    ESPN.clusterMatchdays(ms.filter(function(m){ return m.round==='league'; })).forEach(function(g,i){
      out.push({ label:[ 'Journée '+(i+1), 'Matchday '+(i+1) ], ms:g });
    });
    ESPN.ROUND_ORDER.forEach(function(r){
      var legs=ESPN.clusterMatchdays(ms.filter(function(m){ return m.round===r; }));
      legs.forEach(function(g,i){
        var two=legs.length>1;
        out.push({ label:[ ROUND[r][0]+(two?(i?' · retour':' · aller'):''), ROUND[r][1]+(two?(i?' · 2nd leg':' · 1st leg'):'') ], ms:g });
      });
    });
    return out;
  }
  function t(m){ return m.dateObj?m.dateObj.getTime():0; }
  /* Journée affichée d'office : celle d'un match en cours ; sinon la
     dernière jouée pendant 36 h après son dernier match ; sinon la prochaine. */
  function defaultGroup(){
    var now=Date.now(), i;
    for(i=0;i<groups.length;i++) if(groups[i].ms.some(function(m){ return m.state==='in'; })) return i;
    for(i=0;i<groups.length;i++){
      var g=groups[i].ms;
      if(g.some(function(m){ return m.state==='pre'; })){
        var prev=groups[i-1];
        if(prev && now-Math.max.apply(null,prev.ms.map(t))<36*3600000 && t(g[0])-now>DAY) return i-1;
        return i;
      }
    }
    return groups.length-1;
  }

  /* ---- Rendu de la journée ---- */
  function dayKey(m){ return m.dateObj?m.dateObj.toDateString():''; }
  /* Carte de match : même dessin que l'accueil LDC (dashboard.html) — pastille
     d'état et minute ou compte à rebours, domicile EN HAUT, extérieur en bas,
     scores à droite, heure en pied. Un clic sur un club ouvre sa fiche. */
  var lastScores={};
  function pad(n){ return n<10?'0'+n:''+n; }
  function hm(d){ return d?pad(d.getHours())+':'+pad(d.getMinutes()):''; }
  function countdown(d){
    var ms=d.getTime()-Date.now(); if(ms<=0) return "0'";
    var s=Math.floor(ms/1000), h=Math.floor(s/3600), mm=Math.floor((s%3600)/60);
    return (h>0?h+':':'')+pad(mm)+':'+pad(s%60);
  }
  /* Moins de 7 jours : compte à rebours ; au-delà : date et heure. */
  function upcomingWhen(d){
    if(!d) return '—';
    if(d.getTime()-Date.now()<=7*DAY) return countdown(d);
    return d.toLocaleDateString(loc(),{day:'numeric',month:'short'})+' · '+hm(d);
  }
  function clockHTML(m){
    if(m.state==='post') return 'FT';
    if(/HT|Half/i.test(m.statusDetail)) return esc(T('MT','HT'));
    var dc=m.displayClock||''; if(!dc) return "0'";
    var i=dc.indexOf('+'); if(i===-1) return esc(dc);
    return esc(dc.slice(0,i))+'<span class="extra">'+esc(dc.slice(i))+'</span>';
  }
  /* Mosaïque de l'accueil LDC : 1 match plein écran, 2 côte à côte, sinon une
     grande carte, deux larges puis des petites. */
  function sizeFor(i,n){ if(n===1) return 'size-full'; if(n===2) return 'size-wide'; if(i===0) return 'size-featured'; if(i<3) return 'size-wide'; return 'size-small'; }
  function card(m,size,i){
    var st=m.state, lbl=st==='in'?I18N.t('common.live'):(st==='pre'?I18N.t('common.upcoming'):I18N.t('common.finished'));
    if(ESPN.isInterrupted(m)) lbl='⏸ '+m.statusDetail;
    var fid=favId(), hasFav=fid && (String(m.home.teamId)===fid || String(m.away.teamId)===fid);
    var pen=(m.home.shootout!=null && m.away.shootout!=null);
    var key=m.home.score+'-'+m.away.score, bump=st==='in' && lastScores[m.id] && lastScores[m.id]!==key;
    lastScores[m.id]=key;
    function row(c){
      var win=st==='post' && c.winner, fav=fid && String(c.teamId)===fid;
      return '<button type="button" class="live-team-row'+(win?' winner':'')+(fav?' is-fav':'')+'" data-team="'+esc(c.teamId)+'" aria-label="'+esc(T('Fiche du club : ','Club card: ')+c.name)+'">'+
        (c.logo?'<img class="live-team-logo" src="'+esc(c.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="live-team-logo"></span>')+
        '<span class="live-team-name">'+(fav?'<span class="uf-star" aria-hidden="true">★</span>':'')+esc(c.name)+'</span>'+
        '<span class="live-team-score'+(bump?' bumped':'')+'">'+(st==='pre'?'–':c.score)+(pen?' <span class="pen-sub">('+c.shootout+')</span>':'')+'</span></button>';
    }
    var clock = st==='pre'
      ? '<span class="live-card-clock live-countdown"'+(m.dateObj?' data-kickoff="'+m.dateObj.getTime()+'"':'')+'>'+esc(upcomingWhen(m.dateObj))+'</span>'
      : '<span class="live-card-clock">'+clockHTML(m)+'</span>';
    return '<article class="live-card state-'+st+' '+size+(hasFav?' has-fav':'')+(st==='pre'?' can-sim':'')+(sims[m.id]?' is-simmed':'')+'" data-id="'+esc(m.id)+'" style="animation-delay:'+(0.03+Math.min(i,12)*0.04).toFixed(2)+'s">'+
      '<div class="live-shimmer"></div>'+
      '<div class="live-card-status"><span class="live-status-pill state-'+st+'"><span class="live-dot"></span> '+esc(lbl)+'</span>'+clock+'</div>'+
      '<div class="live-card-teams">'+row(m.home)+row(m.away)+'</div>'+
      '<div class="live-card-footer"><span>'+(pen?'<span class="live-pen">'+esc(I18N.t('common.pen'))+' '+m.home.shootout+'–'+m.away.shootout+'</span>':'')+'</span>'+
        '<span class="live-kickoff">'+esc(st==='pre'?hm(m.dateObj):(m.statusDetail||''))+'</span></div>'+
    '</article>';
  }
  function hour(m){ return m.dateObj?m.dateObj.toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'}):''; }
  function dayTitle(m){ return m.dateObj?m.dateObj.toLocaleDateString(loc(),{weekday:'long',day:'numeric',month:'long'}):'—'; }

  function renderDay(){
    var grid=el('mdGrid');
    if(!groups.length){
      grid.innerHTML='<div class="empty-state">'+esc(T('Aucun match publié par ESPN pour cette saison.','ESPN has not published any match for this season yet.'))+'</div>';
      el('mdLabel').textContent='—'; el('mdPrev').disabled=el('mdNext').disabled=true; return;
    }
    var g=groups[cur], ms=g.ms.slice().sort(function(a,b){ return t(a)-t(b) || a.home.name.localeCompare(b.home.name); });
    var first=ms[0], last=ms[ms.length-1];
    var range=dayKey(first)===dayKey(last) ? dayTitle(first)
      : first.dateObj.toLocaleDateString(loc(),{day:'numeric',month:'short'})+' – '+last.dateObj.toLocaleDateString(loc(),{day:'numeric',month:'short'});
    el('mdLabel').innerHTML=esc(T(g.label[0],g.label[1]))+'<span class="md-dates">'+esc(range)+'</span>';
    el('mdPrev').disabled=cur<=0; el('mdNext').disabled=cur>=groups.length-1;
    /* Un bloc par jour ; dans chaque jour, les matchs en cours d'abord (la
       grande carte), puis l'ordre des coups d'envoi. */
    var days=[], byDay={};
    ms.forEach(function(m){ var k=dayKey(m); if(!byDay[k]){ byDay[k]=[]; days.push(k); } byDay[k].push(m); });
    var html='', multi=days.length>1;
    days.forEach(function(k){
      var list=byDay[k].slice().sort(function(a,b){ return (b.state==='in')-(a.state==='in') || t(a)-t(b) || a.home.name.localeCompare(b.home.name); });
      if(multi) html+='<h3 class="lc-day">'+esc(dayTitle(list[0]))+'</h3>';
      list.forEach(function(m,i){ html+=card(m, sizeFor(i,list.length), i); });
    });
    /* Animation d'entrée au changement de journée seulement, pas à chaque
       rafraîchissement des scores. */
    grid.classList.toggle('no-anim', grid.getAttribute('data-md')===String(cur));
    grid.setAttribute('data-md', String(cur));
    grid.innerHTML=html;
    /* Les scores simulés survivent au rafraîchissement : on rouvre leurs éditeurs. */
    Object.keys(sims).forEach(function(id){
      var c=grid.querySelector('.live-card[data-id="'+id+'"]'); if(c) openSimEditor(c, sims[id].match, true);
    });
  }

  /* ---- Classement par zones : même bloc que l'accueil LDC ----
     Trois colonnes (1-8 huitièmes, 9-24 barrages, 25-36 éliminés), recherche
     et filtre par pays sans re-rendu, simulateur « et si ? » : un score saisi
     sur un match à venir recalcule le classement avec le moteur
     réglementaire (simulate.js) et montre les places gagnées ou perdues.
     Pas de filtre par chapeau : ESPN ne publie pas ceux de cette coupe. */
  var CO={ ALB:['Albanie','Albania'], AND:['Andorre','Andorra'], ARM:['Arménie','Armenia'], AUT:['Autriche','Austria'], AZE:['Azerbaïdjan','Azerbaijan'],
    BEL:['Belgique','Belgium'], BIH:['Bosnie-Herzégovine','Bosnia and Herzegovina'], BUL:['Bulgarie','Bulgaria'], CRO:['Croatie','Croatia'], CYP:['Chypre','Cyprus'],
    CZE:['Tchéquie','Czechia'], DEN:['Danemark','Denmark'], ENG:['Angleterre','England'], ESP:['Espagne','Spain'], FIN:['Finlande','Finland'], FRA:['France','France'],
    GEO:['Géorgie','Georgia'], GER:['Allemagne','Germany'], GIB:['Gibraltar','Gibraltar'], GRE:['Grèce','Greece'], HUN:['Hongrie','Hungary'], ISR:['Israël','Israel'],
    ITA:['Italie','Italy'], KAZ:['Kazakhstan','Kazakhstan'], LTU:['Lituanie','Lithuania'], LVA:['Lettonie','Latvia'], NED:['Pays-Bas','Netherlands'], NOR:['Norvège','Norway'],
    POL:['Pologne','Poland'], POR:['Portugal','Portugal'], ROU:['Roumanie','Romania'], SCO:['Écosse','Scotland'], SRB:['Serbie','Serbia'], SUI:['Suisse','Switzerland'],
    SVN:['Slovénie','Slovenia'], SWE:['Suède','Sweden'], TUR:['Turquie','Türkiye'], UKR:['Ukraine','Ukraine'] };
  function coName(c){ var e=CO[c]; return e?T(e[0],e[1]):(c||''); }
  function countryOf(id){ var m=window.LDCCupClubs2026 && LDCCupClubs2026[ESPN.LEAGUE_SLUG]; return (m && m[String(id)])||''; }
  function fold(x){ return String(x||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
  var zFilter={ q:'', co:'' }, sims={}, viewById={};

  function simCount(){ return Object.keys(sims).length; }
  function displayStandings(){
    if(!simCount() || !window.LDCSim) return standings;
    var seed=ESPN.isArchive()?null:ESPN.leagueClubs(events);
    return LDCSim.simulateStandings(standings, Object.keys(sims).map(function(k){ return sims[k]; }), {
      matches: ESPN.leagueMatches(events),
      rank: function(ms){ return ESPN.rankLeagueMatches(ms, seed); }
    });
  }
  function matchesFilter(row){
    if(zFilter.co && countryOf(row.teamId)!==zFilter.co) return false;
    if(zFilter.q){
      var hay=fold(row.name)+' '+fold(row.abbr)+' '+fold(row.shortName)+' '+fold(coName(countryOf(row.teamId)));
      if(hay.indexOf(fold(zFilter.q))===-1) return false;
    }
    return true;
  }
  /* Applique le filtre sans re-rendre : seules les classes des lignes changent. */
  function applyZoneFilter(){
    var rows=document.querySelectorAll('#zonesGrid .zone-team[data-team]'), hits=0, active=!!(zFilter.q||zFilter.co);
    for(var i=0;i<rows.length;i++){
      var row=viewById[rows[i].getAttribute('data-team')], ok=!active || (row && matchesFilter(row));
      rows[i].classList.toggle('zt-dim', active && !ok);
      rows[i].classList.toggle('zt-hit', active && ok);
      if(active && ok) hits++;
    }
    el('zhits').textContent=active?(hits+' / '+rows.length):'';
    el('zqClear').style.display=zFilter.q?'block':'none';
  }
  function buildCountrySelect(){
    var sel=el('zco'), codes={};
    standings.forEach(function(r){ var c=countryOf(r.teamId); if(c) codes[c]=1; });
    var list=Object.keys(codes).sort(function(a,b){ return coName(a).localeCompare(coName(b)); });
    sel.innerHTML='<option value="">'+esc(I18N.t('zbar.allCountries'))+'</option>'+
      list.map(function(c){ return '<option value="'+c+'"'+(zFilter.co===c?' selected':'')+'>'+esc(coName(c))+'</option>'; }).join('');
    sel.style.display=list.length?'':'none';
  }
  function renderSimBar(){
    var bar=el('simbar'), n=simCount();
    bar.style.display=n?'flex':'none';
    if(n) bar.querySelector('.simbar-t').innerHTML='🔮 '+esc(T('Simulation en cours — ','Simulation active — '))+'<b>'+n+'</b> '+
      esc(n>1?T('matchs simulés','matches simulated'):T('match simulé','match simulated'));
    el('simReset').textContent=I18N.t('sim.reset');
  }
  function renderZones(){
    var grid=el('zonesGrid'), fid=favId(), view=displayStandings(), simOn=simCount()>0;
    viewById={}; view.forEach(function(r){ viewById[String(r.teamId)]=r; });
    var sync=ESPN.lastSeasonSync&&ESPN.lastSeasonSync();
    el('zonesSync').textContent=sync?(I18N.t('sync.espn')||'Synchro ESPN')+' · '+sync.toLocaleString(loc(),{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
    el('zonesTitle').textContent=I18N.t('dash.zonesTitle2');
    el('zq').placeholder=I18N.t('zbar.search');
    if(!view.length){ grid.innerHTML='<div class="empty-state" style="grid-column:1/-1">'+esc(T('Le classement démarre avec la 1re journée.','The table starts with matchday 1.'))+'</div>'; return; }
    var defs=[{cls:'z-q',key:'dash.zoneQ',from:0,to:8},{cls:'z-po',key:'dash.zonePO',from:8,to:24},{cls:'z-out',key:'dash.zoneOut',from:24,to:36}];
    grid.innerHTML=defs.map(function(d){
      var rows=view.slice(d.from,d.to).map(function(r){
        var isFav=fid && String(r.teamId)===fid, mv='', mvCls='';
        /* Mouvement chiffré pour toute équipe qui bouge ; surlignage réservé à
           l'équipe du match simulé ou à celle qui change de zone. */
        if(simOn && r.delta!=null){
          var notable=r.simulated || LDCSim.changedZone(r);
          if(r.delta>0){ mv='<span class="zt-delta up">📈 +'+r.delta+'</span>'; if(notable) mvCls=' sim-up'; }
          else if(r.delta<0){ mv='<span class="zt-delta down">📉 '+r.delta+'</span>'; if(notable) mvCls=' sim-down'; }
          else mv='<span class="zt-delta flat">–</span>';
        }
        var live=!simOn && r.live ? '<span class="dot live" title="'+esc(I18N.t('common.live'))+'"></span>' : '';
        return '<div class="zone-team'+(isFav?' is-fav':'')+mvCls+'" data-team="'+esc(r.teamId)+'" tabindex="0" role="button" aria-label="'+esc(T('Fiche du club : ','Club card: ')+r.name)+'">'+
          '<span class="rk">'+(r.rank||r.pos)+'</span>'+
          (r.logo?'<img src="'+esc(r.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span style="width:22px"></span>')+
          '<span class="nm">'+(isFav?'<span class="uf-star" aria-hidden="true">★</span>':'')+esc(r.name)+'</span>'+live+mv+'<span class="pts">'+r.pts+'</span></div>';
      }).join('') || '<div class="zone-team"><span class="nm muted">—</span></div>';
      return '<div class="zone-card '+d.cls+'"><div class="zone-head">'+esc(I18N.t(d.key))+'</div><div class="zone-list">'+rows+'</div></div>';
    }).join('');
    var TH=window.LDCThresholds;
    el('zonesNote').textContent=TH ? T('Repères : le 8e avait '+TH.trend('top8')+' ; le 24e '+TH.trend('top24')+'. Clique sur un match à venir pour simuler son score.',
                                       'For reference: 8th place had '+TH.trend('top8',true)+'; 24th had '+TH.trend('top24',true)+'. Click an upcoming match to simulate its score.') : '';
    applyZoneFilter();
  }
  function refreshSimulation(){
    renderSimBar(); renderZones();
    Array.prototype.forEach.call(document.querySelectorAll('.live-card[data-id]'),function(c){ c.classList.toggle('is-simmed', !!sims[c.getAttribute('data-id')]); });
  }
  function debounce(fn,ms){ var tm; return function(){ var a=arguments, th=this; clearTimeout(tm); tm=setTimeout(function(){ fn.apply(th,a); },ms); }; }
  function setSim(m,hg,ag){
    if(hg===''||ag===''||hg==null||ag==null) delete sims[m.id]; else sims[m.id]={ match:m, hg:hg, ag:ag };
    refreshSimulation();
  }
  /* Éditeur de score injecté dans la carte du match à venir. */
  function openSimEditor(card, m, quiet){
    if(card.querySelector('.sim-editor')) return;
    var curS=sims[m.id], box=document.createElement('div');
    box.className='sim-editor';
    box.innerHTML='<input type="number" min="0" max="99" inputmode="numeric" value="'+(curS?curS.hg:'')+'" aria-label="'+esc(m.home.name)+'">'+
      '<span class="sim-sep">-</span>'+
      '<input type="number" min="0" max="99" inputmode="numeric" value="'+(curS?curS.ag:'')+'" aria-label="'+esc(m.away.name)+'">'+
      '<button class="sim-x" type="button" title="'+esc(I18N.t('sim.clear'))+'" aria-label="'+esc(I18N.t('sim.clear'))+'">×</button>';
    card.appendChild(box);
    var ins=box.querySelectorAll('input'), push=debounce(function(){ setSim(m, ins[0].value, ins[1].value); },180);
    ins[0].addEventListener('input',push); ins[1].addEventListener('input',push);
    box.querySelector('.sim-x').addEventListener('click',function(){ delete sims[m.id]; box.remove(); refreshSimulation(); });
    if(!quiet) ins[0].focus();
  }
  el('mdGrid').addEventListener('click',function(e){
    var c=e.target.closest('.live-card.can-sim'); if(!c || e.target.closest('[data-team]') || e.target.closest('.sim-editor')) return;
    var m=matches.filter(function(x){ return String(x.id)===c.getAttribute('data-id'); })[0];
    if(m && m.state==='pre') openSimEditor(c,m);
  });
  el('simReset').addEventListener('click',function(){
    sims={}; Array.prototype.forEach.call(document.querySelectorAll('.sim-editor'),function(b){ b.remove(); }); refreshSimulation();
  });
  (function bindZoneBar(){
    var input=el('zq'), run=debounce(function(){ zFilter.q=input.value.trim(); applyZoneFilter(); },220);
    input.addEventListener('input',run);
    input.addEventListener('keydown',function(e){ if(e.key==='Escape'){ input.value=''; zFilter.q=''; applyZoneFilter(); } });
    el('zqClear').addEventListener('click',function(){ input.value=''; zFilter.q=''; applyZoneFilter(); input.focus(); });
    el('zco').addEventListener('change',function(){ zFilter.co=this.value; applyZoneFilter(); });
    el('zonesGrid').addEventListener('click',function(e){ var r=e.target.closest('.zone-team[data-team]'); if(r) openClub(r.getAttribute('data-team')); });
    el('zonesGrid').addEventListener('keydown',function(e){
      if(e.key!=='Enter' && e.key!==' ') return;
      var r=e.target.closest('.zone-team[data-team]'); if(!r || e.target!==r) return;
      e.preventDefault(); openClub(r.getAttribute('data-team'));
    });
  })();

  /* ---- Défilé des logos (comme l'accueil LDC) : les 36 clubs, clic -> fiche ---- */
  var marqueeKey='';
  function renderMarquee(){
    var clubs=ESPN.leagueClubs(events), fid=favId();
    var key=clubs.map(function(c){ return c.id; }).join(',')+'|'+fid+'|'+(en()?'en':'fr');
    el('loopLabel').textContent=I18N.t('dash.marqueeLabel');
    if(!clubs.length || key===marqueeKey) return;          // pas de re-rendu : le défilé ne saute pas
    marqueeKey=key;
    var chip=function(c, hidden){ return '<button type="button" class="crest-chip'+(fid && c.id===fid?' is-fav':'')+'" data-team="'+esc(c.id)+'"'+
      (hidden?' tabindex="-1" aria-hidden="true"':' aria-label="'+esc(T('Fiche du club : ','Club card: ')+c.name)+'"')+'>'+
      (c.logo?'<img src="'+esc(c.logo)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+'<span>'+esc(c.abbr||c.name)+'</span></button>'; };
    el('loopTrack').innerHTML=clubs.map(function(c){ return chip(c,false); }).join('')+clubs.map(function(c){ return chip(c,true); }).join('');   // doublé : boucle infinie
  }
  el('loopTrack').addEventListener('click',function(e){ var b=e.target.closest('[data-team]'); if(b) openClub(b.getAttribute('data-team')); });

  /* ---- Chiffres de la saison (calculés sur les matchs terminés) ---- */
  function renderStats(){
    var done=matches.filter(function(m){ return m.state==='post'; });
    var host=el('statsBody');
    if(!done.length){ host.innerHTML='<div class="empty-state">'+esc(T('Pas encore de match terminé.','No finished match yet.'))+'</div>'; el('statsNote').textContent=''; return; }
    var goals=0, hw=0, dr=0, aw=0, big=null;
    done.forEach(function(m){
      var h=m.home.score, a=m.away.score; goals+=h+a;
      if(h>a) hw++; else if(h<a) aw++; else dr++;
      var d=Math.abs(h-a);
      if(!big || d>big.d || (d===big.d && h+a>big.g)) big={ d:d, g:h+a, m:m };
    });
    function pct(n){ return Math.round(n*100/done.length)+' %'; }
    function tile(v,l,cls){ return '<div class="cup-stat'+(cls?' '+cls:'')+'"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>'; }
    var bm=big.m, bw=bm.home.score>=bm.away.score;
    host.innerHTML=
      tile(done.length, T('matchs joués','matches played'))+
      tile(goals, T('buts','goals'))+
      tile((goals/done.length).toLocaleString(loc(),{maximumFractionDigits:2}), T('buts par match','goals per match'))+
      tile(pct(hw)+' · '+pct(dr)+' · '+pct(aw), T('domicile · nul · extérieur','home · draw · away'))+
      tile((bw?bm.home.name:bm.away.name)+' '+Math.max(bm.home.score,bm.away.score)+'–'+Math.min(bm.home.score,bm.away.score)+' '+(bw?bm.away.name:bm.home.name),
           T('plus large victoire','biggest win')+' · '+bm.dateObj.toLocaleDateString(loc(),{day:'numeric',month:'short'}), 'wide');
    el('statsNote').textContent=T('Calculé sur les matchs terminés du calendrier ESPN, toutes phases confondues.','Computed from the finished matches in the ESPN schedule, all rounds included.');
  }

  function renderStatic(){
    el('heroSub').textContent=T('Scores en direct, journée en cours et classement de la phase de ligue.','Live scores, current matchday and league phase table.');
    el('seasonChip').textContent=ESPN.seasonLabel();
    el('ctaTable').textContent=T('Classement complet →','Full table →');
    el('ctaUcl').textContent=T('← Ligue des Champions','← Champions League');
    el('mdTitle').textContent=T('Matchs','Matches');
    el('statsTitle').textContent=T('La saison en chiffres','The season in numbers');
    el('mdPrev').setAttribute('aria-label',T('Journée précédente','Previous matchday'));
    el('mdNext').setAttribute('aria-label',T('Journée suivante','Next matchday'));
    var sync=ESPN.lastSeasonSync&&ESPN.lastSeasonSync();
    el('mdSync').textContent=sync?(I18N.t('sync.espn')||'Synchro ESPN')+' · '+sync.toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';
  }
  function renderAll(){ renderStatic(); renderFav(); if(groups.length || matches.length){ renderDay(); buildCountrySelect(); renderSimBar(); renderZones(); renderStats(); renderPlayers(); renderMarquee(); } }

  /* ---- Top buteurs, passeurs et murailles (comme l'accueil LDC) ----
     Buteurs et passeurs : agrégés depuis les résumés des matchs terminés
     (ESPN.fetchScorerBoard), PAS depuis /statistics, faux entre deux
     recalculs ; chaque résumé est gardé dans le navigateur, seul un match
     nouvellement terminé coûte une requête. Murailles : matchs de phase de
     ligue sans but encaissé (ESPN.computeCleanSheets). */
  var TOP_N=5, board={ goals:null, assists:null }, boardKey=null, boardBusy=false;
  function clubOf(id){
    for(var i=0;i<matches.length;i++){ var m=matches[i];
      if(String(m.home.teamId)===String(id)) return m.home;
      if(String(m.away.teamId)===String(id)) return m.away; }
    return null;
  }
  function wRow(rank, logo, name, sub, value, teamId){
    var fav=teamId && String(teamId)===favId();
    return '<div class="wrow'+(fav?' is-fav':'')+'"><span class="wrow-rk">'+rank+'</span>'+
      '<span class="wrow-crest">'+(logo?'<img src="'+esc(logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'')+'</span>'+
      '<span class="wrow-id"><span class="wrow-nm">'+esc(name)+'</span><span class="wrow-tm">'+(fav?'★ ':'')+esc(sub)+'</span></span>'+
      '<span class="wrow-v">'+value+'</span></div>';
  }
  function wCard(cls, ico, title, rows, empty){
    return '<div class="wcard '+cls+'"><div class="wcard-head"><span class="wcard-ico" aria-hidden="true">'+ico+'</span>'+esc(title)+'</div>'+
      (rows||'<div class="wcard-empty">'+esc(empty)+'</div>')+'</div>';
  }
  function playerRows(list){
    return (list||[]).slice(0,TOP_N).map(function(p,i){
      var c=clubOf(p.teamId);
      return wRow(i+1, c?c.logo:'', p.name, c?(c.abbr||c.name):'', p.value, p.teamId);
    }).join('');
  }
  function renderPlayers(){
    var host=el('wgrid'); if(!host) return;
    var pending=board.goals===null;
    var empty=pending?T('Calcul en cours…','Loading…'):I18N.t('wg.empty');
    var cs=ESPN.computeCleanSheets(events).filter(function(x){ return x.cs>0; }).slice(0,TOP_N);
    host.innerHTML=
      wCard('w-goals','⚽',I18N.t('wg.scorers'), playerRows(board.goals), empty)+
      wCard('w-assists','🅰️',I18N.t('wg.assists'), playerRows(board.assists), empty)+
      wCard('w-cs','🧱',I18N.t('wg.cleansheets'), cs.map(function(x,i){
        return wRow(i+1, x.logo, x.name, T('encaissés ','conceded ')+x.ga+' · '+x.pld+T(' j',' pl'), x.cs, x.teamId); }).join(''), I18N.t('wg.empty'));
    el('wgTitle').textContent=T('Les meilleurs de la saison','Season leaders');
    el('wgNote').textContent=T('Buts et passes relevés dans le résumé ESPN de chaque match terminé, toutes phases confondues.',
                               'Goals and assists taken from the ESPN summary of every finished match, all rounds included.');
  }
  function loadPlayers(){
    var done=matches.filter(function(m){ return m.state==='post'; });
    var key=done.map(function(m){ return m.id; }).sort().join(',');
    if(boardBusy || key===boardKey) return;
    if(!done.length){ board={ goals:[], assists:[] }; boardKey=key; renderPlayers(); return; }
    boardBusy=true;
    function apply(b){ board={ goals:b.goals, assists:b.assists }; renderPlayers(); }
    ESPN.fetchScorerBoard(done,{ onProgress:apply }).then(function(b){ apply(b); boardKey=key; })
      .catch(function(){ if(board.goals===null){ board={ goals:[], assists:[] }; renderPlayers(); } })
      .then(function(){ boardBusy=false; });
  }

  /* ---- Club favori : propre à chaque compétition (clé dédiée dans espn.js) ---- */
  function favId(){ var f=ESPN.getFav(); return f?String(f.id):null; }
  function applyFavAccent(){ var a=ESPN.favAccent(), r=document.documentElement; if(a) r.style.setProperty('--fav-rgb',a); else r.style.removeProperty('--fav-rgb'); }
  /* Match à mettre en avant : en cours, sinon le prochain, sinon le dernier. */
  function favMatch(id){
    var mine=matches.filter(function(m){ return String(m.home.teamId)===id || String(m.away.teamId)===id; });
    var live=mine.filter(function(m){ return m.state==='in'; })[0]; if(live) return live;
    var next=mine.filter(function(m){ return m.state==='pre'; }).sort(function(a,b){ return t(a)-t(b); })[0]; if(next) return next;
    return mine.filter(function(m){ return m.state==='post'; }).sort(function(a,b){ return t(b)-t(a); })[0] || null;
  }
  function favStatus(id){
    var m=favMatch(id);
    if(!m) return '<span class="uf-muted">'+esc(T('Aucun match au calendrier pour l’instant.','No match scheduled yet.'))+'</span>';
    var home=String(m.home.teamId)===id, me=home?m.home:m.away, opp=home?m.away:m.home;
    var logo=opp.logo?'<img class="uf-olog" src="'+esc(opp.logo)+'" alt="" onerror="this.remove()">':'';
    var who=esc(home?T('vs','vs'):T('chez','at'))+' '+logo+esc(opp.name);
    if(m.state==='in') return '<span class="uf-pill live"><i></i>'+esc(I18N.t('common.live'))+'</span> <b class="uf-score">'+me.score+'–'+opp.score+'</b> '+who+' · '+esc(/HT|Half/i.test(m.statusDetail)?T('Mi-temps','Half-time'):(m.displayClock||m.statusDetail));
    if(m.state==='pre') return '<span class="uf-pill">'+esc(T('Prochain match','Next match'))+'</span> '+who+' · '+esc(dayTitle(m)+' · '+hour(m));
    return '<span class="uf-pill post">'+esc(T('Dernier match','Last match'))+'</span> <b class="uf-score">'+me.score+'–'+opp.score+'</b> '+who;
  }
  function renderFav(){
    applyFavAccent();
    var host=el('favSection'), f=ESPN.getFav();
    host.setAttribute('aria-label',T('Club favori','Favourite club'));
    if(!f){
      host.innerHTML='<div class="uf-card"><span class="uf-bigstar" aria-hidden="true">★</span><div class="uf-txt">'+
        '<div class="uf-name sm">'+esc(T('Suis ton club en '+compName(),'Follow your '+compName()+' club'))+'</div>'+
        '<div class="uf-status">'+esc(T('Ses matchs et sa place mis en avant sur l’accueil et dans le classement.','Its matches and position highlighted on the home page and in the table.'))+'</div></div>'+
        '<div class="uf-actions"><button type="button" class="uf-btn primary" data-fav="choose">'+esc(I18N.t('fav.choose'))+'</button></div></div>';
      return;
    }
    var id=String(f.id), st=standings.filter(function(r){ return String(r.teamId)===id; })[0];
    var place=st && st.pld ? ' · '+(st.rank||st.pos)+(en()?((st.rank||st.pos)===1?'st':(st.rank||st.pos)===2?'nd':(st.rank||st.pos)===3?'rd':'th'):((st.rank||st.pos)===1?'er':'e'))+' · '+st.pts+' pt'+(st.pts>1?'s':'') : '';
    host.innerHTML='<div class="uf-card has-team">'+
      (f.logo?'<img class="uf-crest" src="'+esc(f.logo)+'" alt="" onerror="this.style.visibility=\'hidden\'">':'<span class="uf-crest"></span>')+
      '<div class="uf-txt"><div class="uf-label">★ '+esc(I18N.t('fav.myTeam'))+esc(place)+'</div>'+
      '<div class="uf-name">'+esc(f.name)+'</div><div class="uf-status">'+favStatus(id)+'</div></div>'+
      '<div class="uf-actions">'+
        '<button type="button" class="uf-btn primary" data-fav="card">'+esc(T('Voir sa fiche','Club card'))+'</button>'+
        '<button type="button" class="uf-btn" data-fav="choose">'+esc(I18N.t('fav.change'))+'</button>'+
        '<button type="button" class="uf-btn" data-fav="remove">'+esc(I18N.t('fav.remove'))+'</button>'+
      '</div></div>';
  }
  el('favSection').addEventListener('click',function(e){
    var b=e.target.closest('[data-fav]'); if(!b) return;
    var a=b.getAttribute('data-fav');
    if(a==='choose') openChooser(b);
    else if(a==='card') openClub(favId());
    else if(a==='remove'){ ESPN.clearFav(); renderAll(); el('favSection').querySelector('[data-fav]').focus(); }
  });

  /* Choix du club : les 36 clubs de la phase de ligue, d'après le calendrier ESPN. */
  var chooserOpener=null;
  function openChooser(opener){
    chooserOpener=opener||null;
    var clubs=ESPN.leagueClubs(events), fid=favId();
    el('favModalTitle').textContent='★ '+I18N.t('fav.chooseTitle');
    el('favModalSub').textContent=T('Les '+clubs.length+' clubs de la phase de ligue '+ESPN.seasonLabel()+'.','The '+clubs.length+' clubs of the '+ESPN.seasonLabel()+' league phase.');
    el('favModalClose').setAttribute('aria-label',T('Fermer','Close'));
    var s=el('favSearch'); s.value=''; s.placeholder=I18N.t('fav.search'); s.setAttribute('aria-label',I18N.t('fav.search'));
    el('favGrid').innerHTML=clubs.length ? clubs.map(function(c){
      return '<button type="button" class="uf-club'+(c.id===fid?' on':'')+'" data-id="'+esc(c.id)+'" aria-pressed="'+(c.id===fid)+'">'+
        (c.logo?'<img src="'+esc(c.logo)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="uf-noimg"></span>')+
        '<span>'+esc(c.name)+'</span></button>';
    }).join('') : '<p class="uf-muted">'+esc(T('Liste indisponible : ESPN n’a pas encore répondu.','List unavailable: ESPN has not answered yet.'))+'</p>';
    el('favModal').hidden=false;
    document.body.style.overflow='hidden';
    s.focus();
  }
  function closeChooser(){
    el('favModal').hidden=true; document.body.style.overflow='';
    if(chooserOpener && document.body.contains(chooserOpener)) chooserOpener.focus();
    else { var b=el('favSection').querySelector('[data-fav]'); if(b) b.focus(); }
  }
  el('favGrid').addEventListener('click',function(e){
    var b=e.target.closest('.uf-club'); if(!b) return;
    var c=ESPN.leagueClubs(events).filter(function(x){ return x.id===b.getAttribute('data-id'); })[0]; if(!c) return;
    ESPN.setFav({ id:c.id, name:c.name, abbr:c.abbr, logo:c.logo, color:c.color });
    renderAll(); chooserOpener=null; closeChooser();      // focus : premier bouton de la nouvelle carte
  });
  el('favSearch').addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    Array.prototype.forEach.call(el('favGrid').querySelectorAll('.uf-club'),function(b){ b.hidden=!!q && b.textContent.toLowerCase().indexOf(q)===-1; });
  });
  el('favModalClose').addEventListener('click',closeChooser);
  el('favModal').addEventListener('click',function(e){ if(e.target===el('favModal')) closeChooser(); });
  el('favModal').addEventListener('keydown',function(e){
    if(e.key==='Escape'){ e.preventDefault(); closeChooser(); return; }
    if(e.key!=='Tab') return;
    var f=Array.prototype.filter.call(el('favModal').querySelectorAll('button,input'),function(x){ return !x.hidden && x.offsetParent!==null; });
    if(!f.length) return;
    if(e.shiftKey && document.activeElement===f[0]){ e.preventDefault(); f[f.length-1].focus(); }
    else if(!e.shiftKey && document.activeElement===f[f.length-1]){ e.preventDefault(); f[0].focus(); }
  });

  /* ---- Fiche club ---- */
  function ctx(){ return { matches:matches, standings:standings }; }
  function openClub(id){ if(id && window.LDCClubPanel) LDCClubPanel.open(id, ctx()); }
  el('mdGrid').addEventListener('click',function(e){ var b=e.target.closest('.live-team-row[data-team]'); if(b) openClub(b.getAttribute('data-team')); });
  /* Comptes à rebours : mis à jour chaque seconde, sans tout redessiner. */
  setInterval(function(){
    Array.prototype.forEach.call(document.querySelectorAll('.live-countdown[data-kickoff]'),function(x){ x.textContent=upcomingWhen(new Date(+x.getAttribute('data-kickoff'))); });
  },1000);
  el('mdPrev').addEventListener('click',function(){ if(cur>0){ cur--; picked=true; renderDay(); } });
  el('mdNext').addEventListener('click',function(){ if(cur<groups.length-1){ cur++; picked=true; renderDay(); } });

  /* ---- Chargement : toutes les 20 s s'il y a du direct, sinon chaque minute ---- */
  function load(){
    if(document.visibilityState==='hidden'){ schedule(60000); return; }
    ESPN.fetchSeasonEvents({ ttl:20000 }).then(function(evs){
      el('offlineNotice').style.display='none';
      events=evs;
      matches=evs.map(ESPN.normalizeEvent).filter(Boolean);
      var seed=ESPN.isArchive()?null:ESPN.leagueClubs(evs);
      standings=ESPN.computeStandings(evs, seed);
      groups=buildGroups(matches);
      if(!picked || cur==null || cur>=groups.length) cur=defaultGroup();
      var live=matches.some(function(m){ return m.state==='in'; });
      el('liveFlag').style.display=live?'inline-flex':'none';
      renderAll();
      if(window.LDCClubPanel) LDCClubPanel.refresh(ctx());
      loadPlayers();
      if(wantChooser){ wantChooser=false; openChooser(null); }
      schedule(live?20000:60000);
    }).catch(function(){
      el('offlineNotice').style.display='flex';
      if(!matches.length) el('mdGrid').innerHTML='<div class="empty-state">'+esc(T('ESPN ne répond pas. Nouvel essai dans une minute.','ESPN is not responding. Retrying in a minute.'))+'</div>';
      schedule(60000);
    });
  }
  function schedule(ms){ clearTimeout(timer); timer=setTimeout(load, ms); }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible') load(); });
  window.addEventListener('ldc:langchange', renderAll);
  renderStatic();
  renderFav();
  load();
  var wantChooser=location.hash==='#choisir';
})();
