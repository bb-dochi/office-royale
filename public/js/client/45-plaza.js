/* ================= plaza: the shared lobby behind the start menu =================
   Everyone on the start screen walks around the 1F lobby together (server/src/plaza.js relays positions),
   plus a few local bots. No game rules run here: movement uses the same collision code, greetings are preset lines. */
const PZ={fits:new Map(),dress:false,on:false,ws:null,pid:null,others:new Map(),bots:[],count:0,sendT:0,sent:'',online:false};
/* lobby lines: keys 1-5 say the first five, E says any of the ten at random; server/src/plaza.js checks the count */
const EMOTES=['안녕하세요.','좋은 아침입니다.','집 가고 싶다..','배고프다..','점심 뭐 드세요?','커피 한잔 하실래요?','오늘도 야근인가요…','수고하셨습니다!','회의 몇 시였죠?','같이 출근하실 분~'];
/* what the lobby bots mutter, one line every several seconds each */
const BOT_LINES=['오늘 점심 뭐 먹지…','회의 몇 시였더라','커피 한 잔 해야겠다','퇴근까지 몇 시간 남았지','월요일 싫다…','보고서 아직 못 썼는데','팀장님 어디 가셨지?','주말만 기다린다','야근 각이다…','오늘도 무사히…'];
/* 안내원 at the 1F 안내데스크: E gets a piece of advice at random, each one once before any comes round again */
const GUIDE_TIPS=['신입 씨, 위층부터 올라가세요. 아래층부터 닫혀요!','대표님 보이면 꼭 먼저 인사하세요!','옆 팀 팀장님은 피하세요. 말씀이 엄청 길어요…',
  '부장님 보이면 인사부터 하세요.','부장님 앞에선 던지지 마세요. 바로 걸려요!','청소 아주머니께 인사 잘해 두세요.',
  '젖은 바닥에선 뛰지 마세요. 미끄러져요.','인턴 후배가 물어보면 친절하게 알려 주세요.','내 자리에 앉으면 업무를 할 수 있어요.',
  '화장실에 너무 오래 숨어 있지 마세요.','화장실 변기에 앉으면 폰으로 화캉스를 즐길 수 있어요~','너무 노시면 업무 태만으로 찍혀요.',
  '힘들면 커피 카트 근처로 가 보세요.','직급 높은 사람을 이기면 보상을 더 받아요.','곧 폐쇄되는 층의 업무는 보상이 커요.',
  '고과 관리 잘하시고 동료들 조심하세요!'];
const GUIDE_IDLE=['어서 오세요, 신입 씨!','모르는 거 있으면 물어보세요~','첫 출근이죠? 긴장 푸세요.','오늘도 파이팅하세요!'];
const GUIDE_FIT={hair:'bun',hairC:'#1f1b1a',skin:'#fbd8bb',top:'vest',topC:'#2b4a6b',shirtC:'#f4f6f8',tie:'#d9a441',badge:true,glasses:false,bottom:'pants',bottomC:'#2b3a55'};
const PZ_BASE=100000; // actor ids for real people, so every client builds the same outfit for the same person

function plazaWorld(){
  const me=mk('나',true,'플레이어','#2b6cb0',{x:FW/2,y:K(470)});me.id=PZ_BASE;me.alive=true;me.f=0;me.face=-Math.PI/2;me.fit=myFit();
  G={t:0,actors:[me],me,proj:[],items:[],traps:[],tasks:[],drops:[],wet:[],pops:[],dings:[],bursts:[],closed:0,nextClose:1e9,warn:false,final:false,finalT:0,over:false,winner:null,
     npcs:[],doors:FLOORS.map((_,f)=>({f,v:null})),events:[],notice:null,ceo:null,blackout:null,cake:null,fire:0,star:null,audit:null,lunch:null,airdrops:[],plaza:true};
  PZ.bots=[];
  for(let i=0;i<5;i++){const p=randFree(0,60),b=mk(NAMES[(i*4+3)%NAMES.length],false,'봇',SHIRTS[(i*5+2)%SHIRTS.length],p);b.f=0;b.alive=true;b.path=[];b.pause=1+i;b.talkT=rnd(3,10);
    G.actors.push(b);PZ.bots.push(b);}
  /* stands behind the 안내데스크, left of the info board, facing the visitors */
  const g=mk('안내원',false,'안내원','#2b4a6b',{x:K(478),y:K(538)});g.f=0;g.alive=true;g.face=Math.PI/2;g.fit=GUIDE_FIT;g.talkT=rnd(6,12);g.lookT=0;
  G.actors.push(g);PZ.guide=g;PZ.desk=FLOORS[0].ob.filter(o=>o.k==='reception').sort((a,b)=>b.w-a.w)[0];PZ.tips=PZ.tips||[]; // anywhere along the desk counts
  PZ.others.clear();cam={x:me.x,y:me.y};if(typeof hallSet==='function')hallSet();
}
function pzURL(){
  const q=new URLSearchParams(location.search).get('server'),host=q||location.host;
  const secure=q?!/^(localhost|127\.|192\.168\.|10\.)/.test(q):location.protocol==='https:';
  return `${secure?'wss':'ws'}://${host}/plaza`;
}
function plazaConnect(){
  let ws;try{ws=new WebSocket(pzURL());}catch{return;}
  PZ.ws=ws;
  ws.onopen=()=>{const hi=()=>{if(PZ.ws!==ws||ws.readyState!==1)return;if(typeof rankUid!=='function')return void setTimeout(hi,50);   // the socket can open before 48-rank.js has loaded
    ws.send(JSON.stringify({t:'hello',name:store.get('or-name')||'신입',fit:myFit(),uid:rankUid()}));};hi();};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.t==='pz-hi'){PZ.pid=m.you;PZ.online=true;PZ.roomSent='';pzRoomSend();const me=G&&G.plaza&&G.me;if(me){me.id=PZ_BASE+m.you;me.name=m.name;dropMesh(me);}}
    else if(m.t==='pz'){PZ.count=m.n;plazaPeople(m.p);}
    else if(m.t==='pz-fit'){const a=PZ.others.get(m.id);PZ.fits.set(m.id,m.fit);if(a){a.fit=cleanFit(m.fit);dropMesh(a);}}
    else if(m.t==='pz-say'){const a=m.id===PZ.pid?G.me:PZ.others.get(m.id);if(a&&EMOTES[m.i])say(a,EMOTES[m.i]);}};
  ws.onclose=()=>{if(PZ.ws!==ws)return;PZ.ws=null;PZ.online=false;if(PZ.on)setTimeout(()=>{if(PZ.on&&!PZ.ws)plazaConnect();},4000);};
}
/* 상대방: a spring towards the last position heard. The velocity stays continuous, so uneven network steps don't show as stutter */
const PZ_FOLLOW=2/.16;
function pzFollow(a,dt){if(Math.hypot(a.nx-a.x,a.ny-a.y)>260){a.x=a.nx;a.y=a.ny;a.fvx=a.fvy=0;return;}
  const k=PZ_FOLLOW*dt,e=1/(1+k+.48*k*k+.235*k*k*k);
  for(const[p,n,v]of[['x','nx','fvx'],['y','ny','fvy']]){const c=a[p]-a[n],t=((a[v]||0)+PZ_FOLLOW*c)*dt;a[v]=((a[v]||0)-PZ_FOLLOW*t)*e;a[p]=a[n]+(c+t)*e;}}
const dropMesh=a=>{const m=actorM.get(a);if(m){scene.remove(m);actorM.delete(a);}};
function plazaPeople(list){
  if(!G||!G.plaza)return;const seen=new Set();
  for(const[pid,name,seed,x,y,face,mv,room]of list){if(pid===PZ.pid)continue;seen.add(pid);
    let a=PZ.others.get(pid);
    if(!a){a=mk(name,true,'플레이어',SHIRTS[seed%SHIRTS.length],{x,y});a.id=PZ_BASE+pid;a.f=0;a.alive=true;a.nx=x;a.ny=y;a.fit=cleanFit(PZ.fits.get(pid));PZ.others.set(pid,a);G.actors.push(a);}
    a.nx=x;a.ny=y;a.tf=face;a.name=name;a.room=room||null;}
  for(const[pid,a]of PZ.others)if(!seen.has(pid)){PZ.others.delete(pid);PZ.fits.delete(pid);G.actors.splice(G.actors.indexOf(a),1);}
}
/* keepLobby: coming back to a match room's waiting sheet, which docks over the plaza instead of the home card */
function plazaStart(keepLobby){
  if(PZ.on)return;PZ.on=true;running=false;
  plazaWorld();document.body.classList.add('plaza');
  for(const id of['lobby','result','cine','notice','callBox','branchBox','countdown','spec'])if(!(keepLobby&&id==='lobby'))$(id).hidden=true;
  $('home').hidden=!!keepLobby;$('feed').textContent='';PZ.roomSent='';
  plazaConnect();if(typeof careerLoad==='function')careerLoad();if(typeof hallLoad==='function')hallLoad();   // (the very first time 51-career.js and 52-hall.js aren't loaded yet: they do this themselves)
}
function plazaStop(){
  if(!PZ.on)return;PZ.on=false;if(G&&G.plaza&&G.me){G.me.wc=null;if(G.me.sit)pzStand();}if(typeof hallStop==='function')hallStop();
  {const fl=FLOORS[0];let ch=false;for(const d of fl.doors)if(d.open){d.open=false;ch=true;}if(ch)refreshObs(fl);}dressClose();document.body.classList.remove('plaza');$('home').hidden=true;$('pzRooms').hidden=true;PZ.roomsKey='';
  const ws=PZ.ws;PZ.ws=null;PZ.online=false;if(ws)try{ws.close();}catch{}
}
/* ---------- match rooms seen in the plaza ---------- */
/* tell the plaza which room I am waiting in (or none), so it shows over my head to everyone else */
function pzRoomSend(){
  const r=NETC.room,mine=r&&r.players.find(p=>p.key===r.you),v=r&&r.state==='lobby'&&PZ.on?{code:r.code,n:r.players.length,name:mine?mine.name:undefined}:{};
  if(G&&G.plaza&&G.me){G.me.room=v.code?[v.code,v.n]:null;if(v.name)G.me.name=v.name;}
  const k=JSON.stringify(v);if(!PZ.ws||PZ.ws.readyState!==1||k===PZ.roomSent)return;PZ.roomSent=k;PZ.ws.send(JSON.stringify({t:'pz-room',...v}));
}
function pzJoin(code){if(NETC.room)return;$('nameIn').value=$('nameIn').value||store.get('or-name')||'';dressClose();joinRoom(code);}
/* the nearest person with an open room, close enough to walk up and press E */
const pzNear=()=>{const me=G.me;let best=null,bd=110;for(const a of PZ.others.values())if(a.room&&a.room[1]<ROOM_MAX){const d=Math.hypot(a.x-me.x,a.y-me.y);if(d<bd){bd=d;best=a;}}return best;};
/* E on the lobby's things and bots: a taste of the office with nothing at stake (no 고과, only seen on this screen).
   pzTarget is what E would do here, also drawn as a hint over it by the renderer */
const PZ_THINGS=[
  ['coffee',50,'커피 마시기',()=>{pop(0,G.me.x,G.me.y-30,'☕ 카페인 충전','#7a4b2a');say(G.me,pick(['캬~ 살 것 같다','오늘도 커피로 버틴다','아메리카노 수혈 완료']));}],
  ['cooler',60,'물 마시기',()=>{pop(0,G.me.x,G.me.y-30,'💧 시원하다','#3f6f99');say(G.me,pick(['물 마시는 척 쉬는 중','하루 2리터 목표…']));}],
  ['printer',55,'출력하기',()=>say(G.me,pick(['지이잉… 출력 중','또 용지 걸렸네','컬러로 뽑으면 혼나겠지?']))],
  ['copier',55,'복사하기',()=>say(G.me,pick(['복사기 예열 중…','양면으로 할걸','토너가 없다…']))],
  ['board',70,'사내 게시판 보기',()=>boardOpen()],
  ['badge',45,'출입증 찍기',()=>say(G.me,pick(['삑! 출근 완료','삑… 오늘도 왔다','지각 아니다 지각 아니다']))],
];
const BOT_REPLIES=['아 네, 안녕하세요!','점심 같이 드실래요?','저 지금 회의 가는 길이에요','오늘 출근하셨어요?','부장님 보셨어요?','커피 사주시는 거예요?','네? 저요?','오늘 야근 각이래요…'];
function pzTarget(){
  if(!G||!G.plaza||!G.me||PZ.dress)return null;const me=G.me,sp=FLOORS[0].spots,fl=FLOORS[0];
  /* the match's own door, 화캉스 phone and desk game, run locally (pzLocal) */
  if(me.wc)return me.wc.res?null:{x:me.x,y:me.y,label:`${wcGain(me.wc.m)>=0?'익절':'손절'}! ×${me.wc.m.toFixed(2)}`,fn:()=>cashWc(me)};
  if(me.sit)return{x:me.x,y:me.y,label:me.desk?'일어나기 (근무 끝)':'일어나기',fn:()=>pzStand()};
  {const d=nearDoor(me);if(d)return{x:d.x+d.w/2,y:d.y+d.h/2,label:d.open?`${d.name} 닫기`:`${d.name} 열기`,fn:()=>toggleDoor(0,d,!d.open)};}
  if(me.inRest&&sp.toilet&&dist(me,sp.toilet)<48)return me.wcCd>0?{x:sp.toilet.x,y:sp.toilet.y,label:`폰 충전 중 · ${Math.ceil(me.wcCd)}초`,fn:()=>{}}
    :{x:sp.toilet.x,y:sp.toilet.y,label:'화캉스 즐기기',fn:()=>startWc(me)};
  {const s=fl.seats.find(s=>!s.occ&&!s.npc&&dist(me,s)<26);if(s){const work=s.dept!=='카페'&&me.deskCd<=0;
    return{x:s.x,y:s.y,label:work?'앉기 (모니터 업무)':'앉기',fn:()=>pzSit(s,work)};}}
  {const g=PZ.guide,d=PZ.desk;if(g&&(Math.hypot(g.x-me.x,g.y-me.y)<150||d&&inRect(me,{x:d.x-30,y:d.y-80,w:d.w+60,h:d.h+160})))return{x:g.x,y:g.y,bot:true,quiet:g.lookT>0,label:'말 걸기',fn:()=>pzGuide(g)};}
  if(typeof hallNear==='function'&&hallNear(me))return{x:HL_X,y:HL_BOX.y+HL_BOX.h,label:'명예 사원 보기',fn:hallOpen};
  let best=null,bd=1e9;
  for(const b of PZ.bots){const d=Math.hypot(b.x-me.x,b.y-me.y);if(d<70&&d<bd){bd=d;best={x:b.x,y:b.y,bot:true,label:'말 걸기',fn:()=>pzTalk(b)};}}
  if(best)return best;
  for(const[k,r,label,fn]of PZ_THINGS){const p=sp[k];if(!p)continue;const d=Math.hypot(p.x-me.x,p.y-me.y);if(d<r&&d<bd){bd=d;best={x:p.x,y:p.y,label,fn,board:k==='board'};}}
  return best;
}
/* the bot stops, turns to me and answers */
function pzTalk(b){b.pause=Math.max(b.pause,2.5);b.path=[];b.face=Math.atan2(G.me.y-b.y,G.me.x-b.x);b.talkT=Math.max(b.talkT,6);say(b,pick(BOT_REPLIES));}
/* the 안내원 turns to me and gives a tip off a shuffled pile (reshuffled when empty, without the one just said), held on screen long enough to read */
function pzGuide(g){g.face=Math.atan2(G.me.y-g.y,G.me.x-g.x);g.lookT=5;g.talkT=Math.max(g.talkT,12);
  if(!PZ.tips.length){PZ.tips=GUIDE_TIPS.filter(t=>t!==PZ.lastTip);for(let i=PZ.tips.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[PZ.tips[i],PZ.tips[j]]=[PZ.tips[j],PZ.tips[i]];}}
  PZ.lastTip=PZ.tips.pop();say(g,PZ.lastTip);G.pops[G.pops.length-1].life=5;}
/* a desk chair runs the monitor game (the rules want the seat to be mine, so it is for as long as I sit) */
function pzSit(s,work){PZ.seat={s,owner:s.owner};s.owner=work?G.me:null;sit(G.me,s);}
function pzStand(){stand(G.me);pzSeatBack();}
const pzSeatBack=()=>{if(PZ.seat){PZ.seat.s.owner=PZ.seat.owner;PZ.seat=null;}};
/* every frame in the lobby: restroom, phone game, desk game (it stands me up itself when done), sitting still */
function pzLocal(dt,m){
  /* the games pay out 고과 as in a match; keep it far enough below the 사원 line (55) that the lobby never promotes
     anyone or hands out a team (a desk round is +6 at most, 화캉스 +12) */
  const me=G.me;me.g=me.peak=40;me.rank='인턴';me.branch=null;me.inRest=inRect(me,FLOORS[0].rest);
  if(me.wcCd>0)me.wcCd-=dt;if(me.deskCd>0)me.deskCd-=dt;
  if(me.wc){if(wcLeave(me,m))me.wc=null;else wcStep(me,dt);}
  if(me.desk)deskStepA(me,dt);
  if(me.sit&&!me.desk&&m>.35)pzStand();
  if(!me.sit)pzSeatBack();
  return!me.sit&&!me.wc;
}
function pzUse(){const t=pzTarget();if(!t||G.t<(PZ.useT||0))return false;PZ.useT=G.t+1.2;t.fn();return true;}
/* chips at the top for every open room in the plaza (one per room, named after whoever is in it), refreshed a few times a second */
PZ.roomsT=0;PZ.roomsKey='';
function pzRooms(dt){
  PZ.roomsT-=dt;if(PZ.roomsT>0)return;PZ.roomsT=.4;
  const mine=NETC.room&&NETC.room.code,rooms=new Map();
  if(!mine&&!PZ.dress)for(const a of PZ.others.values())if(a.room&&!rooms.has(a.room[0]))rooms.set(a.room[0],{code:a.room[0],n:a.room[1],who:a.name});
  const list=[...rooms.values()].slice(0,3),key=JSON.stringify(list);if(key===PZ.roomsKey)return;PZ.roomsKey=key;
  const el=$('pzRooms');el.hidden=!list.length;
  el.innerHTML=list.map(r=>`<button data-code="${r.code}"${r.n>=ROOM_MAX?' disabled':''}><span>${esc(r.who)}님 방 · ${r.n}/${ROOM_MAX}</span><b>${r.n>=ROOM_MAX?'꽉 참':'참가'}</b></button>`).join('');
}
$('pzRooms').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&!b.disabled)pzJoin(b.dataset.code);});
function plazaSay(i){if(!PZ.on||!G||!G.me)return;if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-say',i}));else say(G.me,EMOTES[i]);}
/* every frame while the plaza is up: my walking, bots wandering, other people gliding to their reported spot */
function plazaFrame(dt){
  if(!G||!G.plaza)return;G.t+=dt;const me=G.me;
  const inp=PZ.dress?NOINPUT:me.input||NOINPUT;let{vx,vy}=inp;if(PZ.dress)me.face=Math.PI/2+PZ.yaw;const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}
  if(m>.15&&!G.me.sit)me.face=Math.atan2(vy,vx);const free=pzLocal(dt,m);me.sprint=free&&inp.run&&m>.15;if(free)drive(me,m>.15?vx:0,m>.15?vy:0,dt);
  for(const b of PZ.bots){
    b.talkT-=dt;if(b.talkT<=0){b.talkT=rnd(8,16);say(b,pick(BOT_LINES));}
    if(b.pause>0){b.pause-=dt;continue;}
    if(!b.path.length){const p=randFree(0,60);b.path=findPath(0,b.x,b.y,p.x,p.y);b.pause=rnd(1.5,4);continue;}
    const q=b.path[0],dx=q.x-b.x,dy=q.y-b.y,d=Math.hypot(dx,dy);if(d<6){b.path.shift();continue;}
    b.face=Math.atan2(dy,dx);drive(b,dx/d*.75,dy/d*.75,dt);}
  {const g=PZ.guide;if(g){if(g.lookT>0&&(g.lookT-=dt)<=0)g.face=Math.PI/2;g.talkT-=dt;if(g.talkT<=0){g.talkT=rnd(14,24);say(g,pick(GUIDE_IDLE));}}}
  for(const a of PZ.others.values()){pzFollow(a,dt);if(a.tf!=null)a.face=a.tf;}
  for(const p of G.pops)p.t+=dt;G.pops=G.pops.filter(p=>p.t<(p.life||(p.say?2.4:1.1)));
  const now=performance.now();
  if(PZ.ws&&PZ.ws.readyState===1&&now-PZ.sendT>100){const s=`${Math.round(me.x)},${Math.round(me.y)},${me.face.toFixed(2)}`;
    if(s!==PZ.sent||now-PZ.sendT>2000){PZ.sent=s;PZ.sendT=now;PZ.ws.send(JSON.stringify({t:'pz-pos',x:me.x,y:me.y,face:me.face,mv:m>.15}));}}
  pzRooms(dt);
  const n=PZ.online?Math.max(1,PZ.count):0;
  const t=PZ.online?`지금 로비에 ${n}명 접속 중`:'혼자 둘러보는 중 (로비 서버 연결 안 됨)';if($('pzCount').textContent!==t)$('pzCount').textContent=t;
  const dc=PZ.online?`로비 ${n}명`:'혼자 둘러보는 중';if($('dockCount').textContent!==dc)$('dockCount').textContent=dc;
}

/* ---------- menu ---------- */
/* PC greets with keys 1-5 and E; phones with the 상호작용 button when there is nothing near to use (10-input.js) */
const plazaSayRandom=()=>plazaSay(Math.floor(Math.random()*EMOTES.length));
addEventListener('keydown',e=>{if(!PZ.on||($('home').hidden&&!$('lobby').classList.contains('dock'))||(e.target.closest&&e.target.closest('input')))return;
  if(G&&G.plaza&&G.me.desk){const k={KeyW:'U',ArrowUp:'U',KeyS:'D',ArrowDown:'D',KeyA:'L',ArrowLeft:'L',KeyD:'R',ArrowRight:'R'}[e.code];if(k){e.preventDefault();deskKey(G.me,k);return;}}
  const n=/^(?:Digit|Numpad)([1-5])$/.exec(e.code);if(n)plazaSay(+n[1]-1);
  else if(e.code==='KeyE'){const a=!NETC.room&&pzNear();if(a)pzJoin(a.room[0]);else if(!pzUse())plazaSayRandom();}});
/* how much of the screen bottom the card covers; the lobby camera lifts me into the space above it */
PZ.cardH=0;
const pzCover=()=>{const c=!$('home').hidden&&$('home').classList.contains('dressing')?$('home').querySelector('.homecard'):!$('lobby').hidden&&$('lobby').classList.contains('dock')?$('lobby').querySelector('.memo'):null;
  PZ.cardH=c?Math.max(0,innerHeight-c.getBoundingClientRect().top):0;};
const pzRO=new ResizeObserver(pzCover);pzRO.observe($('home').querySelector('.homecard'));pzRO.observe($('lobby').querySelector('.memo'));
/* ---------- name: asked once on the first visit, changeable from the chip under the title ---------- */
function nameStep(on){$('nameStep').hidden=!on;$('homeMenu').hidden=on;$('home').classList.toggle('naming',on);if(on)$('home').classList.remove('closed');if(on){$('homeName').value=store.get('or-name')||'';setTimeout(()=>$('homeName').focus(),50);}}
function nameSave(){
  const n=$('homeName').value.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,10);if(!n){$('homeName').focus();return;}
  const first=!store.get('or-name');
  store.set('or-name',n);$('nameIn').value=n;$('myName').textContent=n;nameStep(false);if(first)tutAsk(true,n);if(!first)profSave();
  if(G&&G.plaza&&G.me)G.me.name=n;if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-name',name:n}));
}
$('myName').textContent=store.get('or-name')||'신입';
/* first visit: once the name is set, ask whether to do the tutorial before showing the menu */
function tutAsk(on,n){$('tutAsk').hidden=!on;$('homeMenu').hidden=on;$('home').classList.toggle('asking',on);if(on){$('tutAskH').textContent=`${n}님, 첫 출근이시죠?`;setTimeout(()=>$('tutAskGo').focus(),50);}}
$('tutAskGo').addEventListener('click',()=>{tutAsk(false);tutStart();});
$('tutAskSkip').addEventListener('click',()=>tutAsk(false));
$('nameOk').addEventListener('click',nameSave);
$('homeName').addEventListener('keydown',e=>{if(e.key==='Enter')nameSave();});
$('nameEdit').addEventListener('click',()=>nameStep(true));
/* ---------- open card ↔ binder tabs on the right ---------- */
/* first visit: the card is open (it asks for a name); after that the lobby opens with just the tabs, unless the card was left open */
function homeClose(c){if(c&&!$('tutAsk').hidden)tutAsk(false);$('home').classList.toggle('closed',c);pzCover();}
homeClose(false); // the guide card greets every page load
if(!store.get('or-name'))nameStep(true);
$('homeX').addEventListener('click',()=>homeClose(true));
$('home').addEventListener('click',e=>{if(e.target===$('home')&&$('nameStep').hidden&&!PZ.dress)homeClose(true);}); // tap the dimmed lobby to close
addEventListener('keydown',e=>{if(e.key==='Escape'&&PZ.on&&!$('home').hidden&&!$('home').classList.contains('closed')&&!PZ.dress&&$('nameStep').hidden)homeClose(true);});
$('dock').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const go=b.dataset.go;
  if(go==='guide')homeClose(false);
  else if(go==='solo')diffOpen();
  else if(go==='multi'){$('home').hidden=true;showLobby();}
  else if(go==='rank')rankOpen();
  else if(go==='tut')tutStart();
  else if(go==='dress'){PZ.dressFromDock=true;$('home').classList.remove('closed');dressOpen();}});
$('hSolo').addEventListener('click',diffOpen);
/* 부서 안내: one card per team, opened from the 팀 보기 link on the guide */
const TEAM_FIRST={dev:'업무 많이',mkt:'서류 명중 많이',hr:'윗선·동료 응대 많이'},PROP_NAME={dev:'💻',mkt:'📣',hr:'📋'},TEAM_PERK={dev:'업무 속도 ↑',mkt:'서류 사거리 ↑',hr:'받는 피해 ↓'};
function teamInfoOpen(){
  /* three rows per team: how you get there, what promotions give, the Q skill. Each card wears its team's colour here */
  $('teamInfoCards').innerHTML=TEAMS.map(k=>{const B=BRANCH[k];return`<div class="tcard" style="--tc:${B.c}"><b>${PROP_NAME[k]} ${teamShort(k)}팀</b>
    <dl><dt>발령 기준</dt><dd>인턴 때 ${TEAM_FIRST[k]}</dd><dt>승진 혜택</dt><dd>${TEAM_PERK[k]}</dd><dt>팀 스킬${isTouch?'':' (Q)'}</dt><dd><em>${B.sk}:</em> ${B.kt}</dd></dl></div>`;}).join('');
  $('teamInfo').hidden=false;}
$('teamInfoBtn').addEventListener('click',e=>{e.stopPropagation();teamInfoOpen();});
$('teamInfoX').addEventListener('click',()=>{$('teamInfo').hidden=true;});
$('teamInfo').addEventListener('click',e=>{if(e.target===$('teamInfo'))$('teamInfo').hidden=true;});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('teamInfo').hidden){e.stopImmediatePropagation();$('teamInfo').hidden=true;}},true);
$('hMulti').addEventListener('click',()=>{$('home').hidden=true;showLobby();});
/* ---------- dressing room ---------- */
/* rows by category tab: [label, key, options, names, shown-if, picture]. Rows with names show a picture of the default outfit (기본 옷) wearing
   each option (charShot: the view, or one per option); the rest are colour swatches. Keys other than fit fields: eyes
   (안경/선글라스), faceK (없음/다크서클/주근깨), badgeK (사원증 기본/금장), gear (toggled 성과 pieces). Options a 성과 step unlocks are shown locked (🔒) and only tried on */
const DRESS_CATS=[['hair','헤어'],['face','얼굴'],['top','상의'],['bottom','하의'],['acc','소품'],['fx','이펙트'],['title','칭호']];
/* a colour list with the 성과 swatches for that fit field after the ordinary ones */
const rwCols=(k,base)=>[...base,...Object.keys(RW_COLOR).filter(c=>RW_COLOR[c].key===k&&!base.includes(c))];
const DRESS_ROWS={
  hair:[['헤어','hair',FIT.hair,{short:'짧은 머리',side:'옆가르마',long:'긴 머리',bun:'올림 머리',bald:'대머리',twin:'양갈래',slick:'2대8 가르마',messy:'부스스',pony:'포니테일',allback:'올백',perm:'뽀글 파마',buzz:'반삭'},null,'head'],['헤어 색','hairC',rwCols('hairC',FIT.hairC)]],
  face:[['표정','eye',FIT.eye,{normal:'기본',sparkle:'초롱초롱',sleepy:'게슴츠레',smile:'실눈',dead:'기절'},null,'face'],['안경','eyes',['none','glasses','shades'],{none:'없음',glasses:'안경',shades:'선글라스'},null,'face'],['얼굴','faceK',['off','eyebags','freckles','stamp'],{off:'없음',eyebags:'다크서클',freckles:'주근깨',stamp:'반려 도장'},null,'face'],['피부','skin',FIT.skin]],
  top:[['상의','top',FIT.top,{shirt:'셔츠',jacket:'정장',cardigan:'가디건',vest:'조끼',hoodie:'후드티',check:'체크셔츠',tee:'거래소 티셔츠',pj:'파자마'},null,'chest'],['상의 색','topC',rwCols('topC',FIT.topC),null,f=>f.top!=='pj'&&f.top!=='tee'],
    ['셔츠','shirtC',FIT.shirtC,null,f=>['jacket','cardigan','vest'].includes(f.top)],['넥타이','tie',rwCols('tie',FIT.tie),null,f=>f.top!=='hoodie'&&f.top!=='tee'&&f.top!=='pj']],
  bottom:[['하의','bottom',FIT.bottom,{pants:'바지',skirt:'치마',shorts:'반바지',pj:'파자마 바지'},null,'legs'],['하의 색','bottomC',rwCols('bottomC',FIT.bottomC),null,f=>f.bottom!=='pj'],
    ['신발','shoe',FIT.shoe,{loafer:'구두',sneaker:'운동화',slipper:'슬리퍼'},null,'feet'],['신발 색','shoeC',rwCols('shoeC',FIT.shoeC)]],
  acc:[['사원증','badgeK',['off','on','goldBadge'],{off:'없음',on:'기본',goldBadge:'금장'},null,{off:'chest',on:'chest',goldBadge:'badge'}],
    ['소품','gear',['cig','coffee','dragon','pillow','postit','crown','watch','tissue','sash','trophy','halo'],{cig:'담배',coffee:'커피',dragon:'용문신 토시',pillow:'목베개',postit:'포스트잇',crown:'왕관',watch:'금시계',tissue:'바지에 낀 휴지',sash:'어깨띠',trophy:'트로피',halo:'후광'},null,{cig:'face',coffee:'cup',dragon:'dragon',pillow:'neck',postit:'note',crown:'crown',watch:'wrist',tissue:'tail',sash:'sash',trophy:'trophy',halo:'halo'}],
    ['후광 색 (관리자)','haloT',[1,2,3],{1:'금',2:'은',3:'동'},f=>RW_LOCAL&&(f.gear||[]).includes('halo')]],
  fx:[['달리기','fx',[null,'gold','paper','wind','smoke','escort'],{null:'없음',gold:'금가루',paper:'서류 날림',wind:'칼바람',smoke:'담배연기',escort:'수행원'},null,{null:'—',gold:'✨',paper:'📄',wind:'💨',smoke:'🚬',escort:'🕴️'}],
    ['던지기','thr',[null,'plane','sticky','trophy','keyboard','mug'],{null:'서류',plane:'종이비행기',sticky:'포스트잇',trophy:'작은 트로피',keyboard:'키보드',mug:'머그컵'},null,{null:'📄',plane:'✈️',sticky:'🟨',trophy:'🏆',keyboard:'⌨️',mug:'☕'}]],
};
const RW_AW_N=REWARDS.awards;
/* the open tab and the locked options being tried on ([{k,v}]) */
const DR={cat:'hair',tries:[]};
/* which 성과 step an option needs (null: free) and whether I have it (the server's 성과 steps, see 51-career.js) */
function rwNeed(k,v){
  if(k==='title'){const[aw,st]=String(v).split(':');return{aw,st:+st,oid:`title:${v}`};}
  const aw=r=>r&&(r.aw||r.temp)?r:null;   // (no aw: free for everyone)
  if(k==='eyes')return v==='shades'?aw(RW_GEAR.shades):null;if(k==='badgeK')return v==='goldBadge'?aw(RW_GEAR.goldBadge):null;if(k==='faceK')return aw(RW_GEAR[v]||REWARDS.face[v]);
  if(REWARDS[k])return aw(REWARDS[k][v]);
  const c=RW_COLOR[v];return c&&c.key===k?c:null;}   // a colour is locked even with no step yet
/* the default outfit wearing one option, for its picture */
const rwShotFit=(k,v)=>{const f=dressApply(DEFAULT_FIT,k,v);return f;};
/* 로컬 전체 해금: on the dev server everything can be worn, to walk round in it (the 옷장 button turns it off to see the locks); never on the real site */
const RW_LOCAL=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname),rwUnlocked=()=>RW_LOCAL&&store.get('or-unlock')!=='0';
/* have it: in the career's 소지품 (the server's `own`) */
for(const k of['top','hair','eye','face','shoe','bottom','gear','fx','thr','color'])for(const[id,r]of Object.entries(REWARDS[k]))r.oid=`${k}:${id}`;
function rwHave(n){if(!n||rwUnlocked())return true;const own=typeof CR!=='undefined'&&CR.view&&CR.view.own;return!!own&&own.includes(n.oid);}
/* my place last week (1~3) if it lends me anything, and taking off what was only lent once the week is over */
const rwPlace=()=>{const own=(typeof CR!=='undefined'&&CR.view&&CR.view.own)||[],k=own.find(x=>/^halo:/.test(x));return k?+k.slice(5):0;};
/* 지난주 1~3위: once a week, on coming back to the lobby: the 후광 put on for them (금가루 too for 1위, unless another trail is on) and a note saying so */
function rwLentCheck(){const l=typeof CR!=='undefined'&&CR.view&&CR.view.lent;if(!l||!PZ.on)return;const seen=`${l.week}:${l.place}`;if(store.get('or-lentSeen')===seen)return;store.set('or-lentSeen',seen);
  const f=myFit();f.gear=[...new Set([...(f.gear||[]),'halo'])];f.haloT=l.place;if(l.place===1&&!f.fx)f.fx='gold';store.set('or-fit',JSON.stringify(f));
  if(G&&G.plaza&&G.me)dressShow();if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-fit',fit:f}));profSave();
  $('rankWinList').hidden=true;$('rankWinH').textContent=`지난주 랭킹 ${l.place}위!`;
  $('rankWinS').textContent=`${['','금빛 후광과 금가루를','은빛 후광을','동빛 후광을'][l.place]} 입혀 드렸어요.\n이번 주 동안 쓸 수 있고, 옷장에서 벗을 수도 있어요.`;$('rankWin').hidden=false;if($('nameStep').hidden&&!PZ.dress)homeClose(true);}   // the note takes the place of the guide card
$('rankWinOk').addEventListener('click',()=>{$('rankWin').hidden=true;newsCheck();});
function rwPrune(){if(rwUnlocked())return;let f;try{f=JSON.parse(store.get('or-fit'));}catch{return;}if(!f)return;
  const g=f.gear||[],keep=g.filter(x=>x!=='halo'||rwHave(RW_GEAR.halo)),p=rwPlace();let ch=keep.length!==g.length;
  if(f.fx==='gold'&&!rwHave(RW_FX.gold)){f.fx=null;ch=true;}if(p&&keep.includes('halo')&&f.haloT!==p){f.haloT=p;ch=true;}
  if(ch){f.gear=keep;store.set('or-fit',JSON.stringify(f));if(G&&G.plaza&&G.me)dressShow();}}
/* the goal of a 성과 step in its own number (100일), from the server's list; `n단계` until that has loaded */
function rwGoal(aw,st){const a=typeof CR!=='undefined'&&CR.view&&CR.view.awards&&CR.view.awards.find(x=>x.id===aw);
  return a?(a.names?a.names[st-1]:`${a.at[st-1].toLocaleString()}${a.unit}`):`${st}단계`;}
const rwWhy=n=>n.temp?'지난주 주간 랭킹 3위 안에 들면 일주일 동안 쓸 수 있어요':n.aw?`${RW_AW_N[n.aw]} ${rwGoal(n.aw,n.st)} 달성 시 열려요`:'아직 열 수 없어요';
function dressIs(f,k,v){const g=f.gear||[];
  if(k==='eyes')return v==='shades'?g.includes('shades'):v==='glasses'?f.glasses&&!g.includes('shades'):!f.glasses&&!g.includes('shades');
  if(k==='badgeK')return v==='goldBadge'?g.includes('goldBadge'):v==='on'?f.badge&&!g.includes('goldBadge'):!f.badge&&!g.includes('goldBadge');
  if(k==='faceK')return v==='eyebags'?g.includes('eyebags'):v==='freckles'?!!f.freckles:v==='stamp'?!!f.stamp:!f.freckles&&!f.stamp&&!g.includes('eyebags');
  if(k==='haloT')return(f.haloT||1)===v;if(k==='gear')return g.includes(v);if(k==='title')return f.title===v;return(f[k]??null)===v;}
/* one choice applied to a copy of a fit */
function dressApply(f0,k,v){const f={...f0,gear:[...(f0.gear||[])]},drop=x=>{f.gear=f.gear.filter(y=>y!==x);},put=x=>{if(!f.gear.includes(x))f.gear.push(x);};
  if(k==='eyes'){drop('shades');f.glasses=v==='glasses';if(v==='shades')put('shades');}
  else if(k==='badgeK'){drop('goldBadge');f.badge=v!=='off';if(v==='goldBadge')put('goldBadge');}
  else if(k==='tie')f.tie=v||null;
  else if(k==='faceK'){drop('eyebags');f.freckles=v==='freckles';f.stamp=v==='stamp';if(v==='eyebags')put('eyebags');}   // one of 없음 / 다크서클 / 주근깨
  else if(k==='gear'){if(f.gear.includes(v))drop(v);else put(v);if(v==='halo'&&rwPlace())f.haloT=rwPlace();}
  else if(k==='haloT')f.haloT=+v;
  else if(k==='title')f.title=f.title===v?null:v;
  else f[k]=v;
  return cleanFit(f);}
let fitSendT=null;
/* what I wear: the saved fit, plus the locked options being tried on */
const dressSaved=()=>{try{return cleanFit(JSON.parse(localStorage.getItem('or-fit')))||{...DEFAULT_FIT};}catch{return{...DEFAULT_FIT};}};
function dressShow(){G.me.fit=DR.tries.reduce((f,t)=>dressApply(f,t.k,t.v),dressSaved());dropMesh(G.me);}
let shotQ=[];   // thumbnails still to draw (a few a frame, so a tab opens at once)
function shotPump(){for(let i=0;i<3&&shotQ.length;i++){const[img,fit,view]=shotQ.shift();if(img.isConnected)img.src=charShot(fit,view);}if(shotQ.length)setTimeout(shotPump,16);}
function dressRender(){
  const f=G.me.fit,lockI='<i class="lk" aria-hidden="true">🔒</i>',jobs=[];
  $('dressCats').innerHTML=DRESS_CATS.map(([k,n])=>`<button data-c="${k}" class="${DR.cat===k?'on':''}">${n}</button>`).join('');
  const btn=(lab,k,v,names,view)=>{const n=rwNeed(k,v),lock=!rwHave(n),tr=DR.tries.some(t=>t.k===k&&t.v===v);
    const cls=`${dressIs(f,k,v)?'on':''}${lock?' lock':''}${tr?' trying':''}`,data=`data-k="${k}" data-v="${v??''}"`,tip=n?(lock?rwWhy(n):n.n||''):'';
    if(names&&view){const vw=typeof view==='string'?view:view[v];
      if(k==='fx'||k==='thr')return`<button ${data} class="th ${cls}" title="${tip}"><b class="thi">${vw}</b><span>${lock?lockI:''}${names[v]}</span></button>`;
      const tf=rwShotFit(k,v),url=shotKnown(tf,vw);   // always on the default outfit: the same few pictures, drawn once (what I wear shows on me beside the card)
      if(!url)jobs.push([tf,vw]);   // drawn ones go straight in, so re-rendering the rows on every tap doesn't blink
      return`<button ${data} class="th ${cls}" title="${tip}"><img alt="" ${url?`src="${url}"`:`data-j="${jobs.length-1}"`}><span>${lock?lockI:''}${names[v]}</span></button>`;}
    if(names)return`<button ${data} class="${cls}" title="${tip}">${lock?lockI:''}${names[v]}</button>`;
    return`<button ${data} class="sw${v?'':' none'} ${cls}" style="--c:${v===RAINBOW?'linear-gradient(#e8607a,#f2a25c,#f5df7a,#8fd08a,#7fbfe8,#8f8fe0,#c08fe0)':v||'#fff'}" aria-label="${lab} ${n?n.n:v||'없음'}" title="${tip}">${lock?lockI:''}</button>`;};
  let html;
  if(DR.cat==='title'){   // 칭호: one per 성과 step, one worn at a time; a gold chip in my name tag in the lobby
    const nm=esc(store.get('or-name')||G.me.name||'나'),plate=t=>`<span class="tplate">${t?`<i class="tstamp">${esc(t)}</i>`:''}<b>${nm}</b></span>`;
    html=`<div class="row tnow"><span>이름표</span><div class="opts">${plate(titleOf(f.title))}</div></div>`+
      `<div class="row big"><span>전체 칭호</span><div class="opts tchips">${Object.keys(RW_TITLES).flatMap(aw=>RW_TITLES[aw].flatMap((t,i)=>t?[{t,aw,st:i+1,v:`${aw}:${i+1}`,lock:!rwHave({oid:`title:${aw}:${i+1}`})}]:[])).sort((x,y)=>x.lock-y.lock)   // the ones I have first
        .map(({t,aw,st,v,lock})=>`<button data-k="title" data-v="${v}" class="tchip${f.title===v?' on':''}${lock?' lock':''}" title="${RW_AW_N[aw]} ${rwGoal(aw,st)}${lock?' 달성 시 열려요':''}">${lock?lockI:''}${t}</button>`).join('')}</div></div>`;}
  else{const hide=store.get('or-hideLock')==='1',has=(k,v)=>rwHave(rwNeed(k,v));   // in each row the ones I have come first; the locked ones can be hidden (a piece I'm trying on stays). 후광 only shows for those it's lent to
    html=DRESS_ROWS[DR.cat].filter(r=>!r[4]||r[4](f)).map(([lab,key,opts,names,,view])=>{const list=opts.filter(v=>!(key==='gear'&&v==='halo'&&!has(key,v))&&(!hide||has(key,v)||DR.tries.some(t=>t.k===key&&t.v===v))).sort((x,y)=>has(key,y)-has(key,x));
      return`<div class="row${view?' big':''}"><span>${lab}</span><div class="opts${view?' ths':''}">${list.map(v=>btn(lab,key,v,names,view)).join('')}</div></div>`;}).join('');
    html=`<label class="dhide"><input type="checkbox" id="dHideLock"${hide?' checked':''}> 잠긴 것 숨기기</label>`+html;}
  $('dressRows').innerHTML=(RW_LOCAL?`<button class="dunlock" data-unlock="1">🔓 전체 해금 ${rwUnlocked()?'ON':'OFF'} <small>로컬 전용</small></button>`:'')+html;
  shotQ=[...$('dressRows').querySelectorAll('img[data-j]')].map(img=>[img,...jobs[+img.dataset.j]]);if(shotQ.length)setTimeout(shotPump,0);
  const t=DR.tries[DR.tries.length-1],n=t&&rwNeed(t.k,t.v);$('dressNote').hidden=!n;
  if(n)$('dressNote').innerHTML=`<b>🔒 미리보기${DR.tries.length>1?` ${DR.tries.length}개`:''}</b> ${n.n||titleOf(t.v)} · ${rwWhy(n)}`;
}
function dressSet(k,v){
  /* locked: only tried on, several at once (tap again to take one off); one of a kind per slot except gear */
  const same=t=>t.k===k&&t.v===v,had=DR.tries.some(same);DR.tries=DR.tries.filter(t=>k==='gear'?!same(t):t.k!==k);
  if(!rwHave(rwNeed(k,v))){if(!had)DR.tries.push({k,v});dressShow();dressRender();return;}
  const f=dressApply(dressSaved(),k,v);
  try{localStorage.setItem('or-fit',JSON.stringify(f));}catch{}
  dressShow();dressRender();
  clearTimeout(fitSendT);fitSendT=setTimeout(()=>{if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-fit',fit:dressSaved()}));},600);profSave();
}
/* turning me round: the ◀ ▶ buttons or dragging across the view. The 헤어 / 얼굴 tabs bring the camera in on the head */
PZ.yaw=0;PZ.zoom=0;
const dressZoom=c=>c==='face'?1:c==='hair'?.85:0;   // 얼굴·헤어 tabs: in close on the head
$('dressCats').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;DR.cat=b.dataset.c;PZ.zoom=dressZoom(DR.cat);dressRender();$('paneWear').scrollTop=0;});
for(const[id,d]of[['dRotL',-1],['dRotR',1]])$(id).addEventListener('click',()=>{PZ.yaw+=d*Math.PI/4;});
{let dx=null;addEventListener('pointerdown',e=>{if(PZ.dress&&(e.target===cv||e.target===gl.domElement))dx=e.clientX;});
 addEventListener('pointermove',e=>{if(dx===null||!PZ.dress)return;PZ.yaw-=(e.clientX-dx)*.012;dx=e.clientX;});
 addEventListener('pointerup',()=>{dx=null;});addEventListener('pointercancel',()=>{dx=null;});}
function dressOpen(){if(!PZ.on)return;PZ.dress=true;$('home').classList.add('dressing');
  /* step into the open middle of the lobby so nothing stands between the camera and you */
  /* …and never on top of anyone else changing at the same time. Picking "the emptiest spot" races when two people press
     together (both see the other where they stood before), so each person starts from their own slot (plaza id) and only
     moves on to the next slot if someone is already standing there */
  {const spots=[];for(const y of[K(280),K(340)])for(const dx of[0,-120,120,-240,240])if(!blocked(0,FW/2+dx,y))spots.push({x:FW/2+dx,y});
   const others=G.actors.filter(a=>a!==G.me),n=spots.length||1,start=((PZ.pid??Math.floor(Math.random()*n))%n+n)%n;
   let best=spots[start]||{x:FW/2,y:K(300)};
   for(let i=0;i<n;i++){const p=spots[(start+i)%n];if(!others.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<60)){best=p;break;}}
   G.me.x=best.x;G.me.y=best.y;}
  idMark();G.me.vx=G.me.vy=0;cam={x:G.me.x,y:G.me.y};$('homeMenu').hidden=true;$('dress').hidden=false;DR.tries=[];PZ.yaw=0;PZ.zoom=dressZoom(DR.cat);dressRender();idTab('wear');careerLoad();}   // the 옷장 locks read the 성과 steps
function dressClose(){if(DR.tries.length){DR.tries=[];dressShow();}PZ.dress=false;$('home').classList.remove('dressing');$('homeMenu').hidden=false;$('dress').hidden=true;
  if(PZ.dressFromDock){PZ.dressFromDock=false;homeClose(true);}} // opened from the tabs: go back to the tabs
$('dressRows').addEventListener('change',e=>{if(e.target.id==='dHideLock'){store.set('or-hideLock',e.target.checked?'1':'0');dressRender();}});
$('dressRows').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.unlock){store.set('or-unlock',rwUnlocked()?'0':'1');DR.tries=[];dressShow();dressRender();return;}dressSet(b.dataset.k,b.dataset.v||null);});
$('hDress').addEventListener('click',dressOpen);
$('dressDone').addEventListener('click',dressClose);
$('dressReset').addEventListener('click',()=>{DR.tries=[];G.me.fit=cleanFit({...DEFAULT_FIT,title:dressSaved().title});   // 기본 옷으로 keeps the 칭호
  try{localStorage.setItem('or-fit',JSON.stringify(G.me.fit));}catch{}dropMesh(G.me);dressRender();
  if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-fit',fit:G.me.fit}));profSave();});
$('homeBtn').addEventListener('click',()=>{netClose();history.replaceState(null,'',location.pathname);plazaStart();});

plazaStart();
if(roomParam()){$('home').hidden=true;showLobby();}
