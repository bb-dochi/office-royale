/* ================= state ================= */
let G=null;
const NAMES=['김민지','이준호','박서연','최도윤','정하은','강지훈','조수아','윤태민','장예린','임건우','한소율','오세훈','신유나','배준영','송다은','홍민재','문가영','양지성','권나래'];
const TYPES=['성실파','정치꾼','루팡','폭주','아부꾼','성실파','정치꾼','폭주','루팡','아부꾼','성실파','정치꾼','폭주','성실파','아부꾼','루팡','정치꾼','폭주','성실파'];
const HUMAN_COLORS=['#2b6cb0','#d6457a','#1f9d8a','#e07b1f','#7b4fd6','#3a8f3a','#c43d3d','#2f8fc4'];
const SHIRTS=['#d9a441','#7a9e7e','#b5651d','#8e6c8a','#4f7c99','#c46b6b','#6f8f3a','#9a7b4f','#5b6fa8','#a35d7a','#3f8f8f','#b0803a','#6a7fb0','#8f5e3a','#a86f9a','#4c8a6a','#b55a4a','#7a6aa8','#5e9aa0'];
let NID=0;
function mk(name,isPlayer,type,color,pos){
  return{id:++NID,name,isPlayer,type,color,f:0,x:pos.x,y:pos.y,vx:0,vy:0,face:Math.random()*6.28,g:50,peak:50,rank:'인턴',alive:true,cd:0,
    path:[],pathAge:0,goal:null,mode:'idle',think:Math.random()*.3,target:null,strafe:Math.random()<.5?1:-1,react:.4,
    speed:isPlayer?175:135+Math.random()*25,flash:0,lastHitBy:null,hitBy:0,lastHitT:-99,cause:null,sx:pos.x,sy:pos.y,stuckT:0,nudge:null,place:0,
    items:[],docs:0,intelT:0,sprint:false,runCd:0,fallCd:0,side:null,lunchGo:false,rapidT:0,slipT:0,ammo:0,lastCd:.6,cloakT:0,skillCd:0,rushT:0,branch:null,revived:false,shieldN:0,speedT:0,stunT:0,vipT:0,slowT:0,lockT:0,lockWhy:'',chan:null,transit:null,inv:0,
    seats:{},sit:null,sitT:0,sitHeal:0,sitStart:0,sitGoal:0,desk:null,deskCd:0,working:false,wc:null,wcCd:0,jobs:{dev:0,mkt:0,hr:0},lighter:0,bill:false,billFrom:null,billT:-99,meal:0,lad:null,smokeCd:0,workT:0,carry:false,lastTaskT:-99,tasksDone:0,coffeeCd:0,coolerCd:0,
    contact:null,call:null,met:{},stampT:0,stampNpc:null,greetLock:0,cleanCd:0,cleanFriend:false,chatCd:0,restT:0,inRest:false,
    pref:0,padPref:Math.random()<.5?'stair':'elev',greed:rnd(2,10),maxF:0,killer:null};
}
function mkNpc(kind,f,x,y){return{id:'n'+(++NID),kind,f,x,y,face:0,wp:0,pause:0,hold:0,alert:null,path:[],pathAge:0,goal:null,dropT:rnd(1,3),lastGreet:-99,active:true,t:0};}
const isOpen=f=>f>=G.closed&&f<=Math.min(NF-1,G.closed+WIN-1)&&f<NF;
const isLocked=f=>f>Math.min(NF-1,G.closed+WIN-1);
const topOpen=()=>Math.min(NF-1,G.closed+WIN-1);
const warnFloor=f=>G.warn&&f===G.closed&&G.closed<NF-1;

function assignSeats(f){
  const seats=FLOORS[f].seats.filter(s=>!s.npc).sort(()=>Math.random()-.5); // seat workers keep theirs
  for(const s of seats){s.owner=null;s.occ=null;}
  const al=G.actors.filter(a=>a.alive).sort(()=>Math.random()-.5);
  al.forEach((a,i)=>{const s=seats.at(i);if(s){s.owner=a;a.seats[f]=s;}else a.seats[f]=null;});
}
/* opts.humans: [{key,name}] for online rooms; default is one local player called '나'. Bots fill the rest up to TOTAL. */
/* solo difficulty: how good the bots are (aim spread, reaction, throw cooldown, speed) and whether a player who
   keeps out of trouble slowly gets 고과 back. Online rooms always play 'normal'. */
/* hunt: how close a person has to be before a bot goes for them unprovoked (0 = bots only hit back);
   huntP: the share of bots that do that at all; huntMax: how many may go after the same person at once;
   seek/seekAfter: on the last floor, the share of bots that go looking for people even out of sight, and how many
   seconds after the last floor opens they start (so hiding in a corner can't win the match) */
const DIFF={easy:{n:'쉬움',aim:1.8,react:.35,cd:1.35,speed:.9,regen:false,idle:false,hunt:0,huntP:0,huntMax:0,dodge:.1,seek:.2,seekAfter:25},normal:{n:'보통',aim:1,react:0,cd:1,speed:1,regen:false,idle:true,hunt:130,huntP:.2,huntMax:1,dodge:.3,seek:.55,seekAfter:10},
  hard:{n:'어려움',aim:.55,react:-.08,cd:.8,speed:1.07,regen:false,idle:true,hunt:180,huntP:.3,huntMax:2,dodge:.5,seek:.8,seekAfter:4}};
const diff=()=>DIFF[G&&G.diff]||DIFF.normal;
function newGame(opts={}){
  NID=0;
  const actors=[],spots=[];
  const pickPos=()=>{for(let i=0;i<300;i++){const p=randFree(0,90);if(p.y>K(480)&&spots.every(s=>dist(s,p)>80)){spots.push(p);return p;}}const p=randFree(0,90);spots.push(p);return p;};
  const hs=(opts.humans||[{key:'me',name:'나'}]).slice(0,TOTAL);
  for(const h of hs){const a=mk(h.name,true,'플레이어',HUMAN_COLORS[actors.length%HUMAN_COLORS.length],pickPos());a.key=h.key;a.fit=h.fit||null;actors.push(a);}
  const me=actors[0];
  /* opts.bots: how many bots (default: fill to TOTAL). opts.tutorial: a practice floor with no closures or events */
  const nb=opts.bots??TOTAL-hs.length;
  for(let i=0;i<nb;i++){const b=mk(NAMES[i],false,TYPES[i],SHIRTS[i],pickPos());b.pref=Math.random()<.3?1:0;actors.push(b);}
  G={t:0,actors,me,proj:[],items:[],traps:[],tasks:[],drops:[],wet:[],pops:[],dings:[],bursts:[],closed:0,nextClose:INTERVAL,warn:false,final:false,finalT:0,over:false,itemT:0,winner:null,
     npcs:[],doors:[],events:[],notice:null,ceo:null,blackout:null,cake:null,fire:0,star:null,audit:null,taskId:0,fillT:0,lunch:null,airdrops:[],respawn:[],smokes:[]};
  for(let f=0;f<NF;f++){
    const w=FLOORS[f].wp;
    G.npcs.push(Object.assign(mkNpc('boss',f,w[0][0],w[0][1]),{wp:1,slot:0,senior:f>=4})); // 5F+ : a 전무 instead of a 부장
    G.npcs.push(Object.assign(mkNpc('boss',f,w[2][0],w[2][1]),{wp:3,slot:1}));
    const c=randFree(f);G.npcs.push(mkNpc('cleaner',f,c.x,c.y));
    if(f>=1&&f<=4){const p=randFree(f);G.npcs.push(mkNpc('busy',f,p.x,p.y));}
    if(f>=1){const p=randFree(f);G.npcs.push(mkNpc('newbie',f,p.x,p.y));G.npcs.push(Object.assign(mkNpc('courier',f,PADS.elev.x,PADS.elev.y-20),{on:false,cd:rnd(12,40)}));}
    {const p=randFree(f);G.npcs.push(mkNpc('cart',f,p.x,p.y));}
    G.doors.push({f,v:null,cd:rnd(10,30)});
    /* seat workers: a few people glued to their desks from 2F up; their chairs are taken and now and then they ask a favour */
    for(const s of FLOORS[f].seats)s.npc=null;
    if(f>=1)for(const s of [...FLOORS[f].seats].sort(()=>Math.random()-.5).slice(0,3)){
      const n=Object.assign(mkNpc('desk',f,s.x,s.y),{face:s.face,ask:false,askT:rnd(6,30)});s.npc=n;s.occ=null;G.npcs.push(n);}
  }
  for(const s of FLOORS[ROOF].seats){s.owner=null;s.occ=null;}   // rooftop benches belong to nobody
  for(let f=0;f<WIN;f++)assignSeats(f);
  for(let f=0;f<WIN;f++){fillTasks(f);for(let i=0;i<itemQuota(f);i++)spawnItem(f);}
  // events
  const kinds=['ceo','blackout','cake','fire','audit','star'].sort(()=>Math.random()-.5);
  if(kinds.indexOf('ceo')>2){kinds.splice(kinds.indexOf('ceo'),1);kinds.splice(1,0,'ceo');}
  [rnd(28,38),rnd(62,72),rnd(150,165),rnd(195,210)].forEach((at,i)=>G.events.push({at,kind:kinds.at(i),stage:0}));
  G.events.push({at:rnd(96,104),kind:'lunch',stage:0});G.lunchKind=opts.lunch||pick(LUNCH_KINDS);
  G.diff=DIFF[opts.diff]?opts.diff:'normal';for(const b of actors)if(!b.isPlayer){b.speed*=diff().speed;b.hunter=Math.random()<diff().huntP;}
  if(opts.tutorial){G.tutorial=true;G.events=[];G.nextClose=1e9;for(const b of actors)if(!b.isPlayer)b.dummy=true;}
  UI.snapCam(me);
  UI.reset();
}
/* the top open floor has little work early on, so nobody can run ahead and keep a whole floor of tasks to themself */
const taskQuota=f=>!isOpen(f)?0:(G.closed>=NF-1?5:f===topOpen()?(G.closed<2?1:2):4);
const itemQuota=f=>!isOpen(f)?0:(G.closed>=NF-1?3:f===G.closed?4:f===topOpen()?2:3);
/* a handed-in task leaves a gap for a while before another one turns up (the lobby's few desks stay empty longer) */
const TASK_GAP=f=>f===0?15:0;
/* promotion progress (peak) only takes part of the 고과 you gain above it once you're 대리 or 팀장, so the top ranks
   take real work (고과 itself is not affected) */
const PROMO_K={사원:.5,대리:.3,팀장:.7};
const IDLE=45,IDLE_DRAIN=.35; // seconds without doing anything before 고과 leaks, and how fast
function fillTasks(f){let n=0;const gaps=G.respawn.filter(r=>r.f===f&&r.at>G.t).length;while(G.tasks.filter(t=>t.f===f).length+gaps<taskQuota(f)&&n++<10)spawnTask(f);}
function spawnTask(f){
  const fl=FLOORS[f],have=k=>G.tasks.some(t=>t.f===f&&t.kind===k);
  const pool=['report','report'];
  if(f>0&&!have('copy'))pool.push('copy');
  if(!have('print')&&!G.actors.some(a=>a.carry&&a.f===f)&&!G.drops.some(d=>d.f===f))pool.push('print');
  if(fl.meet.length&&G.tasks.filter(t=>t.f===f&&t.kind==='meet').length<fl.meet.length)pool.push('meet','meet');
  if(fl.spots.server&&!have('server'))pool.push('server');
  if(fl.recep.length&&G.tasks.filter(t=>t.f===f&&t.kind==='recep').length<fl.recep.length)pool.push('recep','recep');
  if(f===0){pool.length=0;pool.push('recep','recep');if(!have('badge'))pool.push('badge');}
  const k=pick(pool),T={id:++G.taskId,f,kind:k,prog:0,ready:false,react:{},by:null,awayT:0};
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

/* Feed lines go to every human; msg may be a function of the viewer (v=>...) so each player reads '내가' about themself. */
function feed(msg,hot){UI.feed(msg,hot,null);}
function tell(a,msg,hot){if(a.isPlayer)UI.feed(msg,hot,a);}
const humans=()=>G.actors.filter(a=>a.isPlayer);
function notice(text,dur=5){G.notice={text,t:dur};UI.notice(text);}
function pop(f,x,y,text,color){G.pops.push({f,x,y,text,color,t:0});}
/* a spoken line: drawn as a speech bubble that follows the speaker (o = actor or npc; or any {f,x,y} spot) */
function say(o,text,color){if(!o||o.f<0)return;const by=o.id??null;if(by!=null)G.pops=G.pops.filter(p=>!(p.say&&p.by===by));G.pops.push({f:o.f,x:o.x,y:o.y,text,color:color||'#1d2328',t:0,say:true,by});}
function burst(p){for(const a of G.actors){if(a===p.o||!a.alive||a.f!==p.f||a.inRest||ally(p.o,a))continue;if(Math.hypot(a.x-p.x,a.y-p.y)<95)hit(a,p.o,7,'서류 폭탄 -7',p);}G.bursts.push({f:p.f,x:p.x,y:p.y,t:0});}
function dmg(a,n,cause){if(!a.alive)return;a.g-=n;a.cause=cause;}
/* drink=true: coffee and the like top 고과 up but don't count toward promotion */
function gain(a,n,drink){
  if(!a.alive)return;const was=a.g;a.g=Math.min(100,a.g+n);
  if(!drink&&a.g>a.peak){a.peak+=(a.g-Math.max(was,a.peak))*(PROMO_K[a.rank]??1);const r=rankOf(a.peak);if(r!==a.rank){a.rank=r;if(a.isPlayer)pop(a.f,a.x,a.y-40,'승진! '+r,'#2f7d4f'); // the promotion slip (client) says the rest
    if(rankAt(a,'사원')&&!a.branch)assignTeam(a);}} // 사원 promotion: 발령 to the team of what you did most as an intern
}
const locked=a=>!!a.call||a.lockT>0||a.stunT>0;
function stand(a){if(a.desk)endDesk(a);if(a.sit){a.sit.occ=null;a.sit=null;}}
/* credit for real work (task, delivery, favour, kill): resets the idle clock */
function worked(a){if(a)a.workT=G.t;}
function sit(a,s){if(s.npc||s.occ&&s.occ!==a)return false;stand(a);a.sit=s;s.occ=a;a.x=s.x;a.y=s.y;a.face=s.face;a.sitT=0;a.sitHeal=0;a.sitStart=G.t;a.path=[];a.vx=a.vy=0;if(s.owner===a&&a.deskCd<=0)startDesk(a);return true;}
const DMG={인턴:1,사원:1.15,대리:1.3,팀장:1.6,'임원':2};
const dmgMul=o=>o&&o.rank?(DMG[o.rank]||1):1;
function hit(t,o,n,label,p){
  n=Math.round(n*dmgMul(o));if(t.branch==='hr')n*=1-.1*teamK(t); // 인사: 대리 -5%, 팀장 -10% damage taken
  if(label)label=label.replace(/-\d+/,'-'+Math.round(n));
  if(t.inv>0){pop(t.f,t.x,t.y-26,'도착 보호','#5d666e');return;}
  if(t.desk){pop(t.f,t.x,t.y-26,'근무 중 (못 건드림)','#5d666e');return;}
  if(t.f===ROOF){n=Math.max(1,Math.round(n*LUNCH.dmg));if(label)label=label.replace(/-\d+/,'-'+n);dropLighters(t);if(t.meal>0)t.meal=Math.max(0,t.meal-LUNCH.meal.spill);}
  if(t.shieldN>0){t.shieldN--;pop(t.f,t.x,t.y-26,'결재 도장으로 막음','#cf3626');return;}
  dmg(t,n,'paper');if(o){o.workT=G.t;jobDone(o,'mkt');passBill(t,o);}t.lastHitBy=o;t.hitBy=o?o.id:0;t.lastHitT=G.t;t.flash=.22;pop(t.f,t.x,t.y-26,label||('-'+Math.round(n)),'#cf3626');
  UI.shake(.15,t);
  stand(t);
  if(t.chan&&t.chan.pad==='stair'){t.chan=null;pop(t.f,t.x,t.y-44,'계단 오르다 맞음','#cf3626');}
  if(t.carry){t.carry=false;G.drops.push({f:t.f,x:t.x+rnd(-14,14),y:t.y+rnd(-14,14)});pop(t.f,t.x,t.y-44,'출력물 떨어뜨림','#cf3626');}
  if(p&&o)soundAlert(t.f,t,p.ox,p.oy,o);
}
