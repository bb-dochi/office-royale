/* ================= tutorial: a guided practice run of the main features =================
   A solo game with tutorial:true (no closures, no events, bots that stand still, NPCs off until a step needs one).
   Each step sets something up, points an arrow at it and waits until the player has done it. */
const TUT={on:false,i:0,target:null,wait:0};
/* texts depend on PC vs touch, so the list is rebuilt when the input mode changes (setInputMode) */
function tutSteps(){const PC=!isTouch;return[
  {t:'이동',d:PC?'WASD로 움직여 보세요.':'화면 왼쪽을 드래그해서 움직여 보세요.',
    setup(){TUT.base={x:G.me.x,y:G.me.y};},done:()=>Math.hypot(G.me.x-TUT.base.x,G.me.y-TUT.base.y)>160},
  {t:'달리기',d:PC?'Shift를 누른 채 움직이면 달려요. 부장님 앞에서 뛰면 혼나요!':'조이스틱을 끝까지 밀면 달려요. 부장님 앞에서 뛰면 혼나요!',
    setup(){TUT.run=0;},tick(dt){if(G.me.sprint)TUT.run+=dt;},done:()=>TUT.run>1},
  {t:'업무',d:`노란 원 안에 서 있으면 업무가 진행돼요. 다 되면 ${PC?'E':'상호작용 버튼'}으로 제출! 업무가 고과를 올리는 기본이에요.`,
    setup(){const me=G.me;TUT.n0=me.tasksDone;TUT.task=G.tasks.filter(t=>t.f===me.f).sort((a,b)=>dist(a,me)-dist(b,me))[0]||null;TUT.target=TUT.task;},
    tick(){if(TUT.task&&!G.tasks.includes(TUT.task)){TUT.task=G.tasks.filter(t=>t.f===G.me.f).sort((a,b)=>dist(a,G.me)-dist(b,G.me))[0]||null;TUT.target=TUT.task;}},
    done:()=>G.me.tasksDone>TUT.n0},
  {t:'부장님께 인사',d:`부장님 노란 시야에 들어가면 먼저 인사해야 해요(${PC?'E':'상호작용'}). 늦으면 호출당하고 고과가 깎여요.`,
    setup(){const me=G.me,b=G.npcs.find(n=>n.kind==='boss'&&n.f===me.f);TUT.boss=b;if(!b)return;b.tut=true;
      const p=[[150,0],[-150,0],[0,150],[0,-150]].map(([dx,dy])=>({x:me.x+dx,y:me.y+dy})).find(p=>!blocked(me.f,p.x,p.y))||{x:me.x+150,y:me.y};
      b.x=p.x;b.y=p.y;b.pause=1e9;b.face=Math.atan2(me.y-b.y,me.x-b.x);me.met={};TUT.target=b;},
    tick(){const b=TUT.boss;if(b){b.pause=1e9;b.face=Math.atan2(G.me.y-b.y,G.me.x-b.x);
      if(!G.me.contact&&!G.me.call&&G.me.stampNpc!==b)G.me.met[b.id]=-99;}}, // missed it? let the boss look again right away
    done:()=>!TUT.boss||G.me.stampNpc===TUT.boss,
    leave(){if(TUT.boss)TUT.boss.tut=false;G.me.call=null;G.me.contact=null;}},
  {t:'서류 던지기',d:`${PC?'Space나 마우스 클릭':'서류 투척 버튼'}으로 동료를 맞혀 보세요. 고과가 0이 되면 권고사직이에요.`,
    setup(){const me=G.me,d=G.actors.filter(a=>!a.isPlayer&&a.alive).sort((a,b)=>dist(a,me)-dist(b,me))[0];TUT.dummy=d;if(!d)return;
      if(d.f!==me.f||dist(d,me)>260){d.f=me.f;const p=[[120,40],[-120,40],[40,120]].map(([dx,dy])=>({x:me.x+dx,y:me.y+dy})).find(p=>!blocked(me.f,p.x,p.y))||{x:me.x+120,y:me.y};d.x=p.x;d.y=p.y;}
      d.lastHitBy=null;TUT.target=d;},
    done:()=>!TUT.dummy||TUT.dummy.lastHitBy===G.me},
  {t:'공격 아이템',d:'빨간 공격 아이템은 주우면 바로 손에 들고, 공격할 때 나가요. 스테이플러를 주워서 쏴 보세요!',
    setup(){const me=G.me,p=[[90,0],[-90,0],[0,90],[0,-90]].map(([dx,dy])=>({x:me.x+dx,y:me.y+dy})).find(p=>!blocked(me.f,p.x,p.y))||{x:me.x,y:me.y+60};
      me.items=[];me.ammo=0;spawnItem(me.f,'stapler',p);TUT.item=G.items.at(-1);TUT.target=TUT.item;},
    tick(){if(TUT.item&&!G.items.includes(TUT.item)){TUT.item=null;TUT.target=TUT.dummy;}},
    done:()=>G.me.ammo>0&&G.me.ammo<15},
  {t:'위층으로',d:`40초마다 아래층부터 폐쇄돼요. 계단이나 엘리베이터 위에서 ${PC?'E':'상호작용'}로 위층으로 올라가세요!`,
    setup(){TUT.f0=G.me.f;TUT.target={f:G.me.f,x:PADS.stair.x,y:PADS.stair.y};},done:()=>G.me.f>TUT.f0},
  {t:'끝!',d:'고과를 쌓아 승진하고(대리 → 팀장 → 임원), 최후의 1인이 되면 CEO실 입성! 이제 실전에서 살아남아 보세요.',final:true,setup(){TUT.target=null;}},
];}
let TUT_STEPS=tutSteps();
const blocked=(f,x,y)=>x<40||y<40||x>FW-40||y>FH-40||obsOf(f).some(o=>x>o.x-24&&x<o.x+o.w+24&&y>o.y-24&&y<o.y+o.h+24);
function tutShow(){
  const s=TUT_STEPS[TUT.i];$('tutStep').textContent=s.final?'튜토리얼 완료':`튜토리얼 ${TUT.i+1}/${TUT_STEPS.length-1}`;
  $('tutTitle').textContent=s.t;$('tutText').textContent=s.d;
  $('tutDots').innerHTML=TUT_STEPS.slice(0,-1).map((_,k)=>`<i class="${k<TUT.i?'on':k===TUT.i?'now':''}"></i>`).join('');
  $('tutSkip').hidden=!!s.final;$('tutPlay').hidden=$('tutHome').hidden=!s.final;$('tutQuit').hidden=!!s.final;$('tut').classList.remove('ok');
}
function tutGo(i){const prev=TUT_STEPS[TUT.i];if(prev&&prev.leave&&i!==TUT.i)prev.leave();TUT.i=i;TUT.target=null;TUT.wait=0;const s=TUT_STEPS[i];if(s.setup)s.setup();tutShow();}
function tutStart(){
  netClose();TUT_STEPS=tutSteps();newGame({humans:[{key:'me',name:'나',fit:myFit()}],bots:3,tutorial:true});startScreens();
  TUT.on=true;$('tut').hidden=false;tutGo(0);feed('튜토리얼: 연습용 층이라 폐쇄되지 않아요');
}
function tutStop(){TUT.on=false;TUT.target=null;$('tut').hidden=true;}
/* called every frame from the main loop while a tutorial is running */
function tutFrame(dt){
  if(!TUT.on||!running||!G||!G.tutorial)return;
  const s=TUT_STEPS[TUT.i];if(s.final)return;
  if(s.tick)s.tick(dt);
  if(TUT.wait>0){TUT.wait-=dt;if(TUT.wait<=0)tutGo(TUT.i+1);return;}
  if(s.done()){TUT.wait=1.1;$('tut').classList.add('ok');$('tutText').textContent='잘했어요! ✓';TUT.target=null;}
}
$('hTut').addEventListener('click',tutStart);
$('tutSkip').addEventListener('click',()=>{if(TUT.i<TUT_STEPS.length-1)tutGo(TUT.i+1);});
$('tutQuit').addEventListener('click',()=>{tutStop();plazaStart();});
$('tutHome').addEventListener('click',()=>{tutStop();plazaStart();});
$('tutPlay').addEventListener('click',()=>{tutStop();start();});
