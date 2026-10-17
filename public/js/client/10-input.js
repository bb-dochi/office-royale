/* ================= input ================= */
const keys=new Set();let joy={id:null,ox:0,oy:0,dx:0,dy:0},throwHeld=false;
function playerFloor(dir){const me=G.me,p=padOf(me);if(!running||!me.alive||!p)return;if(startChan(me,p,dir))feed(`${PADS[p].n}: 사원증 태그 ${tagOf(me)}초 → ${FLOORS[me.f+dir].name}`);}
function interact(){
  if(!running)return;const me=G.me;if(!me.alive||me.f<0||locked(me)||me.chan)return;
  const act=contextAction();if(act)act.fn();
}
function contextAction(){
  const me=G.me;if(!me.alive||me.f<0||me.transit||locked(me)||me.chan)return null;
  if(me.contact)return{label:me.contact.n.kind==='ceo'?'대표님께 인사!':'부장님께 인사!',cls:'hot',fn:()=>greet(me)};
  if(me.quest)return{label:'신입 질문 답해주기 +2',cls:'hot',fn:()=>answerQuest(me)};
  if(me.docs>0){const n=watchers(me).find(n=>dist(n,me)<150);if(n)return{label:'결재 올리기 +8',cls:'ready',fn:()=>submitDoc(me,n)};}
  const rt=G.tasks.find(t=>t.ready&&inTaskRange(me,t));
  if(rt)return{label:`제출 +${rt.reward*(warnFloor(rt.f)?2:1)}`,cls:'ready',fn:()=>submitTask(me,rt)};
  const d=G.doors[me.f];
  if(d&&d.v&&dist(me,DOOR)<64)return{label:'문 열기',cls:'go',fn:()=>openDoor(me)};
  const rd=nearDoor(me);
  if(rd&&!me.sit)return{label:rd.open?`${rd.name} 닫기`:`${rd.name} 열기`,cls:rd.open?'':'go',fn:()=>{if(!toggleDoor(me.f,rd,!rd.open))feed('문 앞에 사람이 있어 못 닫습니다');}};
  const pad=padOf(me);
  if(pad&&!me.sit&&G.lunch&&G.lunch.t>3)return{label:pad==='stair'?'◀ 옥상 왼쪽 문':'옥상 오른쪽 문 ▶',cls:'hot',fn:()=>goRoof(me,pad==='stair'?'L':'R')};
  if(pad&&!me.sit){const up=me.f+1,dn=me.f-1;
    if(up<NF&&isOpen(up))return{label:`▲ ${FLOORS[up].short} · 태그 ${tagOf(me)}초`,cls:'go',fn:()=>playerFloor(1)};
    if(dn>=0&&isOpen(dn))return{label:`▼ ${FLOORS[dn].short}로`,cls:'',fn:()=>playerFloor(-1)};
    if(up<NF)return{label:`${FLOORS[up].short} 잠김`,cls:'',fn:()=>playerFloor(1)};}
  if(me.sit)return{label:'일어나기',cls:'',fn:()=>stand(me)};
  const own=me.seats[me.f];
  if(own&&dist(me,own)<40&&!own.occ)return{label:'내 자리에 앉기',cls:'go',fn:()=>{if(sit(me,own))feed('내 자리에 앉았다: 고과 회복 중');}};
  const other=FLOORS[me.f].seats.find(s=>s!==own&&!s.occ&&dist(me,s)<22);
  if(other)return{label:'남의 자리에 앉기',cls:'',fn:()=>{if(sit(me,other))feed(`${other.owner?other.owner.name+'님':'빈'} 자리: 회복 없음`);}};
  const cl=G.npcs.find(n=>n.kind==='cleaner'&&n.f===me.f&&npcActive(n)&&dist(n,me)<80);
  if(cl&&me.cleanCd<=0)return{label:'아주머니께 인사 (정보)',cls:'',fn:()=>greet(me)};
  return null;
}
const CALLKEY={Digit1:0,Digit2:1,Digit3:2,Numpad1:0,Numpad2:1,Numpad3:2};
addEventListener('keydown',e=>{
  const c=e.code;if(c.startsWith('Arrow')||c==='Space'||c==='Tab')e.preventDefault();
  keys.add(c);if(!running||!G||e.repeat&&c!=='Space')return;const me=G.me;
  if(me.call&&c in CALLKEY){const o=callOptions(me).at(CALLKEY[c]);if(o)answer(me,o.key);return;}
  if(!$('branchBox').hidden&&/^(Digit|Numpad)[1-4]$/.test(c)){chooseBranch(Object.keys(BRANCH).at(Number(c.slice(-1))-1));return;}
  if(c==='Space')throwPaper(me,aimAngle(me));
  else if(c==='KeyE')interact();
  else if(c==='KeyF')useItem(me,0);
  else if(c==='KeyQ')useSkill(me);
  else if(c==='KeyM'||c==='Tab'){mapMode=mapMode==='building'?'floor':'building';hudT=0;}
});
let wT=null,wLong=false;
let slotHold=null;
addEventListener('keyup',e=>{keys.delete(e.code);if(slotHold&&(slotHold.key?e.code===slotHold.key:/^(Digit|Numpad)[1-4]$/.test(e.code)&&Number(e.code.slice(-1))-1===slotHold.i)){clearTimeout(wT);if(!slotHold.long&&running&&G)useItem(G.me,slotHold.i);slotHold=null;}});
addEventListener('blur',()=>keys.clear());
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(!running)return;e.preventDefault();
  if(e.pointerType==='mouse'){if(e.button===2){useItem(G.me,0);return;}const w=screenToWorld(e.clientX,e.clientY);throwPaper(G.me,Math.atan2(w.y-G.me.y,w.x-G.me.x));return;}
  if(e.clientX<VW*.55&&joy.id===null){
    joy={id:e.pointerId,ox:e.clientX,oy:e.clientY,dx:0,dy:0};cv.setPointerCapture(e.pointerId);
    const s=$('stick');s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';s.hidden=false;$('knob').style.transform='';$('hint').hidden=true;
  }else throwPaper(G.me,autoAim(G.me));
});
cv.addEventListener('pointermove',e=>{
  if(e.pointerId!==joy.id)return;
  let dx=e.clientX-joy.ox,dy=e.clientY-joy.oy;const m=Math.hypot(dx,dy),mx=48;if(m>mx){dx=dx/m*mx;dy=dy/m*mx;}
  joy.full=m>=mx*.97;$('knob').classList.toggle('run',joy.full);
  joy.dx=dx/mx;joy.dy=dy/mx;$('knob').style.transform=`translate(${dx}px,${dy}px)`;
});
const endJoy=e=>{if(e.pointerId!==joy.id)return;joy={id:null,ox:0,oy:0,dx:0,dy:0,full:false};$('knob').classList.remove('run');$('stick').hidden=true;};
cv.addEventListener('pointerup',endJoy);cv.addEventListener('pointercancel',endJoy);
const tb=$('throwBtn'),gb=$('greetBtn');
const press=(el,fn)=>{el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(running)fn();});el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&running){e.preventDefault();fn();}});};
tb.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();throwHeld=true;if(running)throwPaper(G.me,autoAim(G.me));});
['pointerup','pointercancel','pointerleave'].forEach(t=>tb.addEventListener(t,()=>throwHeld=false));
press(gb,()=>interact());
let ibT=null,ibLong=false;
$('slots').addEventListener('pointerdown',e=>{const b=e.target.closest('.slot');if(!b)return;e.preventDefault();e.stopPropagation();ibLong=false;});
$('slots').addEventListener('pointerup',e=>{const b=e.target.closest('.slot');clearTimeout(ibT);if(!b)return;e.preventDefault();if(!ibLong&&running)useItem(G.me,+b.dataset.i);ibLong=true;});
$('slots').addEventListener('pointerleave',()=>clearTimeout(ibT));
press($('skillBtn'),()=>useSkill(G.me));
$('tower').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();mapMode=mapMode==='building'?'floor':'building';hudT=0;});
$('pills').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();
  const a=b.dataset.a;if(a==='up')playerFloor(1);else if(a==='down')playerFloor(-1);else if(a==='act')interact();});
$('callOpts').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();if(G&&G.me.call)answer(G.me,b.dataset.k);});
document.addEventListener('touchmove',e=>{if(!e.target.closest('.sheet'))e.preventDefault();},{passive:false});
function callOptions(a){return[{key:'greet',t:'인사',s:'죄송합니다!'},a.docs>0?{key:'doc',t:'결재 요청',s:'여기 있습니다'}:{key:'report',t:'보고',s:'진행 중입니다'},{key:'busy',t:'바쁜 척',s:'타닥타닥'}];}

function readInput(){
  if(!G)return;const me=G.me;let vx=0,vy=0;
  if(keys.has('ArrowLeft')||keys.has('KeyA'))vx-=1;if(keys.has('ArrowRight')||keys.has('KeyD'))vx+=1;
  if(keys.has('ArrowUp')||keys.has('KeyW'))vy-=1;if(keys.has('ArrowDown')||keys.has('KeyS'))vy+=1;
  if(joy.id!==null){vx+=joy.dx;vy+=joy.dy;}
  me.input={vx,vy,fire:throwHeld,run:keys.has('ShiftLeft')||keys.has('ShiftRight')||(joy.id!==null&&joy.full)};
  me.aim=performance.now()-mouse.t<1500?aimAngle(me):null;
}
