/* ================= screens ================= */
const fmt=s=>`${Math.floor(s/60)}분 ${String(Math.floor(s%60)).padStart(2,'0')}초`;
/* what HR writes when you are the last one standing; one at random */
const CEO_LINES=[
  '최후의 1인입니다. 오늘부터 전 부서 업무를 혼자 맡게 됩니다.',
  '대표이사 취임을 축하합니다. 첫 업무는 신입 공채 공고 올리기입니다.',
  'CEO실 입성! 단, 법인카드 한도는 그대로입니다.',
  '모두 퇴사했습니다. 내일 아침 회의엔 혼자 참석하시면 됩니다.',
  '승진을 축하드립니다. 이제 야근 수당은 없습니다.',
  '살아남았습니다. 그런데 이제 커피는 누가 타죠?',
  '전 직원의 결재 서류가 지금 대표님 책상으로 향하고 있습니다.',
  '축하합니다. 회의실 예약은 이제 대표님 마음대로입니다.',
  '최종 결재권자가 되셨습니다. 반려는 신중하게 해 주세요.',
  '오늘부터 회사 단톡방 공지는 대표님 몫입니다.',
];
function showResult(win){
  const me=G.me;
  $('rStamp').innerHTML=win?'승진':'권고<br>사직';
  $('rTitle').textContent=win?'CEO실 입성':'권고사직 통보';
  $('rPlace').textContent=`${win?1:me.place}위 / ${TOTAL}명`;
  $('rTime').textContent=fmt(G.t);$('rRank').textContent=win?'CEO':rankName(me);$('rPerf').textContent=`업무 ${me.tasksDone}건, ${me.kills||0}명 해고`;
  let note='';
  if(win)note=pick(CEO_LINES);
  else if(me.killer)note=`${me.killer.name}님에게 최종 결재되었습니다.`;
  else if(me.cause==='zone')note='폐쇄된 층에 남아 있다가 정리되었습니다.';
  else if(me.cause==='boss')note='윗분들 앞에서 처신을 잘못했습니다.';
  else if(me.cause==='overtime')note='야근을 버티지 못했습니다.';
  else if(me.cause==='rest')note='화장실에 너무 오래 있었습니다.';
  else if(me.cause==='sales')note='영업사원에게 문을 열어준 게 마지막이었습니다.';
  else note='고과 관리에 실패했습니다.';
  if(!win&&G.over&&G.winner)note+=` 최종 승자는 ${G.winner.name}님입니다.`;
  $('rNote').textContent=note;
  Object.assign(RES,{win,title:$('rTitle').textContent,name:me.name==='나'?store.get('or-name')||'신입':me.name,place:$('rPlace').textContent,time:$('rTime').textContent,
    rank:$('rRank').textContent,perf:$('rPerf').textContent,note});
  $('rScoreRow').hidden=true;if(!NETC.room&&!G.net&&!G.tutorial)rankSubmit(win); // solo: weekly ranking
  $('watchBtn').hidden=win||G.over;
  $('againBtn').textContent=NETC.room?'대기실로':'다시 출근';
  $('result').hidden=false;$('callBox').hidden=true;
}
if(!isTouch)document.body.classList.add('pc');
function setInputMode(touch){
  if(touch===isTouch)return;isTouch=touch;document.body.classList.toggle('pc',!touch);
  if(typeof TUT!=='undefined'){TUT_STEPS=tutSteps();if(TUT.on)tutShow();}
}
addEventListener('keydown',e=>{if(/^(Key[WASDEQF]|Arrow|Space|Shift|Digit)/.test(e.code))setInputMode(false);},true);
addEventListener('touchstart',()=>setInputMode(true),{passive:true,capture:true});
let lastKb='';
function keybar(){
  if(isTouch){if(!$('keybar').hidden)$('keybar').hidden=true;return;}
  if(!G||!G.me)return;const me=G.me,kb=$('keybar');kb.hidden=!running||!me.alive;if(kb.hidden)return;
  const act=myAction(),B=me.branch&&BRANCH[me.branch];
  const held=me.items[0]&&ITEMS[me.items[0]];
  /* the item itself is in the slot next to this, so the attack key just says attack / use */
  const ch=[['E',act?act.label:'상호작용',(act?(act.cls||''):'off')+' wide'],
    [ 'Space',me.ammo>0||held?'아이템 사용':'던지기',me.ammo>0||held?'atk':'',Math.max(0,me.cd)/me.lastCd,held&&held.c],
    ...(B&&B.cd&&rankAt(me,'팀장')?[['Q',me.skillCd>0?`${B.sk} ${Math.ceil(me.skillCd)}초`:B.sk,me.skillCd>0?'off':'go']]:[]),
    ['Shift',me.sprint?'달리는 중':'달리기','']];
  {const dn=me.f-1;if(me.f>=0&&me.f!==ROOF&&padOf(me)&&!me.sit&&dn>=0&&isOpen(dn)&&!G.lunch)ch.splice(1,0,['Shift+E',`▼ ${FLOORS[dn].short}로`,'wide']);}
  const h=ch.map(([k,t,c,cd,col])=>`<div class="kc ${c||''}"${col?` style="border-color:${col};box-shadow:0 0 12px ${col}"`:''}><kbd>${k}</kbd><span>${t}</span>${cd>0?`<i class="cd" style="width:${cd*100}%"></i>`:''}</div>`).join('');
  if(h!==lastKb){lastKb=h;kb.innerHTML=h;}
}
function startScreens(){paused=false;$('pause').hidden=true;plazaStop();if(typeof TUT!=='undefined')tutStop();$('home').hidden=true;$('countdown').hidden=true;lastCd='';$('branchBox').hidden=true;branchT=0;$('cineTower').hidden=false;running=true;lastItem='x';lastPills='x';lastCall=null;
  $('lobby').hidden=true;$('result').hidden=true;$('cine').hidden=true;$('notice').hidden=true;$('callBox').hidden=true;$('feed').textContent='';cineT=0;if(isTouch)$('hint').hidden=false;}
/* ---------- solo pause (Esc or the ❚❚ on the ID card): the rules stop, nothing else changes ---------- */
let paused=false;
function pauseOpen(on){paused=on;$('pause').hidden=!on;if(on){keys.clear();throwHeld=false;}}
const canPause=()=>running&&G&&G.me&&G.me.alive&&!NETC.on&&!G.net&&!TUT.on&&$('result').hidden;
addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(paused){e.preventDefault();pauseOpen(false);}else if(canPause()){e.preventDefault();pauseOpen(true);}});
$('pauseBtn').addEventListener('click',e=>{e.stopPropagation();if(canPause())pauseOpen(true);});
$('pResume').addEventListener('click',()=>pauseOpen(false));
$('pRestart').addEventListener('click',()=>{pauseOpen(false);start();});
$('pHome').addEventListener('click',()=>{pauseOpen(false);running=false;plazaStart();});
/* solo: d is the difficulty picked on the 난이도 sheet; restarts (다시 출근, pause) reuse the last one */
function start(d){netClose();if(DIFF[d])store.set('or-diff',d);$('diffSheet').hidden=true;
  newGame({humans:[{key:'me',name:'나',fit:myFit()}],diff:store.get('or-diff')||'normal'});startScreens();}
const DIFF_TXT={easy:'봇이 굼뜨고 서류가 잘 빗나가요. 가만히 있어도 고과가 안 깎여요.',normal:'기본 난이도. 할 일을 안 하면 고과가 깎여요.',hard:'봇이 빠르고 정확하게 던져요. 놀면 고과가 깎여요.'};
function diffOpen(){
  const last=store.get('or-diff')||'normal';
  $('diffOpts').innerHTML=Object.entries(DIFF).map(([k,v],i)=>`<button data-d="${k}" class="${k===last?'last':''}">
    <em aria-hidden="true">${'●'.repeat(i+1)}${'○'.repeat(2-i)}</em><b>${v.n}${k===RANKED?'<i class="rk">🏆 주간 랭킹 기록</i>':''}${k===last?'<i>지난번</i>':''}</b><span>${DIFF_TXT[k]}</span></button>`).join('');
  $('diffSheet').hidden=false;
}
$('diffOpts').addEventListener('click',e=>{const b=e.target.closest('button');if(b)start(b.dataset.d);});
$('diffX').addEventListener('click',()=>{$('diffSheet').hidden=true;});
addEventListener('keydown',e=>{if($('diffSheet').hidden)return;
  if(e.key==='Escape'){e.stopImmediatePropagation();$('diffSheet').hidden=true;return;}
  const n=/^(?:Digit|Numpad)([1-3])$/.exec(e.code);if(n){e.stopImmediatePropagation();start(Object.keys(DIFF)[+n[1]-1]);}},true);
$('againBtn').addEventListener('click',()=>{if(NETC.room)showLobby();else start();});

/* ---------- online lobby ---------- */
const store={get:k=>{try{return localStorage.getItem(k);}catch{return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch{}}};
const roomParam=()=>(new URLSearchParams(location.search).get('room')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
function lobbyNote(t,err){const n=$('lobbyNote');n.textContent=t||'';n.classList.toggle('err',!!err);}
/* no room yet: a sheet to create or join (an invite link narrows it to one join button).
   In a room: the sheet docks at the bottom and the shared lobby keeps running behind it, showing the room to passers-by */
function showLobby(){
  running=false;$('result').hidden=true;$('home').hidden=true;
  const r=NETC.room;if(r&&!PZ.on)plazaStart(true);
  $('lobby').hidden=false;$('lobby').classList.toggle('dock',!!r);
  $('lobbyJoin').hidden=!!r;$('lobbyRoom').hidden=!r;$('backBtn').hidden=!!r;pzRoomSend();
  if(!r){const inv=roomParam();$('lobby').classList.toggle('invited',!!inv);$('invCode').textContent=inv;
    lobbyNameShow(!store.get('or-name'));if(inv)$('codeIn').value=inv;lobbyNote('');return;}
  $('copyBtn').textContent=isTouch&&navigator.share?'초대 링크 보내기':'초대 링크 복사';
  $('roomCode').textContent=r.code;
  /* every seat of the room, numbered like a roster; empty ones get a bot */
  $('players').innerHTML=Array.from({length:r.max||8},(_,i)=>{const p=r.players[i];
    return p?`<li class="${p.key===r.you?'me':''}"><span>${esc(p.name)}${p.key===r.you?' (나)':''}</span><small>${p.host?'방장':''}${p.inGame?' · 게임 중':''}</small></li>`
      :`<li class="empty"><span>빈자리</span><small>봇</small></li>`;}).join('');
  const host=r.players[0]&&r.players[0].key===r.you;
  $('goBtn').hidden=!host;$('goBtn').disabled=r.state!=='lobby';
  lobbyNote(r.state==='playing'?'게임이 진행 중이에요. 끝나면 다음 판에 같이 들어가요.':host?'다 모이면 출근 시작을 누르세요.':'방장이 시작하길 기다리는 중…');
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function joinRoom(code){
  const name=store.get('or-name')||$('nameIn').value.trim()||'신입';store.set('or-name',name);
  lobbyNote('연결 중…');
  netConnect(code,name,r=>{
    if(r.state==='lobby'&&NETC.on){NETC.on=false;running=false;} // match over: keep the last frame, result sheet stays up
    history.replaceState(null,'',`${location.pathname}?room=${r.code}${new URLSearchParams(location.search).get('server')?'&server='+new URLSearchParams(location.search).get('server'):''}`);
    if(!running&&$('result').hidden)showLobby();else if(!$('lobby').hidden)showLobby();
  },err=>{NETC.room=null;running=false;showLobby();lobbyNote(err,true);});
}
const newCode=()=>Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
$('createBtn').addEventListener('click',()=>joinRoom(newCode()));
$('joinBtn').addEventListener('click',()=>{const c=$('codeIn').value.toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length<4){lobbyNote('방 코드를 확인해 주세요',true);return;}joinRoom(c);});
$('codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinBtn').click();});
$('goBtn').addEventListener('click',()=>netSend({t:'start'}));
$('leaveBtn').addEventListener('click',()=>{netClose();history.replaceState(null,'',location.pathname);$('lobby').hidden=true;$('lobby').classList.remove('dock');pzRoomSend();if(PZ.on)$('home').hidden=false;else plazaStart();});
$('invBtn').addEventListener('click',()=>joinRoom(roomParam()));
$('invOther').addEventListener('click',()=>{history.replaceState(null,'',location.pathname);showLobby();});
/* the applicant line: shows the saved name, the pencil swaps in a text field (Enter or leaving it saves) */
function lobbyNameShow(edit){const n=store.get('or-name')||'';$('lobbyName').textContent=n||'(미정)';$('nameIn').value=n;
  $('nameIn').hidden=!edit;$('lobbyName').hidden=edit;$('lobbyNameEdit').hidden=edit;if(edit)setTimeout(()=>$('nameIn').focus(),30);}
function lobbyNameSave(){
  const n=$('nameIn').value.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,10);
  if(n&&n!==store.get('or-name')){store.set('or-name',n);$('myName').textContent=n;if(G&&G.plaza&&G.me)G.me.name=n;
    if(PZ.ws&&PZ.ws.readyState===1)PZ.ws.send(JSON.stringify({t:'pz-name',name:n}));if(NETC.room)netSend({t:'name',name:n});}
  lobbyNameShow(!store.get('or-name'));
}
$('lobbyNameEdit').addEventListener('click',()=>lobbyNameShow(true));
$('nameIn').addEventListener('keydown',e=>{if(e.key!=='Enter')return;lobbyNameSave();if($('lobby').classList.contains('invited')&&store.get('or-name'))$('invBtn').click();});
$('nameIn').addEventListener('blur',()=>{if(!$('nameIn').hidden&&$('nameIn').value.trim())lobbyNameSave();});
$('backBtn').addEventListener('click',()=>{$('lobby').hidden=true;if(PZ.on)$('home').hidden=false;else plazaStart();});
/* phones get the share sheet (KakaoTalk etc.), PCs a copied link; the link drops friends straight onto the join button */
$('copyBtn').addEventListener('click',async()=>{const url=location.href,code=NETC.room?NETC.room.code:'';
  if(isTouch&&navigator.share){try{await navigator.share({title:'오피스 로얄',text:`오피스 로얄 같이 출근해요! 방 코드 ${code}`,url});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(url);lobbyNote('초대 링크를 복사했어요. 친구에게 보내 주세요');}catch{lobbyNote(url);}});

/* ---------- spectating ---------- */
let specId=null;
const watching=()=>running&&G&&G.me&&!G.me.alive&&$('result').hidden;
function specTarget(){
  if(!G)return null;let a=G.actors.find(o=>o.id===specId&&o.alive);
  if(!a){a=(G.me.killer&&G.me.killer.alive?G.me.killer:null)||leader()||null;specId=a?a.id:null;}
  return a;
}
function specCycle(d){const al=G.actors.filter(a=>a.alive);if(!al.length)return;const cur=specTarget(),i=Math.max(0,al.indexOf(cur));specId=al[(i+d+al.length)%al.length].id;}
function specExit(){$('spec').hidden=true;specId=null;if(NETC.room)showLobby();else plazaStart();}
let lastSpec='';
function specHud(){
  const show=watching();if($('spec').hidden===show)$('spec').hidden=!show;if(!show)return;
  const a=specTarget(),t=a?`${a.name} ${rankName(a)}|${a.f>=0?FLOORS[a.f].short:''}`:'';
  if(t!==lastSpec){lastSpec=t;const[n,f]=t.split('|');$('specName').textContent=n||'-';$('specFloor').textContent=f||'';}
}
$('watchBtn').addEventListener('click',()=>{$('result').hidden=true;specId=null;specTarget();});
$('specPrev').addEventListener('click',()=>specCycle(-1));
$('specNext').addEventListener('click',()=>specCycle(1));
$('specExit').addEventListener('click',specExit);

let last=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  shake=Math.max(0,shake-dt);
  /* hit-stop: in solo the rules crawl for a blink after a hit that involves me (online the server keeps time) */
  let sdt=dt;if(hitStop>0){hitStop-=dt;if(!NETC.on&&!reduceMotion)sdt=dt*.08;}
  if(running&&G&&!paused){readInput();if(NETC.on){netSendInput();netFrame(dt);}else if(!G.net)step(sdt);}
  else if(PZ.on){readInput();plazaFrame(dt);}
  if(TUT.on)tutFrame(dt);
  juiceFrame(dt);
  render(dt);hud(dt);keybar();countdown();specHud();
  {const pb=$('pauseBtn'),h=!canPause();if(pb.hidden!==h)pb.hidden=h;}
  requestAnimationFrame(frame);
}
/* one line under the character at a time: a new line replaces the old one, except that an urgent (red) line
   is not pushed out by an ordinary one for its first 1.5 s, and repeats only refresh the timer */
const FD={el:null,hot:false,t0:0,out:0,gone:0};
function feedDOM(msg,hot){
  const f=$('feed'),now=performance.now();
  if(FD.el&&FD.el.isConnected){
    if(FD.el.textContent===msg){FD.el.classList.remove('out');}
    else if(FD.hot&&!hot&&now-FD.t0<1500)return;
    else{FD.el.remove();FD.el=null;}
  }
  if(!FD.el||!FD.el.isConnected){const el=document.createElement('div');el.className='fi'+(hot?' hot':'');el.textContent=msg;f.textContent='';f.append(el);FD.el=el;FD.hot=!!hot;FD.t0=now;}
  clearTimeout(FD.out);clearTimeout(FD.gone);const el=FD.el,life=hot?3000:2200;
  FD.out=setTimeout(()=>el.classList.add('out'),life);FD.gone=setTimeout(()=>{el.remove();if(FD.el===el)FD.el=null;},life+500);
}
/* hooks the rules call; target a = the actor it is about (ignored unless it is me) */
const forMe=a=>!a||!G||!G.me||a===G.me;
Object.assign(UI,{
  feed:(msg,hot,to)=>{if(!forMe(to))return;const t=typeof msg==='function'?msg(G.me):msg;if(t)feedDOM(t,hot);},
  notice:t=>{$('noticeText').textContent=t;$('notice').hidden=false;},
  noticeEnd:()=>{$('notice').hidden=true;},
  branch:a=>{if(forMe(a)&&$('branchBox').hidden)openBranch();},
  shake:(v,a)=>{if(forMe(a)&&!reduceMotion)shake=v;},
  vibrate:a=>{if(forMe(a)&&navigator.vibrate)try{navigator.vibrate(40);}catch(e){}},
  cine:(t,sub,dur=1.6,a)=>{if(!forMe(a))return;$('cineTower').hidden=true;$('cineS').textContent=sub||'';$('cineT').textContent=t;$('cine').hidden=false;cineT=dur;},
  closure:(...a)=>closureCine(...a),
  result:(win,ms,a)=>{if(forMe(a))setTimeout(()=>showResult(win),ms);},
  reset:()=>{$('feed').textContent='';},
  snapCam:a=>{if(forMe(a))cam={x:a.x,y:a.y};},
});
requestAnimationFrame(frame);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{resetFloors();});
