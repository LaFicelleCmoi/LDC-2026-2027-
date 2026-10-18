/* =========================================================================
   cup-club.js — Onglet « Mon club » des coupes européennes
   UN SEUL script pour europa-monclub.html et conference-monclub.html : la
   compétition vient de espn.js (window.LDC_LEAGUE), le club du favori propre
   à cette compétition (ESPN.getFav).
   - saison en cours : place, bilan, forme, match en direct ou prochain match,
     objectifs (seuils réels, thresholds.js), calendrier restant ; données
     calculées par clubpanel.js (clubData), comme la fiche club ;
   - parcours dans la compétition depuis COMP.historyFrom (2021-22) : tour
     atteint chaque saison et bilan cumulé.
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

  var CO={ ALB:['Albanie','Albania'], AND:['Andorre','Andorra'], ARM:['Arménie','Armenia'], AUT:['Autriche','Austria'], AZE:['Azerbaïdjan','Azerbaijan'],
    BEL:['Belgique','Belgium'], BIH:['Bosnie-Herzégovine','Bosnia and Herzegovina'], BUL:['Bulgarie','Bulgaria'], CRO:['Croatie','Croatia'], CYP:['Chypre','Cyprus'],
    CZE:['Tchéquie','Czechia'], DEN:['Danemark','Denmark'], ENG:['Angleterre','England'], ESP:['Espagne','Spain'], FIN:['Finlande','Finland'], FRA:['France','France'],
    GEO:['Géorgie','Georgia'], GER:['Allemagne','Germany'], GIB:['Gibraltar','Gibraltar'], GRE:['Grèce','Greece'], HUN:['Hongrie','Hungary'], ISR:['Israël','Israel'],
    ITA:['Italie','Italy'], KAZ:['Kazakhstan','Kazakhstan'], LTU:['Lituanie','Lithuania'], LVA:['Lettonie','Latvia'], NED:['Pays-Bas','Netherlands'], NOR:['Norvège','Norway'],
    POL:['Pologne','Poland'], POR:['Portugal','Portugal'], ROU:['Roumanie','Romania'], SCO:['Écosse','Scotland'], SRB:['Serbie','Serbia'], SUI:['Suisse','Switzerland'],
    SVN:['Slovénie','Slovenia'], SWE:['Suède','Sweden'], TUR:['Turquie','Türkiye'], UKR:['Ukraine','Ukraine'] };
  function country(id){ var m=window.LDCCupClubs2026 && LDCCupClubs2026[ESPN.LEAGUE_SLUG], c=m && m[String(id)]; return c&&CO[c]?T(CO[c][0],CO[c][1]):''; }

  var RLBL={ po:['Barrages','Play-offs'], r16:['Huitièmes de finale','Round of 16'], qf:['Quarts de finale','Quarter-finals'], sf:['Demi-finales','Semi-finals'], final:['Finale','Final'] };
  function rlbl(k){ var e=RLBL[k]; return e?T(e[0],e[1]):k; }
  function ordinal(n){ return n+(en()?(n===1?'st':n===2?'nd':n===3?'rd':'th'):(n===1?'er':'e')); }
  function applyFavAccent(){ var a=ESPN.favAccent(), r=document.documentElement; if(a) r.style.setProperty('--fav-rgb',a); else r.style.removeProperty('--fav-rgb'); }

  var fav=null, matches=[], standings=[], timer=null;

  /* ---- Saison en cours ---- */
  function longDate(t){ return new Date(t).toLocaleDateString(loc(),{weekday:'long',day:'numeric',month:'long'})+' · '+new Date(t).toLocaleTimeString(loc(),{hour:'2-digit',minute:'2-digit'}); }
  function shortDate(t){ return new Date(t).toLocaleDateString(loc(),{day:'numeric',month:'short'}); }
  function where(home){ return home?T('vs','vs'):T('chez','at'); }
  function crest(src,cls){ return src?'<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="'+cls+'"></span>'; }
  function letter(r){ return r==='w'?T('V','W'):(r==='d'?T('N','D'):T('D','L')); }
  function roundOf(r){ return r.round==='league' ? (r.md?T('Journée ','Matchday ')+r.md:T('Phase de ligue','League phase')) : rlbl(r.round); }

  function renderSeason(){
    var host=el('mcSeason'); if(!host || !fav) return;
    var d=LDCClubPanel.clubData(fav.id, matches, standings), s=d.summary, st=d.standing;
    var zone=st?{ q:T('Top 8 · huitièmes directs','Top 8 · direct to R16'), po:T('9–24 · barrages','9–24 · play-offs'), out:T('25–36 · éliminé','25–36 · eliminated') }[st.zone]:'';
    el('mcRank').innerHTML=st?('<span class="mc-chip gold">'+esc(ordinal(st.rank)+' · '+st.pts+' pt'+(st.pts>1?'s':''))+'</span><span class="mc-chip z-'+st.zone+'">'+esc(zone)+'</span>'):'';
    function tile(v,l){ return '<div class="mc-tot"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>'; }
    var diff=s.gf-s.ga, html='';
    if(d.live){
      var L=d.live;
      html+='<div class="mc-live" role="status" data-mp-open="'+esc(L.id)+'" tabindex="0" title="'+esc(T('Fiche du match','Match details'))+'"><span class="mc-live-pill"><i></i>'+esc(I18N.t('common.live'))+'</span>'+
        '<span class="mc-live-clock">'+esc(/HT|Half/i.test(L.detail)?T('Mi-temps','Half-time'):(L.clock||L.detail))+'</span>'+
        '<div class="mc-live-main">'+crest(fav.logo,'mc-lv-logo')+'<b>'+L.gf+' – '+L.ga+'</b>'+crest(L.opp.logo,'mc-lv-logo')+
        '<span class="mc-live-opp">'+esc(where(L.home))+' '+esc(L.opp.name)+'</span></div></div>';
    }
    html+='<div class="mc-totals">'+tile(s.pld,T('Matchs','Matches'))+tile(s.w,T('Victoires','Wins'))+tile(s.d,T('Nuls','Draws'))+tile(s.l,T('Défaites','Losses'))+
      tile(s.gf+'–'+s.ga,T('Buts P/C','Goals F/A'))+tile((diff>0?'+':'')+diff,T('Différence','Goal diff'))+'</div>';
    var form=d.played.filter(function(r){ return r.result; }).slice(0,5);
    if(form.length) html+='<div class="mc-form">'+form.map(function(r){ return '<span class="cp-badge '+r.result+'" title="'+esc(where(r.home)+' '+r.opp.name+' · '+r.gf+'–'+r.ga)+'">'+letter(r.result)+'</span>'; }).join('')+
      '<span class="mc-form-l">'+esc(T('Forme, du plus récent au plus ancien','Form, most recent first'))+'</span></div>';
    var cols='';
    if(d.next){
      var n=d.next;
      cols+='<div class="mc-box"><div class="mc-box-t">'+esc(T('Prochain match','Next match'))+'</div>'+
        '<div class="mc-next" data-mp-open="'+esc(n.id)+'" tabindex="0" role="button" title="'+esc(T('Fiche du match','Match details'))+'">'+crest(n.opp.logo,'mc-nlogo')+'<div><div class="mc-next-opp">'+esc(where(n.home))+' '+esc(n.opp.name)+'</div>'+
        '<div class="mc-next-when">'+esc(roundOf(n))+' · '+esc(longDate(n.time))+'</div></div></div>'+
        (n.odds && window.LDCMatchPanel && LDCMatchPanel.probBar ? '<div class="mc-probs">'+LDCMatchPanel.probBar(n.odds, n.home?(fav.abbr||fav.name):(n.opp.abbr||n.opp.name), n.home?(n.opp.abbr||n.opp.name):(fav.abbr||fav.name), 'sm')+
          '<p class="mp-note">'+esc(T('Probabilités du marché (cotes '+(n.odds.provider||'')+' via ESPN, sans marge). Indicatif.','Market probabilities ('+(n.odds.provider||'')+' odds via ESPN, margin removed). Indicative.'))+'</p></div>' : '')+'</div>';
    }
    var TH=window.LDCThresholds, left=d.upcoming.filter(function(r){ return r.round==='league'; }).length;
    if(TH && st && left>0){
      var ob=TH.objectives(st.pts,left);
      var row=function(o,label,cls){
        var pct=Math.min(100,Math.round(o.pts/o.target*100)), txt;
        if(o.status==='reached') txt=T('✓ Seuil atteint.','✓ Threshold reached.');
        else if(o.status==='out') txt=T('Hors de portée : au mieux '+o.max+' pts.','Out of reach: '+o.max+' pts at best.');
        else txt=T('Il manque '+o.missing+' pt'+(o.missing>1?'s':'')+' · '+o.wins+' victoire'+(o.wins>1?'s':''),o.missing+' pt'+(o.missing>1?'s':'')+' short · '+o.wins+' win'+(o.wins>1?'s':''));
        return '<div class="cp-obj '+cls+' is-'+o.status+'"><div class="cp-obj-head"><span>'+esc(label)+'</span><b>'+o.pts+' / '+o.target+' pts</b></div>'+
          '<div class="cp-bar"><i style="width:'+pct+'%"></i></div><p class="cp-obj-txt">'+esc(txt)+'</p></div>';
      };
      cols+='<div class="mc-box"><div class="mc-box-t">'+esc(T('Objectifs','Targets'))+' <span class="mc-muted">· '+left+' '+esc(T('match'+(left>1?'s':'')+' restant'+(left>1?'s':''),'match'+(left>1?'es':'')+' left'))+'</span></div>'+
        row(ob.top8,T('Top 8 · huitièmes directs','Top 8 · direct to R16'),'o-q')+row(ob.top24,T('Top 24 · barrages','Top 24 · play-offs'),'o-po')+
        (function(){ var ch=window.LDCChances&&LDCChances.cached(matches, standings.map(function(r){ return { id:r.teamId }; })), c=ch&&ch[String(fav.id)];
          return c?'<p class="cp-chances"><span>'+esc(T('Chances estimées','Estimated chances'))+'</span><b>'+esc('Top 8 : '+LDCChances.pct(c.top8))+'</b><b>'+esc('Top 24 : '+LDCChances.pct(c.top24))+'</b><small>'+esc(T('3 000 simulations des matchs restants, à titre indicatif','3,000 simulations of the remaining matches, indicative only'))+'</small></p>':''; })()+
        '<p class="mc-muted mc-small">'+esc(T('Seuils réels : le 8e avait '+TH.trend('top8')+', le 24e '+TH.trend('top24')+'.','Actual thresholds: 8th had '+TH.trend('top8',true)+', 24th had '+TH.trend('top24',true)+'.'))+'</p></div>';
    }
    if(cols) html+='<div class="mc-cols">'+cols+'</div>';
    var rest=d.upcoming.slice(d.next?1:0);
    if(rest.length){
      html+='<div class="mc-box"><div class="mc-box-t">'+esc(T('Calendrier restant','Remaining fixtures'))+'</div><ul class="mc-fix">'+
        rest.map(function(r){ return '<li><span class="mc-md">'+esc(r.round==='league'&&r.md?T('J','MD')+r.md:rlbl(r.round))+'</span>'+
          '<span class="mc-muted">'+esc(where(r.home))+'</span>'+crest(r.opp.logo,'mc-ologo')+'<span class="mc-oname">'+esc(r.opp.name)+'</span>'+
          '<span class="mc-fdate">'+esc(shortDate(r.time))+'</span></li>'; }).join('')+'</ul></div>';
    }
    if(d.last.length){
      html+='<div class="mc-box"><div class="mc-box-t">'+esc(T('Résultats','Results'))+'</div><ul class="mc-fix">'+
        d.last.map(function(r){ return '<li data-mp-open="'+esc(r.id)+'" tabindex="0" role="button" title="'+esc(T('Fiche du match','Match details'))+'"><span class="cp-badge '+r.result+'">'+letter(r.result)+'</span>'+
          '<span class="mc-muted">'+esc(where(r.home))+'</span>'+crest(r.opp.logo,'mc-ologo')+'<span class="mc-oname">'+esc(r.opp.name)+'</span>'+
          '<span class="mc-score">'+r.gf+'–'+r.ga+'</span><span class="mc-fdate">'+esc(shortDate(r.time))+'</span></li>'; }).join('')+'</ul></div>';
    }
    if(!d.played.length && !d.upcoming.length) html='<p class="mc-muted">'+esc(T('Ce club ne figure pas au calendrier '+compName()+' de cette saison.','This club is not in this season’s '+compName()+' schedule.'))+'</p>';
    host.innerHTML=html;
    el('mcSeasonT').textContent=T('Saison ','Season ')+ESPN.seasonLabel()+' · '+compName();
    var live=!!d.live || (window.LDCClubPanel && LDCClubPanel.followsLive && LDCClubPanel.followsLive(d, Date.now()));
    clearTimeout(timer); timer=setTimeout(loadSeason, live?20000:120000);
  }
  function loadSeason(){
    if(document.visibilityState==='hidden'){ clearTimeout(timer); timer=setTimeout(loadSeason,60000); return; }
    ESPN.fetchSeasonEvents({ ttl:20000 }).then(function(evs){
      matches=evs.map(ESPN.normalizeEvent).filter(Boolean);
      standings=ESPN.computeStandings(evs, ESPN.leagueClubs(evs));
      renderSeason();
      if(window.LDCClubPanel) LDCClubPanel.refresh({ matches:matches, standings:standings });
    }).catch(function(){
      if(!matches.length) el('mcSeason').innerHTML='<p class="mc-muted">'+esc(T('ESPN ne répond pas. Nouvel essai dans une minute.','ESPN is not responding. Retrying in a minute.'))+'</p>';
      clearTimeout(timer); timer=setTimeout(loadSeason,60000);
    });
  }

  /* ---- Parcours depuis COMP.historyFrom ---- */
  var YEARS=[]; (function(){ for(var y=ESPN.CURRENT_SEASON-1; y>=(COMP.historyFrom||ESPN.CURRENT_SEASON-1); y--) YEARS.push(y); })();
  function sameClub(t){ return t && fav && String(t.teamId||t.id)===String(fav.id); }
  function other(tie, side){ var x=side==='A'?tie.teamB:tie.teamA; return x?(x.name||x.abbr||''):''; }
  function outcome(events){
    var norm=(events||[]).map(ESPN.normalizeEvent).filter(Boolean);
    var mine=norm.filter(function(m){ return m.round!=='qualifying' && (sameClub(m.home)||sameClub(m.away)); });
    if(!mine.length) return { key:'none' };
    var rounds=ESPN.buildBracket(events), order=['final','sf','qf','r16','po'];
    for(var oi=0;oi<order.length;oi++){
      var r=rounds.filter(function(x){ return x.key===order[oi]; })[0]; if(!r) continue;
      for(var i=0;i<r.ties.length;i++){ var tie=r.ties[i], side=sameClub(tie.teamA)?'A':(sameClub(tie.teamB)?'B':null);
        if(side){
          if(order[oi]==='final') return (tie.decided&&tie.winner===side)?{ key:'champion', opp:other(tie,side) }:{ key:'finalist', opp:other(tie,side) };
          return { key:'out', round:order[oi], opp:other(tie,side) };
        }
      }
    }
    return { key:'league' };
  }
  function outcomeHTML(o,y){
    if(o.key==='champion') return { cls:'champion', round:'🏆 '+T('Vainqueur','Winner'), detail:T('Finale gagnée contre ','Won the final against ')+o.opp, badge:T('Sacré','Winner') };
    if(o.key==='finalist') return { cls:'finalist', round:T('Finaliste','Runner-up'), detail:T('Finale perdue contre ','Lost the final to ')+o.opp, badge:T('Finale','Final') };
    if(o.key==='out'){ var deep=(o.round==='sf'||o.round==='qf'); return { cls:deep?'deep':'mid', round:rlbl(o.round), detail:T('Éliminé par ','Knocked out by ')+o.opp, badge:rlbl(o.round) }; }
    if(o.key==='league'){ var lab=ESPN.isLeaguePhaseFormat(y)?T('Phase de ligue','League phase'):T('Phase de groupes','Group stage'); return { cls:'out', round:lab, detail:T('Pas de phase finale','No knockout stage'), badge:lab }; }
    return { cls:'none', round:T('Absent','Not involved'), detail:T('Pas engagé dans la compétition','Did not take part'), badge:'—' };
  }
  function loadHistory(){
    var host=el('mcCamps'); if(!host) return;
    host.innerHTML=YEARS.map(function(y){ return '<div class="mc-camp skel" id="mc-y'+y+'"><span class="mc-season">'+ESPN.seasonLabel(y)+'</span><div class="mc-res"></div></div>'; }).join('');
    var tot={ mp:0, w:0, d:0, l:0, gf:0, ga:0 }, i=0;
    function tally(events){
      (events||[]).map(ESPN.normalizeEvent).filter(Boolean).forEach(function(m){
        if(m.state!=='post' || m.round==='qualifying') return;
        var side=sameClub(m.home)?'h':(sameClub(m.away)?'a':null); if(!side) return;
        var mg=side==='h'?m.home.score:m.away.score, og=side==='h'?m.away.score:m.home.score;
        tot.mp++; tot.gf+=mg; tot.ga+=og; if(mg>og) tot.w++; else if(mg<og) tot.l++; else tot.d++;
      });
    }
    function paint(y,events){
      var row=el('mc-y'+y); if(!row) return;
      row.className='mc-camp';
      if(!events){ row.innerHTML='<span class="mc-season">'+ESPN.seasonLabel(y)+'</span><div class="mc-res"><div class="mc-detail">'+esc(T('Données indisponibles','Data unavailable'))+'</div></div>'; return; }
      tally(events);
      var h=outcomeHTML(outcome(events),y);
      row.classList.toggle('is-none', h.cls==='none');
      row.innerHTML='<span class="mc-season">'+ESPN.seasonLabel(y)+'</span>'+
        '<div class="mc-res"><div class="mc-round">'+esc(h.round)+'</div><div class="mc-detail">'+esc(h.detail)+'</div></div>'+
        '<span class="mc-badge '+h.cls+'">'+esc(h.badge)+'</span>'+
        (y>=ESPN.EARLIEST_SEASON && h.cls!=='none'?'<a class="mc-relive" href="'+COMP.standings+'?season='+y+'">'+esc(T('Revivre','Relive'))+' →</a>':'');
    }
    /* Une saison après l'autre : doux pour l'API. */
    (function next(){
      if(i>=YEARS.length){ renderHistTotals(tot); return; }
      var y=YEARS[i++];
      ESPN.fetchSeasonEvents({ year:y, ttl:3600000 }).then(function(ev){ paint(y,ev); },function(){ paint(y,null); }).then(next);
    })();
  }
  function renderHistTotals(t){
    var host=el('mcHistTot'); if(!host) return;
    if(!t.mp){ host.innerHTML=''; return; }
    function tile(v,l){ return '<div class="mc-tot"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>'; }
    var diff=t.gf-t.ga;
    host.innerHTML='<div class="mc-totals">'+tile(t.mp,T('Matchs','Matches'))+tile(t.w,T('Victoires','Wins'))+tile(t.d,T('Nuls','Draws'))+tile(t.l,T('Défaites','Losses'))+
      tile(t.gf+'–'+t.ga,T('Buts P/C','Goals F/A'))+tile((diff>0?'+':'')+diff,T('Différence','Goal diff'))+'</div>';
  }

  /* ---- Page ---- */
  function renderEmpty(){
    el('mcContent').innerHTML='<div class="card pad mc-empty"><div class="em-star" aria-hidden="true">★</div>'+
      '<p>'+esc(T('Choisis ton club en '+compName()+' pour suivre sa saison et revoir son parcours.','Pick your '+compName()+' club to follow its season and look back at its campaigns.'))+'</p>'+
      '<a class="uf-btn primary" href="'+COMP.home+'#choisir">'+esc(T('Choisir mon club','Pick my club'))+'</a></div>';
  }
  function render(){
    applyFavAccent();
    el('mcTitle').textContent=T('Mon club','My club');
    document.title=T('Mon club','My club')+' — '+compName();
    fav=ESPN.getFav();
    if(!fav){ renderEmpty(); return; }
    var co=country(fav.id);
    el('mcContent').innerHTML=
      '<div class="card mc-hero">'+crest(fav.logo,'mc-crest')+
        '<div class="mc-htxt"><div class="mc-eyebrow">★ '+esc(T('Mon club favori','My favourite club'))+' · '+esc(compName())+'</div>'+
          '<div class="mc-name">'+esc(fav.name)+'</div>'+
          '<div class="mc-meta"><span id="mcRank"></span>'+(function(){ var t=ESPN.clubTitlesById(fav.id); return t?'<span class="mc-chip gold">🏆 '+t.n+' '+esc(t.n>1?T('titres','titles'):T('titre','title'))+' · '+esc(t.years.slice().reverse().join(', '))+'</span>':''; })()+(co?'<span class="mc-chip">'+esc(co)+'</span>':'')+(fav.abbr?'<span class="mc-chip">'+esc(fav.abbr)+'</span>':'')+'</div>'+
          '<div class="mc-acts"><button type="button" class="uf-btn primary" id="mcOpen">'+esc(T('Fiche complète','Full club card'))+'</button>'+
            '<a class="uf-btn" href="'+COMP.home+'#choisir">'+esc(T('Changer de club','Change club'))+'</a>'+
            (window.LDCGoalAlerts?'<button type="button" class="uf-btn'+(LDCGoalAlerts.isOn(ESPN.LEAGUE_SLUG)?' on':'')+'" id="mcAlerts" aria-pressed="'+LDCGoalAlerts.isOn(ESPN.LEAGUE_SLUG)+'" title="'+esc(LDCGoalAlerts.hint(ESPN.LEAGUE_SLUG))+'">'+(LDCGoalAlerts.isOn(ESPN.LEAGUE_SLUG)?'🔔 ':'🔕 ')+esc(T('Alertes but','Goal alerts'))+'</button>':'')+'</div>'+
        '</div></div>'+
      '<h2 class="mc-section-title" id="mcSeasonT"></h2><div id="mcSeason"><div class="empty-state">'+esc(I18N.t('common.loading')||'…')+'</div></div>'+
      '<h2 class="mc-section-title">'+esc(T('Parcours en '+compName()+' depuis ','Record in the '+compName()+' since ')+ESPN.seasonLabel(COMP.historyFrom))+'</h2>'+
      '<div id="mcHistTot"></div><div class="mc-camps" id="mcCamps"></div>';
    el('mcOpen').addEventListener('click',function(){ LDCClubPanel.open(fav.id,{ matches:matches, standings:standings }); });
    var al=el('mcAlerts'); if(al) al.addEventListener('click',function(){ LDCGoalAlerts.toggle(ESPN.LEAGUE_SLUG).then(function(){ render(); var x=el('mcAlerts'); if(x) x.focus(); }); });
    el('mcSeasonT').textContent=T('Saison ','Season ')+ESPN.seasonLabel()+' · '+compName();
    if(matches.length) renderSeason();
    loadSeason();
    loadHistory();
  }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible' && fav) loadSeason(); });
  window.addEventListener('ldc:langchange', render);
  render();
})();
