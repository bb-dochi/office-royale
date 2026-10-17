const aimOf=a=>a.isPlayer&&a.aim!=null?a.aim:autoAim(a);
/* ================= actions ================= */
function throwPaper(a,ang){
  if(a.cd>0||!a.alive||a.f<0||locked(a)||a.sit||a.chan)return false;
  const base=a.isPlayer?(G.final?.38:.6):(G.final?.8:1.5),staple=a.ammo>0;if(staple)a.ammo--;
  a.cd=base*(staple?.35:1);a.lastCd=a.cd;a.face=ang;a.cloakT=0;
  G.proj.push({f:a.f,x:a.x+Math.cos(ang)*(R+4),y:a.y+Math.sin(ang)*(R+4),ox:a.x,oy:a.y,dx:Math.cos(ang),dy:Math.sin(ang),d:0,o:a,spin:Math.random()*6,staple,sp:staple?720:560,rng:staple?300:340});
  if(staple&&a.ammo===0)tell(a,'스테이플러를 다 썼다');
  for(const n of watchers(a))if(!immune(a,n)&&sees(n,a)){caught(a,n,'act');break;}
  return true;
}
function visibleTo(a,o){
  if(o===a||!o.alive||o.f!==a.f||o.inRest)return false;
  if(o.cloakT>0&&dist(a,o)>40)return false;
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
const canTake=(a,k)=>!STORE.has(k)||a.items.length<1;
function useItem(a,i=0){
  const k=a.items[i];if(!k||!a.alive||a.f<0||locked(a))return false;
  a.items.splice(i,1);
  if(G.audit&&G.audit.f===a.f){dmg(a,5,'audit');pop(a.f,a.x,a.y-44,'감사팀: 압수 -5','#cf3626');tell(a,'감사팀에 아이템 압수 -5',true);return true;}
  return applyItem(a,k);
}
function applyItem(a,k){
  const it=ITEMS[k];
  const say=t=>pop(a.f,a.x,a.y-44,t,it.c);
  if(k==='stapler'){a.ammo=15;say('스테이플러 장전 15발');}
  else if(k==='stamp'){a.shieldN+=3;say('결재 도장 x3');}
  else if(k==='ticket'){a.speedT=8;say('야근 식권 사용');}
  else if(k==='vip'){a.vipT=10;say('임원 인맥 발동');}
  else if(k==='spill'){G.traps.push({f:a.f,x:a.x+Math.cos(a.face)*34,y:a.y+Math.sin(a.face)*34,o:a,t:0});say('커피를 쏟았다');}
  else if(k==='card'){let n=0;for(const o of G.actors)if(o!==a&&o.alive&&o.f===a.f&&dist(a,o)<200&&o.inv<=0&&!ally(a,o)){o.stunT=3;o.chan=null;stand(o);n++;pop(o.f,o.x,o.y-44,'회식 참석','#c08a1e');}say(n?`회식 소집 (${n}명)`:'아무도 안 옴');}
  else if(k==='bundle'){const ang=aimOf(a);G.proj.push({f:a.f,x:a.x+Math.cos(ang)*(R+4),y:a.y+Math.sin(ang)*(R+4),ox:a.x,oy:a.y,dx:Math.cos(ang),dy:Math.sin(ang),d:0,o:a,spin:0,bundle:true,sp:420,rng:260});a.cloakT=0;a.face=ang;
    say('서류 뭉치 투척!');for(const n of watchers(a))if(!immune(a,n)&&sees(n,a)){caught(a,n,'act');break;}}
  else if(k==='coffee'){gain(a,12);say('+12 커피');}
  if(k!=='coffee')tell(a,`${it.n} 사용`);
  return true;
}
function useSkill(a){
  if(!a.alive||a.f<0||locked(a)||a.sit||a.chan||!a.branch||a.skillCd>0)return false;
  const B=BRANCH[a.branch];if(!B.cd)return false;
  if(a.branch==='mkt'){for(let i=0;i<10;i++){const ang=i/10*Math.PI*2;G.proj.push({f:a.f,x:a.x+Math.cos(ang)*(R+4),y:a.y+Math.sin(ang)*(R+4),ox:a.x,oy:a.y,dx:Math.cos(ang),dy:Math.sin(ang),d:0,o:a,spin:Math.random()*6,flyer:true,sp:480,rng:230});}
    pop(a.f,a.x,a.y-44,'전단지 살포!','#c08a1e');a.cloakT=0;for(const n of watchers(a))if(!immune(a,n)&&sees(n,a)){caught(a,n,'act');break;}}
  else if(a.branch==='design'){a.cloakT=4;pop(a.f,a.x,a.y-44,'위장','#8e5c8a');tell(a,'위장: 4초간 아무도 못 봄 (던지면 풀림)');}
  a.skillCd=B.cd;return true;
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
function arriveRoof(a,side){
  a.f=ROOF;a.side=side;a.x=K(side==='L'?135:965);a.y=K(380)+rnd(-60,60);a.path=[];a.goal=null;a.mode='idle';a.target=null;a.transit=null;a.inv=1.5;a.vx=a.vy=0;
  if(a.isPlayer){const n=G.actors.filter(o=>o!==a&&o.alive&&o.f===ROOF&&o.side===side).length;tell(a,`옥상 ${side==='L'?'왼쪽':'오른쪽'} 문 도착 · 흡연 동맹 ${n}명 (같은 쪽끼리는 못 때림)`);UI.snapCam(a);}
}
function goRoof(a,side){
  if(!G.lunch||G.lunch.t<3||!a.alive||a.f<0||a.f===ROOF||locked(a))return;stand(a);a.chan=null;a.preLunchF=a.f;a.preLunchG=a.g;a.transit={to:ROOF,t:.6,side};a.f=-1;tell(a,'엘리베이터로 옥상 직행');
}
const ally=(a,o)=>!!(a&&o&&a.f===ROOF&&o.f===ROOF&&a.side&&a.side===o.side);
function showCine(t,sub,dur=1.6){UI.cine(t,sub,dur);}
function arrive(a,f,padKey){
  const p=PADS[padKey];a.f=f;a.x=p.x+rnd(-20,20);a.y=p.y-34-rnd(0,18);a.path=[];a.goal=null;a.mode='idle';a.target=null;a.transit=null;a.inv=1.5;a.vx=a.vy=0;
  a.maxF=Math.max(a.maxF,f);
  if(a.isPlayer){const s=a.seats[f];tell(a,`${FLOORS[f].name} 도착${s?` · 내 자리: ${s.name}`:''}`);UI.snapCam(a);}
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
  if(v.type==='cleaner'){gain(a,4);a.cleanFriend=true;pop(a.f,a.x,a.y-40,'청소 아주머니 +4','#2f7d4f');tell(a,'청소 아주머니였다 +4 · 이제 젖은 바닥에서 안 미끄러짐');}
  else if(v.type==='courier'){spawnItem(a.f,null,{x:DOOR.x+rnd(-30,30),y:DOOR.y-40});pop(a.f,a.x,a.y-40,'택배 도착','#2f7d4f');tell(a,'택배 기사였다: 아이템 상자');}
  else if(v.type==='sales'){dmg(a,4,'sales');a.lockT=3;a.lockWhy='영업 당하는 중';pop(a.f,a.x,a.y-40,'"잠깐 설명 좀…" -4','#cf3626');tell(a,'영업사원이었다 -4 · 3초 붙잡힘',true);}
  else if(v.type==='interview'){gain(a,6);pop(a.f,a.x,a.y-40,'면접자 안내 +6','#2f7d4f');tell(a,'면접자를 안내했다 +6');}
}
function submitTask(a,t){
  if(!G.tasks.includes(t))return;
  const dbl=warnFloor(t.f)?2:1,v=t.reward*dbl;gain(a,v);a.lastTaskT=G.t;a.tasksDone++;
  pop(a.f,a.x,a.y-30,`+${v} ${t.name}${dbl>1?' (막판 실적 x2)':''}`,'#2f7d4f');
  for(const h of humans())if(h!==a&&inTaskRange(h,t))tell(h,`${a.name}님이 제출 버튼을 먼저 눌렀습니다`);
  if(Math.random()<.3&&a.docs<2){a.docs++;tell(a,'결재 서류 획득: 부장님 근처에서 결재 올리기 +8');}
  G.tasks.splice(G.tasks.indexOf(t),1);
}
function inTaskRange(a,t){if(!a.alive||a.f!==t.f||a.transit)return false;return t.zone?inRect(a,t.zone):Math.hypot(a.x-t.x,a.y-t.y)<t.r;}
/* ================= player commands (shared by the browser and the room server) ================= */
function useFloor(a,dir){const p=padOf(a);if(!a.alive||!p)return;if(startChan(a,p,dir))tell(a,`${PADS[p].n}: 사원증 태그 ${tagOf(a)}초 → ${FLOORS[a.f+dir].name}`);}
function chooseBranch(a,k){if(!a||!BRANCH[k]||a.branch)return;a.branch=k;a.branchAsk=0;tell(a,`${BRANCH[k].n}이 되었습니다`);pop(a.f,a.x,a.y-44,BRANCH[k].n,'#2f7d4f');}
function callOptions(a){return[{key:'greet',t:'인사',s:'죄송합니다!'},a.docs>0?{key:'doc',t:'결재 요청',s:'여기 있습니다'}:{key:'report',t:'보고',s:'진행 중입니다'},{key:'busy',t:'바쁜 척',s:'타닥타닥'}];}
/* What E / the action button does right now for actor me: {label, cls, fn} or null. */
function contextAction(me){
  if(!me.alive||me.f<0||me.transit||locked(me)||me.chan)return null;
  if(me.contact)return{label:me.contact.n.kind==='ceo'?'대표님께 인사!':'부장님께 인사!',cls:'hot',fn:()=>greet(me)};
  if(me.quest)return{label:'신입 질문 답해주기 +2',cls:'hot',fn:()=>answerQuest(me)};
  if(me.docs>0){const n=watchers(me).find(n=>dist(n,me)<150);if(n)return{label:'결재 올리기 +8',cls:'ready',fn:()=>submitDoc(me,n)};}
  const rt=G.tasks.find(t=>t.ready&&inTaskRange(me,t));
  if(rt)return{label:`제출 +${rt.reward*(warnFloor(rt.f)?2:1)}`,cls:'ready',fn:()=>submitTask(me,rt)};
  const d=G.doors[me.f];
  if(d&&d.v&&dist(me,DOOR)<64)return{label:'문 열기',cls:'go',fn:()=>openDoor(me)};
  const rd=nearDoor(me);
  if(rd&&!me.sit)return{label:rd.open?`${rd.name} 닫기`:`${rd.name} 열기`,cls:rd.open?'':'go',fn:()=>{if(!toggleDoor(me.f,rd,!rd.open))tell(me,'문 앞에 사람이 있어 못 닫습니다');}};
  const pad=padOf(me);
  if(pad&&!me.sit&&G.lunch&&G.lunch.t>3)return{label:pad==='stair'?'◀ 옥상 왼쪽 문':'옥상 오른쪽 문 ▶',cls:'hot',fn:()=>goRoof(me,pad==='stair'?'L':'R')};
  if(pad&&!me.sit){const up=me.f+1,dn=me.f-1;
    if(up<NF&&isOpen(up))return{label:`▲ ${FLOORS[up].short} · 태그 ${tagOf(me)}초`,cls:'go',fn:()=>useFloor(me,1)};
    if(dn>=0&&isOpen(dn))return{label:`▼ ${FLOORS[dn].short}로`,cls:'',fn:()=>useFloor(me,-1)};
    if(up<NF)return{label:`${FLOORS[up].short} 잠김`,cls:'',fn:()=>useFloor(me,1)};}
  if(me.sit)return{label:'일어나기',cls:'',fn:()=>stand(me)};
  const own=me.seats[me.f];
  if(own&&dist(me,own)<40&&!own.occ)return{label:'내 자리에 앉기',cls:'go',fn:()=>{if(sit(me,own))tell(me,'내 자리에 앉았다: 고과 회복 중');}};
  const other=FLOORS[me.f].seats.find(s=>s!==own&&!s.occ&&dist(me,s)<22);
  if(other)return{label:'남의 자리에 앉기',cls:'',fn:()=>{if(sit(me,other))tell(me,`${other.owner?other.owner.name+'님':'빈'} 자리: 회복 없음`);}};
  const cl=G.npcs.find(n=>n.kind==='cleaner'&&n.f===me.f&&npcActive(n)&&dist(n,me)<80);
  if(cl&&me.cleanCd<=0)return{label:'아주머니께 인사 (정보)',cls:'',fn:()=>greet(me)};
  return null;
}
function interact(a){if(!a.alive||a.f<0||locked(a)||a.chan)return;const act=contextAction(a);if(act)act.fn();}
