/* =========================================================================
   lanyard.js — Badge « Mon club » : accréditation suspendue à une lanière
   (physique de corde, carte saisissable), partagé par l'accueil LDC et les
   accueils Europa / Conference League. La page fournit :
     <div id="lanyard"><div class="ly-stage"><canvas id="lanyardCanvas">
       </canvas><div class="lanyard-card" id="lanyardCard"></div></div></div>
   Texte de la lanière, logo et couleur suivent la compétition (ESPN.COMP) ;
   la carte affiche le club favori de cette compétition. Styles : lanyard.css.
   API : window.LDCLanyard = { refresh, rebuild }
   ========================================================================= */
window.LDCLanyard = (function(){
  /* Badge « Mon club » : accréditation suspendue à une lanière, dans la
     colonne droite du bandeau (≥ 960 px). Physique de corde (Verlet) : la
     lanière se balance, la carte se saisit et se lance. Elle ne recouvre
     jamais le contenu : sa place est réservée dans la mise en page, et elle
     est masquée sur les petits écrans (la carte « Mon équipe » suffit). */
  var host=document.getElementById('lanyard');
  var canvas=document.getElementById('lanyardCanvas');
  var card=document.getElementById('lanyardCard');
  var stage=host && host.querySelector('.ly-stage');
  if(!host||!canvas||!card||!stage) return { refresh:function(){} };
  var ctx=canvas.getContext('2d');
  var reduce=false; try{ reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}

  var W=0,H=0,dpr=1;
  var CARDW=178, CLIPW=40, BANDLEN=124, SEG=12, DROP=18;
  var pts=[], sticks=[], iSplit=0, iL=0, iR=0;
  var dragging=false, gx=0, gy=0, offL={x:0,y:0}, offR={x:0,y:0}, tt=0, clubCol='245,181,10', ink='#1a1300';
  var down=null;

  /* Compétition de la page (espn.js) : texte de la lanière, logo, couleur. */
  var COMPS={
    ucl:{ code:'LDC', logo:'logo.svg?v=4', rgb:'245,181,10', l1:['Ligue des','Champions'], l2:['Champions','League'] },
    uel:{ code:'UEL', logo:'europa.svg?v=2', rgb:'255,122,26', l1:['Europa','Europa'], l2:['League','League'] },
    uecl:{ code:'UECL', logo:'conference.svg?v=1', rgb:'25,196,79', l1:['Conference','Conference'], l2:['League','League'] }
  };
  function C(){ var c=window.ESPN&&ESPN.COMP; var x=COMPS[c&&c.key]||COMPS.ucl; x.fr=c?c.fr:'Ligue des Champions'; x.en=c?c.en:'Champions League'; return x; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function L(){ try{ return (window.I18N&&I18N.getLang&&I18N.getLang())||'fr'; }catch(e){ return 'fr'; } }
  function T(fr,en){ return L()==='en'?en:fr; }
  function mk(x,y){ return {x:x,y:y,ox:x,oy:y,pin:false}; }
  function visible(){ return getComputedStyle(host).display!=='none'; }

  function resize(){
    dpr=Math.min(2,window.devicePixelRatio||1);
    W=stage.clientWidth; H=stage.clientHeight;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function local(e){ var r=stage.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; }
  function build(){
    card.style.width=CARDW+'px';
    resize();
    var ax=W/2, ay=0;
    pts=[ {x:ax,y:ay,ox:ax,oy:ay,pin:true} ];
    var N=Math.max(5,Math.round(BANDLEN/SEG));
    for(var i=1;i<=N;i++) pts.push(mk(ax, ay+i*SEG));
    iSplit=pts.length-1;
    var cy=ay+BANDLEN+DROP;
    pts.push(mk(ax-CLIPW/2, cy)); iL=pts.length-1;
    pts.push(mk(ax+CLIPW/2, cy)); iR=pts.length-1;
    sticks=[];
    for(var s=0;s<iSplit;s++) sticks.push([s,s+1,SEG]);
    var leg=Math.sqrt((CLIPW/2)*(CLIPW/2)+DROP*DROP);
    sticks.push([iSplit,iL,leg]); sticks.push([iSplit,iR,leg]); sticks.push([iL,iR,CLIPW]);
  }

  function solve(st){
    var a=pts[st[0]], b=pts[st[1]], len=st[2];
    var dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)||0.0001;
    var diff=(len-d)/d*0.5, ox=dx*diff, oy=dy*diff;
    if(!a.pin){ a.x-=ox; a.y-=oy; } if(!b.pin){ b.x+=ox; b.y+=oy; }
  }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  /* La carte reste dans la scène (colonne du badge et ses marges). */
  function containClip(){
    var Lp=pts[iL], Rp=pts[iR], midx=(Lp.x+Rp.x)/2, midy=(Lp.y+Rp.y)/2;
    var minX=CARDW/2+6, maxX=W-CARDW/2-6; if(maxX<minX){ minX=maxX=W/2; }
    var cardH=card.offsetHeight||250, minY=40, maxY=Math.max(minY,H-cardH-6);
    var dx=clamp(midx,minX,maxX)-midx, dy=clamp(midy,minY,maxY)-midy;
    Lp.x+=dx; Lp.y+=dy; Rp.x+=dx; Rp.y+=dy; Lp.ox+=dx; Lp.oy+=dy; Rp.ox+=dx; Rp.oy+=dy;
  }
  function stabilizeClip(){
    var Lp=pts[iL], Rp=pts[iR], cx=(Lp.x+Rp.x)/2, cy=(Lp.y+Rp.y)/2;
    var ang=clamp(Math.atan2(Rp.y-Lp.y,Rp.x-Lp.x),-0.9,0.9);
    var hx=Math.cos(ang)*CLIPW/2, hy=Math.sin(ang)*CLIPW/2;
    var lx=cx-hx, ly=cy-hy, rx=cx+hx, ry=cy+hy;
    Lp.ox+=lx-Lp.x; Lp.oy+=ly-Lp.y; Rp.ox+=rx-Rp.x; Rp.oy+=ry-Rp.y;
    Lp.x=lx; Lp.y=ly; Rp.x=rx; Rp.y=ry;
  }
  function capVelocity(p,max){
    var vx=p.x-p.ox, vy=p.y-p.oy, sp=Math.sqrt(vx*vx+vy*vy);
    if(sp>max){ var k=max/sp; p.ox=p.x-vx*k; p.oy=p.y-vy*k; }
  }
  function setDrag(){
    pts[iL].x=gx+offL.x; pts[iL].y=gy+offL.y; pts[iR].x=gx+offR.x; pts[iR].y=gy+offR.y;
    containClip(); stabilizeClip();
  }
  function step(){
    var g=0.55, damp=0.982;
    var wind=(dragging||reduce)?0:(Math.sin(tt*0.8)*0.035+Math.sin(tt*0.31)*0.02);
    for(var i=0;i<pts.length;i++){ var p=pts[i]; if(p.pin) continue;
      var vx=(p.x-p.ox)*damp, vy=(p.y-p.oy)*damp; p.ox=p.x; p.oy=p.y; p.x+=vx+wind; p.y+=vy+g; }
    for(var k=0;k<16;k++){ pts[0].x=W/2; pts[0].y=0; if(dragging) setDrag(); for(var j=0;j<sticks.length;j++) solve(sticks[j]); }
    pts[0].x=W/2; pts[0].y=0; if(dragging) setDrag();
    stabilizeClip(); containClip();
  }

  /* ---- Dessin : lanière tissée, mousqueton, anneau ---- */
  function centerline(){
    var P=[]; for(var i=0;i<=iSplit;i++) P.push({x:pts[i].x,y:pts[i].y}); return P;
  }
  function offsetLine(P,d){
    var out=[];
    for(var i=0;i<P.length;i++){
      var a=P[i>0?i-1:0], b=P[i<P.length-1?i+1:P.length-1], dx=b.x-a.x, dy=b.y-a.y, l=Math.sqrt(dx*dx+dy*dy)||1;
      out.push({x:P[i].x-dy/l*d, y:P[i].y+dx/l*d});
    }
    return out;
  }
  function ribbon(P,hw){
    var Lt=offsetLine(P,hw), Rt=offsetLine(P,-hw), i;
    ctx.beginPath(); ctx.moveTo(Lt[0].x,Lt[0].y);
    for(i=1;i<Lt.length;i++) ctx.lineTo(Lt[i].x,Lt[i].y);
    for(i=Rt.length-1;i>=0;i--) ctx.lineTo(Rt[i].x,Rt[i].y);
    ctx.closePath();
  }
  function polyline(P){ ctx.beginPath(); ctx.moveTo(P[0].x,P[0].y); for(var i=1;i<P.length;i++) ctx.lineTo(P[i].x,P[i].y); }
  function strapText(P){
    var seg=[], total=0, i;
    for(i=1;i<P.length;i++){ var dx=P[i].x-P[i-1].x, dy=P[i].y-P[i-1].y, d=Math.sqrt(dx*dx+dy*dy); seg.push({a:P[i-1],b:P[i],len:d,start:total}); total+=d; }
    if(total<30) return;
    function at(s){
      for(var i=0;i<seg.length;i++){ var e=seg[i]; if(s<=e.start+e.len || i===seg.length-1){ var t=e.len?(s-e.start)/e.len:0; t=clamp(t,0,1);
        return {x:e.a.x+(e.b.x-e.a.x)*t, y:e.a.y+(e.b.y-e.a.y)*t, ang:Math.atan2(e.b.y-e.a.y,e.b.x-e.a.x)}; } }
    }
    ctx.save();
    ctx.font='400 11px "Bebas Neue", Impact, sans-serif';
    ctx.fillStyle=ink==='#ffffff'?'rgba(255,255,255,.9)':'rgba(10,14,30,.82)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    var unit=(T(C().fr,C().en)).toUpperCase()+'  ★  ', s=26, idx=0, guard=0;
    while(s<total-6 && guard<400){ guard++;
      var ch=unit.charAt(idx%unit.length), w=ctx.measureText(ch).width;
      if(ch!==' '){ var p=at(s+w/2); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.ang); ctx.fillText(ch,0,0.5); ctx.restore(); }
      s+=(ch===' ')?w*0.7:(w+1.6); idx++;
    }
    ctx.restore();
  }
  function metal(x0,y0,x1,y1){
    var g=ctx.createLinearGradient(x0,y0,x1,y1);
    g.addColorStop(0,'#f4f7fb'); g.addColorStop(.45,'#b9c1cf'); g.addColorStop(.55,'#8d96a7'); g.addColorStop(1,'#dfe4ec');
    return g;
  }
  function render(){
    ctx.clearRect(0,0,W,H);
    var P=centerline(), split=pts[iSplit], Lp=pts[iL], Rp=pts[iR];
    var mx=(Lp.x+Rp.x)/2, my=(Lp.y+Rp.y)/2, ang=Math.atan2(Rp.y-Lp.y,Rp.x-Lp.x);
    ctx.lineCap='round'; ctx.lineJoin='round';
    // lanière : ombre portée douce, tissu aux couleurs du club, coutures, texte
    ctx.save(); ctx.translate(2,3); ribbon(P,8.5); ctx.fillStyle='rgba(0,0,0,.30)'; ctx.fill(); ctx.restore();
    ribbon(P,8); ctx.fillStyle='rgb('+clubCol+')'; ctx.fill();
    ribbon(P,8); ctx.save(); ctx.clip();
    ctx.globalAlpha=.16; for(var k=-1;k<=1;k+=2){ polyline(offsetLine(P,k*3)); ctx.strokeStyle=k<0?'#fff':'#000'; ctx.lineWidth=5; ctx.stroke(); }
    ctx.restore();
    ctx.setLineDash([2.5,2.5]); ctx.lineWidth=.9; ctx.strokeStyle=ink==='#ffffff'?'rgba(255,255,255,.45)':'rgba(0,0,0,.35)';
    polyline(offsetLine(P,6)); ctx.stroke(); polyline(offsetLine(P,-6)); ctx.stroke(); ctx.setLineDash([]);
    strapText(P);
    // embout cousu au bout de la lanière
    ctx.save(); ctx.translate(split.x,split.y); ctx.rotate(Math.atan2(split.y-P[P.length-2].y,split.x-P[P.length-2].x)-Math.PI/2);
    ctx.fillStyle=metal(-9,0,9,0); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-9,-7,18,9,2) : ctx.rect(-9,-7,18,9); ctx.fill();
    ctx.restore();
    // anneau pivotant puis mousqueton jusqu'à la fente de la carte
    ctx.lineWidth=2.6; ctx.strokeStyle=metal(split.x-6,split.y,split.x+6,split.y);
    ctx.beginPath(); ctx.arc(split.x,split.y+5,4.5,0,Math.PI*2); ctx.stroke();
    var cx=mx, cy=my+6;
    ctx.save(); ctx.translate(split.x,split.y+9);
    var dxc=cx-split.x, dyc=cy-(split.y+9), lc=Math.sqrt(dxc*dxc+dyc*dyc)||1; ctx.rotate(Math.atan2(dyc,dxc)-Math.PI/2);
    ctx.fillStyle=metal(-5,0,5,0); ctx.beginPath();
    ctx.moveTo(-2.5,0); ctx.lineTo(2.5,0); ctx.lineTo(5,lc*0.45); ctx.quadraticCurveTo(5,lc,0,lc+2); ctx.quadraticCurveTo(-5,lc,-5,lc*0.45); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(20,26,40,.55)'; ctx.beginPath(); ctx.ellipse(0,lc*0.62,1.8,lc*0.22,0,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // carte : son bord haut passe sous le mousqueton
    card.style.transform='translate('+(mx-CARDW/2)+'px,'+(my-2)+'px) rotate('+ang+'rad)';
    card.style.setProperty('--tilt', (ang*40).toFixed(1)+'%');
  }

  var raf=null;
  function loop(){
    raf=requestAnimationFrame(loop);
    if(document.hidden || !visible()) return;
    tt+=0.016; step(); render();
  }

  /* ---- Contenu de la carte ---- */
  function lum(rgb){ var c=rgb.split(',').map(function(v){ v=(+v)/255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }
  /* Code-barres décoratif, propre à chaque club (déterministe). */
  function barcode(seed){
    var h=0, s=String(seed||'LDC'); for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    var x=0, stops=[];
    for(var b=0;b<30 && x<100;b++){ h=(h*1103515245+12345)>>>0; var w=1+(h>>>16)%3, gap=1+(h>>>8)%2;
      stops.push('#0b1020 '+x+'px '+(x+w)+'px','transparent '+(x+w)+'px '+(x+w+gap)+'px'); x+=w+gap; }
    return 'linear-gradient(90deg,'+stops.join(',')+')';
  }
  function fitName(){
    var n=card.querySelector('.lc-name'); if(!n) return;
    var size=26; n.style.fontSize=size+'px';
    while((n.scrollWidth>n.clientWidth || n.scrollHeight>size*2.3) && size>15){ size--; n.style.fontSize=size+'px'; }
  }
  function refresh(){
    var f=(window.ESPN&&ESPN.getFav)?ESPN.getFav():null;
    clubCol=(window.ESPN&&ESPN.favAccent&&ESPN.favAccent())||C().rgb;
    ink=lum(clubCol)>0.42?'#0b1020':'#ffffff';
    var season=(window.ESPN&&ESPN.seasonLabel)?ESPN.seasonLabel():'2026–27';
    var crest=f?(f.logo||C().logo):C().logo;
    var name=f?f.name:T('Mon club','My club');
    var role=f?T('Supporter','Supporter'):T('Choisis ton équipe','Pick your team');
    var code=(f?(f.abbr||'').toUpperCase():'')||C().code;
    card.classList.toggle('is-empty',!f);
    card.title=f?'':T('Choisir mon équipe','Choose my team');
    card.innerHTML='<div class="lc-inner" style="--club:'+clubCol+';--ink:'+ink+'">'+
        '<span class="lc-slot"></span>'+
        '<div class="lc-head">'+
          '<span class="lc-brand"><img src="'+C().logo+'" alt=""><span>'+esc(T(C().l1[0],C().l1[1]))+'<br>'+esc(T(C().l2[0],C().l2[1]))+'</span></span>'+
          '<span class="lc-season">'+esc(season)+'</span>'+
        '</div>'+
        '<div class="lc-crest"><img src="'+esc(crest)+'" alt="" onerror="this.onerror=null;this.src=\''+C().logo+'\'"></div>'+
        '<div class="lc-body">'+
          '<div class="lc-name">'+esc(name)+'</div>'+
          '<div class="lc-role">'+esc(role)+'</div>'+
          '<div class="lc-foot"><span class="lc-code">'+esc(code)+' · '+esc(season.replace('–','/'))+'</span><span class="lc-bar" style="background:'+barcode(f?f.id:'LDC')+'"></span></div>'+
        '</div>'+
        '<span class="lc-holo"></span>'+
      '</div>';
    fitName();
  }

  /* ---- Saisie : glisser pour lancer ; un simple clic sans favori ouvre le choix ---- */
  card.addEventListener('pointerdown', function(e){
    dragging=true; card.classList.add('grabbing');
    try{ card.setPointerCapture(e.pointerId); }catch(_){}
    var p=local(e); gx=p.x; gy=p.y; down={x:e.clientX,y:e.clientY,t:Date.now()};
    offL={x:pts[iL].x-gx, y:pts[iL].y-gy}; offR={x:pts[iR].x-gx, y:pts[iR].y-gy};
    pts[iL].pin=true; pts[iR].pin=true;
    e.preventDefault();
  });
  window.addEventListener('pointermove', function(e){
    if(!dragging) return;
    pts[iL].ox=pts[iL].x; pts[iL].oy=pts[iL].y; pts[iR].ox=pts[iR].x; pts[iR].oy=pts[iR].y;
    var p=local(e); gx=p.x; gy=p.y; setDrag();
  });
  function endDrag(e){
    if(!dragging) return;
    dragging=false; card.classList.remove('grabbing');
    capVelocity(pts[iL],14); capVelocity(pts[iR],14);
    pts[iL].pin=false; pts[iR].pin=false;
    if(e && e.type==='pointerup' && down && Math.abs(e.clientX-down.x)<5 && Math.abs(e.clientY-down.y)<5 && Date.now()-down.t<450){
      var choose=document.querySelector('#favChoose,[data-fav="choose"]'); if(choose && !(window.ESPN&&ESPN.getFav())) choose.click();
    }
    down=null;
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('blur', endDrag);

  var rt; window.addEventListener('resize', function(){ clearTimeout(rt); rt=setTimeout(build, 200); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);

  build(); refresh(); loop();
  return { refresh:refresh, rebuild:build };
})();
