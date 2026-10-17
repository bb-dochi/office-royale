/* ================= state ================= */
let G=null;
const NAMES=['김민지','이준호','박서연','최도윤','정하은','강지훈','조수아','윤태민','장예린','임건우','한소율','오세훈','신유나','배준영','송다은','홍민재','문가영','양지성','권나래'];
const TYPES=['성실파','정치꾼','루팡','폭주','아부꾼','성실파','정치꾼','폭주','루팡','아부꾼','성실파','정치꾼','폭주','성실파','아부꾼','루팡','정치꾼','폭주','성실파'];
const SHIRTS=['#d9a441','#7a9e7e','#b5651d','#8e6c8a','#4f7c99','#c46b6b','#6f8f3a','#9a7b4f','#5b6fa8','#a35d7a','#3f8f8f','#b0803a','#6a7fb0','#8f5e3a','#a86f9a','#4c8a6a','#b55a4a','#7a6aa8','#5e9aa0'];
let NID=0;
function mk(name,isPlayer,type,color,pos){
  return{id:++NID,name,isPlayer,type,color,f:0,x:pos.x,y:pos.y,vx:0,vy:0,face:Math.random()*6.28,g:50,peak:50,rank:'인턴',alive:true,cd:0,
    path:[],pathAge:0,goal:null,mode:'idle',think:Math.random()*.3,target:null,strafe:Math.random()<.5?1:-1,react:.4,
    speed:isPlayer?175:135+Math.random()*25,flash:0,lastHitBy:null,lastHitT:-99,cause:null,sx:pos.x,sy:pos.y,stuckT:0,nudge:null,place:0,
    items:[],docs:0,intelT:0,sprint:false,runCd:0,fallCd:0,side:null,lunchGo:false,rapidT:0,slipT:0,ammo:0,lastCd:.6,cloakT:0,skillCd:0,branch:null,revived:false,shieldN:0,speedT:0,stunT:0,vipT:0,slowT:0,lockT:0,lockWhy:'',chan:null,transit:null,inv:0,
    seats:{},sit:null,sitT:0,sitHeal:0,sitStart:0,sitGoal:0,carry:false,lastTaskT:-99,tasksDone:0,coffeeCd:0,coolerCd:0,
    contact:null,call:null,met:{},stampT:0,stampNpc:null,greetLock:0,cleanCd:0,cleanFriend:false,chatCd:0,restT:0,inRest:false,
    pref:0,padPref:Math.random()<.5?'stair':'elev',greed:rnd(2,10),maxF:0,killer:null};
}
function mkNpc(kind,f,x,y){return{id:'n'+(++NID),kind,f,x,y,face:0,wp:0,pause:0,hold:0,alert:null,path:[],pathAge:0,goal:null,dropT:rnd(1,3),lastGreet:-99,active:true,t:0};}
const isOpen=f=>f>=G.closed&&f<=Math.min(NF-1,G.closed+WIN-1)&&f<NF;
const isLocked=f=>f>Math.min(NF-1,G.closed+WIN-1);
const topOpen=()=>Math.min(NF-1,G.closed+WIN-1);
const warnFloor=f=>G.warn&&f===G.closed&&G.closed<NF-1;

function assignSeats(f){
  const seats=[...FLOORS[f].seats].sort(()=>Math.random()-.5);
  for(const s of seats){s.owner=null;s.occ=null;}
  const al=G.actors.filter(a=>a.alive).sort(()=>Math.random()-.5);
  al.forEach((a,i)=>{const s=seats.at(i);if(s){s.owner=a;a.seats[f]=s;}else a.seats[f]=null;});
}
function newGame(){
  NID=0;
  const actors=[],spots=[];
  const pickPos=()=>{for(let i=0;i<300;i++){const p=randFree(0,90);if(p.y>K(480)&&spots.every(s=>dist(s,p)>80)){spots.push(p);return p;}}const p=randFree(0,90);spots.push(p);return p;};
  const me=mk('나',true,'플레이어','#2b6cb0',pickPos());actors.push(me);
  for(let i=0;i<NAMES.length;i++){const b=mk(NAMES[i],false,TYPES[i],SHIRTS[i],pickPos());b.pref=Math.random()<.3?1:0;actors.push(b);}
  G={t:0,actors,me,proj:[],items:[],traps:[],tasks:[],drops:[],wet:[],pops:[],dings:[],bursts:[],closed:0,nextClose:INTERVAL,warn:false,final:false,finalT:0,over:false,itemT:0,winner:null,
     npcs:[],doors:[],events:[],notice:null,ceo:null,blackout:null,cake:null,fire:0,star:null,audit:null,taskId:0,fillT:0,lunch:null,airdrops:[]};
  for(let f=0;f<NF;f++){
    const w=FLOORS[f].wp;
    G.npcs.push(Object.assign(mkNpc('boss',f,w[0][0],w[0][1]),{wp:1,slot:0}));
    G.npcs.push(Object.assign(mkNpc('boss',f,w[2][0],w[2][1]),{wp:3,slot:1}));
    const c=randFree(f);G.npcs.push(mkNpc('cleaner',f,c.x,c.y));
    if(f>=1&&f<=4){const p=randFree(f);G.npcs.push(mkNpc('busy',f,p.x,p.y));}
    if(f>=1){const p=randFree(f);G.npcs.push(mkNpc('newbie',f,p.x,p.y));G.npcs.push(Object.assign(mkNpc('courier',f,PADS.elev.x,PADS.elev.y-20),{on:false,cd:rnd(12,40)}));}
    {const p=randFree(f);G.npcs.push(mkNpc('cart',f,p.x,p.y));}
    G.doors.push({f,v:null,cd:rnd(10,30)});
  }
  for(let f=0;f<WIN;f++)assignSeats(f);
  for(let f=0;f<WIN;f++){fillTasks(f);for(let i=0;i<itemQuota(f);i++)spawnItem(f);}
  // events
  const kinds=['ceo','blackout','cake','fire','audit','star'].sort(()=>Math.random()-.5);
  if(kinds.indexOf('ceo')>2){kinds.splice(kinds.indexOf('ceo'),1);kinds.splice(1,0,'ceo');}
  [rnd(28,38),rnd(62,72),rnd(150,165),rnd(195,210)].forEach((at,i)=>G.events.push({at,kind:kinds.at(i),stage:0}));
  G.events.push({at:rnd(96,104),kind:'lunch',stage:0});
  UI.snapCam(me);
  UI.reset();
}
const taskQuota=f=>!isOpen(f)?0:(G.closed>=NF-1?5:f===topOpen()?3:4);
const itemQuota=f=>!isOpen(f)?0:(G.closed>=NF-1?3:f===G.closed?4:f===topOpen()?2:3);
function fillTasks(f){let n=0;while(G.tasks.filter(t=>t.f===f).length<taskQuota(f)&&n++<10)spawnTask(f);}
function spawnTask(f){
  const fl=FLOORS[f],have=k=>G.tasks.some(t=>t.f===f&&t.kind===k);
  const pool=['report','report'];
  if(f>0&&!have('copy'))pool.push('copy');
  if(!have('print')&&!G.actors.some(a=>a.carry&&a.f===f)&&!G.drops.some(d=>d.f===f))pool.push('print');
  if(fl.meet.length&&G.tasks.filter(t=>t.f===f&&t.kind==='meet').length<fl.meet.length)pool.push('meet','meet');
  if(fl.spots.server&&!have('server'))pool.push('server');
  if(fl.recep.length&&G.tasks.filter(t=>t.f===f&&t.kind==='recep').length<fl.recep.length)pool.push('recep','recep');
  if(f===0){pool.length=0;pool.push('recep','recep');if(!have('badge'))pool.push('badge');}
  const k=pick(pool),T={id:++G.taskId,f,kind:k,prog:0,ready:false,react:{}};
  if(k==='report'){
    const used=new Set(G.tasks.filter(t=>t.seat).map(t=>t.seat));
    const cands=fl.seats.filter(s=>!used.has(s));if(!cands.length)return;
    const s=pick(cands);Object.assign(T,{seat:s,x:s.x,y:s.y,r:26,need:2.2,reward:8,name:'보고서 작성'});
  }else if(k==='copy')Object.assign(T,{x:fl.spots.copier.x,y:fl.spots.copier.y,r:K(58),need:1.5,reward:6,name:'복사'});
  else if(k==='print')Object.assign(T,{x:fl.spots.printer.x,y:fl.spots.printer.y,r:K(58),need:1.2,reward:12,name:'출력물 배달'});
  else if(k==='meet'){const used=G.tasks.filter(t=>t.zone).map(t=>t.zone);const z=pick(fl.meet.filter(m=>!used.includes(m)));if(!z)return;
    Object.assign(T,{zone:z,x:z.x+z.w/2,y:z.y+z.h/2,need:3,reward:10,name:'회의 참석'});}
  else if(k==='server')Object.assign(T,{x:fl.spots.server.x,y:fl.spots.server.y,r:30,need:4,reward:15,name:'서버 재부팅'});
  else if(k==='badge')Object.assign(T,{x:fl.spots.badge.x,y:fl.spots.badge.y,r:34,need:2.2,reward:8,name:'출입증 발급'});
  else if(k==='recep'){const used=G.tasks.filter(t=>t.kind==='recep').map(t=>t.spot);const s=pick(fl.recep.filter(p=>!used.includes(p)));if(!s)return;
    Object.assign(T,{spot:s,x:s.x,y:s.y,r:34,need:2.2,reward:8,name:'방문객 응대'});}
  G.tasks.push(T);
}
function spawnItem(f,k,pos){const p=pos||randFree(f);G.items.push({f,x:p.x,y:p.y,k:k||randItem(),t:0});}
const alive=()=>G.actors.filter(a=>a.alive);
const aliveCount=()=>alive().length;
const leader=()=>alive().sort((a,b)=>b.g-a.g)[0];

function feed(msg,hot){UI.feed(msg,hot);}
function notice(text,dur=5){G.notice={text,t:dur};UI.notice(text);}
function pop(f,x,y,text,color){G.pops.push({f,x,y,text,color,t:0});}
function burst(p){for(const a of G.actors){if(a===p.o||!a.alive||a.f!==p.f||a.inRest||ally(p.o,a))continue;if(Math.hypot(a.x-p.x,a.y-p.y)<95)hit(a,p.o,7,'서류 폭탄 -7',p);}G.bursts.push({f:p.f,x:p.x,y:p.y,t:0});}
function dmg(a,n,cause){if(!a.alive)return;a.g-=n;a.cause=cause;}
function gain(a,n){
  if(!a.alive)return;a.g=Math.min(100,a.g+n);
  if(a.g>a.peak){a.peak=a.g;const r=rankOf(a.peak);if(r!==a.rank){a.rank=r;if(a.isPlayer){pop(a.f,a.x,a.y-40,'승진! '+r,'#2f7d4f');feed(`승진했습니다: ${r}`);}
    if((r==='팀장'||r==='임원')&&!a.branch){if(a.isPlayer)UI.branch();else a.branch=pick(Object.keys(BRANCH));}}}
}
const locked=a=>!!a.call||a.lockT>0||a.stunT>0;
function stand(a){if(a.sit){a.sit.occ=null;a.sit=null;}}
function sit(a,s){if(s.occ&&s.occ!==a)return false;stand(a);a.sit=s;s.occ=a;a.x=s.x;a.y=s.y;a.face=s.face;a.sitT=0;a.sitHeal=0;a.sitStart=G.t;a.path=[];a.vx=a.vy=0;return true;}
const DMG={인턴:1,대리:1.3,팀장:1.6,'임원':2};
const dmgMul=o=>o&&o.rank?(DMG[o.rank]||1):1;
function hit(t,o,n,label,p){
  n=Math.round(n*dmgMul(o));if(label)label=label.replace(/-\d+/,'-'+n);
  if(t.inv>0){pop(t.f,t.x,t.y-26,'도착 보호','#5d666e');return;}
  if(t.shieldN>0){t.shieldN--;pop(t.f,t.x,t.y-26,'결재 도장으로 막음','#cf3626');return;}
  dmg(t,n,'paper');t.lastHitBy=o;t.lastHitT=G.t;t.flash=.22;pop(t.f,t.x,t.y-26,label||('-'+n),'#cf3626');
  if(t.isPlayer)UI.shake(.15);
  stand(t);
  if(t.chan&&t.chan.pad==='stair'){t.chan=null;pop(t.f,t.x,t.y-44,'계단 오르다 맞음','#cf3626');}
  if(t.carry){t.carry=false;G.drops.push({f:t.f,x:t.x+rnd(-14,14),y:t.y+rnd(-14,14)});pop(t.f,t.x,t.y-44,'출력물 떨어뜨림','#cf3626');}
  if(p&&o)soundAlert(t.f,t,p.ox,p.oy,o);
}
