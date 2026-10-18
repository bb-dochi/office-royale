/* ================= input ================= */
const keys=new Set();let joy={id:null,ox:0,oy:0,dx:0,dy:0},throwHeld=false;
/* player actions go through ACT (client/05-net.js): straight into the rules in solo, to the room server online */
function doInteract(){if(running&&G.me.alive)ACT.interact();}
const CALLKEY={Digit1:0,Digit2:1,Digit3:2,Numpad1:0,Numpad2:1,Numpad3:2};
addEventListener('keydown',e=>{
  const c=e.code;if(c.startsWith('Arrow')||c==='Space'||c==='Tab')e.preventDefault();
  keys.add(c);if(!running||!G||e.repeat&&c!=='Space')return;const me=G.me;
  if(me.call&&c in CALLKEY){const o=callOptions(me).at(CALLKEY[c]);if(o)ACT.answer(o.key);return;}
  if(!$('branchBox').hidden&&/^(Digit|Numpad)[1-4]$/.test(c)){pickBranch(Object.keys(BRANCH).at(Number(c.slice(-1))-1));return;}
  if(c==='Space')ACT.throw(aimAngle(me));
  else if(c==='KeyE')doInteract();
  else if(c==='KeyQ')ACT.skill();
  else if(c==='KeyM'||c==='Tab'){mapMode=mapMode==='building'?'floor':'building';hudT=0;}
});
let wT=null,wLong=false;
let slotHold=null;
addEventListener('keyup',e=>{keys.delete(e.code);if(slotHold&&(slotHold.key?e.code===slotHold.key:/^(Digit|Numpad)[1-4]$/.test(e.code)&&Number(e.code.slice(-1))-1===slotHold.i)){clearTimeout(wT);if(!slotHold.long&&running&&G)ACT.item(slotHold.i);slotHold=null;}});
addEventListener('blur',()=>keys.clear());
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(!running)return;e.preventDefault();
  if(e.pointerType==='mouse'){if(e.button===2)return;const w=screenToWorld(e.clientX,e.clientY);ACT.throw(Math.atan2(w.y-G.me.y,w.x-G.me.x));return;}
  if(e.clientX<VW*.55&&joy.id===null){
    joy={id:e.pointerId,ox:e.clientX,oy:e.clientY,dx:0,dy:0};cv.setPointerCapture(e.pointerId);
    const s=$('stick');s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';s.hidden=false;$('knob').style.transform='';$('hint').hidden=true;
  }else ACT.throw(autoAim(G.me));
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
tb.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();throwHeld=true;if(running)ACT.throw(autoAim(G.me));});
['pointerup','pointercancel','pointerleave'].forEach(t=>tb.addEventListener(t,()=>throwHeld=false));
press(gb,()=>doInteract());
let ibT=null,ibLong=false;
$('slots').addEventListener('pointerdown',e=>{const b=e.target.closest('.slot');if(!b)return;e.preventDefault();e.stopPropagation();ibLong=false;});
$('slots').addEventListener('pointerup',e=>{const b=e.target.closest('.slot');clearTimeout(ibT);if(!b)return;e.preventDefault();if(!ibLong&&running)ACT.item(+b.dataset.i);ibLong=true;});
$('slots').addEventListener('pointerleave',()=>clearTimeout(ibT));
press($('skillBtn'),()=>ACT.skill());
$('tower').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();mapMode=mapMode==='building'?'floor':'building';hudT=0;});
$('pills').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();
  const a=b.dataset.a;if(a==='up')ACT.floor(1);else if(a==='down')ACT.floor(-1);else if(a==='act')doInteract();});
$('callOpts').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();if(G&&G.me.call)ACT.answer(b.dataset.k);});
document.addEventListener('touchmove',e=>{if(!e.target.closest('.sheet'))e.preventDefault();},{passive:false});

function readInput(){
  if(!G||!G.me)return;const me=G.me;let vx=0,vy=0;
  if(keys.has('ArrowLeft')||keys.has('KeyA'))vx-=1;if(keys.has('ArrowRight')||keys.has('KeyD'))vx+=1;
  if(keys.has('ArrowUp')||keys.has('KeyW'))vy-=1;if(keys.has('ArrowDown')||keys.has('KeyS'))vy+=1;
  if(joy.id!==null){vx+=joy.dx;vy+=joy.dy;}
  me.input={vx,vy,fire:throwHeld,run:keys.has('ShiftLeft')||keys.has('ShiftRight')||(joy.id!==null&&joy.full)};
  me.aim=performance.now()-mouse.t<1500?aimAngle(me):null;
}
