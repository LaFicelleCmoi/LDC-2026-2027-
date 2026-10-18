/* =========================================================================
   compare.js — Comparateur de clubs (comparateur.html), trois compétitions
   -------------------------------------------------------------------------
   ?c=ucl|uel|uecl&a=ID&b=ID : deux clubs de la même compétition.
   - saison en cours, face à face : place, points, bilan, buts, clean
     sheets, forme (classement et chiffres calculés comme partout ailleurs) ;
   - confrontations directes dans la compétition, saison en cours et
     saisons passées (depuis 2019-20 en LDC, 2021-22 pour les autres coupes) ;
   - parcours comparés saison par saison.
   L'adresse suit les choix : un lien partagé rouvre la même comparaison.
   ========================================================================= */
(function(){
  'use strict';
  I18N.mountToggle('#langSwitch');
  function el(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function en(){ return I18N.getLang()==='en'; }
  function T(fr,e){ return en()?e:fr; }
  function loc(){ return en()?'en-GB':'fr-FR'; }
  function crest(src,cls){ return src?'<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<span class="'+cls+'"></span>'; }
  function ordinal(n){ return n+(en()?(n===1?'st':n===2?'nd':n===3?'rd':'th'):(n===1?'er':'e')); }

  var COMPS={
    ucl:{ slug:'uefa.champions', icon:'logo.svg?v=4', rgb:'245, 181, 10', from:null },
    uel:{ slug:'uefa.europa', icon:'europa.svg?v=2', rgb:'255, 122, 26', from:2021 },
    uecl:{ slug:'uefa.europa.conf', icon:'conference.svg?v=1', rgb:'25, 196, 79', from:2021 }
  };
  var q=new URLSearchParams(location.search);
  var key=COMPS[q.get('c')]?q.get('c'):'ucl', A=q.get('a')||'', B=q.get('b')||'';
  var E=null, events=[], matches=[], standings=[], clubs=[], hist={}, histKey='', loadToken=0;

  function comp(){ return COMPS[key]; }
  function compName(){ return T(E.COMP.fr,E.COMP.en); }
  function years(){ var c=ESPN.CURRENT_SEASON, from=comp().from||c-7, out=[]; for(var y=c-1;y>=from;y--) out.push(y); return out; }
  function writeUrl(){ try{ history.replaceState(null,'',location.pathname+'?c='+key+(A?'&a='+A:'')+(B?'&b='+B:'')); }catch(e){} }

  /* ---- Choix ---- */
  function renderPickers(){
    el('cmpComps').innerHTML=Object.keys(COMPS).map(function(k){
      var e=ESPN.forLeague(COMPS[k].slug);
      return '<button type="button" class="cmp-comp'+(k===key?' on':'')+'" data-c="'+k+'" aria-pressed="'+(k===key)+'"><img src="'+COMPS[k].icon+'" alt="">'+esc(T(e.COMP.fr,e.COMP.en))+'</button>';
    }).join('');
    function opts(sel){ return '<option value="">'+esc(T('Choisir un club…','Pick a club…'))+'</option>'+clubs.map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.name)+'</option>'; }).join(''); }
    el('cmpA').innerHTML=opts(A); el('cmpB').innerHTML=opts(B);
  }
  function defaults(){
    var ids=clubs.map(function(c){ return c.id; });
    if(ids.indexOf(A)===-1) A='';
    if(ids.indexOf(B)===-1) B='';
    var fav=E.getFav(), ranked=standings.map(function(r){ return String(r.teamId); });
    if(!A) A=(fav && ids.indexOf(String(fav.id))!==-1)?String(fav.id):(ranked[0]||ids[0]||'');
    if(!B || B===A) B=ranked.filter(function(id){ return id!==A; })[0]||ids.filter(function(id){ return id!==A; })[0]||'';
  }

  /* ---- Saison en cours ---- */
  function side(id){
    var d=LDCClubPanel.clubData(id, matches, standings), cs=0;
    ESPN.forLeague(comp().slug).computeCleanSheets(events).forEach(function(x){ if(String(x.teamId)===String(id)) cs=x.cs; });
    var team=d.team||(clubs.filter(function(c){ return c.id===id; })[0])||{ name:'—' };
    return { id:id, d:d, team:team, cs:cs };
  }
  function row(label, a, b, opts){
    opts=opts||{};
    var va=opts.val?opts.val(a):a, vb=opts.val?opts.val(b):b;
    var better = va===vb||va==null||vb==null ? 0 : ((opts.lower?va<vb:va>vb)?-1:1);
    var tot=Math.abs(va||0)+Math.abs(vb||0), pa=tot?Math.abs(va||0)/tot*100:50;
    var fa=opts.html?opts.html(a):esc(opts.fmt?opts.fmt(a):a), fb=opts.html?opts.html(b):esc(opts.fmt?opts.fmt(b):b);
    return '<div class="cmp-row"><div class="cmp-vals"><b class="'+(better<0?'lead':'')+'">'+fa+'</b><span>'+esc(label)+'</span><b class="'+(better>0?'lead':'')+'">'+fb+'</b></div>'+
      (opts.noBar?'':'<div class="cmp-bar"><i class="a" style="width:'+pa.toFixed(1)+'%"></i><i class="b" style="width:'+(100-pa).toFixed(1)+'%"></i></div>')+'</div>';
  }
  function formHTML(d){ return d.played.filter(function(r){ return r.result; }).slice(0,5).reverse().map(function(r){ return '<span class="cp-badge '+r.result+'">'+(r.result==='w'?T('V','W'):r.result==='d'?T('N','D'):T('D','L'))+'</span>'; }).join('')||'—'; }
  function renderSeason(){
    if(!A || !B){ el('cmpSeason').innerHTML='<p class="cmp-empty">'+esc(T('Choisis deux clubs.','Pick two clubs.'))+'</p>'; el('cmpHead').innerHTML=''; return; }
    var a=side(A), b=side(B), sa=a.d.summary, sb=b.d.summary, ra=a.d.standing, rb=b.d.standing;
    function head(x,cls){
      var st=x.d.standing;
      return '<button type="button" class="cmp-team '+cls+'" data-club="'+esc(x.id)+'">'+crest(x.team.logo,'cmp-crest')+'<span class="cmp-tname">'+esc(x.team.name)+'</span>'+
        (st?'<span class="cmp-trank">'+esc(ordinal(st.rank)+' · '+st.pts+' pts')+'</span>':'')+'</button>';
    }
    el('cmpHead').innerHTML=head(a,'a')+'<span class="cmp-vs">VS</span>'+head(b,'b');
    function per(s,k){ return s.pld?Math.round(s[k]/s.pld*100)/100:0; }
    var html='';
    if(ra && rb) html+=row(T('Classement','Position'), ra.rank, rb.rank, { lower:true, noBar:true, html:function(n){ return n+'<sup>'+esc(ordinal(n).replace(/^\d+/,''))+'</sup>'; } });
    html+=row(T('Points','Points'), ra?ra.pts:0, rb?rb.pts:0)+
      row(T('Matchs joués','Played'), sa.pld, sb.pld, { noBar:true })+
      row(T('Victoires','Wins'), sa.w, sb.w)+row(T('Nuls','Draws'), sa.d, sb.d, { noBar:true })+row(T('Défaites','Defeats'), sa.l, sb.l, { lower:true })+
      row(T('Buts marqués','Goals scored'), sa.gf, sb.gf)+row(T('Buts encaissés','Goals conceded'), sa.ga, sb.ga, { lower:true })+
      row(T('Différence de buts','Goal difference'), sa.gf-sa.ga, sb.gf-sb.ga, { fmt:function(v){ return (v>0?'+':'')+v; }, noBar:true })+
      row(T('Buts par match','Goals per match'), per(sa,'gf'), per(sb,'gf'), { fmt:function(v){ return v.toLocaleString(loc()); } })+
      row(T('Encaissés par match','Conceded per match'), per(sa,'ga'), per(sb,'ga'), { lower:true, fmt:function(v){ return v.toLocaleString(loc()); } })+
      row(T('Clean sheets','Clean sheets'), a.cs, b.cs);
    html+='<div class="cmp-row"><div class="cmp-vals cmp-forms"><span class="cmp-form">'+formHTML(a.d)+'</span><span>'+esc(T('Forme','Form'))+'</span><span class="cmp-form r">'+formHTML(b.d)+'</span></div></div>';
    var tt=window.LDCThresholds && LDCThresholds.forLeague(comp().slug);
    function nxt(x){ var n=x.d.live||x.d.next; return n?'<button type="button" class="cmp-next" data-mp-open="'+esc(n.id)+'" data-mp-league="'+comp().slug+'">'+(x.d.live?'<i></i>'+esc(T('En direct ','Live '))+n.gf+'–'+n.ga:esc(T('Prochain','Next')))+' · '+esc((n.home?T('vs ','vs '):T('à ','at '))+n.opp.name)+'</button>':'<span class="cmp-muted">—</span>'; }
    html+='<div class="cmp-row"><div class="cmp-vals cmp-nexts">'+nxt(a)+'<span>'+esc(T('À suivre','Up next'))+'</span>'+nxt(b)+'</div></div>';
    el('cmpSeason').innerHTML=html+(tt?'<p class="cmp-note">'+esc(T('Repères '+compName()+' : le 8e avait '+tt.trend('top8')+' ; le 24e '+tt.trend('top24')+'.','For reference in the '+compName()+': 8th place had '+tt.trend('top8',true)+'; 24th had '+tt.trend('top24',true)+'.'))+'</p>':'');
    el('cmpSeasonT').textContent=T('Saison ','Season ')+ESPN.seasonLabel()+' · '+compName();
  }

  /* ---- Historique : confrontations et parcours ---- */
  var RL={ po:['Barrages','Play-offs'], r16:['Huitièmes','Round of 16'], qf:['Quarts','Quarter-finals'], sf:['Demies','Semi-finals'], final:['Finale','Final'], league:['Phase de ligue','League phase'] };
  function rl(k,y){ if(k==='league' && y!=null && y<2024) return T('Phase de groupes','Group stage'); var e=RL[k]; return e?T(e[0],e[1]):k; }
  function outcome(evs, id){
    var ms=evs.map(E.normalizeEvent).filter(function(m){ return m && m.round!=='qualifying' && (String(m.home.teamId)===id||String(m.away.teamId)===id); });
    if(!ms.length) return { key:'none' };
    var rounds=E.buildBracket(evs), order=['final','sf','qf','r16','po'];
    for(var i=0;i<order.length;i++){
      var r=rounds.filter(function(x){ return x.key===order[i]; })[0]; if(!r) continue;
      for(var j=0;j<r.ties.length;j++){ var tie=r.ties[j], s=String(tie.teamA.teamId||tie.teamA.id)===id?'A':(String(tie.teamB.teamId||tie.teamB.id)===id?'B':null);
        if(s) return order[i]==='final'?{ key:(tie.decided&&tie.winner===s)?'champion':'finalist' }:{ key:'out', round:order[i] };
      }
    }
    return { key:'league' };
  }
  function outLabel(o,y){
    if(o.key==='champion') return ['champion','🏆 '+T('Vainqueur','Winner')];
    if(o.key==='finalist') return ['finalist',T('Finaliste','Runner-up')];
    if(o.key==='out') return [(o.round==='sf'||o.round==='qf')?'deep':'mid', rl(o.round)];
    if(o.key==='league') return ['out', rl('league',y)];
    return ['none','—'];
  }
  function meetings(evs, y){
    return evs.map(E.normalizeEvent).filter(function(m){
      if(!m || m.state==='pre') return false;
      var h=String(m.home.teamId), a=String(m.away.teamId);
      return (h===A && a===B) || (h===B && a===A);
    }).map(function(m){ m._y=y; return m; });
  }
  function renderHistory(){
    var ys=years(), done=ys.filter(function(y){ return hist[y]!==undefined; });
    var all=meetings(events, ESPN.CURRENT_SEASON);
    done.forEach(function(y){ if(hist[y]) all=all.concat(meetings(hist[y], y)); });
    all.sort(function(x,y){ return (y.dateObj?y.dateObj.getTime():0)-(x.dateObj?x.dateObj.getTime():0); });
    var wa=0, wb=0, dr=0;
    all.forEach(function(m){ var ga=String(m.home.teamId)===A?m.home.score:m.away.score, gb=String(m.home.teamId)===A?m.away.score:m.home.score;
      /* Séance de tirs au but : le vainqueur désigné par ESPN. */
      if(ga===gb && m.home.shootout!=null && m.away.shootout!=null){ var winA=(String(m.home.teamId)===A)===(m.home.shootout>m.away.shootout); if(winA) wa++; else wb++; }
      else if(ga>gb) wa++; else if(gb>ga) wb++; else dr++; });
    var ta=side(A).team, tb=side(B).team, loading=done.length<ys.length;
    el('cmpH2hT').textContent=T('Confrontations en ','Head-to-head in the ')+compName();
    el('cmpH2h').innerHTML=(all.length?'<div class="cmp-h2h-sum"><span><b>'+wa+'</b>'+esc(ta.name)+'</span><span><b>'+dr+'</b>'+esc(T('nuls','draws'))+'</span><span><b>'+wb+'</b>'+esc(tb.name)+'</span></div>'+
      '<div class="cmp-list">'+all.map(function(m){
        return '<button type="button" class="cmp-meet" data-mp-open="'+esc(m.id)+'" data-mp-league="'+comp().slug+'"><span class="cmp-my">'+esc(ESPN.seasonLabel(m._y))+'<small>'+esc(rl(m.round,m._y))+'</small></span>'+
          '<span class="cmp-mt">'+crest(m.home.logo,'cmp-mini')+esc(m.home.name)+'</span><b>'+m.home.score+' – '+m.away.score+'</b><span class="cmp-mt r">'+esc(m.away.name)+crest(m.away.logo,'cmp-mini')+'</span></button>';
      }).join('')+'</div>'
      :'<p class="cmp-empty">'+esc(loading?T('Recherche dans les saisons passées…','Searching past seasons…'):T('Jamais affrontés dans cette compétition depuis ','Never met in this competition since ')+ESPN.seasonLabel(ys[ys.length-1])+'.')+'</p>')+
      (loading&&all.length?'<p class="cmp-note">'+esc(T('Recherche dans les saisons passées…','Searching past seasons…'))+'</p>':'');
    /* Parcours */
    el('cmpPathT').textContent=T('Parcours en ','Record in the ')+compName();
    el('cmpPath').innerHTML='<div class="cmp-path"><div class="cmp-ph"><span></span><span>'+crest(ta.logo,'cmp-mini')+esc(ta.abbr||ta.name)+'</span><span>'+crest(tb.logo,'cmp-mini')+esc(tb.abbr||tb.name)+'</span></div>'+
      ys.map(function(y){
        if(hist[y]===undefined) return '<div class="cmp-pr skel"><span>'+esc(ESPN.seasonLabel(y))+'</span><span></span><span></span></div>';
        if(!hist[y]) return '<div class="cmp-pr"><span>'+esc(ESPN.seasonLabel(y))+'</span><span class="cmp-muted">'+esc(T('indisponible','unavailable'))+'</span><span></span></div>';
        var oa=outLabel(outcome(hist[y],A),y), ob=outLabel(outcome(hist[y],B),y);
        return '<div class="cmp-pr"><span>'+esc(ESPN.seasonLabel(y))+'</span><span class="mc-badge '+oa[0]+'">'+esc(oa[1])+'</span><span class="mc-badge '+ob[0]+'">'+esc(ob[1])+'</span></div>';
      }).join('')+'</div>';
  }
  function loadHistory(){
    var k=key+'|'+A+'|'+B; if(!A||!B) return;
    if(histKey.split('|')[0]!==key) hist={};
    histKey=k; var token=++loadToken, ys=years().filter(function(y){ return hist[y]===undefined; });
    renderHistory();
    (function next(i){
      if(token!==loadToken || i>=ys.length) return;
      E.fetchSeasonEvents({ year:ys[i], ttl:3600000 }).then(function(ev){ hist[ys[i]]=ev; },function(){ hist[ys[i]]=null; })
        .then(function(){ if(token===loadToken) renderHistory(); next(i+1); });
    })(0);
  }

  function renderStatic(){
    el('cmpTitle').textContent=T('Comparateur de clubs','Club comparison');
    el('cmpSub').textContent=T('Deux clubs d’une même coupe, face à face : saison en cours, confrontations directes et parcours.','Two clubs from the same competition, side by side: current season, head-to-head and past campaigns.');
    el('cmpSwap').setAttribute('aria-label',T('Inverser','Swap'));
    el('cmpShare').textContent=T('Copier le lien','Copy link');
    el('cmpLA').textContent=T('Club 1','Club 1'); el('cmpLB').textContent=T('Club 2','Club 2');
    document.title=T('Comparateur','Club comparison')+' — '+(E?compName():'');
  }
  function renderAll(){ renderStatic(); renderPickers(); renderSeason(); renderHistory(); }

  function setComp(k){
    key=k; E=ESPN.forLeague(comp().slug);
    document.documentElement.style.setProperty('--cmp-rgb', comp().rgb);
    var token=++loadToken;
    el('cmpSeason').innerHTML='<p class="cmp-empty">'+esc(I18N.t('common.loading')||'…')+'</p>';
    E.fetchSeasonEvents({ ttl:60000 }).then(function(evs){
      if(token!==loadToken) return;
      events=evs; matches=evs.map(E.normalizeEvent).filter(Boolean);
      var seed=key==='ucl'?E.qualifiedClubs():E.leagueClubs(evs);
      standings=E.computeStandings(evs, seed);
      var map={}; E.leagueClubs(evs).concat(key==='ucl'?E.qualifiedClubs().map(function(c){ return { id:String(c.id), name:c.name, logo:c.logo, abbr:c.abbr }; }):[]).forEach(function(c){ if(!map[c.id]) map[c.id]=c; });
      clubs=Object.keys(map).map(function(id){ return map[id]; }).sort(function(a,b){ return a.name.localeCompare(b.name); });
      defaults(); writeUrl(); renderAll(); loadHistory();
    }).catch(function(){ el('cmpSeason').innerHTML='<p class="cmp-empty">'+esc(I18N.t('common.offline')||'—')+'</p>'; });
  }

  el('cmpComps').addEventListener('click',function(e){ var b=e.target.closest('[data-c]'); if(b && b.getAttribute('data-c')!==key){ A=''; B=''; setComp(b.getAttribute('data-c')); } });
  el('cmpA').addEventListener('change',function(){ A=this.value; if(A===B) B=''; defaults(); writeUrl(); renderAll(); loadHistory(); });
  el('cmpB').addEventListener('change',function(){ B=this.value; if(A===B) A=''; defaults(); writeUrl(); renderAll(); loadHistory(); });
  el('cmpSwap').addEventListener('click',function(){ var x=A; A=B; B=x; writeUrl(); renderAll(); });
  el('cmpShare').addEventListener('click',function(){
    var b=this, done=function(){ b.textContent=T('Lien copié ✓','Link copied ✓'); setTimeout(function(){ b.textContent=T('Copier le lien','Copy link'); },1800); };
    if(navigator.clipboard) navigator.clipboard.writeText(location.href).then(done,done); else done();
  });
  document.addEventListener('click',function(e){
    var b=e.target.closest('.cmp-team[data-club]'); if(!b) return;
    LDCClubPanel.open(b.getAttribute('data-club'), { matches:matches, standings:standings, espn:E, thresholds:LDCThresholds.forLeague(comp().slug) });
  });
  window.addEventListener('ldc:langchange', renderAll);
  setComp(key);
})();
