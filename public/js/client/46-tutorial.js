/* ================= tutorial: a guided practice run of the main features =================
   A solo game with tutorial:true (no closures, no events, bots that stand still, NPCs off until a step needs one).
   Each step sets something up, points an arrow at it and waits until the player has done it. */
const TUT={on:false,i:0,target:null,wait:0};
/* texts depend on PC vs touch, so the list is rebuilt when the input mode changes (setInputMode) */
function tutSteps(){const PC=!isTouch;return[
  {t:'이동',d:PC?'WASD로 움직여 보세요.':'화면 왼쪽을 드래그해서 움직여 보세요.',
    setup(){TUT.base={x:G.me.x,y:G.me.y};},done:()=>Math.hypot(G.me.x-TUT.base.x,G.me.y-TUT.base.y)>160},
  {t:'달리기',d:PC?'Shift를 누른 채 움직이면 달려요. 부장님 앞에서 뛰면 혼나요!':'손가락을 노란 점선 밖까지 멀리 밀면 달려요. 부장님 앞에서 뛰면 혼나요!',
    setup(){TUT.run=0;},tick(dt){if(G.me.sprint)TUT.run+=dt;},done:()=>TUT.run>1},
  {t:'업무',d:`노란 원 안에 서 있으면 업무가 진행돼요. 다 되면 잠시 뒤 자동 제출되고, ${PC?'E':'상호작용 버튼'}를 누르면 바로 내요. 남보다 먼저 내야 고과를 가져가요!`,
    setup(){const me=G.me;TUT.n0=me.tasksDone;TUT.task=G.tasks.filter(t=>t.f===me.f).sort((a,b)=>dist(a,me)-dist(b,me))[0]||null;TUT.target=TUT.task;},
    tick(){if(TUT.task&&!G.tasks.includes(TUT.task)){TUT.task=G.tasks.filter(t=>t.f===G.me.f).sort((a,b)=>dist(a,G.me)-dist(b,G.me))[0]||null;TUT.target=TUT.task;}},
    done:()=>G.me.tasksDone>TUT.n0},
  {t:'승진',d:'고과 최고점이 오르면 직급이 올라요.',
    h:`<span class="ladder">${RANKS.map(([n,r])=>`<em data-r="${r}">${r}${n>0?`<small>${n}</small>`:''}</em>`).join('<s>›</s>')}</span>
      <span class="perks"><i>직급 ⬆ = 서류 공격력 ⬆</i><i>팀장: 부서 스킬 ${PC?'(Q)':''}</i><i>임원: 부장님이 먼저 인사</i></span>`,
    read:true,setup(){const me=G.me;if(me.peak<55)gain(me,56-me.g);TUT.target=null;}},
  {t:'부장님께 인사',d:`부장님 노란 시야에 들어가면 ${PC?'E':'상호작용'}로 먼저 인사하세요. (지금은 천천히 해도 돼요)`,
    setup(){const me=G.me,b=G.npcs.find(n=>n.kind==='boss'&&n.f===me.f);TUT.boss=b;if(!b)return;b.tut=true;
      const p=[[150,0],[-150,0],[0,150],[0,-150]].map(([dx,dy])=>({x:me.x+dx,y:me.y+dy})).find(p=>!blocked(me.f,p.x,p.y))||{x:me.x+150,y:me.y};
      b.x=p.x;b.y=p.y;b.pause=1e9;b.face=Math.atan2(me.y-b.y,me.x-b.x);me.met={};TUT.target=b;},
    tick(){const b=TUT.boss,me=G.me;if(b){b.pause=1e9;b.face=Math.atan2(me.y-b.y,me.x-b.x);
      if(me.contact)me.contact.t=me.contact.max; // no rush in this step: the greeting window stays open
      if(!me.contact&&!me.call&&me.stampNpc!==b)me.met[b.id]=-99;}}, // walked out of sight? let the boss look again
    done:()=>!TUT.boss||G.me.stampNpc===TUT.boss},
  {t:'인사가 늦으면',d:`호출당해요! 질문에 맞는 대답을 고르세요 (${PC?'1~3 키':'버튼'}).
예: "인사도 안 하나?" → 인사. 실전에선 몇 초 안에 못 고르면 고과가 깎여요.`,
    setup(){const me=G.me,b=TUT.boss;me.contact=null;if(!b){TUT.called=true;return;}TUT.called=false;startCall(me,b);TUT.called=true;TUT.target=b;},
    tick(){const c=G.me.call;if(c)c.t=c.max;if(TUT.boss){TUT.boss.pause=1e9;TUT.boss.face=Math.atan2(G.me.y-TUT.boss.y,G.me.x-TUT.boss.x);}}, // timer frozen for the lesson
    done:()=>TUT.called&&!G.me.call,
    leave(){if(TUT.boss)TUT.boss.tut=false;G.me.call=null;G.me.contact=null;}},
  {t:'서류 던지기',d:`${PC?'Space나 마우스 클릭':'서류 투척 버튼'}으로 동료를 맞혀 보세요. 고과가 0이 되면 권고사직이에요.`,
    setup(){const me=G.me,d=G.actors.filter(a=>!a.isPlayer&&a.alive).sort((a,b)=>dist(a,me)-dist(b,me))[0];TUT.dummy=d;if(!d)return;
      if(d.f!==me.f||dist(d,me)>260){d.f=me.f;const p=[[120,40],[-120,40],[40,120]].map(([dx,dy])=>({x:me.x+dx,y:me.y+dy})).find(p=>!blocked(me.f,p.x,p.y))||{x:me.x+120,y:me.y};d.x=p.x;d.y=p.y;}
      d.lastHitBy=null;TUT.target=d;},
    done:()=>!TUT.dummy||TUT.dummy.lastHitBy===G.me},
  {t:'공격 아이템',d:'빨간 공격 아이템은 주우면 바로 손에 들고, 공격할 때 나가요. 다 쓰기 전까지는 새로 못 주워요. 스테이플러를 주워서 쏴 보세요!',
    setup(){const me=G.me,p=[[90,0],[-90,0],[0,90],[0,-90]].map(([dx,dy])=>({x:me.x+dx,y:me.y+dy})).find(p=>!blocked(me.f,p.x,p.y))||{x:me.x,y:me.y+60};
      me.items=[];me.ammo=0;spawnItem(me.f,'stapler',p);TUT.item=G.items.at(-1);TUT.target=TUT.item;},
    tick(){if(TUT.item&&!G.items.includes(TUT.item)){TUT.item=null;TUT.target=TUT.dummy;}},
    done:()=>G.me.ammo>0&&G.me.ammo<15},
  {t:'위층으로',d:`40초마다 아래층부터 폐쇄돼요. 계단이나 엘리베이터 위에서 ${PC?'E':'상호작용'}로 위층으로 올라가세요!`,
    setup(){TUT.f0=G.me.f;TUT.target={f:G.me.f,x:PADS.stair.x,y:PADS.stair.y};},done:()=>G.me.f>TUT.f0},
  {t:'아래층으로',d:PC?'계단·엘리베이터 위에서 Shift+E를 누르면 아래층으로 내려가요. 도망칠 때 써요!':'계단·엘리베이터 위에서 ▼ 버튼을 누르면 아래층으로 내려가요. 도망칠 때 써요!',
    setup(){TUT.f1=G.me.f;const p=padOf(G.me)||'stair';TUT.target={f:G.me.f,x:PADS[p].x,y:PADS[p].y};},done:()=>G.me.f<TUT.f1&&G.me.f>=0},
  {t:'돌발 이벤트',d:'실전에선 점심시간(옥상 난투전), 소방 훈련, 감사팀, 우수사원 발표 같은 이벤트가 갑자기 터져요. 화면 공지를 잘 보세요!',
    read:true,setup(){TUT.target=null;}},
  {t:'고과 올리는 법',d:'일은 찾아서 하는 거예요. 솔선수범할수록 고과가 올라요.',
    h:`<span class="perks"><i>📋 노란 원 업무 · 출력물 배달</i><i>🖥 내 자리 근무: 모니터 미니게임</i><i>🙋 동료 부탁 들어주기</i><i>🚽 화캉스: 변기에서 코인 한 판</i><i>☕ 커피 · 정수기 · 커피 카트</i></span>`,
    read:true,setup(){TUT.target=null;}},
  {t:'끝!',d:'고과를 쌓아 승진하고(사원 → 대리 → 팀장 → 임원), 최후의 1인이 되면 CEO실 입성! 이제 실전에서 살아남아 보세요.',final:true,setup(){TUT.target=null;}},
];}
let TUT_STEPS=tutSteps();
const blocked=(f,x,y)=>x<40||y<40||x>FW-40||y>FH-40||obsOf(f).some(o=>x>o.x-24&&x<o.x+o.w+24&&y>o.y-24&&y<o.y+o.h+24);
function tutShow(){
  const s=TUT_STEPS[TUT.i];$('tutStep').textContent=s.final?'튜토리얼 완료':`튜토리얼 ${TUT.i+1}/${TUT_STEPS.length-1}`;
  $('tutTitle').textContent=s.t;$('tutText').innerHTML='';$('tutText').append(s.d);
  if(s.h){$('tutText').insertAdjacentHTML('beforeend',s.h);const cur=$('tutText').querySelector(`[data-r="${G.me.rank}"]`);if(cur)cur.classList.add('cur');}
  $('tutDots').innerHTML=TUT_STEPS.slice(0,-1).map((_,k)=>`<i class="${k<TUT.i?'on':k===TUT.i?'now':''}"></i>`).join('');
  $('tutNext').hidden=!s.read;$('tutSkip').hidden=!!s.final||!!s.read;$('tutPlay').hidden=$('tutHome').hidden=!s.final;$('tutQuit').hidden=!!s.final;$('tut').classList.remove('ok');
}
function tutGo(i){const prev=TUT_STEPS[TUT.i];if(prev&&prev.leave&&i!==TUT.i)prev.leave();TUT.i=i;TUT.target=null;TUT.wait=0;const s=TUT_STEPS[i];if(s.setup)s.setup();tutShow();}
function tutStart(){
  netClose();TUT_STEPS=tutSteps();newGame({humans:[{key:'me',name:'나',fit:myFit(),team:myTeam()}],bots:3,tutorial:true});startScreens();
  TUT.on=true;$('tut').hidden=false;tutGo(0);
}
function tutStop(){TUT.on=false;TUT.target=null;$('tut').hidden=true;}
/* called every frame from the main loop while a tutorial is running */
function tutFrame(dt){
  if(!TUT.on||!running||!G||!G.tutorial)return;
  const s=TUT_STEPS[TUT.i];if(s.final)return;
  if(s.read)return; // read-only steps wait for 다음 / Enter
  if(s.tick)s.tick(dt);
  if(TUT.wait>0){TUT.wait-=dt;if(TUT.wait<=0)tutGo(TUT.i+1);return;}
  if(s.done()){TUT.wait=1.1;$('tut').classList.add('ok');$('tutText').textContent='잘했어요! ✓';TUT.target=null;}
}
$('hTut').addEventListener('click',tutStart);
/* steps that only explain something move on with 다음 or Enter */
const tutNext=()=>{const s=TUT_STEPS[TUT.i];if(TUT.on&&s&&s.read)tutGo(TUT.i+1);};
$('tutNext').addEventListener('click',tutNext);
addEventListener('keydown',e=>{if(e.key==='Enter'&&TUT.on&&TUT_STEPS[TUT.i]&&TUT_STEPS[TUT.i].read){e.preventDefault();tutNext();}});
$('tutSkip').addEventListener('click',()=>{if(TUT.i<TUT_STEPS.length-1)tutGo(TUT.i+1);});
$('tutQuit').addEventListener('click',()=>{tutStop();plazaStart();});
$('tutHome').addEventListener('click',()=>{tutStop();plazaStart();});
$('tutPlay').addEventListener('click',()=>{tutStop();start();});
