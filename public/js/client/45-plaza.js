/* ================= plaza: the shared lobby behind the start menu =================
   Everyone on the start screen walks around the 1F lobby together (server/src/plaza.js relays positions),
   plus a few local bots. No game rules run here: movement uses the same collision code, greetings are preset lines. */
const PZ={fits:new Map(),dress:false,on:false,ws:null,pid:null,others:new Map(),bots:[],count:0,sendT:0,sent:'',online:false};
const EMOTES=['안녕하세요.','좋은 아침입니다.','집 가고 싶다..','배고프다..'];
/* what the lobby bots mutter, one line every several seconds each */
const BOT_LINES=['오늘 점심 뭐 먹지…','회의 몇 시였더라','커피 한 잔 해야겠다','퇴근까지 몇 시간 남았지','월요일 싫다…','보고서 아직 못 썼는데','팀장님 어디 가셨지?','주말만 기다린다','야근 각이다…','오늘도 무사히…'];
const PZ_BASE=100000; // actor ids for real people, so every client builds the same outfit for the same person

function plazaWorld(){
  const me=mk('나',true,'플레이어','#2b6cb0',{x:FW/2,y:K(470)});me.id=PZ_BASE;me.alive=true;me.f=0;me.face=-Math.PI/2;me.fit=myFit();
  G={t:0,actors:[me],me,proj:[],items:[],traps:[],tasks:[],drops:[],wet:[],pops:[],dings:[],bursts:[],closed:0,nextClose:1e9,warn:false,final:false,finalT:0,over:false,winner:null,
     npcs:[],doors:FLOORS.map((_,f)=>({f,v:null})),events:[],notice:null,ceo:null,blackout:null,cake:null,fire:0,star:null,audit:null,lunch:null,airdrops:[],plaza:true};
  PZ.bots=[];
  for(let i=0;i<5;i++){const p=randFree(0,60),b=mk(NAMES[(i*4+3)%NAMES.length],false,'봇',SHIRTS[(i*5+2)%SHIRTS.length],p);b.f=0;b.alive=true;b.path=[];b.pause=1+i;b.talkT=rnd(3,10);
    G.actors.push(b);PZ.bots.push(b);}
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
    if(m.t==='pz-hi'){PZ.pid=m.you;PZ.online=true;const me=G&&G.plaza&&G.me;if(me){me.id=PZ_BASE+m.you;me.name=m.name;dropMesh(me);}}
    else if(m.t==='pz'){PZ.count=m.n;plazaPeople(m.p);}
    else if(m.t==='pz-fit'){const a=PZ.others.get(m.id);PZ.fits.set(m.id,m.fit);if(a){a.fit=cleanFit(m.fit);dropMesh(a);}}
    else if(m.t==='pz-say'){const a=m.id===PZ.pid?G.me:PZ.others.get(m.id);if(a&&EMOTES[m.i])say(a,EMOTES[m.i]);}};
  ws.onclose=()=>{if(PZ.ws!==ws)return;PZ.ws=null;PZ.online=false;if(PZ.on)setTimeout(()=>{if(PZ.on&&!PZ.ws)plazaConnect();},4000);};
}
const dropMesh=a=>{const m=actorM.get(a);if(m){scene.remove(m);actorM.delete(a);}};
function plazaPeople(list){
  if(!G||!G.plaza)return;const seen=new Set();
  for(const[pid,name,seed,x,y,face,mv]of list){if(pid===PZ.pid)continue;seen.add(pid);
    let a=PZ.others.get(pid);
    if(!a){a=mk(name,true,'플레이어',SHIRTS[seed%SHIRTS.length],{x,y});a.id=PZ_BASE+pid;a.f=0;a.alive=true;a.nx=x;a.ny=y;a.fit=cleanFit(PZ.fits.get(pid));PZ.others.set(pid,a);G.actors.push(a);}
    a.nx=x;a.ny=y;a.tf=face;a.name=name;}
  for(const[pid,a]of PZ.others)if(!seen.has(pid)){PZ.others.delete(pid);PZ.fits.delete(pid);G.actors.splice(G.actors.indexOf(a),1);}
}
function plazaStart(){
  if(PZ.on)return;PZ.on=true;running=false;
  plazaWorld();document.body.classList.add('plaza');
  for(const id of['lobby','result','cine','notice','callBox','branchBox','countdown','spec'])$(id).hidden=true;
  $('home').hidden=false;$('feed').textContent='';
  plazaConnect();
}
function plazaStop(){
  if(!PZ.on)return;PZ.on=false;dressClose();document.body.classList.remove('plaza');$('home').hidden=true;
  const ws=PZ.ws;PZ.ws=null;PZ.online=false;if(ws)try{ws.close();}catch{}
}
function plazaSay(i){if(!PZ.on||!G||!G.me)return;if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-say',i}));else say(G.me,EMOTES[i]);}
/* every frame while the plaza is up: my walking, bots wandering, other people gliding to their reported spot */
function plazaFrame(dt){
  if(!G||!G.plaza)return;G.t+=dt;const me=G.me;
  const inp=PZ.dress?NOINPUT:me.input||NOINPUT;let{vx,vy}=inp;if(PZ.dress)me.face=Math.PI/2;const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}
  me.sprint=inp.run&&m>.15;if(m>.15)me.face=Math.atan2(vy,vx);drive(me,m>.15?vx:0,m>.15?vy:0,dt);
  for(const b of PZ.bots){
    b.talkT-=dt;if(b.talkT<=0){b.talkT=rnd(8,16);say(b,pick(BOT_LINES));}
    if(b.pause>0){b.pause-=dt;continue;}
    if(!b.path.length){const p=randFree(0,60);b.path=findPath(0,b.x,b.y,p.x,p.y);b.pause=rnd(1.5,4);continue;}
    const q=b.path[0],dx=q.x-b.x,dy=q.y-b.y,d=Math.hypot(dx,dy);if(d<6){b.path.shift();continue;}
    b.face=Math.atan2(dy,dx);drive(b,dx/d*.75,dy/d*.75,dt);}
  const k=Math.min(1,dt*10);
  for(const a of PZ.others.values()){a.x+=(a.nx-a.x)*k;a.y+=(a.ny-a.y)*k;if(a.tf!=null)a.face=a.tf;}
  for(const p of G.pops)p.t+=dt;G.pops=G.pops.filter(p=>p.t<(p.say?2.4:1.1));
  const now=performance.now();
  if(PZ.ws&&PZ.ws.readyState===1&&now-PZ.sendT>160){const s=`${Math.round(me.x)},${Math.round(me.y)},${me.face.toFixed(2)}`;
    if(s!==PZ.sent||now-PZ.sendT>2000){PZ.sent=s;PZ.sendT=now;PZ.ws.send(JSON.stringify({t:'pz-pos',x:me.x,y:me.y,face:me.face,mv:m>.15}));}}
  const n=PZ.online?Math.max(1,PZ.count):0;
  const t=PZ.online?`지금 로비에 ${n}명 접속 중`:'혼자 둘러보는 중 (로비 서버 연결 안 됨)';if($('pzCount').textContent!==t)$('pzCount').textContent=t;
}

/* ---------- menu ---------- */
/* PC greets with keys 1-4; touch screens get a small speech button that opens the four lines */
$('emotePop').innerHTML=EMOTES.map((t,i)=>`<button data-i="${i}">${t}</button>`).join('');
$('emotePop').addEventListener('click',e=>{const b=e.target.closest('button');if(b){plazaSay(+b.dataset.i);$('emotePop').hidden=true;}});
$('emoteBtn').addEventListener('click',()=>{$('emotePop').hidden=!$('emotePop').hidden;});
addEventListener('keydown',e=>{if(!PZ.on||$('home').hidden||(e.target.closest&&e.target.closest('input')))return;
  const n=/^(?:Digit|Numpad)([1-4])$/.exec(e.code);if(n)plazaSay(+n[1]-1);else if(e.code==='KeyE')plazaSay(0);});
$('hSolo').addEventListener('click',start);
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
  G.me.x=FW/2;G.me.y=K(300);G.me.vx=G.me.vy=0;cam={x:G.me.x,y:G.me.y};$('homeMenu').hidden=true;$('dress').hidden=false;dressRender();}
function dressClose(){PZ.dress=false;$('home').classList.remove('dressing');$('homeMenu').hidden=false;$('dress').hidden=true;}
$('dressRows').addEventListener('click',e=>{const b=e.target.closest('button');if(b)dressSet(b.dataset.k,b.dataset.v||null);});
$('hDress').addEventListener('click',dressOpen);
$('dressDone').addEventListener('click',dressClose);
$('dressReset').addEventListener('click',()=>{G.me.fit={...DEFAULT_FIT};try{localStorage.setItem('or-fit',JSON.stringify(G.me.fit));}catch{}dropMesh(G.me);dressRender();
  if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-fit',fit:G.me.fit}));});
$('homeBtn').addEventListener('click',()=>{netClose();history.replaceState(null,'',location.pathname);plazaStart();});

plazaStart();
if(roomParam()){$('home').hidden=true;showLobby();}
