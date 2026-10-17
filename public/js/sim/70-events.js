/* ================= events ================= */
const AREAS=[['회의실 앞',a=>a.meet.length?{x:a.meet[0].x-30,y:a.meet[0].y+a.meet[0].h/2}:null],['탕비실',a=>({x:K(930),y:K(150)})],['복사실',a=>({x:K(110),y:K(400)})],['엘리베이터 홀',a=>({x:K(960),y:K(640)})]];
function prepEvent(ev){
  if(ev.kind==='ceo'){
    const opts=[];for(let f=G.closed;f<=topOpen();f++)if(!(warnFloor(f)))opts.push(f);
    ev.f=pick(opts.length?opts:[topOpen()]);const fl=FLOORS[ev.f];
    const ar=AREAS.map(([n,fn])=>[n,fn(fl)]).filter(x=>x[1]);const[an,ap]=pick(ar);ev.area={name:an,p:ap};
    notice(`10초 후 대표님이 ${fl.name} ${an} 쪽으로 오십니다.`,10);
  }else{
    const opts=[];for(let f=G.closed;f<=topOpen();f++)opts.push(f);ev.f=pick(opts);
    const fn=FLOORS[ev.f].name;
    const msg={blackout:`5초 후 ${fn} 전기 점검으로 10초간 정전됩니다.`,cake:`5초 후 ${fn} 탕비실에 생일 케이크가 도착합니다. 먼저 드세요!`,
      fire:'5초 후 소방 훈련: 15초간 엘리베이터 운행이 멈춥니다.',lunch:'10초 후 점심시간! 계단·엘리베이터에서 바로 옥상으로 갈 수 있습니다. <흡연 동맹 난투전>',audit:`5초 후 감사팀이 ${fn}을 20초간 감사합니다. 아이템 사용 금지.`,star:'5초 후 이달의 우수사원을 발표합니다.'}[ev.kind];
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
  else if(ev.kind==='lunch'){G.lunch={t:30,dropT:.5};G.airdrops=[];for(const b of G.actors)if(!b.isPlayer){b.lunchGo=Math.random()<.7;b.lunchPad=Math.random()<.5?'stair':'elev';}
    showCine('점심시간!','부장님 식사 중 · 옥상에서 흡연 동맹 난투전',2);feed('점심시간: 부장님 부재 · 업무·구조조정 일시정지',true);}
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
  if(G.ceo){G.ceo.t-=dt;if(G.ceo.t<=0||!isOpen(G.ceo.f)){G.npcs.splice(G.npcs.indexOf(G.ceo),1);for(const a of G.actors)if(a.contact&&a.contact.n===G.ceo)a.contact=null;G.ceo=null;feed('대표님이 돌아가셨습니다');}}
  if(G.lunch){const L=G.lunch;L.t-=dt;L.dropT-=dt;
    if(L.dropT<=0){L.dropT=rnd(1.6,2.6);const p=randFree(ROOF,80);G.airdrops.push({x:p.x,y:p.y,t:0,k:Math.random()<.55?'food':randItem()});}
    for(const d of G.airdrops)d.t+=dt;
    for(const d of G.airdrops.filter(d=>d.t>=1.2)){spawnItem(ROOF,d.k,d);for(const a of alive())if(a.f===ROOF&&Math.hypot(a.x-d.x,a.y-d.y)<24){dmg(a,3,'drop');pop(ROOF,a.x,a.y-30,'택배 상자에 맞음 -3','#cf3626');}}
    G.airdrops=G.airdrops.filter(d=>d.t<1.2);
    if(L.t<=0){G.lunch=null;G.airdrops=[];G.items=G.items.filter(i=>i.f!==ROOF);G.traps=G.traps.filter(t=>t.f!==ROOF);
      for(const a of G.actors){if(!a.alive)continue;const back=isOpen(a.preLunchF)?a.preLunchF:G.closed;if(a.transit&&a.transit.to===ROOF)a.transit.to=back;
        if(a.f===ROOF){const pk=a.side==='L'?'stair':'elev';a.side=null;if(a.preLunchG!=null&&a.g<a.preLunchG){a.g=a.preLunchG;tell(a,'점심 동안 깎인 고과 복구');}arrive(a,back,pk);}}
      showCine('점심시간 끝','모두 업무 복귀',1.4);feed('점심시간 끝: 옥상 인원은 원래 있던 층으로 복귀',true);}}
  if(G.blackout){G.blackout.t-=dt;if(G.blackout.t<=0)G.blackout=null;}
  if(G.fire>0){G.fire-=dt;if(G.fire<=0)feed('소방 훈련 종료: 엘리베이터 운행 재개');}
  if(G.audit){G.audit.t-=dt;if(G.audit.t<=0)G.audit=null;}
  if(G.star){G.star.t-=dt;if(G.star.t<=0)G.star=null;}
  if(G.cake){const a=alive().find(a=>a.f===G.cake.f&&Math.hypot(a.x-G.cake.x,a.y-G.cake.y)<30);if(a){gain(a,8);pop(a.f,a.x,a.y-34,'생일 케이크 +8','#2f7d4f');feed(v=>`${a===v?'내가':a.name+'님이'} 케이크를 먹었다`);G.cake=null;}else if(!isOpen(G.cake.f))G.cake=null;}
  if(G.notice){G.notice.t-=dt;if(G.notice.t<=0){G.notice=null;UI.noticeEnd();}}
}
