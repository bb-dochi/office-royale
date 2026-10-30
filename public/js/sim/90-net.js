/* ================= online rooms =================
   What a room server needs from the rules: start a match for a list of humans, apply their input and commands,
   and turn the state into JSON snapshots. No sockets or timers here; the host (tools/dev-server.mjs or the
   Durable Object in server/) owns those and calls NET.* on a fixed tick. The browser decodes snapshots in client/05-net.js. */
const NET={out:new Map(),pubT:-1,pub:null};
const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
const nk=o=>o._n||(o._n=++G.nid);
const seatRef=s=>s?[s.f,FLOORS[s.f].seats.indexOf(s)]:null;
const idOf=o=>o?o.id:null;
const clampN=(v,lo,hi)=>typeof v==='number'&&isFinite(v)?Math.max(lo,Math.min(hi,v)):0;
/* fields every client needs about every actor (labels, poses, auras), with the value a client assumes when one is left out */
const PUB_A={id:0,name:'',color:'',isPlayer:false,f:0,x:0,y:0,face:0,g:0,peak:0,rank:'',alive:false,branch:null,flash:0,items:[],ammo:0,cloakT:0,carry:false,inRest:false,stunT:0,lockT:0,lockWhy:'',sprint:false,side:null,speedT:0,rushT:0,shieldN:0,vipT:0,slowT:0,intelT:0,place:0,kills:0,revived:false,tasksDone:0,maxF:0,fit:null,hitBy:0,working:false,lighter:0,bill:false,meal:0};
/* fixed for the whole match: sent only on the once-a-second full snapshot, and clients keep the last value */
const FIXED_A=new Set(['name','color','fit']);
/* empty values (0, false, null, '', [], spent timers) are left out of public actor data to keep snapshots small */
const empty=v=>v===null||v===false||v===''||v===undefined||(typeof v==='number'&&v<=0&&v>-1e-9)||(Array.isArray(v)&&!v.length);
/* bot brain and bookkeeping that never leaves the server */
const SKIP_A=new Set(['path','pathAge','goal','mode','think','target','strafe','react','sx','sy','stuckT','nudge','met','input','aim','pref','padPref','greed','lunchGo','seeker','lastHitBy','type','key','_n','sitGoal','desk','wc','jobs','moveSk','idleT','throwT','dodgeCd','svx','svy']);
function serA(a,full,fixed){
  const o={};
  if(!full){for(const k in PUB_A){if(!fixed&&FIXED_A.has(k))continue;let v=a[k];if(typeof v==='number'){v=r1(v);if((k.endsWith('T')||k==='flash')&&v<0)v=0;}if(k==='f'||k==='x'||k==='y'||k==='face'?v!==0:!empty(v))o[k]=v;}}
  else for(const k in a){if(SKIP_A.has(k))continue;const v=a[k];
    if(v===null||typeof v==='string'||typeof v==='boolean')o[k]=v;else if(typeof v==='number')o[k]=r2(v);
    else if(Array.isArray(v)&&v.every(x=>typeof x!=='object'))o[k]=v;}
  if(a.sit)o.sit=seatRef(a.sit);
  if(a.transit)o.transit={to:a.transit.to,t:r2(a.transit.t)};
  if(a.chan)o.chan={pad:a.chan.pad,dir:a.chan.dir,tag:a.chan.tag,t:r2(a.chan.t),max:a.chan.max};
  if(a.call)o.call=full?{n:a.call.n.id,line:{q:a.call.line.q,ans:a.call.line.ans},t:r2(a.call.t),max:a.call.max}:1;
  if(full){
    o.seats={};for(const f in a.seats)o.seats[f]=seatRef(a.seats[f]);
    o.contact=a.contact?{n:a.contact.n.id,t:r2(a.contact.t),max:a.contact.max}:null;
    o.quest=a.quest?{t:r2(a.quest.t),max:a.quest.max}:null;
    o.killer=idOf(a.killer);o.stampNpc=idOf(a.stampNpc);
    o.errand=a.errand?{...a.errand}:null;
    o.jobs={...a.jobs};
    o.wc=a.wc?{t:r2(a.wc.t),m:r2(a.wc.m),sq:a.wc.sq?1:0,res:a.wc.res,resT:a.wc.resT,gain:a.wc.gain}:null; // never the crash time
    o.desk=a.desk?{round:a.desk.round,ok:a.desk.ok,seq:a.desk.seq,kind:a.desk.kind,show:a.desk.show,rule:a.desk.rule,bar:a.desk.bar,pos:a.desk.pos,t:r2(a.desk.t),max:a.desk.max,job:a.desk.job,wait:r2(a.desk.wait),res:a.desk.res,resT:a.desk.resT}:null;
  }
  return o;
}
const serN=n=>({id:n.id,kind:n.kind,f:n.f,x:r1(n.x),y:r1(n.y),face:r2(n.face),slot:n.slot,on:n.on,sr:n.senior?1:0,ask:n.ask&&n.job?n.job.r:0,cg:n.caught?1:0});
/* the ladder's rungs stay on the server until everyone has picked a lane */
function lunchSnap(){const L=G.lunch;if(!L)return null;
  return{kind:L.kind,t:r2(L.t),score:L.score,phase:L.phase,dealt:L.dealt,zone:L.zone,crowd:L.crowd,
    groups:L.groups&&L.groups.map(g=>({ids:g.ids,lane:g.lane,pay:g.pay,payer:g.payer,rungs:L.phase==='pick'?null:g.rungs}))};}
function pubSnap(){
  if(NET.pubT===G.t&&NET.pub)return NET.pub;
  const open=f=>f===ROOF||f>=G.closed;
  const seats={},fdoors={};
  for(let f=G.closed;f<NF;f++){seats[f]=FLOORS[f].seats.map(s=>[idOf(s.owner),idOf(s.occ)]);fdoors[f]=FLOORS[f].doors.map(d=>d.open?1:0).join('');}
  seats[ROOF]=FLOORS[ROOF].seats.map(s=>[null,idOf(s.occ)]);   // rooftop lunch benches
  /* seat owners change rarely: resend them only on change, plus once a second for anyone who missed it */
  const full=Math.floor(G.t)!==Math.floor(NET.pubT),seatStr=JSON.stringify(seats),sendSeats=full||seatStr!==NET.seatStr;NET.seatStr=seatStr;
  /* the same beat carries what never changes (names, colors, where each task is); a new task is spelled out for its first second */
  const seen=NET.tSeen,serT=t=>{if(!seen.has(t.id))seen.set(t.id,G.t);const o={id:t.id,prog:r2(t.prog),ready:t.ready,by:idOf(t.by)};
    if(full||G.t-seen.get(t.id)<1)Object.assign(o,{f:t.f,kind:t.kind,x:r1(t.x),y:r1(t.y),r:t.r,need:t.need,reward:t.reward,name:t.name,seat:seatRef(t.seat),
      zone:t.zone?{x:r1(t.zone.x),y:r1(t.zone.y),w:r1(t.zone.w),h:r1(t.zone.h)}:null});
    return o;};
  NET.pub={full:full?1:undefined,
    t:r2(G.t),closed:G.closed,nextClose:r2(G.nextClose),warn:G.warn,final:G.final,finalT:r2(G.finalT),over:G.over,winner:idOf(G.winner),
    lunch:lunchSnap(),SM:(G.smokes||[]).map(s=>({n:nk(s),f:s.f,x:r1(s.x),y:r1(s.y),t:r2(s.t),life:s.life,r:s.r,side:s.side})),fire:r2(G.fire),blackout:G.blackout,audit:G.audit,star:G.star?{a:G.star.a.id,t:G.star.t}:null,cake:G.cake,notice:G.notice,ceo:idOf(G.ceo),
    A:G.actors.map(a=>serA(a,false,full)),
    N:G.npcs.filter(n=>n.kind==='ceo'||isOpen(n.f)).map(serN),
    T:G.tasks.map(serT),
    I:G.items.filter(i=>open(i.f)).map(i=>({n:nk(i),f:i.f,x:r1(i.x),y:r1(i.y),k:i.k,t:r1(i.t)})),
    P:G.proj.map(p=>({n:nk(p),f:p.f,x:r1(p.x),y:r1(p.y),dx:r2(p.dx),dy:r2(p.dy),d:r1(p.d),sp:p.sp,rng:p.rng,spin:r1(p.spin),staple:p.staple,bundle:!!p.bundle,flyer:!!p.flyer,o:idOf(p.o)})),
    TR:G.traps.map(t=>({n:nk(t),f:t.f,x:r1(t.x),y:r1(t.y),t:r1(t.t),o:idOf(t.o)})),
    W:G.wet.map(w=>({n:nk(w),f:w.f,x:r1(w.x),y:r1(w.y),t:r1(w.t)})),
    D:G.drops.map(d=>({n:nk(d),f:d.f,x:r1(d.x),y:r1(d.y)})),
    B:G.bursts.map(b=>({n:nk(b),f:b.f,x:r1(b.x),y:r1(b.y),t:r2(b.t)})),
    AD:G.airdrops.map(d=>({n:nk(d),x:r1(d.x),y:r1(d.y),t:r2(d.t),k:d.k})),
    PO:G.pops.map(p=>({n:nk(p),f:p.f,x:r1(p.x),y:r1(p.y),text:p.text,color:p.color,t:r2(p.t),say:p.say||undefined,by:p.by??undefined})),
    DI:G.dings.map(d=>({n:nk(d),f:d.f,t:r2(d.t)})),
    DV:G.doors.map(d=>d.v?{type:d.v.type,t:r1(d.v.t),ph:d.v.ph}:null),
    seats:sendSeats?seats:undefined,fdoors,
  };
  NET.pubT=G.t;return NET.pub;
}
const byKey=k=>G&&G.actors.find(a=>a.key===k);
function push(a,ev){if(!a||!a.key)return;const q=NET.out.get(a.key);if(q)q.push(ev);}
/* opts.lunch: which lunch event this match gets (the room deals them from a shuffled deck, see server/src/room.js) */
NET.lunchKinds=LUNCH_KINDS;
NET.start=function(players,opts={}){
  NET.out=new Map(players.map(p=>[p.key,[]]));NET.pub=null;NET.pubT=-1;NET.seatStr='';NET.tSeen=new Map();
  Object.assign(UI,{
    feed:(msg,hot,to)=>{for(const h of humans())if(!to||to===h){const m=typeof msg==='function'?msg(h):msg;if(m)push(h,{k:'feed',m,hot:!!hot});}},
    notice:t=>{for(const h of humans())push(h,{k:'notice',t});},
    noticeEnd:()=>{for(const h of humans())push(h,{k:'noticeEnd'});},
    cine:(t,sub,dur,a)=>{for(const h of humans())if(!a||a===h)push(h,{k:'cine',t,sub,dur});},
    closure:(f,nf,msg)=>{for(const h of humans())push(h,{k:'closure',f,nf,msg});},
    shake:(v,a)=>{for(const h of humans())if(!a||a===h)push(h,{k:'shake',v});},
    vibrate:a=>push(a,{k:'vibrate'}),
    branch:a=>push(a,{k:'branch'}),
    result:(win,ms,a)=>push(a,{k:'result',win,ms}),
    snapCam:a=>push(a,{k:'snapCam'}),
    reset:()=>{},
  });
  newGame({humans:players.map(p=>({key:p.key,name:String(p.name).slice(0,10),fit:p.fit||null})),lunch:LUNCH_KINDS.includes(opts.lunch)?opts.lunch:undefined});
  G.nid=0;G.online=true;
};
NET.step=dt=>step(dt);
NET.input=function(key,m){const a=byKey(key);if(!a||!a.isPlayer)return;
  a.input={vx:clampN(m.vx,-1,1),vy:clampN(m.vy,-1,1),run:!!m.run,fire:!!m.fire};
  a.aim=typeof m.aim==='number'&&isFinite(m.aim)?m.aim:null;
  if(typeof m.ct==='number'&&isFinite(m.ct)){a.inCt=m.ct;a.inSt=G.t;}};
NET.cmd=function(key,m){const a=byKey(key);if(!a||!a.isPlayer||G.over)return;
  switch(m.c){
    case 'throw':throwPaper(a,typeof m.ang==='number'&&isFinite(m.ang)?m.ang:autoAim(a));break;
    case 'act':interact(a);break;
    case 'item':useItem(a,0);break;
    case 'skill':useSkill(a);break;
    case 'answer':if(a.call&&['greet','report','busy','doc'].includes(m.k))answer(a,m.k);break;
    case 'branch':chooseBranch(a,m.k);break;
    case 'floor':if(m.dir===1||m.dir===-1)useFloor(a,m.dir);break;
    case 'desk':if(typeof m.k==='string')deskKey(a,m.k);break;
    case 'lane':if(typeof m.i==='number')pickLane(a,m.i|0);break;
  }};
/* how one player's match went, for the play stats (server/src/stats.js) */
NET.result=function(key){const a=byKey(key);if(!a)return null;const win=G.winner===a;
  return{place:win?1:a.place||aliveCount(),rank:win?'CEO':a.rank,kills:a.kills||0,tasks:a.tasksDone||0,time:Math.round(a.alive?G.t:a.outT??G.t),diff:G.diff,lunch:G.lunchKind,branch:a.branch||''};};
/* every person in the match is out (or gone): the room doesn't wait for the bots to finish it */
NET.humansOut=()=>!!G&&!humans().some(a=>a.alive);
/* a player who drops mid-match is handed to the bot brain so the match keeps its numbers */
NET.leave=function(key){const a=byKey(key);NET.out.delete(key);if(!a||!a.isPlayer)return;a.isPlayer=false;a.input=null;a.call&&(a.call.botAns=a.call.line.ans,a.call.botT=0);
  if(a.alive)feed(`${a.name}님 연결 끊김: 봇이 대신 근무합니다`);};
/* the same player back on a new socket (server/src/room.js checks the resume token): hand the actor back.
   Events sent while away are gone, so one who was knocked out meanwhile gets their result again */
NET.rejoin=function(key){const a=byKey(key);if(!a||a.isPlayer)return;a.isPlayer=true;a.input=null;a.aim=null;a.mode='idle';a.target=null;NET.out.set(key,[]);
  if(a.alive)feed(`${a.name}님 다시 접속`);else push(a,{k:'result',win:G.winner===a,ms:800});};
NET.snap=function(key){const a=byKey(key);const ev=NET.out.get(key)||[];NET.out.set(key,[]);
  const act=a&&a.isPlayer?contextAction(a):null;
  /* ack: the sender's own clock (ms) that this snapshot's state lines up with, so its prediction compares like with like */
  const ack=a&&a.inCt!=null?Math.round(a.inCt+(G.t-a.inSt)*1000):null;
  return{pub:pubSnap(),me:a?serA(a,true):null,act:act?{label:act.label,cls:act.cls}:null,ack,ev};};
