/* =======================================================================
   share.js — Cartes partageables (canvas -> PNG). 100% côté client.
   API : window.ShareCard = { pass(fav?), champion(data), quiz(data) }
   Chaque fonction dessine une image 1080x1350, la télécharge, et tente
   le partage natif (Web Share) sur mobile. Renvoie le <canvas>.
   ======================================================================= */
(function(){
  'use strict';
  var W = 1080, H = 1350;
  var DISP = "'Bebas Neue', Impact, 'Arial Black', sans-serif";
  var BODY = "'Inter', system-ui, Arial, sans-serif";

  function lang(){ try{ return (window.I18N && I18N.getLang && I18N.getLang()) || 'fr'; }catch(e){ return 'fr'; } }
  function T(fr,en){ return lang()==='en' ? en : fr; }

  /* ---- couleur lisible (portée d'espn.js) ---- */
  function hexToRgb(hex){ hex=String(hex||'').replace(/^#/,'').trim(); if(hex.length===3) hex=hex.replace(/(.)/g,'$1$1'); if(!/^[0-9a-fA-F]{6}$/.test(hex)) return null; return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)]; }
  function rgbToHsl(r,g,b){ r/=255;g/=255;b/=255; var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h,s,l=(mx+mn)/2; if(mx===mn){h=s=0;} else { var d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn); switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;} h/=6; } return [h,s,l]; }
  function hslToRgb(h,s,l){ var r,g,b; if(s===0){r=g=b=l;} else { var hue=function(p,q,t){ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; }; var q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q; r=hue(p,q,h+1/3); g=hue(p,q,h); b=hue(p,q,h-1/3); } return [Math.round(r*255),Math.round(g*255),Math.round(b*255)]; }
  function legible(hex){ var rgb=hexToRgb(hex); if(!rgb) return null; var hsl=rgbToHsl(rgb[0],rgb[1],rgb[2]); var s=Math.max(hsl[1],0.5), l=Math.min(Math.max(hsl[2],0.52),0.70); var o=hslToRgb(hsl[0],s,l); return o[0]+','+o[1]+','+o[2]; }
  function accentRGB(){ try{ return (window.ESPN && ESPN.favAccent && ESPN.favAccent()) || '245,181,10'; }catch(e){ return '245,181,10'; } }

  function loadImg(src){ return new Promise(function(res){ if(!src){res(null);return;} var im=new Image(); im.crossOrigin='anonymous'; var to=setTimeout(function(){res(null);},7000); im.onload=function(){clearTimeout(to);res(im);}; im.onerror=function(){clearTimeout(to);res(null);}; im.src=src; }); }
  function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function starPath(ctx,cx,cy,R){ var r=R*0.382,i; ctx.beginPath(); for(i=0;i<10;i++){ var ang=(-90+i*36)*Math.PI/180, rad=(i%2===0)?R:r, x=cx+rad*Math.cos(ang), y=cy+rad*Math.sin(ang); if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.closePath(); }
  function fitFont(ctx, text, maxW, startSize, weight, family){ var s=startSize; do{ ctx.font=weight+' '+s+'px '+family; if(ctx.measureText(text).width<=maxW) break; s-=2; }while(s>22); return s; }
  function ready(){ return new Promise(function(res){ try{ if(document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){res();}, function(){res();}); setTimeout(res,1500); } else res(); }catch(e){ res(); } }); }

  var STARS=[[120,180,2],[300,120,1.5],[880,220,2],[980,520,1.6],[80,700,2],[520,90,1.4],[720,1010,2],[200,1120,1.6],[900,1180,2],[420,1260,1.4],[640,650,1.6],[1000,860,1.8],[60,420,1.5],[760,320,1.4]];
  function drawBg(ctx, rgb){
    var g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#0e1736'); g.addColorStop(.58,'#0a1024'); g.addColorStop(1,'#05070f'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    var rg=ctx.createRadialGradient(W/2,H*0.33,40,W/2,H*0.33,W*0.72); rg.addColorStop(0,'rgba('+rgb+',0.20)'); rg.addColorStop(1,'rgba('+rgb+',0)'); ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(150,170,210,0.11)'; STARS.forEach(function(s){ ctx.beginPath(); ctx.arc(s[0],s[1],s[2],0,6.283); ctx.fill(); });
    ctx.strokeStyle='rgba('+rgb+',0.55)'; ctx.lineWidth=6; rr(ctx,26,26,W-52,H-52,42); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=2; rr(ctx,36,36,W-72,H-72,34); ctx.stroke();
  }
  function brandTop(ctx, rgb){ ctx.save(); starPath(ctx,96,102,22); ctx.fillStyle='rgb('+rgb+')'; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.fillStyle='rgba(255,255,255,.92)'; ctx.font='400 34px '+DISP; ctx.textBaseline='middle'; ctx.textAlign='left'; ctx.fillText('LIGUE DES CHAMPIONS', 134, 104); ctx.restore(); }
  function brandBottom(ctx){ ctx.save(); ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.fillStyle='rgba(255,255,255,.42)'; ctx.font='600 26px '+BODY; ctx.fillText(T('Tracker Ligue des Champions · non officiel','Champions League Tracker · unofficial'), W/2, H-66); ctx.restore(); }

  function finish(cv, filename){
    try{
      cv.toBlob(function(blob){
        if(!blob) return;
        try{ if(navigator.canShare){ var f=new File([blob],filename,{type:'image/png'}); if(navigator.canShare({files:[f]})){ navigator.share({files:[f], title:'LDC'}).catch(function(){}); } } }catch(e){}
        try{ var url=URL.createObjectURL(blob); var a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},3000); }catch(e){}
      }, 'image/png');
    }catch(e){}
  }

  function crestCircle(ctx, cx, cy, R, rgb, crest, fallbackAbbr){
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.fillStyle='#0c1631'; ctx.fill(); ctx.lineWidth=8; ctx.strokeStyle='rgba('+rgb+',.7)'; ctx.stroke(); ctx.restore();
    if(crest){ var s=R*1.35; ctx.drawImage(crest, cx-s/2, cy-s/2, s, s); }
    else { ctx.save(); starPath(ctx,cx,cy,R*0.6); ctx.fillStyle='rgb('+rgb+')'; ctx.fill(); ctx.restore(); if(fallbackAbbr){ ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='700 '+(R*0.5)+'px '+DISP; } }
  }

  /* ================= PASS SUPPORTER ================= */
  async function pass(fav){
    await ready();
    fav = fav || (window.ESPN && ESPN.getFav && ESPN.getFav()) || null;
    var rgb = (fav && fav.color && legible(fav.color)) || accentRGB();
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var ctx=cv.getContext('2d');
    drawBg(ctx, rgb); brandTop(ctx, rgb);
    var crest = fav ? await loadImg(fav.logo) : null;
    ctx.save(); rr(ctx,90,206,W-180,120,26); var bb=ctx.createLinearGradient(90,206,W-90,206); bb.addColorStop(0,'rgba('+rgb+',.92)'); bb.addColorStop(1,'rgba('+rgb+',.5)'); ctx.fillStyle=bb; ctx.fill(); ctx.restore();
    ctx.fillStyle='rgba(0,0,0,.85)'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='700 52px '+DISP; ctx.fillText(T('PASS SUPPORTER','SUPPORTER PASS'), W/2, 268);
    crestCircle(ctx, W/2, 620, 210, rgb, crest, fav&&fav.abbr);
    var name=(fav?fav.name:T('Mon club','My club')).toUpperCase();
    ctx.textAlign='center'; ctx.fillStyle='#fff'; var ns=fitFont(ctx,name,W-200,104,'700',DISP); ctx.font='700 '+ns+'px '+DISP; ctx.textBaseline='alphabetic'; ctx.fillText(name, W/2, 960);
    ctx.fillStyle='rgba('+rgb+',1)'; ctx.font='700 40px '+DISP; ctx.fillText((fav&&fav.abbr?fav.abbr+'  ·  ':'')+'SAISON 2026-27', W/2, 1015);
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.font='600 30px '+BODY; ctx.fillText(T('Mon club favori','My favourite club'), W/2, 1085);
    brandBottom(ctx);
    finish(cv, 'ldc-pass-'+((fav&&fav.abbr)||'club').toLowerCase()+'.png');
    return cv;
  }

  /* ================= CHAMPION DU PARCOURS ================= */
  async function champion(data){
    await ready(); data=data||{};
    var champ=data.champ||{};
    var rgb=(champ.color && legible(champ.color)) || accentRGB();
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var ctx=cv.getContext('2d');
    drawBg(ctx, rgb); brandTop(ctx, rgb);
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='700 40px '+DISP; ctx.fillText(T('MON CHAMPION','MY CHAMPION'), W/2, 250);
    ctx.fillStyle='rgb('+rgb+')'; ctx.font='600 28px '+BODY; ctx.fillText(T('Mon parcours vers la finale','My road to the final')+(data.season?' · '+data.season:''), W/2, 292);
    var crest=await loadImg(champ.logo);
    crestCircle(ctx, W/2, 560, 200, rgb, crest, champ.abbr);
    var name=(champ.name||'—').toUpperCase();
    ctx.textAlign='center'; ctx.fillStyle='#fff'; var ns=fitFont(ctx,name,W-200,100,'700',DISP); ctx.font='700 '+ns+'px '+DISP; ctx.fillText(name, W/2, 880);
    // road
    var road=(data.road||[]).slice(-4);
    if(road.length){
      var y=960, rowH=78, x0=140, x1=W-140;
      road.forEach(function(r){
        ctx.save(); rr(ctx, x0, y, x1-x0, rowH-14, 16); ctx.fillStyle='rgba(255,255,255,.05)'; ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle='rgba('+rgb+',.35)'; ctx.stroke(); ctx.restore();
        ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='rgb('+rgb+')'; ctx.font='700 26px '+DISP; ctx.fillText((r.round||'').toUpperCase(), x0+26, y+(rowH-14)/2);
        ctx.textAlign='right'; ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='600 26px '+BODY; ctx.fillText(T('bat ','beat ')+(r.opp||''), x1-26, y+(rowH-14)/2);
        y+=rowH;
      });
    }
    brandBottom(ctx);
    finish(cv, 'ldc-champion-'+((champ.abbr)||'run').toLowerCase()+'.png');
    return cv;
  }

  /* ================= SCORES DE QUIZ ================= */
  async function quiz(data){
    await ready(); data=data||{};
    var rgb=accentRGB();
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var ctx=cv.getContext('2d');
    drawBg(ctx, rgb); brandTop(ctx, rgb);
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#fff'; ctx.font='700 84px '+DISP; ctx.fillText(T('MES SCORES','MY SCORES'), W/2, 320);
    ctx.fillStyle='rgb('+rgb+')'; ctx.font='600 30px '+BODY; ctx.fillText(T('Quiz Ligue des Champions','Champions League Quiz'), W/2, 370);
    var rows=(data.rows||[]);
    var y=470, rowH=118, x0=120, x1=W-120;
    rows.slice(0,6).forEach(function(r){
      ctx.save(); rr(ctx, x0, y, x1-x0, rowH-18, 20); ctx.fillStyle='rgba(255,255,255,.05)'; ctx.fill(); ctx.lineWidth=1.5; ctx.strokeStyle='rgba('+rgb+',.30)'; ctx.stroke(); ctx.restore();
      ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(255,255,255,.92)'; ctx.font='600 40px '+BODY; ctx.fillText(r.label||'', x0+40, y+(rowH-18)/2);
      ctx.textAlign='right'; ctx.fillStyle='rgb('+rgb+')'; ctx.font='700 58px '+DISP; ctx.fillText(String(r.value==null?'—':r.value), x1-40, y+(rowH-18)/2+4);
      y+=rowH;
    });
    if(data.total!=null){ ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,.6)'; ctx.font='600 30px '+BODY; ctx.fillText(T('Meilleure série','Best streak')+' : '+data.total, W/2, y+50); }
    brandBottom(ctx);
    finish(cv, 'ldc-quiz.png');
    return cv;
  }

  window.ShareCard = { pass:pass, champion:champion, quiz:quiz, _legible:legible };
})();
