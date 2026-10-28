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
  PZ.others.clear();cam={x:me.x,y:me.y};
}
function pzURL(){
  const q=new URLSearchParams(location.search).get('server'),host=q||location.host;
  const secure=q?!/^(localhost|127\.|192\.168\.|10\.)/.test(q):location.protocol==='https:';
  return `${secure?'wss':'ws'}://${host}/plaza`;
}
function plazaConnect(){
  let ws;try{ws=new WebSocket(pzURL());}catch{return;}
  PZ.ws=ws;
  ws.onopen=()=>ws.send(JSON.stringify({t:'hello',name:store.get('or-name')||'신입',fit:myFit()}));
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
    if(m.t==='pz-hi'){PZ.pid=m.you;PZ.online=true;PZ.roomSent='';pzRoomSend();const me=G&&G.plaza&&G.me;if(me){me.id=PZ_BASE+m.you;me.name=m.name;dropMesh(me);}}
    else if(m.t==='pz'){PZ.count=m.n;plazaPeople(m.p);}
    else if(m.t==='pz-fit'){const a=PZ.others.get(m.id);PZ.fits.set(m.id,m.fit);if(a){a.fit=cleanFit(m.fit);dropMesh(a);}}
    else if(m.t==='pz-say'){const a=m.id===PZ.pid?G.me:PZ.others.get(m.id);if(a&&EMOTES[m.i])say(a,EMOTES[m.i]);}};
  ws.onclose=()=>{if(PZ.ws!==ws)return;PZ.ws=null;PZ.online=false;if(PZ.on)setTimeout(()=>{if(PZ.on&&!PZ.ws)plazaConnect();},4000);};
}
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
  plazaConnect();
}
function plazaStop(){
  if(!PZ.on)return;PZ.on=false;if(G&&G.plaza&&G.me){G.me.wc=null;if(G.me.sit)pzStand();}
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
  if(me.wc){if(m>.35)me.wc=null;else wcStep(me,dt);}
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
  const inp=PZ.dress?NOINPUT:me.input||NOINPUT;let{vx,vy}=inp;if(PZ.dress)me.face=Math.PI/2;const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}
  if(m>.15&&!G.me.sit)me.face=Math.atan2(vy,vx);const free=pzLocal(dt,m);me.sprint=free&&inp.run&&m>.15;if(free)drive(me,m>.15?vx:0,m>.15?vy:0,dt);
  for(const b of PZ.bots){
    b.talkT-=dt;if(b.talkT<=0){b.talkT=rnd(8,16);say(b,pick(BOT_LINES));}
    if(b.pause>0){b.pause-=dt;continue;}
    if(!b.path.length){const p=randFree(0,60);b.path=findPath(0,b.x,b.y,p.x,p.y);b.pause=rnd(1.5,4);continue;}
    const q=b.path[0],dx=q.x-b.x,dy=q.y-b.y,d=Math.hypot(dx,dy);if(d<6){b.path.shift();continue;}
    b.face=Math.atan2(dy,dx);drive(b,dx/d*.75,dy/d*.75,dt);}
  {const g=PZ.guide;if(g){if(g.lookT>0&&(g.lookT-=dt)<=0)g.face=Math.PI/2;g.talkT-=dt;if(g.talkT<=0){g.talkT=rnd(14,24);say(g,pick(GUIDE_IDLE));}}}
  const k=Math.min(1,dt*10);
  for(const a of PZ.others.values()){a.x+=(a.nx-a.x)*k;a.y+=(a.ny-a.y)*k;if(a.tf!=null)a.face=a.tf;}
  for(const p of G.pops)p.t+=dt;G.pops=G.pops.filter(p=>p.t<(p.life||(p.say?2.4:1.1)));
  const now=performance.now();
  if(PZ.ws&&PZ.ws.readyState===1&&now-PZ.sendT>160){const s=`${Math.round(me.x)},${Math.round(me.y)},${me.face.toFixed(2)}`;
    if(s!==PZ.sent||now-PZ.sendT>2000){PZ.sent=s;PZ.sendT=now;PZ.ws.send(JSON.stringify({t:'pz-pos',x:me.x,y:me.y,face:me.face,mv:m>.15}));}}
  pzRooms(dt);
  const n=PZ.online?Math.max(1,PZ.count):0;
  const t=PZ.online?`지금 로비에 ${n}명 접속 중`:'혼자 둘러보는 중 (로비 서버 연결 안 됨)';if($('pzCount').textContent!==t)$('pzCount').textContent=t;
  const dc=PZ.online?`로비 ${n}명`:'혼자 둘러보는 중';if($('dockCount').textContent!==dc)$('dockCount').textContent=dc;
}

/* ---------- menu ---------- */
/* PC greets with keys 1-4; touch screens get a small speech button that opens the four lines */
const plazaSayRandom=()=>plazaSay(Math.floor(Math.random()*EMOTES.length));
/* phones: the same five lines plus one that picks any of the ten */
$('emotePop').innerHTML=EMOTES.slice(0,5).map((t,i)=>`<button data-i="${i}">${t}</button>`).join('')+'<button data-i="rnd" class="rnd">아무 말이나</button>';
$('emotePop').addEventListener('click',e=>{const b=e.target.closest('button');if(b){if(b.dataset.i==='rnd')plazaSayRandom();else plazaSay(+b.dataset.i);$('emotePop').hidden=true;}});
$('emoteBtn').addEventListener('click',()=>{if($('emotePop').hidden&&pzUse())return;$('emotePop').hidden=!$('emotePop').hidden;}); // next to something: use it instead
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
  store.set('or-name',n);$('nameIn').value=n;$('myName').textContent=n;nameStep(false);if(first)tutAsk(true,n);
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
const DRESS_ROWS=[
  ['헤어','hair',FIT.hair,{short:'짧은 머리',side:'옆가르마',long:'긴 머리',bun:'올림 머리',bald:'대머리'}],
  ['헤어 색','hairC',FIT.hairC],['피부','skin',FIT.skin],
  ['상의','top',FIT.top,{shirt:'셔츠',jacket:'정장',cardigan:'가디건',vest:'조끼'}],['상의 색','topC',FIT.topC],
  ['셔츠','shirtC',FIT.shirtC,null,f=>f.top!=='shirt'],['넥타이','tie',FIT.tie],
  ['하의','bottom',FIT.bottom,{pants:'바지',skirt:'치마'}],['하의 색','bottomC',FIT.bottomC],
  ['소품','acc',['badge','glasses'],{badge:'사원증',glasses:'안경'}],
];
let fitSendT=null;
function dressRender(){
  const f=G.me.fit;
  $('dressRows').innerHTML=DRESS_ROWS.filter(r=>!r[4]||r[4](f)).map(([lab,key,opts,names])=>`<div class="row"><span>${lab}</span><div class="opts">${opts.map(v=>{
    const on=key==='acc'?f[v]:f[key]===v;
    if(names)return`<button data-k="${key}" data-v="${v}" class="${on?'on':''}">${names[v]}</button>`;
    return`<button data-k="${key}" data-v="${v??''}" class="sw${v?'':' none'}${on?' on':''}" style="--c:${v||'#fff'}" aria-label="${lab} ${v||'없음'}"></button>`;}).join('')}</div></div>`).join('');
}
function dressSet(k,v){
  const f={...G.me.fit};
  if(k==='acc')f[v]=!f[v];else f[k]=k==='tie'&&!v?null:v;
  G.me.fit=cleanFit(f);try{localStorage.setItem('or-fit',JSON.stringify(G.me.fit));}catch{}
  dropMesh(G.me);dressRender();
  clearTimeout(fitSendT);fitSendT=setTimeout(()=>{if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-fit',fit:G.me.fit}));},600);
}
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
  G.me.vx=G.me.vy=0;cam={x:G.me.x,y:G.me.y};$('homeMenu').hidden=true;$('dress').hidden=false;dressRender();}
function dressClose(){PZ.dress=false;$('home').classList.remove('dressing');$('homeMenu').hidden=false;$('dress').hidden=true;
  if(PZ.dressFromDock){PZ.dressFromDock=false;homeClose(true);}} // opened from the tabs: go back to the tabs
$('dressRows').addEventListener('click',e=>{const b=e.target.closest('button');if(b)dressSet(b.dataset.k,b.dataset.v||null);});
$('hDress').addEventListener('click',dressOpen);
$('dressDone').addEventListener('click',dressClose);
$('dressReset').addEventListener('click',()=>{G.me.fit={...DEFAULT_FIT};try{localStorage.setItem('or-fit',JSON.stringify(G.me.fit));}catch{}dropMesh(G.me);dressRender();
  if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-fit',fit:G.me.fit}));});
$('homeBtn').addEventListener('click',()=>{netClose();history.replaceState(null,'',location.pathname);plazaStart();});

plazaStart();
if(roomParam()){$('home').hidden=true;showLobby();}
