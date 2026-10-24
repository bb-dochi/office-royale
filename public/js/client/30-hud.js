/* ================= HUD ================= */
let cineT=0;
/* the floor column beside the minimap: 7F at the top, my floor filled blue, closing floor blinking */
function floorsHTML(){
  const counts=new Array(NF).fill(0);
  for(const a of G.actors)if(a.alive){const f=a.transit?a.transit.to:a.f;if(f>=0&&f<NF)counts[f]++;}
  const meF=G.me.alive?(G.me.transit?G.me.transit.to:G.me.f):-9;
  let h=G.lunch?`<div class="fc roof${meF===ROOF?' me':''}"><span>RF</span><span>🍱</span></div>`:'';
  h+=`<div class="fc ceo" title="CEO층"><span>7F</span><span>★</span></div>`;
  for(let f=NF-1;f>=0;f--){
    const st=f<G.closed?'closed':isLocked(f)?'locked':'open';
    const cls=['fc',st,warnFloor(f)?'warn':'',f===meF?'me':''].join(' ');
    h+=`<div class="${cls}"><span>${FLOORS[f].short}</span><span>${st==='closed'?'✕':st==='locked'?'':counts[f]}</span></div>`;
  }
  return h;
}
/* floor map: a dark floor plan. Walls and furniture don't move, so they're drawn once per floor and size into
   an offscreen layer; people, tasks and cones go on top every update, in screen pixels so they stay crisp */
const MINI={key:'',layer:null};
const MP={plate:'#323b44',edge:'#56616b',wall:'#c3ccd4',glass:'#7fb3d6',furn:'#46515b',meet:'rgba(127,179,214,.16)',rest:'#3b4650',me:'#4f93e0',task:'#f3d77a'};
function miniRR(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function miniLayer(f,cw,ch,dpr,big){
  const key=[f,cw,ch,dpr,big].join('|');if(MINI.key===key)return MINI.layer;
  const L=MINI.layer||document.createElement('canvas');L.width=Math.round(cw*dpr);L.height=Math.round(ch*dpr);
  const c=L.getContext('2d'),fl=FLOORS[f],s=Math.min((cw-4)/FW,(ch-4)/FH),ox=(cw-FW*s)/2,oy=(ch-FH*s)/2,X=x=>ox+x*s,Y=y=>oy+y*s;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);
  miniRR(c,X(0),Y(0),FW*s,FH*s,big?10:6);c.fillStyle=f===ROOF?'#3a4148':MP.plate;c.fill();c.strokeStyle=MP.edge;c.lineWidth=1;c.stroke();
  c.save();miniRR(c,X(0),Y(0),FW*s,FH*s,big?10:6);c.clip();
  c.fillStyle=MP.rest;c.fillRect(X(fl.rest.x),Y(fl.rest.y),fl.rest.w*s,fl.rest.h*s);
  c.fillStyle=MP.meet;for(const z of fl.meet)c.fillRect(X(z.x),Y(z.y),z.w*s,z.h*s);
  for(const o of fl.ob){if(o.k==='wall'||o.k==='glass')continue;miniRR(c,X(o.x),Y(o.y),Math.max(o.w*s,2),Math.max(o.h*s,2),big?3:1.5);c.fillStyle=MP.furn;c.fill();}
  for(const o of fl.ob){if(o.k!=='wall'&&o.k!=='glass')continue;c.fillStyle=o.k==='glass'?MP.glass:MP.wall;
    const w=o.w>o.h?o.w*s:Math.max(1.5,o.w*s*.6),h=o.h>o.w?o.h*s:Math.max(1.5,o.h*s*.6);c.fillRect(X(o.x+o.w/2)-w/2,Y(o.y+o.h/2)-h/2,w,h);}
  c.restore();
  const txt=(t,x,y,col,px)=>{c.font=`700 ${px}px 'Noto Sans KR',sans-serif`;c.textAlign='center';c.fillStyle=col;c.fillText(t,x,y);};
  if(f!==ROOF){
    txt('WC',X(fl.rest.x+fl.rest.w/2),Y(fl.rest.y+fl.rest.h/2)+(big?4:3),'rgba(255,255,255,.45)',big?12:8);
    if(big)for(const[t,x,y]of fl.labels)if(t!=='화장실')txt(t,X(x+30),Y(y),'rgba(255,255,255,.4)',11);
    /* stairs and lift: rounded badges with a glyph */
    for(const k in PADS){const p=PADS[k],r=big?14:8;miniRR(c,X(p.x)-r,Y(p.y)-r,r*2,r*2,big?5:3);c.fillStyle='rgba(243,215,122,.16)';c.fill();c.strokeStyle=MP.task;c.lineWidth=big?2:1.2;c.stroke();
      txt(k==='stair'?'⇡':'⇅',X(p.x),Y(p.y)+(big?5:3.5),MP.task,big?15:9);if(big)txt(k==='stair'?'계단':'엘리베이터',X(p.x),Y(p.y)+r+13,'#f3d77a',11);}
  }
  MINI.layer=L;MINI.key=key;MINI.geo={s,ox,oy};return L;
}
function drawMini(){
  const cvs=$('mm'),cw=cvs.clientWidth|0,ch=cvs.clientHeight|0;if(!cw||!ch)return;
  const dpr=Math.min(2,devicePixelRatio||1);if(cvs.width!==Math.round(cw*dpr)||cvs.height!==Math.round(ch*dpr)){cvs.width=Math.round(cw*dpr);cvs.height=Math.round(ch*dpr);}
  const c=cvs.getContext('2d'),f=viewF,fl=FLOORS[f],me=G.me,big=$('mapbox').classList.contains('big');
  const L=miniLayer(f,cw,ch,dpr,big),{s,ox,oy}=MINI.geo,X=x=>ox+x*s,Y=y=>oy+y*s,k=big?1.6:1;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cvs.width,cvs.height);c.drawImage(L,0,0);c.setTransform(dpr,0,0,dpr,0,0);
  const dot=(x,y,r,fill,line)=>{c.beginPath();c.arc(x,y,r,0,7);c.fillStyle=fill;c.fill();if(line){c.strokeStyle=line;c.lineWidth=1;c.stroke();}};
  const lbl=(t,x,y,col,px)=>{c.font=`800 ${px}px 'Noto Sans KR',sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='rgba(29,35,40,.9)';c.strokeText(t,x,y);c.fillStyle=col;c.fillText(t,x,y);};
  for(const d of fl.doors)if(!d.open){c.fillStyle='#b08a5e';c.fillRect(X(d.x),Y(d.y),Math.max(d.w*s,1.5),Math.max(d.h*s,1.5));}
  if(f!==ROOF){
    const dv=G.doors[f];if(dv&&dv.v){c.globalAlpha=.5+.5*Math.sin(G.t*8);c.fillStyle='#e5483a';c.fillRect(X(DOOR.x-40),Y(FH)-3,80*s,3);c.globalAlpha=1;}
    const ms=me.seats&&me.seats[f];if(ms){const r=3*k;miniRR(c,X(ms.x)-r,Y(ms.y)-r,r*2,r*2,1.5);c.fillStyle='rgba(79,147,224,.25)';c.fill();c.strokeStyle=MP.me;c.lineWidth=1.2;c.stroke();if(big)lbl('내 자리',X(ms.x),Y(ms.y)-8,'#9cc8ff',11);}
    for(const it of G.items)if(it.f===f)dot(X(it.x),Y(it.y),2*k,ITEMS[it.k].c,'rgba(0,0,0,.5)');
    /* tasks: small diamonds; mine blue with the progress ring, someone else's grey */
    for(const t of G.tasks){if(t.f!==f)continue;const mine=t.by===me,other=t.by&&!mine,x=X(t.x),y=Y(t.y),r=4.4*k;
      c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();
      c.fillStyle=t.ready&&mine?'#3fbf6a':other?'#7d878f':mine?MP.me:MP.task;c.fill();c.strokeStyle='#1d2328';c.lineWidth=1;c.stroke();
      if(mine&&!t.ready){c.strokeStyle=MP.me;c.lineWidth=1.6;c.beginPath();c.arc(x,y,r+2.6,-Math.PI/2,-Math.PI/2+t.prog*Math.PI*2);c.stroke();}
      if(big)lbl(t.ready&&mine?'제출!':t.name,x,y-r-4,other?'#9aa3ab':'#fbfaf6',11);}
  }
  for(const n of G.npcs){if(n.f!==f||!npcActive(n)||(n.kind!=='boss'&&n.kind!=='ceo'))continue;
    const col=n.kind==='ceo'?'#e0b52a':'#e5483a',v=VIS[n.kind],x=X(n.x),y=Y(n.y);
    if(!(G.blackout&&G.blackout.f===f)&&!(n.kind==='boss'&&!n.senior&&me.rank==='임원')){const g=c.createRadialGradient(x,y,0,x,y,v.len*s);g.addColorStop(0,n.kind==='ceo'?'rgba(224,181,42,.45)':'rgba(229,72,58,.45)');g.addColorStop(1,'rgba(229,72,58,0)');
      c.fillStyle=g;c.beginPath();c.moveTo(x,y);c.arc(x,y,v.len*s,n.face-v.half,n.face+v.half);c.closePath();c.fill();}
    dot(x,y,2.8*k,col,'#1d2328');if(big)lbl(bossTitle(n),x,y-8,'#ffb4aa',11);}
  for(const o of G.actors){if(o===me||!o.alive||o.f!==f||o.transit)continue;
    const star=G.star&&G.star.a===o,shown=me.intelT>0||star||(me.alive&&me.f===f&&seenBy(me,o)&&!(o.cloakT>0));if(!shown)continue;
    dot(X(o.x),Y(o.y),2.2*k,star?'#e0b52a':o.isPlayer?OTHER_HUMAN:me.intelT>0?'#e5483a':'#e8ecef','rgba(0,0,0,.6)');}
  if(me.alive&&me.f===f){const x=X(me.x),y=Y(me.y),a=me.face,r=5*k,pr=r+3+((G.t*1.4)%1)*5*k;
    c.strokeStyle=`rgba(79,147,224,${.6-((G.t*1.4)%1)*.6})`;c.lineWidth=1.5;c.beginPath();c.arc(x,y,pr,0,7);c.stroke();
    c.fillStyle=MP.me;c.strokeStyle='#fff';c.lineWidth=1.5;c.beginPath();c.moveTo(x+Math.cos(a)*r*1.4,y+Math.sin(a)*r*1.4);c.lineTo(x+Math.cos(a+2.5)*r,y+Math.sin(a+2.5)*r);c.lineTo(x+Math.cos(a+Math.PI)*r*.45,y+Math.sin(a+Math.PI)*r*.45);c.lineTo(x+Math.cos(a-2.5)*r,y+Math.sin(a-2.5)*r);c.closePath();c.fill();c.stroke();}
  if(f<G.closed&&f!==ROOF){c.fillStyle='rgba(150,28,18,.5)';miniRR(c,X(0),Y(0),FW*s,FH*s,big?10:6);c.fill();lbl('폐쇄',cw/2,ch/2+5,'#ffd2cc',big?28:15);}
  else if(warnFloor(f)){c.strokeStyle=`rgba(229,72,58,${.5+.5*Math.sin(G.t*9)})`;c.lineWidth=2.5;miniRR(c,X(0)+1,Y(0)+1,FW*s-2,FH*s-2,big?10:6);c.stroke();}
}
/* one line at the top about what matters right now. Urgent states turn it into a coloured band:
   red when my floor is closing (or closed), caution tape for lunch while I'm not on the roof */
let lastStatus='';
function statusLine(me){
  if(!running||!G||G.plaza||G.tutorial||!me||!me.alive||G.over)return null;
  const s=n=>Math.max(0,Math.ceil(n)),fn=f=>f===0?'로비':FLOORS[f].short;
  const onRoof=me.f===ROOF||(me.transit&&me.transit.to===ROOF);
  if(me.f>=0&&me.f<G.closed&&me.f!==ROOF)return{c:'danger',i:'⚠',t:'폐쇄된 층! 고과가 깎이는 중 · 계단·엘리베이터로 올라가세요',m:'폐쇄된 층! 바로 위층으로'};
  if(G.lunch&&!onRoof)return{c:'lunch',i:'🍱',t:`점심시간! 계단·엘리베이터에서 ${isTouch?'상호작용':'E'} → 옥상 라이터 쟁탈전`,m:'점심시간! 계단·엘베 → 옥상',n:s(G.lunch.t)};
  if(G.lunch){const sc=G.lunch.score||{L:0,R:0},mine=me.side?teamOf(me.side):'';
    return{c:'',i:'🚬',t:`점심 난투 · 나는 ${mine}`,m:`점심 난투 · ${mine}`,n:s(G.lunch.t)};}
  if(warnFloor(me.f))return{c:'danger',i:'⚠',t:`${fn(me.f)} 곧 폐쇄! 위층으로 · 지금 업무는 보상 x2`,m:`${fn(me.f)} 곧 폐쇄! 위층으로`,n:s(G.nextClose)};
  if(G.final)return G.finalT>30?{c:'danger',i:'⏰',t:'야근 모드: 모두의 고과가 줄어듭니다 · 최후의 1인까지',m:'야근 모드: 고과 감소 중'}:{c:'',i:'🏁',t:'인사 시즌: 6F만 남았다 · 최후의 1인이 CEO실로',m:'인사 시즌 · 최후의 1인',n:s(30-G.finalT)};
  const ev=G.ceo&&G.ceo.f===me.f?' · 대표님 이 층 방문 중':G.audit&&G.audit.f===me.f?' · 감사 중: 아이템 금지':G.blackout&&G.blackout.f===me.f?' · 정전':G.fire>0?' · 엘리베이터 정지':'';
  return{c:'',i:'📋',t:`다음 폐쇄: ${fn(G.closed)}${ev}`,m:`다음 폐쇄 ${fn(G.closed)}${ev?' ·'+ev.split('·')[1]:''}`,n:s(G.nextClose)};
}
function statusBar(me){
  const st=statusLine(me),el=$('status'),txt=st?(isTouch&&st.m)||st.t:'',n=aliveCount(),key=st?st.c+st.i+txt+'|'+(st.n??'')+'|'+n:'';
  if(key===lastStatus)return;lastStatus=key;
  el.hidden=!st;document.body.classList.toggle('band',!!st);if(!st)return;
  el.className=st.c;$('sAlive').innerHTML=`생존 <b>${n}</b>`;$('sIco').textContent=st.i;$('sText').textContent=txt;$('sTime').textContent=st.n!=null?st.n+'초':'';$('sTime').hidden=st.n==null;
}
/* attack / defence slots under the ID card: icon + a couple of words */
let lastGear='';
function gearSlots(me){
  const it=me.items[0]&&ITEMS[me.items[0]],I=ITEMS;
  const atk=me.ammo>0?{g:I.stapler.g,c:I.stapler.c,t:'스테이플러',n:me.ammo}:it?{g:it.g,c:it.c,t:it.n}:null;
  const vip=me.vipT>0?`이어폰 ${Math.ceil(me.vipT)}초`:'';
  const def=me.shieldN>0?{g:I.stamp.g,c:CAT.def.c,t:vip?'도장·이어폰':'결재 도장',n:'×'+me.shieldN}:vip?{g:I.vip.g,c:CAT.def.c,t:'노캔 이어폰',n:Math.ceil(me.vipT)+'초'}:null;
  const key=JSON.stringify([atk,def,running&&me.alive&&!G.plaza]);if(key===lastGear)return;lastGear=key;
  const slot=(el,v,lbl,none)=>{el.className='gs'+(v?' on':'');if(v)el.style.setProperty('--c',v.c);else el.style.removeProperty('--c');
    el.innerHTML=`<small>${lbl}</small><i>${v?v.g:''}</i>${v&&v.n!=null?`<b>${v.n}</b>`:''}<span>${v?v.t:none}</span>`;};
  slot($('gAtk'),atk,'공격','서류');slot($('gDef'),def,'방어','-');
  $('gear').hidden=!(running&&me.alive&&!G.plaza);
}
/* lunch scoreboard: shown while I'm on the roof, my team marked */
let lastLB='';
function lunchBoard(me){
  const on=running&&me&&me.alive&&G.lunch&&me.f===ROOF&&me.side,el=$('lunchBoard');
  if(!on){if(!el.hidden){el.hidden=true;lastLB='';}return;}
  const sc=G.lunch.score||{L:0,R:0},key=sc.L+'|'+sc.R+'|'+me.side;if(key===lastLB)return;lastLB=key;
  el.hidden=false;$('lbL').textContent=sc.L;$('lbR').textContent=sc.R;el.dataset.me=me.side;
  el.dataset.lead=sc.L>sc.R?'L':sc.R>sc.L?'R':'';
}
/* quest list under the map: the favour I accepted and the task I'm doing */
let lastQ='';
function questList(me){
  const Q=[];
  if(running&&me.alive&&!G.plaza){
    if(!me.branch&&!G.lunch&&!G.tutorial&&me.jobs){const j=me.jobs,l=leadTeam(me);
      Q.push({c:'#8a949c',h:'부서 발령',n:'사원 승진 때',t:`업무 ${j.dev} · 명중 ${j.mkt} · 응대 ${j.hr}`,bar:0,r:l?`→ ${teamShort(l)}팀`:''});}
    if(me.lighter>0)Q.push({c:'#e0603d',h:'라이터',t:`${me.lighter}개 → 우리 재떨이`,bar:me.lighter/LUNCH.carry,r:`+${me.lighter}점`});
    if(me.carry)Q.push({c:'#e0b52a',h:'배달',t:'출력물 → 결재함',bar:1,r:'+12'});
    if(me.docs>0)Q.push({c:'#3fbf6a',h:'결재',t:`서류 ${me.docs}장 → 부장님께`,bar:1,r:'+8'});
    if(me.errand){const e=me.errand;Q.push({c:'#4f93e0',h:'부탁',t:e.step?'부탁한 사람 자리로 전달':e.go,n:`${Math.ceil(e.t)}초`,bar:e.t/e.max,r:`+${e.r}`});}
    const t=G.tasks.find(t=>t.by===me);if(t)Q.push({c:t.ready?'#3fbf6a':'#2b6cb0',h:'내 업무',t:t.ready?`${t.name} · 제출!`:t.name,bar:t.prog,r:`+${t.reward*(warnFloor(t.f)?2:1)}`});
  }
  const key=JSON.stringify(Q.map(q=>[q.h,q.t,q.n,Math.round(q.bar*30)]));if(key===lastQ)return;lastQ=key;
  const el=$('quests');el.hidden=!Q.length;
  el.innerHTML=Q.map(q=>`<div class="q" style="--c:${q.c}"><div class="qh"><b>${q.h}</b><span>${q.n||''}</span><em>${q.r}</em></div><p>${q.t}</p><i style="width:${Math.max(0,Math.min(1,q.bar))*100}%"></i></div>`).join('');
}
/* 화캉스 phone: the coin chart, redrawn every frame from the round's clock (the crash time stays on the server) */
const PH={trail:[]};
function phoneHud(me){
  const w=running&&me&&me.alive&&me.wc,el=$('phone');
  if(document.body.classList.contains('phoning')!==!!w)document.body.classList.toggle('phoning',!!w);
  if(!w){if(!el.hidden){el.hidden=true;PH.trail=[];}return;}
  el.hidden=false;
  const m=wcMult(w.t),crash=w.res==='crash',cash=w.res==='cash';
  $('pMult').textContent=crash?'폭락':`×${m.toFixed(2)}`;$('pMult').className=crash?'bad':cash?'ok':'';
  $('pGain').textContent=crash?`고과 -${WC.crash}`:cash?`익절 +${w.gain}`:`지금 팔면 +${wcGain(m)}`;
  $('pTime').textContent=w.res?'':`${w.t.toFixed(1)}초`;
  $('pRes').textContent=crash?'떡락… 존버는 실패':cash?'수익 실현! 퇴근각':'';$('pRes').className='pres '+(crash?'bad':cash?'ok':'');
  $('pCash').disabled=!!w.res;
  /* chart: the real curve plus a little cosmetic wobble; a crash drops the line off the bottom in red */
  const c=$('pChart').getContext('2d'),W=240,H=150,T=Math.max(3,w.t+.6),top=Math.max(2.2,wcMult(T)*1.08);
  const X=t=>8+t/T*(W-16),Y=v=>H-10-(v-1)/(top-1)*(H-24),wob=t=>wcMult(t)*(1+.05*Math.sin(t*11)+.03*Math.sin(t*29+1));
  c.clearRect(0,0,W,H);c.strokeStyle='rgba(255,255,255,.08)';c.lineWidth=1;for(let i=1;i<4;i++){c.beginPath();c.moveTo(0,H*i/4);c.lineTo(W,H*i/4);c.stroke();}
  c.beginPath();for(let t=0;t<=w.t;t+=.04)c[t?'lineTo':'moveTo'](X(t),Y(wob(t)));
  if(crash){c.lineTo(X(w.t)+6,H);c.strokeStyle='#ff5a4a';}else c.strokeStyle='#3fd17a';
  c.lineWidth=2.5;c.lineJoin='round';c.stroke();
  if(!crash){c.lineTo(X(w.t),H);c.lineTo(X(0),H);c.closePath();c.fillStyle='rgba(63,209,122,.14)';c.fill();
    c.fillStyle='#fff';c.beginPath();c.arc(X(w.t),Y(wob(w.t)),3.5,0,7);c.fill();}
}
/* desk work screen: shown while the rules say I'm at my desk (the camera goes first-person in render) */
let lastDesk='';
const DK={U:'▲',D:'▼',L:'◀',R:'▶'};
function deskHud(me){
  const d=running&&me&&me.alive&&me.desk,el=$('desk');
  if(document.body.classList.contains('desking')!==!!d)document.body.classList.toggle('desking',!!d);
  if(!d){if(!el.hidden){el.hidden=true;lastDesk='';}return;}
  el.hidden=false;
  const recent=G.t-d.resT<1.2&&d.res,key=[d.round,d.seq,d.pos,recent?d.res:''].join('|');
  if(key!==lastDesk){lastDesk=key;
    $('dRound').textContent=`업무 ${Math.min(d.round+1,DESK.rounds)}/${DESK.rounds} · 성공 ${d.ok}`;
    $('dJob').textContent=d.seq?d.job:d.round>=DESK.rounds?'오늘 업무 끝!':d.round?'다음 업무 불러오는 중…':'업무 시스템 접속 중…';
    $('dSeq').innerHTML=d.seq?[...d.seq].map((k,i)=>`<span class="${i<d.pos?'done':i===d.pos?'cur':''}">${DK[k]}</span>`).join(''):'';
    const r=$('dRes');r.className='res '+(recent?d.res:'');r.textContent=recent?(d.res==='ok'?`완료! +${DESK.rew[d.round-1]}`:'반려… (틀렸거나 시간 초과)'):'';
  }
  $('dTm').style.width=(d.seq?Math.max(0,d.t/d.max)*100:0)+'%';
}
function closureCine(f){
  $('cineTower').hidden=true;$('cineS').textContent='';$('cineT').textContent=`${f===0?'로비':(f+1)+'층'} 폐쇄!`;
  $('cine').hidden=false;cineT=1.6;
}
let hudT=0,lastItem='x',lastPills='',lastCall=null,lastTl='',lastFloors='';
const toggleMap=()=>{$('mapbox').classList.toggle('big');hudT=0;};
const KB=k=>isTouch?'':`<kbd class="kb in">${k}</kbd>`;
if(!isTouch){[['greetBtn','E'],['throwBtn','Space'],['skillBtn','Q']].forEach(([id,k])=>$(id).insertAdjacentHTML('beforeend',`<kbd class="kb">${k}</kbd>`));}
let branchT=0;
function openBranch(){branchT=BRANCH_PICK;$('branchOpts').innerHTML=Object.entries(BRANCH).map(([k,v],i)=>`<button data-b="${k}" style="--tc:${v.c}">
  <b>${isTouch?'':`<kbd>${i+1}</kbd>`}${v.n.replace('팀장','')}</b><span><em>${isTouch?'':'Q '}${v.sk}</em> ${v.kt}</span><span>${v.pt}</span></button>`).join('');$('branchBox').hidden=false;}
/* the rules pick a team by themselves when the time runs out (me.branchAsk) */
function pickBranch(k){if(!G||!k)return;$('branchBox').hidden=true;branchT=0;if(!G.me.branch)ACT.branch(k);}
$('branchOpts').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();pickBranch(b.dataset.b);});
let lastCd='';
function countdown(){
  const el=$('countdown');if(!G||!G.me||!running||G.lunch||G.closed>=NF-1||G.nextClose>5||G.nextClose<=0){if(lastCd){el.hidden=true;lastCd='';}return;}
  const n=Math.ceil(G.nextClose),f=G.closed,key=n+'|'+f;if(key===lastCd)return;lastCd=key;
  $('cdName').textContent=`${f===0?'로비':(f+1)+'층'} 폐쇄까지`;$('cdNum').textContent=n;el.classList.toggle('mine',G.me.f===f);el.hidden=false;
  if(!reduceMotion)el.animate([{transform:'translate(-50%,-50%) scale(1.35)',opacity:.4},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:280,easing:'ease-out'});
}
/* the effects bar: everything currently acting on me, as coloured chips with time or uses left */
let fxSeen=new Set(),fxSig='';
function fxBar(me){
  const E=[],I=ITEMS,C=k=>CAT[k].c,sec=v=>`${Math.ceil(v)}초`;
  if(!running||!me.alive||G.plaza){if(fxSig){fxSig='';$('fx').innerHTML='';}return;}
  /* only what is acting on me right now, in a word or two; objectives live in the quest list, items in the slots.
     Bad ones first, at most three */
  if(me.stunT>0)E.push({k:'stun',g:'술',t:'회식 중',bad:1});
  if(me.lockT>0)E.push({k:'lock',g:'⏸',t:me.lockWhy,bad:1});
  if(me.slowT>0)E.push({k:'slow',g:'↓',t:'둔화',bad:1});
  if(onWet(me))E.push({k:'wet',g:'~',t:'미끄러움',bad:1});
  {const idle=G.t-me.workT;if(!G.tutorial&&!G.lunch&&!G.final&&me.f!==ROOF&&!me.desk&&diff().idle&&idle>IDLE-15)E.push({k:'idle',g:'태',t:idle>IDLE?'업무 태만 · 고과 감소':`업무 태만 ${Math.ceil(IDLE-idle)}초 전`,bad:1});}
  if(me.inRest&&me.restT>6)E.push({k:'rest2',g:'WC',t:me.restT>10?'화장실 오래 · 고과 감소':`화장실 ${Math.ceil(10-me.restT)}초 남음`,bad:1});
  if(me.rushT>0)E.push({k:'rush',g:'야',c:C('move'),t:`야근 모드 ${sec(me.rushT)}`,bar:me.rushT/(me.rank==='임원'?8:5)});
  if(me.speedT>0&&!(me.rushT>0))E.push({k:'speed',g:I.ticket.g,c:I.ticket.c,t:`빨라짐 ${sec(me.speedT)}`,bar:me.speedT/8});
  if(me.cloakT>0)E.push({k:'cloak',g:'위',c:C('ctl'),t:`위장 ${sec(me.cloakT)}`,bar:Math.min(1,me.cloakT/4)});
  if(me.intelT>0)E.push({k:'intel',g:'정',c:C('ctl'),t:`위치 정보 ${sec(me.intelT)}`,bar:me.intelT/8});
  E.splice(3);
  const sig=E.map(e=>e.k+e.t+(e.bar!=null?Math.round(e.bar*40):'')).join('|');if(sig===fxSig)return;fxSig=sig;
  const now=new Set(E.map(e=>e.k));
  $('fx').innerHTML=E.map(e=>`<div class="fx${e.bad?' bad':''}${fxSeen.has(e.k)?'':' new'}" style="--c:${e.c||(e.bad?'#e5483a':'#9aa3ab')}"><i>${e.g}</i><span>${e.t}</span>${e.bar!=null?`<b style="width:${Math.max(0,Math.min(1,e.bar))*100}%"></b>`:''}</div>`).join('');
  fxSeen=now;
}
function hud(dt){
  if(branchT>0&&G&&G.me){branchT=G.me.branchAsk?Math.max(0,G.me.branchAsk-G.t):branchT-dt;$('branchTm').style.width=Math.max(0,branchT/BRANCH_PICK*100)+'%';$('branchLeft').textContent=`${Math.ceil(Math.max(0,branchT))}초 뒤 랜덤`;if(branchT<=0||G.me.branch){$('branchBox').hidden=true;branchT=0;}}
  if(cineT>0){cineT-=dt;if(cineT<=0)$('cine').hidden=true;}
  if(!G||!G.me)return;const me=G.me;
  phoneHud(me);
  // call box (every frame)
  if(me.call&&me.alive){
    if(lastCall!==me.call){lastCall=me.call;$('callWho').textContent=me.call.n.kind==='ceo'?'대표님':`${bossTitle(me.call.n)}이 부릅니다`;$('callQ').textContent=me.call.line.q;
      $('callOpts').innerHTML=callOptions(me).map((o,i)=>`<button data-k="${o.key}">${i+1}. ${o.t}<small>${o.s}</small></button>`).join('');$('callBox').hidden=false;}
    $('callTm').style.width=Math.max(0,me.call.t/me.call.max*100)+'%';
  }else if(lastCall){lastCall=null;$('callBox').hidden=true;}
  hudT-=dt;if(hudT>0)return;hudT=.08;
  $('gval').textContent=Math.ceil(Math.max(0,me.g));$('gbar').style.width=Math.max(0,me.g)+'%';
  $('gbarWrap').classList.toggle('low',me.g<30);$('grade').textContent=gradeOf(me.g);$('pname').textContent='나 · '+rankName(me);
  {const nx=RANKS.find(([t])=>t>me.peak);if(nx){const pv=[...RANKS].reverse().find(([t])=>t<=me.peak)[0],base=Math.max(pv,50);$('promoT').textContent=`${nx[1]}까지 ${Math.ceil(nx[0]-me.peak)}`;$('promoB').style.width=Math.max(0,Math.min(100,(me.peak-base)/(nx[0]-base)*100))+'%';}else{$('promoT').textContent='최고 직급';$('promoB').style.width='100%';}}
  fxBar(me);
  statusBar(me);gearSlots(me);deskHud(me);questList(me);lunchBoard(me);
  $('mFloor').textContent=viewF>=0?(viewF===ROOF?'옥상':`${FLOORS[viewF].short} ${FLOORS[viewF].name.replace(/^\d층 /,'')}`):'';
  {const fh=floorsHTML();if(fh!==lastFloors){lastFloors=fh;$('tower').innerHTML=fh;}}
  $('mTap').textContent=`${isTouch?'탭해서':'Tab'} 닫기`;
  drawMini();
  tb.style.setProperty('--cd',Math.max(0,me.cd)/me.lastCd);
  {const dn=me.f-1,show=isTouch&&running&&me.alive&&me.f>=0&&me.f!==ROOF&&!me.sit&&!G.lunch&&!!padOf(me)&&dn>=0&&isOpen(dn),db=$('downBtn');
    if(db.hidden===show)db.hidden=!show;if(show)$('downLabel').textContent=`▼${FLOORS[dn].short}`;}
  const sb=$('skillBtn'),B=me.branch&&BRANCH[me.branch];sb.hidden=!(me.alive&&B&&B.cd&&rankAt(me,'팀장'));
  if(!sb.hidden){sb.style.setProperty('--cd',Math.max(0,me.skillCd)/(B.cd*(me.rank==='임원'?EXEC_CD:1)));$('skillLabel').textContent=me.skillCd>0?Math.ceil(me.skillCd)+'초':B.sk;}
  const held=me.items[0]&&ITEMS[me.items[0]],tl=me.ammo>0?`스테이플<br>${me.ammo}발`:held?held.n.replace(' ','<br>'):'서류<br>투척';
  if(tl!==lastTl){lastTl=tl;$('throwLabel').innerHTML=tl;tb.classList.toggle('staple',me.ammo>0||!!held);tb.style.setProperty('--ic',held?held.c:'');}
  tb.disabled=!!(me.sit||locked(me));
  const act=running&&me.alive?myAction():null;
  const ph=act?act.label+'|'+act.cls:'';
  if(ph!==lastPills){lastPills=ph;$('actLabel').textContent=act?act.label:'상호작용';gb.disabled=!act||act.cls==='off';gb.className='rbtn'+(act&&act.cls?' '+act.cls:'');}
}
