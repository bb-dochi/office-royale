/* ================= screens ================= */
const fmt=s=>`${Math.floor(s/60)}분 ${String(Math.floor(s%60)).padStart(2,'0')}초`;
function showResult(win){
  const me=G.me;
  $('rStamp').innerHTML=win?'승진':'권고<br>사직';
  $('rTitle').textContent=win?'CEO실 입성':'권고사직 통보';
  $('rPlace').textContent=`${win?1:me.place}위 / ${TOTAL}명`;
  $('rTime').textContent=fmt(G.t);$('rRank').textContent=rankName(me);$('rFloor').textContent=win?'7층 CEO층':FLOORS[me.maxF].name;$('rTasks').textContent=`${me.tasksDone}건`;
  let note='';
  if(win)note='최후의 1인입니다. 오늘부터 전 부서 업무를 혼자 맡게 됩니다.';
  else if(me.killer)note=`${me.killer.name}님에게 최종 결재되었습니다.`;
  else if(me.cause==='zone')note='폐쇄된 층에 남아 있다가 정리되었습니다.';
  else if(me.cause==='boss')note='윗분들 앞에서 처신을 잘못했습니다.';
  else if(me.cause==='overtime')note='야근을 버티지 못했습니다.';
  else if(me.cause==='rest')note='화장실에 너무 오래 있었습니다.';
  else if(me.cause==='sales')note='영업사원에게 문을 열어준 게 마지막이었습니다.';
  else note='고과 관리에 실패했습니다.';
  if(!win&&G.over&&G.winner)note+=` 최종 승자는 ${G.winner.name}님입니다.`;
  $('rNote').textContent=note;
  $('watchBtn').hidden=win||G.over;
  $('againBtn').textContent=NETC.room?'대기실로':'다시 출근';
  $('result').hidden=false;$('callBox').hidden=true;
}
if(!isTouch)document.body.classList.add('pc');
let lastKb='';
function keybar(){
  if(isTouch||!G||!G.me)return;const me=G.me,kb=$('keybar');kb.hidden=!running||!me.alive;if(kb.hidden)return;
  const act=myAction(),B=me.branch&&BRANCH[me.branch];
  const ch=[[ 'Space',me.ammo>0?`스테이플 ${me.ammo}`:`던지기 -${Math.round(5*dmgMul(me))}`,me.ammo>0?'atk':'',Math.max(0,me.cd)/me.lastCd],
    ['E',act?act.label:'상호작용',act?(act.cls||''):'off'],
    ...(me.items.length?me.items.map((k,i)=>['F',ITEMS[k].n,'',0,ITEMS[k].c]):[['F','공격템 없음','off']]),
    ...(B&&B.cd?[['Q',me.skillCd>0?`${B.sk} ${Math.ceil(me.skillCd)}초`:B.sk,me.skillCd>0?'off':'go']]:[]),
    ['Shift',me.sprint?'달리는 중':'달리기','']];
  const h=ch.map(([k,t,c,cd,col])=>`<div class="kc ${c||''}"${col?` style="border-color:${col};box-shadow:0 0 12px ${col}"`:''}><kbd>${k}</kbd><span>${t}</span>${cd>0?`<i class="cd" style="width:${cd*100}%"></i>`:''}</div>`).join('');
  if(h!==lastKb){lastKb=h;kb.innerHTML=h;}
}
function startScreens(){$('countdown').hidden=true;lastCd='';$('branchBox').hidden=true;branchT=0;$('cineTower').hidden=false;running=true;lastItem='x';lastPills='x';lastCall=null;
  $('intro').hidden=true;$('lobby').hidden=true;$('result').hidden=true;$('cine').hidden=true;$('notice').hidden=true;$('callBox').hidden=true;$('feed').textContent='';cineT=0;if(isTouch)$('hint').hidden=false;}
function start(){netClose();newGame();startScreens();}
$('startBtn').addEventListener('click',start);
$('againBtn').addEventListener('click',()=>{if(NETC.room)showLobby();else start();});

/* ---------- online lobby ---------- */
const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
const roomParam=()=>(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
function lobbyNote(t,err){const n=$('lobbyNote');n.textContent=t||'';n.classList.toggle('err',!!err);}
function showLobby(){
  running=false;$('intro').hidden=true;$('result').hidden=true;$('lobby').hidden=false;
  const r=NETC.room;$('lobbyJoin').hidden=!!r;$('lobbyRoom').hidden=!r;$('backBtn').hidden=!!r;
  if(!r){$('nameIn').value=$('nameIn').value||store.get('or-name')||'';if(roomParam())$('codeIn').value=roomParam();lobbyNote('');return;}
  $('roomCode').textContent=r.code;
  $('players').innerHTML=r.players.map(p=>`<li class="${p.key===r.you?'me':''}"><span>${esc(p.name)}${p.key===r.you?' (나)':''}</span><small>${p.host?'방장':''}${p.inGame?' · 게임 중':''}</small></li>`).join('')+
    `<li><span>봇</span><small>${TOTAL-r.players.length}명이 자리를 채움</small></li>`;
  const host=r.players[0]&&r.players[0].key===r.you;
  $('goBtn').hidden=!host;$('goBtn').disabled=r.state!=='lobby';
  lobbyNote(r.state==='playing'?'게임이 진행 중이에요. 끝나면 다음 판에 같이 들어가요.':host?'다 모이면 시작하기를 누르세요.':'방장이 시작하길 기다리는 중…');
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function joinRoom(code){
  const name=$('nameIn').value.trim()||'신입';store.set('or-name',name);
  lobbyNote('연결 중…');
  netConnect(code,name,r=>{
    if(r.state==='lobby'&&NETC.on){NETC.on=false;running=false;} // match over: keep the last frame, result sheet stays up
    history.replaceState(null,'',`${location.pathname}?room=${r.code}${new URLSearchParams(location.search).get('server')?'&server='+new URLSearchParams(location.search).get('server'):''}`);
    if(!running&&$('result').hidden)showLobby();else if(!$('lobby').hidden)showLobby();
  },err=>{NETC.room=null;running=false;showLobby();lobbyNote(err,true);});
}
const newCode=()=>Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
$('multiBtn').addEventListener('click',showLobby);
$('createBtn').addEventListener('click',()=>joinRoom(newCode()));
$('joinBtn').addEventListener('click',()=>{const c=$('codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length<4){lobbyNote('방 코드를 확인해 주세요',true);return;}joinRoom(c);});
$('codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinBtn').click();});
$('goBtn').addEventListener('click',()=>netSend({t:'start'}));
$('leaveBtn').addEventListener('click',()=>{netClose();history.replaceState(null,'',location.pathname);showLobby();});
$('backBtn').addEventListener('click',()=>{$('lobby').hidden=true;$('intro').hidden=false;});
$('copyBtn').addEventListener('click',async()=>{const url=location.href;try{await navigator.clipboard.writeText(url);lobbyNote('초대 링크를 복사했어요');}catch{lobbyNote(url);}});
if(roomParam()){$('intro').hidden=true;showLobby();}
$('watchBtn').addEventListener('click',()=>{$('result').hidden=true;});

let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  shake=Math.max(0,shake-dt);
  if(running&&G){readInput();if(NETC.on){netSendInput();netFrame(dt);}else if(!G.net)step(dt);}
  render(dt);hud(dt);keybar();countdown();
  requestAnimationFrame(frame);
}
function feedDOM(msg,hot){
  const el=document.createElement('div');el.className='fi'+(hot?' hot':'');el.textContent=msg;
  const f=$('feed');f.prepend(el);while(f.children.length>3)f.lastChild.remove();
  setTimeout(()=>el.classList.add('out'),3400);setTimeout(()=>el.remove(),4000);
}
/* hooks the rules call; target a = the actor it is about (ignored unless it is me) */
const forMe=a=>!a||!G||!G.me||a===G.me;
Object.assign(UI,{
  feed:(msg,hot,to)=>{if(!forMe(to))return;feedDOM(typeof msg==='function'?msg(G.me):msg,hot);},
  notice:t=>{$('noticeText').textContent=t;$('notice').hidden=false;},
  noticeEnd:()=>{$('notice').hidden=true;},
  branch:a=>{if(forMe(a)&&$('branchBox').hidden)openBranch();},
  shake:(v,a)=>{if(forMe(a)&&!reduceMotion)shake=v;},
  vibrate:a=>{if(forMe(a)&&navigator.vibrate)try{navigator.vibrate(40);}catch(e){}},
  cine:(t,sub,dur=1.6)=>{$('cineTower').hidden=true;$('cineS').textContent=sub||'';$('cineT').textContent=t;$('cine').hidden=false;cineT=dur;},
  closure:(...a)=>closureCine(...a),
  result:(win,ms,a)=>{if(forMe(a))setTimeout(()=>showResult(win),ms);},
  reset:()=>{$('feed').textContent='';},
  snapCam:a=>{if(forMe(a))cam={x:a.x,y:a.y};},
  itemKey:isTouch?'아이템 칸 탭':'F 또는 우클릭',
});
newGame();requestAnimationFrame(frame);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{builtF=-1;});
