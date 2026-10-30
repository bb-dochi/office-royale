/* ================= events ================= */
const AREAS=[['회의실 앞',a=>a.meet.length?{x:a.meet[0].x-30,y:a.meet[0].y+a.meet[0].h/2}:null],['탕비실',a=>({x:K(930),y:K(150)})],['복사실',a=>({x:K(110),y:K(400)})],['엘리베이터 홀',a=>({x:K(960),y:K(640)})]];
function prepEvent(ev){
  if(ev.kind==='ceo'){
    const opts=[];for(let f=G.closed;f<=topOpen();f++)if(!(warnFloor(f)))opts.push(f);
    ev.f=pick(opts.length?opts:[topOpen()]);const fl=FLOORS[ev.f];
    const ar=AREAS.map(([n,fn])=>[n,fn(fl)]).filter(x=>x[1]);const[an,ap]=pick(ar);ev.area={name:an,p:ap};
    notice(`10초 뒤 대표님 방문 · ${fl.short} ${an}`,10);
  }else{
    const opts=[];for(let f=G.closed;f<=topOpen();f++)opts.push(f);ev.f=pick(opts);
    const fn=FLOORS[ev.f].name;
    const fs=FLOORS[ev.f].short;
    const msg={blackout:`5초 뒤 ${fs} 정전 (10초)`,cake:`5초 뒤 ${fs} 탕비실에 생일 케이크`,
      fire:'5초 뒤 소방 훈련 · 엘리베이터 15초 정지',lunch:`10초 뒤 점심시간 · ${LUNCH_INFO[G.lunchKind||'lighter'].n}`,audit:`5초 뒤 ${fs} 감사 · 20초 아이템 금지`,star:'5초 뒤 이달의 우수사원 발표'}[ev.kind];
    notice(msg,5);
  }
}
function fireEvent(ev){
  if(ev.kind==='ceo'){
    if(!isOpen(ev.f)){ev.f=topOpen();}
    const p=ev.area.p,s=randFree(ev.f);const pos=Math.hypot(s.x-p.x,s.y-p.y)<200?s:{x:p.x,y:p.y};
    const n=mkNpc('ceo',ev.f,pos.x,pos.y);n.area=p;n.t=30;G.ceo=n;G.npcs.push(n);
    feed(`대표님이 ${FLOORS[ev.f].name}에 오셨습니다 (30초)`,true);
  }else if(ev.kind==='blackout'){if(isOpen(ev.f)){G.blackout={f:ev.f,t:10};feed(`${FLOORS[ev.f].name} 정전! 부장님도 안 보입니다`,true);}}
  else if(ev.kind==='cake'){if(isOpen(ev.f)){G.cake={f:ev.f,x:K(950),y:K(110)};feed(`${FLOORS[ev.f].name} 탕비실에 생일 케이크 도착`);}}
  else if(ev.kind==='lunch')startLunch();
  else if(ev.kind==='fire'){G.fire=15;feed('소방 훈련 시작: 엘리베이터 정지 15초',true);}
  else if(ev.kind==='audit'){if(isOpen(ev.f)){G.audit={f:ev.f,t:20};feed(`감사팀 감사 시작: ${FLOORS[ev.f].name} 아이템 사용 금지`,true);}}
  else if(ev.kind==='star'){const l=leader();if(l){G.star={a:l,t:10};feed(v=>`이달의 우수사원: ${l===v?'나':l.name} (${FLOORS[Math.max(0,l.f)].short}) · 10초간 위치 공개`,true);}}
}
function updEvents(dt){
  for(const ev of G.events){
    const lead=ev.kind==='ceo'||ev.kind==='lunch'?10:5;
    if(ev.stage===0&&G.t>=ev.at-lead){ev.stage=1;prepEvent(ev);}
    else if(ev.stage===1&&G.t>=ev.at){ev.stage=2;fireEvent(ev);}
  }
  if(G.ceo){G.ceo.t-=dt;if(G.ceo.t<=0||!isOpen(G.ceo.f)){G.npcs.splice(G.npcs.indexOf(G.ceo),1);for(const a of G.actors)if(a.contact&&a.contact.n===G.ceo)a.contact=null;G.ceo=null;feed('대표님께서 나가셨습니다');}}
  if(G.lunch){const L=G.lunch;L.t-=dt;if(L.kind==='ladder')ladderStep(L,dt);else roofStep(L,dt);}
  if(G.blackout){G.blackout.t-=dt;if(G.blackout.t<=0)G.blackout=null;}
  if(G.fire>0){G.fire-=dt;if(G.fire<=0)feed('소방 훈련 종료: 엘리베이터 운행 재개');}
  if(G.audit){G.audit.t-=dt;if(G.audit.t<=0)G.audit=null;}
  if(G.star){G.star.t-=dt;if(G.star.t<=0)G.star=null;}
  if(G.cake){const a=alive().find(a=>a.f===G.cake.f&&Math.hypot(a.x-G.cake.x,a.y-G.cake.y)<30);if(a){gain(a,8);pop(a.f,a.x,a.y-34,'생일 케이크 +8','#2f7d4f');feed(v=>`${a===v?'내가':a.name+'님이'} 케이크를 먹었다`);G.cake=null;}else if(!isOpen(G.cake.f))G.cake=null;}
  if(G.notice){G.notice.t-=dt;if(G.notice.t<=0){G.notice=null;UI.noticeEnd();}}
}
/* ================= lunch (see the lunch notes in 50-actions) ================= */
/* 특식 counter: a random open spot on the roof (2026-10-30, was always the same two). Most of the ring has to be clear
   floor, it isn't on top of a stair exit, and the second one is well away from the first */
function mealSpot(from){const bl=FLOORS[ROOF].blocked,r=LUNCH.meal.r,ex=[{x:K(135),y:K(380)},{x:K(965),y:K(380)}];
  for(let i=0;i<200;i++){const p=randFree(ROOF,r+40);
    if(ex.some(e=>dist(p,e)<r+90)||(from&&dist(p,from)<K(300)))continue;
    let ok=0;for(let k=0;k<8;k++){const a=k*Math.PI/4,[gx,gy]=cellOf(p.x+Math.cos(a)*r*.7,p.y+Math.sin(a)*r*.7);if(!bl[gy*GW+gx])ok++;}
    if(ok>=7)return p;}
  return{...LUNCH.meal.spots[from?1:0]};}
function startLunch(){
  const kind=G.lunchKind||'lighter',I=LUNCH_INFO[kind];
  for(const a of G.actors){a.bill=false;a.billFrom=null;a.meal=0;a.lad=null;}
  if(kind==='ladder'){G.lunch={kind,t:LUNCH.lad.pick+LUNCH.lad.show+2,phase:'pick'};startLadder(G.lunch);
    showCine('점심시간!',I.s,1.6);feed('점심 커피 내기: 사다리 번호를 고르세요',true);return;}
  G.lunch={kind,t:30,dropT:.5,score:{L:0,R:0}};
  if(kind==='meal'){G.lunch.spot=0;G.lunch.zone=mealSpot(null);G.lunch.crowd=0;}
  G.airdrops=[];G.smokes=[];for(const b of G.actors)if(!b.isPlayer){b.lunchGo=Math.random()<(kind==='lighter'?.7:.75);}
  showCine('점심시간!',I.s,2);feed('점심시간: 업무·구조조정 일시정지 · 층엔 비품 보급 없이 부장님만 순찰',true);
}
const roofTell=(msg,hot)=>{for(const h of humans())if(h.alive&&h.f===ROOF)tell(h,msg,hot);};
function roofStep(L,dt){
  const up=alive().filter(a=>a.f===ROOF);L.dropT-=dt;
  if(L.dropT<=0){const lit=L.kind==='lighter',p=randFree(ROOF,80),r=Math.random();L.dropT=lit?rnd(1.1,1.8):rnd(2,3);
    G.airdrops.push({x:p.x,y:p.y,t:0,k:lit?(r<.7?'lighter':r<.85?'food':randItem()):(r<.3?'food':randItem())});}
  /* nobody is fired at lunch (고과 floor) */
  for(const a of up)if(a.g<LUNCH.floor)a.g=LUNCH.floor;
  if(L.kind==='lighter'){ /* lighters delivered to your own ashtray score */
    for(const a of up)if(a.lighter>0&&a.side&&ashOf(a.side).some(p=>Math.hypot(p.x-a.x,p.y-a.y)<K(46))){L.score[a.side]+=a.lighter;pop(ROOF,a.x,a.y-34,`불 붙임 +${a.lighter}`,'#e0603d');
      tell(a,`${teamOf(a.side)} +${a.lighter}점`);a.lighter=0;}}
  else if(L.kind==='bill'){ /* the bills go round once most people are up */
    if(!L.dealt&&L.t<=22){L.dealt=true;const n=up.length<2?0:Math.max(1,Math.round(up.length/4));
      for(const a of up.slice().sort(()=>Math.random()-.5).slice(0,n)){a.bill=true;a.hadBill=true;a.billT=G.t;pop(ROOF,a.x,a.y-54,'계산서 받음!','#cf3626');tell(a,'계산서를 받았다! 서류로 다른 사람을 맞혀 넘기세요',true);}
      if(n)roofTell(`계산서 ${n}장이 돌기 시작했다 · 끝날 때 들고 있으면 점심 쏨`,true);}}
  else if(L.kind==='meal'){
    if(L.spot===0&&L.t<=15){L.spot=1;L.zone=mealSpot(L.zone);roofTell('배식대가 옮겨졌다!',true);}
    /* everyone in the ring shares the counter: alone it fills twice as fast, in a crowd it crawls */
    const inz=up.filter(a=>Math.hypot(a.x-L.zone.x,a.y-L.zone.y)<LUNCH.meal.r);L.crowd=inz.length;
    for(const a of inz)a.meal+=dt*(inz.length===1?2:1/inz.length);}
  for(const s of G.smokes)s.t+=dt;G.smokes=G.smokes.filter(s=>s.t<s.life);
  for(const d of G.airdrops)d.t+=dt;
  for(const d of G.airdrops.filter(d=>d.t>=1.2)){spawnItem(ROOF,d.k,d);for(const a of up)if(Math.hypot(a.x-d.x,a.y-d.y)<24){dmg(a,3,'drop');pop(ROOF,a.x,a.y-30,'택배 상자에 맞음 -3','#cf3626');}}
  G.airdrops=G.airdrops.filter(d=>d.t<1.2);
  if(L.t<=0)endRoofLunch(L,up);
}
function endRoofLunch(L,up){
  let sub=()=>'';
  if(L.kind==='lighter'){
    /* the team with more lighters lit wins 고과 (whoever of them is still standing); 고과 lost up here is not given back */
    const{L:l,R:r}=L.score,win=l>r?'L':r>l?'R':null;
    for(const a of alive())if(a.side&&a.side===win){gain(a,LUNCH.win);a.lunchWin=true;tell(a,`${teamOf(win)} 승리! 고과 +${LUNCH.win}`);}
    sub=()=>win?`${teamOf(win)} 승리 · 라이터 ${l} : ${r}`:`무승부 · 라이터 ${l} : ${r}`;
  }else if(L.kind==='bill'){
    const pay=up.filter(a=>a.bill);
    for(const a of up)if(a.hadBill&&!a.bill)a.lunchWin=true;   // got a bill and passed it on: a lunch won (성과)
    for(const a of up){if(a.bill){a.g=Math.max(1,a.g-LUNCH.bill.pay);pop(ROOF,a.x,a.y-34,`점심 쏨 -${LUNCH.bill.pay}`,'#cf3626');tell(a,`계산서를 들고 끝났다: 오늘 점심은 내가 쏜다 -${LUNCH.bill.pay}`,true);}
      else if(pay.length){gain(a,LUNCH.bill.treat,true);pop(ROOF,a.x,a.y-34,`얻어먹음 +${LUNCH.bill.treat}`,'#2f7d4f');}}
    sub=v=>pay.length?`오늘 점심은 ${pay.map(a=>a===v?'나':a.name+'님').join(', ')}이 쏩니다`:'계산서 없이 끝';
  }else if(L.kind==='meal'){
    const top=up.filter(a=>a.meal>=.3).sort((p,q)=>q.meal-p.meal).slice(0,3);
    if(top[0])top[0].lunchWin=true;   // 특식 1등 (성과)
    top.forEach((a,i)=>{const n=LUNCH.meal.prize[i];gain(a,n);pop(ROOF,a.x,a.y-34,`특식 ${i+1}등 +${n}`,'#2f7d4f');tell(a,`특식 ${i+1}등! 고과 +${n}`,true);});
    sub=v=>top.length?top.map((a,i)=>`${i+1}등 ${a===v?'나':a.name}`).join(' · '):'아무도 특식을 못 먹었다';
  }
  G.lunch=null;G.airdrops=[];G.smokes=[];G.items=G.items.filter(i=>i.f!==ROOF);G.traps=G.traps.filter(t=>t.f!==ROOF);
  for(const a of G.actors){a.bill=false;if(!a.alive)continue;const back=isOpen(a.preLunchF)?a.preLunchF:G.closed;if(a.transit&&a.transit.to===ROOF)a.transit.to=back;
    if(a.f===ROOF){stand(a);a.side=null;a.lighter=0;arrive(a,back,a.roofPad||'elev');}}
  for(const h of humans())UI.cine('점심시간 끝',sub(h),1.8,h);
  feed('점심시간 끝: 옥상 인원은 원래 있던 층으로 복귀',true);
}
/* ladder: everyone is held in place (and can't be hurt) until it's done */
function ladderStep(L,dt){
  const S=LUNCH.lad,ins=alive().filter(a=>a.lad!=null);
  for(const a of ins){if(a.sit||a.desk)stand(a);a.chan=null;a.wc=null;a.lockT=Math.max(a.lockT,.2);a.lockWhy='사다리타기';a.inv=Math.max(a.inv,.2);a.vx=a.vy=0;}
  if(L.phase==='pick'){
    /* once every person has picked, the bots hurry (about 4 a second), and the moment everyone has a lane it's revealed (2026-10-30) */
    const picked=a=>L.groups[a.lad]&&L.groups[a.lad].lane.includes(a.id),rush=ins.filter(a=>a.isPlayer).every(picked);
    for(const a of ins)if(!a.isPlayer&&Math.random()<dt*(rush?4:.6))pickLane(a,-1);
    if(L.t>S.show+2&&ins.every(picked))L.t=S.show+2;
    if(L.t<=S.show+2){for(const a of ins)pickLane(a,-1);L.phase='show';}
  }else if(L.phase==='show'&&L.t<=2){L.phase='done';
    for(const g of L.groups){if(g.ids.length<2)continue;
      g.lane.forEach((id,j)=>{if(id!=null&&ladderEnd(g,j)===g.pay)g.payer=id;});
      const payer=G.actors.find(a=>a.id===g.payer);
      for(const id of g.ids){const a=G.actors.find(a=>a.id===id);if(!a||!a.alive)continue;
        if(a===payer){a.g=Math.max(1,a.g-S.pay);pop(a.f,a.x,a.y-34,`커피 쏨 -${S.pay}`,'#cf3626');tell(a,`☕ 내가 커피 쏜다! 고과 -${S.pay}`,true);}
        else{gain(a,S.treat,true);pop(a.f,a.x,a.y-34,`커피 얻어먹음 +${S.treat}`,'#7a4b2a');if(payer)tell(a,`☕ ${payer.name}님이 커피 쏩니다 · 회복 +${S.treat}`);}}}
  }
  if(L.t<=0){G.lunch=null;for(const a of G.actors)a.lad=null;feed('점심시간 끝: 업무 복귀',true);}
}
