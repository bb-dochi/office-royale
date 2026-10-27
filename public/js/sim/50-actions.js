const aimOf=a=>a.isPlayer&&a.aim!=null?a.aim:autoAim(a);
/* ================= actions ================= */
function throwPaper(a,ang){
  if(a.cd>0||!a.alive||a.f<0||locked(a)||a.sit||a.chan)return false;
  const base=a.isPlayer?(G.final?.38:.6):(G.final?.8:1.5)*diff().cd,staple=a.ammo>0;
  /* a human holding an attack item fires it with the attack button (bots decide in botItems) */
  if(a.isPlayer&&a.items.length&&!staple){a.face=ang;a.cd=a.lastCd=base;useItem(a,0,ang);return true;}
  if(staple)a.ammo--;
  a.cd=base*(staple?.35:1);a.lastCd=a.cd;a.face=ang;a.cloakT=0;
  G.proj.push({f:a.f,x:a.x+Math.cos(ang)*(R+4),y:a.y+Math.sin(ang)*(R+4),ox:a.x,oy:a.y,dx:Math.cos(ang),dy:Math.sin(ang),d:0,o:a,spin:Math.random()*6,staple,sp:staple?720:560,rng:(staple?300:340)*(a.branch==='mkt'?1+.25*teamK(a):1)}); // 마케팅: 멀리 던짐 (대리 +12%, 팀장 +25%)
  if(staple&&a.ammo===0)tell(a,'스테이플러를 다 썼다');
  for(const n of watchers(a))if(!immune(a,n)&&sees(n,a)){caught(a,n,'act');break;}
  return true;
}
function visibleTo(a,o){
  if(o===a||!o.alive||o.f!==a.f||o.inRest)return false;
  if(o.cloakT>0&&dist(a,o)>40)return false;
  if(o.desk)return false;
  if(inSmoke(o)&&dist(a,o)>50)return false; // hidden in a smoke cloud unless right next to it
  if(ally(a,o))return false;
  const d=dist(a,o);if(o.sit&&o.sit.owner===o&&d>150)return false;
  return true;
}
function nearest(a,range,need){
  let best=null,bd=range;
  for(const o of G.actors){if(!visibleTo(a,o))continue;const d=dist(a,o);if(d<bd&&(!need||shotLos(a.f,a.x,a.y,o.x,o.y))){bd=d;best=o;}}
  return best;
}
function autoAim(a){const b=nearest(a,340,true);return b?Math.atan2(b.y-a.y,b.x-a.x):a.face;}
const STORE=new Set(['stapler','bundle','spill','card']);
/* one attack item at a time: no new one until the held one (or the stapler's ammo) is used up */
const canTake=(a,k)=>!STORE.has(k)||(a.items.length<1&&a.ammo<=0);
function useItem(a,i=0,ang){
  const k=a.items[i];if(!k||!a.alive||a.f<0||locked(a))return false;
  a.items.splice(i,1);
  if(G.audit&&G.audit.f===a.f){dmg(a,5,'audit');pop(a.f,a.x,a.y-44,'감사팀: 압수 -5','#cf3626');tell(a,'감사팀에 아이템 압수 -5',true);return true;}
  return applyItem(a,k,ang);
}
function applyItem(a,k,aim){
  const it=ITEMS[k];
  const say=t=>pop(a.f,a.x,a.y-44,t,it.c);
  if(k==='stapler'){a.ammo=15;say('스테이플러 장전 15발');}
  else if(k==='stamp'){a.shieldN+=3;say('결재 도장 x3');}
  else if(k==='ticket'){a.speedT=8;say('야근 식권 사용');}
  else if(k==='vip'){a.vipT=10;say('이어폰 착용: 안 들려요~');}
  else if(k==='spill'){G.traps.push({f:a.f,x:a.x+Math.cos(a.face)*34,y:a.y+Math.sin(a.face)*34,o:a,t:0});say('커피를 쏟았다');}
  else if(k==='card'){let n=0;for(const o of G.actors)if(o!==a&&o.alive&&o.f===a.f&&dist(a,o)<200&&o.inv<=0&&!o.desk&&!ally(a,o)){o.stunT=3;o.chan=null;stand(o);n++;pop(o.f,o.x,o.y-44,'회식 참석','#c08a1e');}say(n?`회식 소집 (${n}명)`:'아무도 안 옴');}
  else if(k==='bundle'){const ang=aim??aimOf(a);G.proj.push({f:a.f,x:a.x+Math.cos(ang)*(R+4),y:a.y+Math.sin(ang)*(R+4),ox:a.x,oy:a.y,dx:Math.cos(ang),dy:Math.sin(ang),d:0,o:a,spin:0,bundle:true,sp:420,rng:260});a.cloakT=0;a.face=ang;
    say('서류 뭉치 투척!');for(const n of watchers(a))if(!immune(a,n)&&sees(n,a)){caught(a,n,'act');break;}}
  else if(k==='coffee'){gain(a,7,true);say('회복 +7');}
  if(k!=='coffee')tell(a,`${it.n} 사용`);
  return true;
}
function useSkill(a){
  if(!a.alive||a.f<0||locked(a)||a.sit||a.chan||!a.branch||!rankAt(a,'팀장')||a.skillCd>0)return false; // the Q skill opens at 팀장
  const B=BRANCH[a.branch];if(!B.cd)return false;const ex=a.rank==='임원';
  if(a.branch==='mkt'){const n=ex?14:10;for(let i=0;i<n;i++){const ang=i/n*Math.PI*2;G.proj.push({f:a.f,x:a.x+Math.cos(ang)*(R+4),y:a.y+Math.sin(ang)*(R+4),ox:a.x,oy:a.y,dx:Math.cos(ang),dy:Math.sin(ang),d:0,o:a,spin:Math.random()*6,flyer:true,sp:480,rng:ex?300:230});}
    pop(a.f,a.x,a.y-44,ex?'전사 전단지 살포!':'전단지 살포!','#c08a1e');a.cloakT=0;for(const n of watchers(a))if(!immune(a,n)&&sees(n,a)){caught(a,n,'act');break;}}
  else if(a.branch==='design'){const t=ex?6:4;a.cloakT=t;pop(a.f,a.x,a.y-44,'위장','#8e5c8a');tell(a,`위장: ${t}초간 아무도 못 봄 (던지면 풀림)`);}
  else if(a.branch==='hr'){
    /* the nearest rival in reach is called in for a talk and can't move or throw for a moment */
    const r=ex?220:160,t=G.actors.filter(o=>o!==a&&visibleTo(a,o)&&!o.inRest&&!ally(a,o)&&dist(o,a)<r).sort((p,q)=>dist(p,a)-dist(q,a))[0];
    if(!t){tell(a,'면담할 사람이 근처에 없어요');return false;}
    const l=ex?2.5:1.5;t.lockT=Math.max(t.lockT,l);t.lockWhy='면담 중';t.vx=t.vy=0;stand(t);
    say(a,pick(['잠깐 면담 좀 하지','자네, 이리 와 봐','인사 평가 얘기 좀 하자']),'#2f7d4f');pop(t.f,t.x,t.y-44,'면담 호출!','#2f7d4f');
    tell(t,`${a.name}에게 면담 호출: ${l}초 묶임`,true);tell(a,`면담 호출: ${t.name} ${l}초 묶음`);}
  else if(a.branch==='dev'){const t=ex?8:5;a.rushT=t;a.speedT=Math.max(a.speedT,t);pop(a.f,a.x,a.y-44,'야근 모드!','#2b6cb0');tell(a,`야근 모드: ${t}초간 업무 2배 더 · 빨라짐`);}
  a.skillCd=B.cd*(ex?EXEC_CD:1);return true;
}
function dropItem(a,i=0){
  const k=a.items[i];if(!k||!a.alive||a.f<0)return;spawnItem(a.f,k,{x:a.x,y:a.y+24});const it=G.items.at(-1);it.nb=a;it.nbT=G.t+2;
  tell(a,`${ITEMS[k].n} 버림`);a.items.splice(i,1);
}
function nearDoor(a,r=50){let best=null,bd=r;if(a.f<0)return null;for(const d of FLOORS[a.f].doors){const dd=Math.hypot(a.x-(d.x+d.w/2),a.y-(d.y+d.h/2));if(dd<bd){bd=dd;best=d;}}return best;}
function toggleDoor(f,d,open){
  if(d.open===open)return true;
  if(!open&&G.actors.some(a=>a.alive&&a.f===f&&a.x>d.x-R&&a.x<d.x+d.w+R&&a.y>d.y-R&&a.y<d.y+d.h+R))return false;
  d.open=open;d.t=0;refreshObs(FLOORS[f]);return true;
}
function padOf(a){if(a.f<0||a.f===ROOF)return null;for(const k in PADS)if(dist(a,PADS[k])<34)return k;return null;}
function startChan(a,padKey,dir){
  const to=a.f+dir;if(to<0||to>=NF||a.chan||a.transit||locked(a))return false;
  if(!isOpen(to)){tell(a,isLocked(to)?`보안 게이트: ${FLOORS[to].name}은 아직 잠겨 있습니다`:`${FLOORS[to].name}은 폐쇄되었습니다`);return false;}
  if(padKey==='elev'&&G.fire>0){tell(a,'소방 훈련 중: 엘리베이터 운행 정지');return false;}
  stand(a);const tag=tagOf(a);
  a.chan={pad:padKey,dir,tag,t:padKey==='stair'?tag+.8:tag,max:padKey==='stair'?tag+.8:tag};return true;
}
/* ================= lunch =================
   One of four per match (G.lunchKind). The first three are on the roof: 고과 lost up there stays lost, but hits are softer,
   nobody drops below 10 and E lights a cigarette (a smoke cloud you can hide in).
   lighter: 전담파 vs 연초파. Whoever comes up is put in the smaller team (ties at random), whichever door they used.
     Lighters drop from the sky: carry them to one of your team's ashtrays for a point (get hit and you drop them).
     The team with more points gets 고과. L = 전담파 (left smoking area), R = 연초파 (right).
   bill: every one for themself. A few people are handed the "오늘 점심 쏨" bill; hit someone with paper to pass yours on
     (no passing straight back for 2 s). Holding one at the end costs 고과, everyone else up there gets a treat.
   meal: the special at the serving counter. Stand in its ring and your plate fills: twice as fast alone, slower the more
     people share it, and a hit spills some. Halfway through the counter moves. The three fullest plates get 고과.
   ladder: nobody goes anywhere. Everyone is held where they stand and put in ladders of about five; pick a lane, and
     whoever's line ends on the coffee cup buys (고과 down), the rest are treated. */
const LUNCH_KINDS=['lighter','bill','meal','ladder'];
const LUNCH={dmg:.6,floor:10,win:8,carry:3,smokeCd:9,smokeLife:6,smokeR:K(75),names:{L:'전담파',R:'연초파'},
  bill:{pay:8,treat:5,safe:2},meal:{r:K(58),prize:[12,8,4],spill:.6,spots:[{x:K(550),y:K(232)},{x:K(550),y:K(532)}]},
  lad:{pick:8,show:5,pay:8,treat:3,size:5,rows:7}};
const LUNCH_INFO={lighter:{n:'라이터 쟁탈전',s:'옥상에서 전담파 vs 연초파 · 라이터 쟁탈전'},bill:{n:'계산서 폭탄 돌리기',s:'옥상에서 계산서 돌리기 · 끝날 때 들고 있으면 내가 쏨'},
  meal:{n:'오늘의 특식',s:'옥상 배식대를 혼자 차지하면 식판이 차요'},ladder:{n:'커피 내기 사다리',s:'다 같이 사다리타기 · ☕ 걸리면 커피 쏘기'}};
const roofLunch=()=>!!(G.lunch&&G.lunch.kind!=='ladder');
const teamOf=s=>LUNCH.names[s]||'';
const ashOf=side=>FLOORS[ROOF].ob.filter(o=>o.k==='ashtray'&&(side==='L')===(o.x<FW/2)).map(o=>({x:o.x+o.w/2,y:o.y+o.h/2}));
function pickTeam(){const n=s=>G.actors.filter(o=>o.alive&&o.side===s&&(o.f===ROOF||(o.transit&&o.transit.to===ROOF))).length;
  const l=n('L'),r=n('R');return l<r?'L':r<l?'R':Math.random()<.5?'L':'R';}
/* side: which stairhouse you come out of; it is also your team in the lighter game */
function arriveRoof(a,side){
  const team=G.lunch&&G.lunch.kind==='lighter',k=G.lunch?G.lunch.kind:'lighter';
  a.f=ROOF;a.side=team?side:null;a.roofPad=side==='L'?'stair':'elev';a.x=K(side==='L'?135:965);a.y=K(380)+rnd(-60,60);a.path=[];a.goal=null;a.mode='idle';a.target=null;a.transit=null;a.inv=1.5;a.vx=a.vy=0;a.lighter=0;
  if(a.isPlayer){
    if(team){UI.cine(teamOf(side),'흡연 동맹 · 라이터를 우리 재떨이로!',2.2,a);tell(a,`${teamOf(side)}: 같은 편끼리는 못 때려요 · E 담배로 연막`);}
    else if(k==='bill'){UI.cine('계산서 폭탄','계산서 든 사람이 서류로 맞히면 넘어와요 · 끝날 때 들고 있으면 -'+LUNCH.bill.pay,2.4,a);tell(a,'계산서 든 사람을 피하세요 · E 담배로 연막');}
    else if(k==='meal'){UI.cine('오늘의 특식','배식대 원 안에 있으면 식판이 차요 · 혼자면 2배 · 1~3등 고과',2.4,a);tell(a,'배식대를 차지하세요 · 사람이 많으면 느리고, 맞으면 흘려요');}
    UI.snapCam(a);}
}
function goRoof(a){
  if(!roofLunch()||G.lunch.t<3||!a.alive||a.f<0||a.f===ROOF||locked(a))return;stand(a);a.chan=null;a.preLunchF=a.f;a.transit={to:ROOF,t:.6,side:pickTeam()};a.f=-1;
}
function dropLighters(a){if(!(a.lighter>0)||a.f!==ROOF)return;for(let i=0;i<a.lighter;i++)spawnItem(ROOF,'lighter',{x:a.x+rnd(-22,22),y:a.y+rnd(-22,22)});pop(a.f,a.x,a.y-44,'라이터 떨어뜨림','#cf3626');a.lighter=0;}
/* bill game: a hit from someone holding a bill hands it over (unless the target just gave it to them) */
function passBill(t,o){
  const L=G.lunch;if(!L||L.kind!=='bill'||!o||!o.bill||t.bill||t.f!==ROOF||o.f!==ROOF)return;
  if(o.billFrom===t&&G.t-o.billT<LUNCH.bill.safe)return;
  o.bill=false;t.bill=true;t.billFrom=o;t.billT=G.t;
  pop(ROOF,t.x,t.y-54,'계산서 받음!','#cf3626');pop(ROOF,o.x,o.y-54,'계산서 넘김','#2f7d4f');
  tell(t,`${o.name}님이 계산서를 넘겼다! 서류로 다른 사람을 맞혀 넘기세요`,true);tell(o,`계산서를 ${t.name}님에게 넘겼다`);
}
function smoke(a){
  if(!roofLunch()||a.f!==ROOF||a.smokeCd>0||!a.alive)return false;
  G.smokes.push({f:ROOF,x:a.x,y:a.y,t:0,life:LUNCH.smokeLife,r:LUNCH.smokeR,side:a.side});a.smokeCd=LUNCH.smokeCd;
  say(a,a.side==='L'?'후우~ (전담)':a.side==='R'?'후~ (연초)':'후~','#5d666e');return true;
}
const inSmoke=o=>G.smokes&&G.smokes.some(s=>s.f===o.f&&Math.hypot(s.x-o.x,s.y-o.y)<s.r);
const ally=(a,o)=>!!(a&&o&&a.f===ROOF&&o.f===ROOF&&a.side&&a.side===o.side);
/* ladder: groups of about five, each lane taken by one person; the rungs stay secret until everyone has picked */
function startLadder(L){
  const al=alive().sort(()=>Math.random()-.5),k=Math.max(1,Math.round(al.length/LUNCH.lad.size)),gs=[];
  for(let i=0;i<k;i++)gs.push([]);al.forEach((a,i)=>gs[i%k].push(a));
  L.groups=gs.map((m,gi)=>{const n=m.length,rungs=[];
    for(let r=0;r<LUNCH.lad.rows;r++){let i=0;while(i<n-1){if(Math.random()<.5){rungs.push([r,i]);i+=2;}else i++;}}
    for(const a of m){a.lad=gi;stand(a);a.chan=null;a.wc=null;}
    return{ids:m.map(a=>a.id),lane:m.map(()=>null),pay:Math.floor(Math.random()*n),rungs,payer:null};});
}
/* i<0: any free lane (bots, and whoever hasn't picked when time is up) */
function pickLane(a,i){
  const L=G.lunch;if(!L||L.kind!=='ladder'||L.phase!=='pick'||a.lad==null)return false;
  const g=L.groups[a.lad];if(!g)return false;
  if(i<0){if(g.lane.includes(a.id))return false;const free=g.lane.map((v,j)=>v==null?j:-1).filter(j=>j>=0);if(!free.length)return false;i=pick(free);}
  if(!(i>=0&&i<g.lane.length)||g.lane[i]!=null)return false;
  const old=g.lane.indexOf(a.id);if(old>=0)g.lane[old]=null;g.lane[i]=a.id;return true;
}
function ladderEnd(g,i){for(let r=0;r<LUNCH.lad.rows;r++){if(g.rungs.some(([R,c])=>R===r&&c===i))i++;else if(g.rungs.some(([R,c])=>R===r&&c===i-1))i--;}return i;}
function showCine(t,sub,dur=1.6){UI.cine(t,sub,dur);}
function arrive(a,f,padKey){
  const p=PADS[padKey];a.f=f;a.x=p.x+rnd(-20,20);a.y=p.y-34-rnd(0,18);a.path=[];a.goal=null;a.mode='idle';a.target=null;a.transit=null;a.inv=1.5;a.vx=a.vy=0;
  a.maxF=Math.max(a.maxF,f);
  if(a.isPlayer)UI.snapCam(a); // the map and status strip already say where I am
}
function moveActor(a,vx,vy,dt){
  a.x+=vx*dt;a.y+=vy*dt;
  for(const o of obsOf(a.f)){
    const nx=Math.max(o.x,Math.min(a.x,o.x+o.w)),ny=Math.max(o.y,Math.min(a.y,o.y+o.h));
    const dx=a.x-nx,dy=a.y-ny,d2=dx*dx+dy*dy;
    if(d2<R*R){
      if(d2>1e-4){const d=Math.sqrt(d2);a.x=nx+dx/d*R;a.y=ny+dy/d*R;}
      else{const l=a.x-o.x,r=o.x+o.w-a.x,t=a.y-o.y,bt=o.y+o.h-a.y,m=Math.min(l,r,t,bt);
        if(m===l)a.x=o.x-R;else if(m===r)a.x=o.x+o.w+R;else if(m===t)a.y=o.y-R;else a.y=o.y+o.h+R;}
    }
  }
  a.x=Math.max(R,Math.min(FW-R,a.x));a.y=Math.max(R,Math.min(FH-R,a.y));
}
const spd=a=>a.speed*(a.speedT>0?1.45:1)*(a.slowT>0?.5:1)*(a.sprint?1.5:1);
const onWet=a=>a.slipT>0||!a.cleanFriend&&G.wet.some(w=>w.f===a.f&&Math.hypot(w.x-a.x,w.y-a.y)<34);
function drive(a,dx,dy,dt){
  const s=spd(a),tx=dx*s,ty=dy*s;
  if(onWet(a)){const k=Math.min(1,dt*1.6);a.vx+=(tx-a.vx)*k;a.vy+=(ty-a.vy)*k;}else{a.vx=tx;a.vy=ty;}
  moveActor(a,a.vx,a.vy,dt);
}
function openDoor(a){
  const d=G.doors[a.f];if(!d||!d.v)return;const v=d.v;d.v=null;d.cd=rnd(18,32);
  if(v.type!=='sales')worked(a);
  if(v.type==='cleaner'){gain(a,4);a.cleanFriend=true;pop(a.f,a.x,a.y-40,'청소 아주머니 +4','#2f7d4f');tell(a,'청소 아주머니였다 +4 · 이제 젖은 바닥에서 안 미끄러짐');}
  else if(v.type==='courier'){spawnItem(a.f,null,{x:DOOR.x+rnd(-30,30),y:DOOR.y-40});pop(a.f,a.x,a.y-40,'택배 도착','#2f7d4f');tell(a,'택배 기사였다: 아이템 상자');}
  else if(v.type==='sales'){dmg(a,4,'sales');a.lockT=3;a.lockWhy='영업 당하는 중';say({f:a.f,x:DOOR.x,y:DOOR.y-30},'잠깐 설명 좀 드릴게요…','#cf3626');pop(a.f,a.x,a.y-40,'-4','#cf3626');tell(a,'영업사원이었다 -4 · 3초 붙잡힘',true);}
  else if(v.type==='interview'){gain(a,6);pop(a.f,a.x,a.y-40,'면접자 안내 +6','#2f7d4f');tell(a,'면접자를 안내했다 +6');}
}
function submitTask(a,t){
  if(!G.tasks.includes(t))return;
  if(t.by&&t.by!==a)return;
  const dbl=warnFloor(t.f)?2:1,v=t.reward*dbl;jobDone(a,'dev');gain(a,v);a.lastTaskT=G.t;a.tasksDone++;worked(a);
  pop(a.f,a.x,a.y-30,`+${v} ${t.name}${dbl>1?' (막판 실적 x2)':''}`,'#2f7d4f');
  if(TASK_GAP(t.f))G.respawn.push({f:t.f,at:G.t+TASK_GAP(t.f)});
  if(Math.random()<.3&&a.docs<2){a.docs++;tell(a,'결재 서류 획득: 부장님 근처에서 결재 올리기 +8');}
  G.tasks.splice(G.tasks.indexOf(t),1);
}
function inTaskRange(a,t){if(!a.alive||a.f!==t.f||a.transit)return false;return t.zone?inRect(a,t.zone):Math.hypot(a.x-t.x,a.y-t.y)<t.r;}
/* ================= desk work: sitting at your own desk turns into a short monitor mini-game =================
   Nobody can touch you while you work, but 고과 only comes from rounds you clear. Each round is a key sequence
   (U/D/L/R) to type before the timer runs out; the rules hold the sequence so the server can check it. */
const DESK={rounds:3,len:[4,5,6],rew:[4,5,6],cd:30,gap:.7,
  jobs:['메일 답장','보고서 결재','엑셀 정리','기안 작성','회의록 정리','경비 처리']};
const DESK_BOT={easy:.55,normal:.7,hard:.85};
function deskRound(a){
  const d=a.desk,n=DESK.len[d.round];
  d.seq=Array.from({length:n},()=>'UDLR'[Math.floor(Math.random()*4)]).join('');d.pos=0;d.max=d.t=1.1+n*.35;d.job=pick(DESK.jobs);d.wait=0;
  if(!a.isPlayer)d.botAt=rnd(1.4,d.max*.85);
}
function startDesk(a){if(a.desk||a.deskCd>0)return;a.desk={round:0,ok:0,gain:0,res:'',resT:0,seq:'',pos:0,t:0,max:1,job:'',wait:.9};a.working=true;} // first round after the camera settles
function endDesk(a){
  const d=a.desk;if(!d)return;a.desk=null;a.working=false;a.deskCd=DESK.cd;
  tell(a,`자리 근무 끝: ${d.ok}/${DESK.rounds} 성공${d.gain?` · 고과 +${d.gain}`:''} · ${DESK.cd}초 뒤 다시 가능`);
}
function deskDone(a,ok){
  const d=a.desk,r=DESK.rew[d.round];
  if(ok){jobDone(a,'dev');d.ok++;d.gain+=r;gain(a,r);pop(a.f,a.x,a.y-30,`+${r} ${d.job}`,'#2f7d4f');}
  d.res=ok?'ok':'bad';d.resT=G.t;d.round++;d.wait=DESK.gap;d.seq='';
}
function deskKey(a,k){
  const d=a.desk;if(!d||d.wait>0||!d.seq||!'UDLR'.includes(k))return;
  if(d.seq[d.pos]===k){d.pos++;if(d.pos>=d.seq.length)deskDone(a,true);}else deskDone(a,false);
}
function deskStepA(a,dt){
  const d=a.desk;
  if(!a.sit||a.sit.owner!==a){a.desk=null;a.working=false;return;}
  if(warnFloor(a.f)){tell(a,'곧 폐쇄되는 층: 자리에서 일어났다',true);stand(a);return;}
  if(d.wait>0){d.wait-=dt;if(d.wait<=0){if(d.round>=DESK.rounds){stand(a);return;}deskRound(a);}return;}
  d.t-=dt;
  if(!a.isPlayer&&d.max-d.t>=d.botAt){deskDone(a,Math.random()<(DESK_BOT[G.diff]||.8));return;}
  if(d.t<=0)deskDone(a,false);
}
/* ================= 화캉스: the toilet stall's phone game =================
   Sit on the toilet and a coin chart starts climbing. Cash out (E) whenever you like: the longer you hold, the
   bigger the payout, but it crashes at a random moment (-3). One round per visit, then the phone needs a rest.
   You are in the restroom, so nobody can hit you meanwhile; the restroom's 10 s rule still applies. */
const WC={cd:40,max:6,crash:3,wait:1.3};
const wcMult=t=>1+t*.45+t*t*.09;                       // the chart: ×1 at the start, about ×4 at 4 s
const wcGain=m=>Math.min(12,Math.round(1.5+(m-1)*3));  // +4 at ×1.8, +7 at ×2.8, capped at +12
const wcSpot=a=>a.f>=0&&a.f!==ROOF?FLOORS[a.f].spots.toilet:null;
function startWc(a){
  const sp=wcSpot(a);if(!sp||a.wc||a.wcCd>0||a.sit||G.actors.some(o=>o!==a&&o.wc&&o.f===a.f))return false;
  a.x=sp.x;a.y=sp.y;a.vx=a.vy=0;a.path=[];a.face=Math.PI/2;
  a.wc={t:0,crashAt:1.2-Math.log(1-Math.random())*2.8,res:'',resT:0,gain:0,end:0};return true;
}
function wcDone(a,res){const w=a.wc;w.res=res;w.resT=G.t;w.end=G.t+WC.wait;
  if(res==='cash'){w.gain=wcGain(wcMult(w.t));gain(a,w.gain);pop(a.f,a.x,a.y-30,`+${w.gain} 익절!`,'#2f7d4f');}
  else if(res==='crash'){dmg(a,WC.crash,'wc');pop(a.f,a.x,a.y-30,`폭락 -${WC.crash}`,'#cf3626');}}
function cashWc(a){if(a.wc&&!a.wc.res)wcDone(a,'cash');}
function endWc(a){if(!a.wc)return;const w=a.wc;a.wc=null;if(w.res)a.wcCd=WC.cd;}
function wcStep(a,dt){
  const w=a.wc,sp=wcSpot(a);if(!sp||!a.inRest){a.wc=null;return;}
  a.x=sp.x;a.y=sp.y;
  if(w.res){if(G.t>=w.end)endWc(a);return;}
  w.t+=dt;if(w.t>=w.crashAt)wcDone(a,'crash');else if(w.t>=WC.max)wcDone(a,'cash');
}
/* ================= player commands (shared by the browser and the room server) ================= */
function useFloor(a,dir){if(a.sit)return;const p=padOf(a);if(!a.alive||!p)return;if(startChan(a,p,dir))tell(a,`${PADS[p].n} → ${FLOORS[a.f+dir].name}`);}
function chooseBranch(a,k){if(!a||!BRANCH[k]||a.branch)return;a.branch=k;a.branchAsk=0;
  tell(a,`${teamShort(k)}팀 발령!`);pop(a.f,a.x,a.y-44,`${teamShort(k)}팀 발령`,BRANCH[k].c);}
/* teams: while an intern, what you do is counted (tasks → 개발, papers that land → 마케팅, dealing with bosses and
   colleagues → 인사); at the 사원 promotion the most-done one is your team. Weights even out how often each comes up */
const JOB_W={dev:1,mkt:.5,hr:1.5};
function jobDone(a,k){if(a&&!a.branch&&a.alive&&a.jobs)a.jobs[k]++;}
/* the team the counts point to right now (null while nothing is counted); ties go to the first in TEAMS */
function leadTeam(a){const j=a.jobs;if(!j)return null;let best=0,k=null;for(const t of TEAMS){const v=(j[t]||0)*JOB_W[t];if(v>best){best=v;k=t;}}return k;}
function assignTeam(a){
  if(a.branch)return;const j=a.jobs||{};let best=0,ks=[];
  for(const t of TEAMS){const v=(j[t]||0)*JOB_W[t];if(v>best+1e-9){best=v;ks=[t];}else if(v>0&&Math.abs(v-best)<1e-9)ks.push(t);}
  chooseBranch(a,pick(ks.length?ks:TEAMS)); // nothing counted: just a team
}
function callOptions(a){return[{key:'greet',t:'인사',s:'죄송합니다!'},a.docs>0?{key:'doc',t:'결재 요청',s:'여기 있습니다'}:{key:'report',t:'보고',s:'진행 중입니다'},{key:'busy',t:'바쁜 척',s:'타닥타닥'}];}
/* What E / the action button does right now for actor me: {label, cls, fn} or null. */
function contextAction(me){
  if(!me.alive||me.f<0||me.transit||locked(me)||me.chan)return null;
  if(me.f===ROOF&&roofLunch())return me.smokeCd>0?{label:`담배 ${Math.ceil(me.smokeCd)}초`,cls:'off',fn:()=>{}}:{label:'담배 피우기 (연막)',cls:'go',fn:()=>smoke(me)};
  if(me.wc)return me.wc.res?null:{label:`익절! +${wcGain(wcMult(me.wc.t))}`,cls:'hot',fn:()=>cashWc(me)};
  if(me.contact)return{label:`${bossTitle(me.contact.n)}께 인사!`,cls:'hot',fn:()=>greet(me)};
  if(me.quest)return{label:'신입 질문 답해주기 +2',cls:'hot',fn:()=>answerQuest(me)};
  if(!me.errand){const n=G.npcs.find(n=>n.kind==='desk'&&n.ask&&n.f===me.f&&dist(n,me)<70);if(n)return{label:`부탁 들어주기 +${n.job.r}`,cls:'go',fn:()=>acceptErrand(me,n)};}
  if(me.docs>0){const n=watchers(me).find(n=>dist(n,me)<150);if(n)return{label:'결재 올리기 +8',cls:'ready',fn:()=>submitDoc(me,n)};}
  const rt=G.tasks.find(t=>t.ready&&t.by===me&&inTaskRange(me,t));
  if(rt)return{label:`제출 +${rt.reward*(warnFloor(rt.f)?2:1)}`,cls:'ready',fn:()=>submitTask(me,rt)};
  const d=G.doors[me.f];
  if(d&&d.v&&dist(me,DOOR)<64)return{label:'문 열기',cls:'go',fn:()=>openDoor(me)};
  const rd=nearDoor(me);
  if(rd&&!me.sit)return{label:rd.open?`${rd.name} 닫기`:`${rd.name} 열기`,cls:rd.open?'':'go',fn:()=>{if(!toggleDoor(me.f,rd,!rd.open))tell(me,'문 앞에 사람이 있어 못 닫습니다');}};
  const pad=padOf(me);
  /* lunch on the roof: one press from anywhere in the building takes you up (no walking to the stairs first) */
  if(!me.sit&&!me.desk&&me.f>=0&&me.f!==ROOF&&roofLunch()&&G.lunch.t>3)return{label:'옥상으로 (점심시간)',cls:'hot',fn:()=>goRoof(me)};
  if(pad&&!me.sit){const up=me.f+1,dn=me.f-1;
    if(up<NF&&isOpen(up))return{label:`▲ ${FLOORS[up].short}로`,cls:'go',fn:()=>useFloor(me,1)};
    if(dn>=0&&isOpen(dn))return{label:`▼ ${FLOORS[dn].short}로`,cls:'',fn:()=>useFloor(me,-1)};
    if(up<NF)return{label:`${FLOORS[up].short} 잠김`,cls:'',fn:()=>useFloor(me,1)};}
  if(me.sit)return{label:me.desk?'일어나기 (근무 끝)':'일어나기',cls:'',fn:()=>stand(me)};
  {const sp=wcSpot(me);if(sp&&me.inRest&&dist(me,sp)<48){
    /* cls 'off': shown greyed out, the button and E do nothing */
    if(G.actors.some(o=>o!==me&&o.wc&&o.f===me.f))return{label:'변기 사용 중',cls:'off',fn:()=>{}};
    return me.wcCd>0?{label:`폰 충전 중 · ${Math.ceil(me.wcCd)}초`,cls:'off',fn:()=>{}}:{label:'화캉스하기',cls:'go',fn:()=>startWc(me)};}}
  const own=me.seats[me.f];
  if(own&&dist(me,own)<40&&!own.occ){
    if(me.deskCd>0)return{label:`내 자리 · ${Math.ceil(me.deskCd)}초 뒤 근무 가능`,cls:'',fn:()=>tell(me,`방금 근무했어요. ${Math.ceil(me.deskCd)}초 뒤에 다시 앉을 수 있어요`)};
    if(warnFloor(me.f))return{label:'폐쇄 직전: 자리 근무 불가',cls:'',fn:()=>tell(me,'곧 폐쇄되는 층이에요. 위층으로!',true)};
    return{label:'내 자리 근무 (모니터 업무)',cls:'go',fn:()=>{if(sit(me,own))tell(me,'자리 근무: 모니터 업무를 성공하면 고과 +');}};}
  const other=FLOORS[me.f].seats.find(s=>s!==own&&!s.occ&&!s.npc&&dist(me,s)<22);
  if(other&&other.bench)return{label:'식탁에 앉기',cls:'',fn:()=>{if(sit(me,other))tell(me,'옥상 식탁에 앉았다 · 움직이면 일어나요');}};
  if(other)return{label:'남의 자리에 앉기',cls:'',fn:()=>{if(sit(me,other))tell(me,`${other.owner?other.owner.name+'님':'빈'} 자리: 회복 없음`);}};
  const cl=G.npcs.find(n=>n.kind==='cleaner'&&n.f===me.f&&npcActive(n)&&dist(n,me)<80);
  if(cl&&me.cleanCd<=0)return{label:'아주머니께 인사 (정보)',cls:'',fn:()=>greet(me)};
  return null;
}
function interact(a){if(!a.alive||a.f<0||locked(a)||a.chan)return;const act=contextAction(a);if(act&&act.cls!=='off')act.fn();}
