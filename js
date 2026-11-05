// Stratégie unique, utilisée par le site (index.html) ET par le scanner 24/7 (scan.mjs).
const Strat=(()=>{
const SL=1.5,TP=3; // stop = 1,5×ATR, objectif = 3×ATR (risque/gain 1:2)
const ema=(a,n)=>{const k=2/(n+1);let e=a[0];return a.map((v,i)=>i?(e=v*k+e*(1-k)):e)};
function rsi(c,n=14){const o=Array(c.length).fill(50);let g=0,l=0;
  for(let i=1;i<c.length;i++){const d=c[i]-c[i-1];
    if(i<=n){g+=Math.max(d,0)/n;l+=Math.max(-d,0)/n}else{g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}
    if(i>=n)o[i]=l===0?100:100-100/(1+g/l)}return o}
function atr(cs,n=14){let a=0;return cs.map((x,i)=>{const tr=i?Math.max(x.h-x.l,Math.abs(x.h-cs[i-1].c),Math.abs(x.l-cs[i-1].c)):x.h-x.l;a=i?(a*(n-1)+tr)/n:tr;return a})}
function adx(cs,n=14){const o=Array(cs.length).fill(0);let tr=0,pd=0,md=0,ad=0;
  for(let i=1;i<cs.length;i++){const up=cs[i].h-cs[i-1].h,dn=cs[i-1].l-cs[i].l,
    t=Math.max(cs[i].h-cs[i].l,Math.abs(cs[i].h-cs[i-1].c),Math.abs(cs[i].l-cs[i-1].c)),
    p=up>dn&&up>0?up:0,m=dn>up&&dn>0?dn:0;
    if(i<=n){tr+=t;pd+=p;md+=m}else{tr+=t-tr/n;pd+=p-pd/n;md+=m-md/n}
    if(i>=n){const a=100*pd/tr,b=100*md/tr,d=100*Math.abs(a-b)/((a+b)||1);
      if(i<2*n){ad+=d/n;if(i===2*n-1)o[i]=ad}else{ad=(ad*(n-1)+d)/n;o[i]=ad}}}
  return o}
function indicators(cs){const c=cs.map(x=>x.c);
  return {cs,c,e9:ema(c,9),e21:ema(c,21),e50:ema(c,50),e200:ema(c,200),r:rsi(c),a:atr(cs),adx:adx(cs)}}

// Signal sur la bougie i (fermée). adv = filtres avancés : marché en tendance (ADX>20) + sens de l'EMA 200.
function signalAt(I,i,adv){
  const {c,e9,e21,e50,e200,r,adx}=I; if(i<51) return null; let s=null;
  const up=e9[i-1]<=e21[i-1]&&e9[i]>e21[i], dn=e9[i-1]>=e21[i-1]&&e9[i]<e21[i];
  if(up&&c[i]>e50[i]&&r[i]>40&&r[i]<68) s="BUY";
  else if(dn&&c[i]<e50[i]&&r[i]<60&&r[i]>32) s="SELL";
  else if(e9[i]>e21[i]&&e21[i]>e50[i]&&r[i-1]<45&&r[i]>=45) s="BUY";   // reprise dans la tendance
  else if(e9[i]<e21[i]&&e21[i]<e50[i]&&r[i-1]>55&&r[i]<=55) s="SELL";
  if(s&&adv&&!(adx[i]>20&&(s==="BUY"?c[i]>e200[i]:c[i]<e200[i]))) return null;
  return s}
const levels=(side,e,d)=>({sl:side==="BUY"?e-SL*d:e+SL*d,tp:side==="BUY"?e+TP*d:e-TP*d});
function liveSignal(I,adv){const n=I.cs.length;
  for(let k=0;k<3;k++){const j=n-2-k,s=signalAt(I,j,adv);
    if(s){const e=I.c[n-1];return {side:s,ct:I.cs[j].t,entry:e,...levels(s,e,I.a[n-2])}}}
  return null}

// Backtest : entrée à l'ouverture de la bougie suivante, un trade à la fois, SL prioritaire si SL et TP dans la même bougie, frais inclus.
function backtest(cs,{adv=true,costPct=0.1}={}){
  const I=indicators(cs),n=cs.length,trades=[];
  for(let i=210;i<n-2;i++){const s=signalAt(I,i,adv); if(!s) continue;
    const e=cs[i+1].o,d=I.a[i],{sl,tp}=levels(s,e,d),buy=s==="BUY";let res=null,j=i+1;
    for(;j<n;j++){const x=cs[j]; if(buy?x.l<=sl:x.h>=sl){res="SL";break} if(buy?x.h>=tp:x.l<=tp){res="TP";break}}
    if(!res) break;
    trades.push({t:cs[i+1].t,side:s,entry:e,sl,tp,res,r:(res==="TP"?TP/SL:-1)-costPct/100*e/(SL*d)});
    i=j;}
  return {trades,stats:stats(trades)}}
function stats(t){const n=t.length,w=t.filter(x=>x.res==="TP").length,
  g=t.filter(x=>x.r>0).reduce((a,x)=>a+x.r,0),l=-t.filter(x=>x.r<0).reduce((a,x)=>a+x.r,0);
  let cum=0,pk=0,dd=0;t.forEach(x=>{cum+=x.r;pk=Math.max(pk,cum);dd=Math.max(dd,pk-cum)});
  return {n,win:n?w/n:0,total:cum,avg:n?cum/n:0,pf:l?g/l:(g?Infinity:0),dd}}
return {indicators,signalAt,liveSignal,backtest,stats,SL,TP};
})();
