/* ================= online client =================
   Talks to a room server (tools/dev-server.mjs locally, the Worker in server/ when deployed). The server runs the rules;
   this file rebuilds a local G from its snapshots (same object shapes, stable identities) so render/HUD code works unchanged.
   ACT is the one place player actions go: straight into the rules in solo, over the socket online. */
/* others are drawn INTERP seconds in the past, between two snapshots (10/s), so they move smoothly despite network jitter */
const INTERP=.15;
const NETC={on:false,ws:null,code:'',you:null,room:null,act:null,sentIn:'',sentT:0,snapT:0,off:null,rtt:.12,pingT:0,byA:new Map(),byN:new Map(),byT:new Map(),byE:new Map()};
const ACT={
  throw:ang=>NETC.on?netSend({t:'cmd',c:'throw',ang}):throwPaper(G.me,ang),
  interact:()=>NETC.on?netSend({t:'cmd',c:'act'}):interact(G.me),
  item:i=>NETC.on?netSend({t:'cmd',c:'item',i}):useItem(G.me,i),
  skill:()=>NETC.on?netSend({t:'cmd',c:'skill'}):useSkill(G.me),
  answer:k=>NETC.on?netSend({t:'cmd',c:'answer',k}):answer(G.me,k),
  branch:k=>NETC.on?netSend({t:'cmd',c:'branch',k}):chooseBranch(G.me,k),
  floor:dir=>NETC.on?netSend({t:'cmd',c:'floor',dir}):useFloor(G.me,dir),
};
/* what the action button would do now: computed by the server online (it sees the whole state) */
const myAction=()=>NETC.on?NETC.act:contextAction(G.me);
function netSend(m){if(NETC.ws&&NETC.ws.readyState===1)NETC.ws.send(JSON.stringify(m));}
function netURL(code){
  const q=new URLSearchParams(location.search).get('server');
  const host=q||location.host,secure=q?!/^(localhost|127\.|192\.168\.|10\.)/.test(q):location.protocol==='https:';
  return `${secure?'wss':'ws'}://${host}/room/${code}`;
}
function netConnect(code,name,onRoom,onFail){
  netClose();
  let ws;try{ws=new WebSocket(netURL(code));}catch(e){onFail('서버 주소가 잘못됐어요');return;}
  NETC.ws=ws;NETC.code=code;let opened=false;
  ws.onopen=()=>{opened=true;ws.send(JSON.stringify({t:'hello',name}));};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.t==='room'){NETC.room=m;NETC.you=m.you;onRoom(m);}
    else if(m.t==='start'){NETC.you=m.you;netBegin();}
    else if(m.t==='s'){if(NETC.on)netApply(m);}
    else if(m.t==='pong'){const r=(performance.now()-m.ct)/1000;if(r>=0&&r<3)NETC.rtt=NETC.rtt*.7+r*.3;}
    else if(m.t==='err'){onFail(m.m);}};
  ws.onclose=()=>{if(NETC.ws!==ws)return;NETC.ws=null;const was=NETC.on;NETC.on=false;
    onFail(opened?(was?'서버와 연결이 끊겼어요':'연결이 끊겼어요'):'서버에 연결하지 못했어요. 멀티는 node tools/dev-server.mjs 로 띄운 주소에서 열어 주세요.');};
}
function netClose(){const ws=NETC.ws;NETC.ws=null;NETC.on=false;NETC.room=null;if(ws)try{ws.close();}catch{}}

/* ---------- snapshot → local G ---------- */
const seatAt=r=>r?FLOORS[r[0]].seats[r[1]]||null:null;
const actorBy=id=>id==null?null:NETC.byA.get(id)||null;
const npcBy=id=>id==null?null:NETC.byN.get(id)||null;
function netBegin(){
  NETC.byA.clear();NETC.byN.clear();NETC.byT.clear();NETC.byE.clear();NETC.act=null;NETC.sentIn='';NETC.off=null;
  for(const fl of FLOORS){for(const s of fl.seats){s.owner=null;s.occ=null;}let ch=false;for(const d of fl.doors)if(d.open){d.open=false;ch=true;}if(ch)refreshObs(fl);}
  G={t:0,actors:[],me:null,proj:[],items:[],traps:[],tasks:[],drops:[],wet:[],pops:[],dings:[],bursts:[],closed:0,nextClose:INTERVAL,warn:false,final:false,finalT:0,over:false,winner:null,
     npcs:[],doors:[],events:[],notice:null,ceo:null,blackout:null,cake:null,fire:0,star:null,audit:null,lunch:null,airdrops:[],net:true};
  NETC.on=true;startScreens();
}
/* reuse one object per server id so renderer caches (keyed by object) stay valid */
function keep(map,key,make){let o=map.get(key);if(!o){o=make();map.set(key,o);}return o;}
function listFrom(arr,prefix,fill){const out=[];for(const s of arr){const o=keep(NETC.byE,prefix+s.n,()=>({}));fill(o,s);out.push(o);}return out;}
function netApply(m){
  const P=m.pub,first=!G.actors.length,now=performance.now()/1000;NETC.act=m.act;NETC.snapT=now;
  /* server clock = local clock + off. Late packets only lower the sample, so take the max and let it sink slowly */
  {const o=P.t-now;NETC.off=NETC.off==null||o>NETC.off||NETC.off-o>1?o:NETC.off-.004;}
  if(first)G.t=P.t-INTERP;
  Object.assign(G,{closed:P.closed,nextClose:P.nextClose,warn:P.warn,final:P.final,finalT:P.finalT,over:P.over,lunch:P.lunch,fire:P.fire,blackout:P.blackout,audit:P.audit,cake:P.cake,notice:P.notice});
  const meId=m.me?m.me.id:null;
  G.actors=P.A.map(s=>{const a=keep(NETC.byA,s.id,()=>({id:s.id,seats:{},samp:[]}));
    const px=a.x,py=a.y,pf=a.face;
    for(const k in PUB_A){const v=s[k];a[k]=v===undefined?(Array.isArray(PUB_A[k])?[]:PUB_A[k]):v;}
    if(s.id!==meId){a.x=px??a.x;a.y=py??a.y;a.face=pf??a.face;pushSamp(a,P.t,s,a.f!==a.lastF||!!a.transit);}
    a.nx=s.x??0;a.ny=s.y??0;a.lastF=a.f;
    a.sit=seatAt(s.sit);a.transit=s.transit||null;a.chan=s.chan||null;a.call=s.call||null;return a;});
  for(const s of P.N){const n=keep(NETC.byN,s.id,()=>({...s,samp:[],path:[]}));const jump=n.f!==s.f;Object.assign(n,{kind:s.kind,f:s.f,slot:s.slot,on:s.on});pushSamp(n,P.t,s,jump);}
  G.npcs=P.N.map(s=>NETC.byN.get(s.id));G.ceo=npcBy(P.ceo);
  G.tasks=P.T.map(s=>{const t=keep(NETC.byT,s.id,()=>({react:{}}));Object.assign(t,s);t.seat=seatAt(s.seat);return t;});
  G.items=listFrom(P.I,'i',(o,s)=>Object.assign(o,s));
  G.proj=listFrom(P.P,'p',(o,s)=>{Object.assign(o,s);o.bx=s.x;o.by=s.y;o.bt=P.t;o.o=actorBy(s.o);});
  G.traps=listFrom(P.TR,'r',(o,s)=>{Object.assign(o,s);o.o=actorBy(s.o);});
  G.wet=listFrom(P.W,'w',(o,s)=>Object.assign(o,s));
  G.drops=listFrom(P.D,'d',(o,s)=>Object.assign(o,s));
  G.bursts=listFrom(P.B,'b',(o,s)=>Object.assign(o,s));
  G.airdrops=listFrom(P.AD,'a',(o,s)=>Object.assign(o,s));
  G.pops=listFrom(P.PO,'o',(o,s)=>Object.assign(o,s));
  G.dings=listFrom(P.DI,'g',(o,s)=>Object.assign(o,s));
  {const live=new Set([...G.items,...G.proj,...G.traps,...G.wet,...G.drops,...G.bursts,...G.airdrops,...G.pops,...G.dings]);for(const[k,o]of NETC.byE)if(!live.has(o))NETC.byE.delete(k);}
  G.doors=P.DV.map((v,f)=>({f,v}));
  for(const f in P.fdoors){const fl=FLOORS[f],bits=P.fdoors[f];let ch=false;fl.doors.forEach((d,i)=>{const o=bits[i]==='1';if(d.open!==o){d.open=o;d.t=0;ch=true;}});if(ch)refreshObs(fl);}
  if(P.seats)for(const f in P.seats)P.seats[f].forEach(([ow,oc],i)=>{const s=FLOORS[f].seats[i];if(s){s.owner=actorBy(ow);s.occ=actorBy(oc);}});
  G.star=P.star?{a:actorBy(P.star.a),t:P.star.t}:null;G.winner=actorBy(P.winner);
  const me=m.me?actorBy(m.me.id):null;if(me)G.me=me;
  if(me&&m.me){const px=me.x,py=me.y,pface=me.face,mine=!first&&me.f===m.me.f&&!m.me.transit&&me.alive&&m.me.alive;
    for(const k in m.me){const v=m.me[k];if(k==='seats'||k==='call'||k==='contact'||k==='quest'||k==='killer'||k==='stampNpc'||k==='sit')continue;me[k]=v;}
    me.seats={};for(const f in m.me.seats)me.seats[f]=seatAt(m.me.seats[f]);
    me.sit=seatAt(m.me.sit);
    me.call=m.me.call?{n:npcBy(m.me.call.n)||{kind:'boss'},line:m.me.call.line,t:m.me.call.t,max:m.me.call.max}:null;
    me.contact=m.me.contact?{n:npcBy(m.me.contact.n)||{kind:'boss'},t:m.me.contact.t,max:m.me.contact.max}:null;
    me.quest=m.me.quest;me.killer=actorBy(m.me.killer);me.stampNpc=npcBy(m.me.stampNpc);
    /* my own position is predicted locally. The server's answer reflects my input from about one round trip ago,
       so compare it with where I was back then and feed only that difference in gradually. */
    me.nx=me.x;me.ny=me.y;
    if(mine&&!me.sit&&!me.chan){
      const h=histAt(me,now-NETC.rtt-.02),ex=h?me.nx-h.x:me.nx-px,ey=h?me.ny-h.y:me.ny-py;
      if(Math.hypot(ex,ey)<120){me.x=px;me.y=py;me.face=pface;me.cx=(me.cx||0)+ex;me.cy=(me.cy||0)+ey;for(const q of me.hist)q.x+=ex,q.y+=ey;}
      else{me.cx=me.cy=0;me.hist=[];}
    }else{me.cx=me.cy=0;me.hist=[];}
  }
  for(const e of m.ev)netEvent(e);
}
function netEvent(e){
  if(e.k==='feed')feedDOM(e.m,e.hot);
  else if(e.k==='notice')UI.notice(e.t);
  else if(e.k==='noticeEnd')UI.noticeEnd();
  else if(e.k==='cine')UI.cine(e.t,e.sub,e.dur);
  else if(e.k==='closure')UI.closure(e.f,e.nf,e.msg);
  else if(e.k==='shake')UI.shake(e.v);
  else if(e.k==='vibrate')UI.vibrate();
  else if(e.k==='branch'&&G.me)UI.branch(G.me);
  else if(e.k==='result'&&G.me)UI.result(e.win,e.ms,G.me);
  else if(e.k==='snapCam'&&G.me)cam={x:G.me.x,y:G.me.y};
}
function pushSamp(o,t,s,jump){
  const q={t,x:s.x??0,y:s.y??0,face:s.face??0};
  if(jump||!o.samp.length||Math.hypot(q.x-o.samp.at(-1).x,q.y-o.samp.at(-1).y)>200){o.samp=[q];o.x=q.x;o.y=q.y;o.face=q.face;return;}
  o.samp.push(q);if(o.samp.length>8)o.samp.shift();
}
const lerpAng=(a,b,k)=>{let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return a+d*k;};
function sampleAt(o,rt){
  const S=o.samp;if(!S||!S.length)return;
  let q=S[0];if(rt<=q.t){o.x=q.x;o.y=q.y;o.face=q.face;return;}
  for(let i=0;i<S.length-1;i++){const a=S[i],b=S[i+1];if(rt<b.t){const k=(rt-a.t)/(b.t-a.t||1);o.x=a.x+(b.x-a.x)*k;o.y=a.y+(b.y-a.y)*k;o.face=lerpAng(a.face,b.face,k);return;}}
  /* ran out of samples (late packet): keep going the same way for up to 0.15 s, then hold */
  q=S.at(-1);const p=S.at(-2),e=p?Math.min(.15,rt-q.t)/(q.t-p.t||1):0;o.x=q.x+(p?(q.x-p.x)*e:0);o.y=q.y+(p?(q.y-p.y)*e:0);o.face=q.face;
}
function histAt(me,t){const H=me.hist;if(!H||!H.length)return null;let best=H[0];for(const h of H)if(Math.abs(h.t-t)<Math.abs(best.t-t))best=h;return Math.abs(best.t-t)<.25?best:null;}
/* every frame: draw others at server time minus INTERP, fly projectiles on the same clock, predict my own walking */
function netFrame(dt){
  if(!G||!G.net)return;
  const now=performance.now()/1000,rt=now+(NETC.off??0)-INTERP;
  G.t=Math.max(G.t,rt);
  if(now-NETC.pingT>1){NETC.pingT=now;netSend({t:'ping',ct:performance.now()});}
  const me=G.me;
  for(const a of G.actors)if(a!==me)sampleAt(a,rt);
  for(const n of G.npcs)sampleAt(n,rt);
  for(const p of G.proj){const d=Math.max(-p.d,p.sp*(rt-p.bt));p.x=p.bx+p.dx*d;p.y=p.by+p.dy*d;p.spin+=dt*14;}
  for(const p of G.pops)p.t+=dt;for(const b of G.bursts)b.t+=dt;for(const d of G.airdrops)d.t+=dt;
  if(!me)return;
  const k=Math.min(1,dt*10);
  if(me.alive&&me.f>=0&&!me.transit&&!me.sit&&!me.chan&&!locked(me)&&me.input){
    let{vx,vy}=me.input;const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}if(m>.15)me.face=Math.atan2(vy,vx);
    me.sprint=me.input.run&&m>.15;
    drive(me,m>.15?vx:0,m>.15?vy:0,dt);
    if(me.cx||me.cy){const c=Math.min(1,dt*6),ox=me.cx*c,oy=me.cy*c;me.cx-=ox;me.cy-=oy;moveActor(me,ox/dt,oy/dt,dt);}
    (me.hist||(me.hist=[])).push({t:now,x:me.x,y:me.y});while(me.hist.length&&now-me.hist[0].t>1.5)me.hist.shift();
  }else{me.x+=(me.nx-me.x)*k;me.y+=(me.ny-me.y)*k;me.hist=[];}
}
function netSendInput(){
  const me=G&&G.me;if(!me||!me.input)return;
  const i=me.input,msg={t:'in',vx:Math.round(i.vx*100)/100,vy:Math.round(i.vy*100)/100,run:!!i.run,fire:!!i.fire,aim:me.aim==null?null:Math.round(me.aim*100)/100};
  const s=JSON.stringify(msg),now=performance.now();
  if(s!==NETC.sentIn&&now-NETC.sentT>40||now-NETC.sentT>500){NETC.sentIn=s;NETC.sentT=now;netSend(msg);}
}
