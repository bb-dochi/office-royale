/* ================= NPC senses ================= */
const VIS={boss:{len:230,half:.52,pres:80,sound:260},ceo:{len:345,half:.7,pres:120,sound:390},busy:{len:120,half:.6,pres:0,sound:0},late:{len:0,half:0,pres:90,sound:0}}; // late: nothing to dodge, only the 인사 range drawn under their feet
function npcActive(n){
  if(G.tutorial&&!n.tut)return false; // the tutorial switches NPCs on one at a time
  if(n.kind==='ceo')return true;
  if(!isOpen(n.f))return false;
  /* roof lunch: 부장님 stay down on the floors (greet first as usual), so sitting the lunch out there isn't free; everyone else is out */
  if(n.kind!=='cleaner'&&G.lunch&&!(n.kind==='boss'&&roofLunch()))return false;
  if((n.kind==='courier'||n.kind==='late')&&!n.on)return false;
  if(n.kind==='boss'){if(G.final)return false;if(n.slot===1&&!(n.f===topOpen()&&G.closed<NF-1))return false;}
  return true;
}
function sees(n,a){
  const v=VIS[n.kind];if(!v||a.f!==n.f||!a.alive)return false;
  if(G.blackout&&G.blackout.f===n.f)return false;
  const d=dist(n,a),k=a.branch==='design'?1-.3*teamK(a):1; // 디자인: 눈에 덜 띔 (대리 -15%, 팀장 -30%)
  if(d<v.pres*k)return sightLos(n.f,n.x,n.y,a.x,a.y);
  if(d>v.len*k)return false;
  if(Math.abs(angDiff(Math.atan2(a.y-n.y,a.x-n.x),n.face))>v.half)return false;
  return sightLos(n.f,n.x,n.y,a.x,a.y);
}
/* 5F and up: the always-on boss is a 전무 (senior). Even 임원 must greet them, and getting caught costs more */
const bossTitle=n=>n.kind==='ceo'?'대표님':n.senior?'전무님':'부장님';
const immune=(a,n)=>(n.kind==='boss'&&!n.senior&&!n.tut&&a.rank==='임원')||a.cloakT>0||a.vipT>0||(a.stampT>G.t&&a.stampNpc===n)||a.inRest;
function watchers(a){return G.npcs.filter(n=>(n.kind==='boss'||n.kind==='ceo')&&n.f===a.f&&npcActive(n));}
/* what the boss says when they catch someone throwing: right in front of them (act), or after turning round to a noise (turn) */
const CAUGHT_LINES={
  act:['지금 뭐 하는 건가?','회사가 놀이터야?','내 앞에서 서류를 던져?','자네, 잠깐 나 좀 보지','이건 인사고과에 반영하겠네'],
  turn:['방금 뭐 던졌어?','내가 못 본 줄 알았나?','등 뒤에서도 다 들려','거기 서! 방금 그거 뭐야?'],
  senior:['전무실로 따라오게','이게 우리 회사 수준인가?','자네 팀장 누구야?'],
  ceo:['자네, 우리 회사 사람 맞나?','인사팀장 좀 불러오게','이런 건 처음 보는군']};
function caught(a,n,why){
  const t=bossTitle(n),line=pick(n.kind==='ceo'?CAUGHT_LINES.ceo:n.senior&&Math.random()<.6?CAUGHT_LINES.senior:CAUGHT_LINES[why==='turn'?'turn':'act']);
  say(n,line,'#cf3626');
  if(n.kind==='ceo'){const l=Math.ceil(a.g/2);dmg(a,l,'boss');pop(a.f,a.x,a.y-34,`대표님께 적발 -${l}`,'#cf3626');tell(a,`대표님: "${line}" 현장 적발: 고과 반토막`,true);UI.shake(.25,a);}
  else{const l=n.senior?15:10;dmg(a,l,'boss');pop(a.f,a.x,a.y-34,`현장 적발 -${l}`,'#cf3626');tell(a,`${t}: "${line}" 현장 적발 -${l}`,true);UI.shake(.2,a);}
  a.flash=.3;a.hitBy=0;
}
/* ---------- seat workers' favours: fetch something on the same floor and bring it back ----------
   Pay follows the walk from this desk (the same 정수기 is next door for one desk and across the floor for another):
   5 + 1 per 110 px one way, 7-20: one-way walks are 190-1810 px, average about +14. Per second of walking that is a
   little under-to-over the 업무 (they get ×2 on a closing floor, favours never do). Briefly 6-13 on 2026-10-30: too low
   A desk asks again 40-60 s after its favour is taken, 25-40 s after one nobody took (2026-10-30: the same desk asked too often) */
const ERRANDS=[{spot:'coffee',ask:'커피 한 잔만 사다 줄래요?',go:'탕비실 커피'},{spot:'printer',ask:'출력물 좀 가져다줄래요?',go:'프린터 출력물'},
  {spot:'box',ask:'이 서류 결재함에 좀 넣어 줄래요?',go:'결재함에 서류 넣기'},{spot:'cooler',ask:'정수기 물 한 잔만요…',go:'정수기 물'}];
function errandPay(n,sp){let L=0,x=n.x,y=n.y;for(const q of findPath(n.f,n.x,n.y,sp.x,sp.y)){L+=Math.hypot(q.x-x,q.y-y);x=q.x;y=q.y;}return Math.max(7,Math.min(20,Math.round(5+L/110)));}
function deskStep(n){
  if(!n.ask){if(G.t>=n.askT){const ok=ERRANDS.filter(e=>FLOORS[n.f].spots[e.spot]),e=pick(ok);n.job={...e,r:errandPay(n,FLOORS[n.f].spots[e.spot])};n.ask=true;n.askEnd=G.t+25;n.called=false;}return;}
  if(G.t>n.askEnd){n.ask=false;n.askT=G.t+rnd(25,40);return;}
  if(!n.called&&humans().some(h=>h.alive&&h.f===n.f&&!h.errand&&dist(h,n)<170)){n.called=true;say(n,n.job.ask,'#3f6f99');}
}
function acceptErrand(a,n){
  const e=n.job,sp=FLOORS[n.f].spots[e.spot];if(!n.ask||!sp||a.errand)return;
  a.errand={go:e.go,f:n.f,step:0,tx:sp.x,ty:sp.y,bx:n.x,by:n.y,t:40,max:40,r:e.r};
  n.ask=false;n.askT=G.t+rnd(40,60);say(a,'네, 다녀올게요!');tell(a,`부탁: ${e.go} · 40초 안에 다녀오기`);
}
function errandStep(a,dt){
  const e=a.errand;e.t-=dt;
  if(a.f!==e.f||e.t<=0){a.errand=null;tell(a,'부탁을 못 들어줬다 (층을 떠났거나 시간 초과)');return;}
  if(e.step===0&&Math.hypot(a.x-e.tx,a.y-e.ty)<50){e.step=1;pop(a.f,a.x,a.y-36,'챙겼다!','#3f6f99');tell(a,'이제 부탁한 사람 자리로 돌아가요');}
  else if(e.step===1&&Math.hypot(a.x-e.bx,a.y-e.by)<55){a.errand=null;jobDone(a,'hr');a.tasksDone++;gain(a,e.r);worked(a);pop(a.f,a.x,a.y-36,`부탁 완료 +${e.r}`,'#2f7d4f');tell(a,`동료 부탁 완료: 고과 +${e.r}`);
    const n=G.npcs.find(n=>n.kind==='desk'&&n.f===a.f&&Math.hypot(n.x-e.bx,n.y-e.by)<2);if(n)say(n,pick(['고마워요!','역시 최고예요','다음에 밥 살게요!']),'#2f7d4f');}
}
function soundAlert(f,victim,ox,oy,thrower){
  for(const n of watchers(victim)){
    if(n.alert)continue;if(G.blackout&&G.blackout.f===f)continue;
    if(dist(n,victim)<VIS[n.kind].sound)n.alert={t:.5,ang:Math.atan2(oy-n.y,ox-n.x),who:thrower};
  }
}
const LINES=[{q:'"요즘 인사도 안 하나?"',ans:'greet',ok:0,bad:4},{q:'"그거 어떻게 됐어?"',ans:'report',ok:2,bad:6},{q:'"요즘 한가한가 봐?"',ans:'busy',ok:0,bad:4,lock:3}];
const DOC_LINE={q:'"결재 서류 가져와"',ans:'doc',ok:5,bad:6};
function startCall(a,n){
  const pool=[...LINES];if(a.docs>0)pool.push(DOC_LINE,DOC_LINE);
  const line=pick(pool);stand(a);
  a.call={n,line,t:2,max:2};say(n,line.q.replace(/"/g,''),n.kind==='ceo'?'#c08a1e':'#cf3626');
  if(!a.isPlayer){const p=GREET_P[a.type]??.6;a.call.botAns=Math.random()<p?line.ans:pick(['greet','report','busy']);a.call.botT=rnd(.4,1.4);
    if(a.type==='루팡'&&line.ans==='busy')a.call.botAns='busy';}
}
function answer(a,choice){
  const c=a.call;if(!c)return;a.call=null;const L=c.line;
  {const o=callOptions(a).find(o=>o.key===choice);say(a,o?o.s:'……');}
  let ok=choice===L.ans;
  if(ok&&L.ans==='doc'){a.docs--;a.shieldN+=1;}
  /* 보고 is always the right answer; the bonus only comes with a task finished in the last 20s */
  const bonus=L.ans==='report'&&G.t-a.lastTaskT>20?0:L.ok;
  if(ok){jobDone(a,'hr');if(bonus)gain(a,bonus);a.stampT=G.t+5;a.stampNpc=c.n;pop(a.f,a.x,a.y-36,bonus?`잘했어 +${bonus}`:'무사 통과',bonus?'#2f7d4f':'#5d666e');tell(a,L.ans==='doc'?'결재 완료: +5, 결재 도장 1개':`호출 통과${bonus?` +${bonus}`:''} · 눈도장 5초`);}
  else{dmg(a,L.bad,'boss');pop(a.f,a.x,a.y-36,`-${L.bad}`,'#cf3626');if(L.lock){a.lockT=L.lock;a.lockWhy='잡무 지시';}
    tell(a,choice?`틀린 대답: 고과 -${L.bad}${L.lock?' · 잡무 지시 3초':''}`:`대답을 못 했다: 고과 -${L.bad}`,true);}
}
function submitDoc(a,n){
  if(a.docs<=0)return;a.docs--;jobDone(a,'hr');gain(a,8);a.shieldN+=1;a.stampT=G.t+10;a.stampNpc=n;a.met[n.id]=G.t;a.contact=null;
  pop(a.f,a.x,a.y-36,'결재 완료 +8','#2f7d4f');tell(a,'결재 올리기 +8 · 결재 도장 1개 · 눈도장 10초');
}
function greet(a){
  if(!a.alive||a.f<0)return;
  if(a.contact){
    const n=a.contact.n;a.contact=null;
    const first=G.t-n.lastGreet>1.5;n.lastGreet=G.t;
    const v=n.kind==='ceo'?10:n.senior?(first?5:2):(first?3:1);jobDone(a,'hr');gain(a,v);a.stampT=G.t+10;a.stampNpc=n;
    say(a,n.kind==='ceo'?'대표님, 안녕하십니까!':pick(['안녕하십니까!','좋은 아침입니다!',`${bossTitle(n)} 안녕하세요!`]));
    if(first)say(n,n.kind==='ceo'?pick(['허허, 열심히 하게','자네 이름이 뭐였지?']):pick(['어, 그래','수고가 많아','오늘도 힘내고']),n.kind==='ceo'?'#c08a1e':'#5d666e');
    pop(a.f,a.x,a.y-36,`인사 +${v}`,'#2f7d4f');
    tell(a,`먼저 인사했다 +${v} · 눈도장 10초`);
    return;
  }
  if(a.greetLock>0)return;
  const cl=G.npcs.find(n=>n.kind==='cleaner'&&n.f===a.f&&dist(n,a)<80);
  if(cl&&a.cleanCd<=0){gain(a,1);a.cleanCd=30;a.intelT=8;say(a,'수고 많으십니다!');say(cl,'어이구, 고마워라','#3f8f8f');pop(a.f,a.x,a.y-36,'인사 +1','#2f7d4f');
    if(a.isPlayer){const os=G.actors.filter(o=>o!==a&&o.alive&&o.f===a.f),hid=os.filter(o=>o.inRest||(o.sit&&o.sit.owner===o));
      tell(a,`아주머니: "이 층에 ${os.length}명 있어${hid.length?`. ${hid[0].name} 씨는 ${hid[0].inRest?'화장실에':'자리에'} 숨어 있고`:''}" · 8초간 위치 표시`);}
    return;}
  a.greetLock=2;if(a.isPlayer)say(a,'안녕하… 세요?','#5d666e');
}
/* 안내원 (lobby only): it's their first day, so they ask anyone who comes to the desk for help. Pays little on purpose:
   one go never reaches 사원 (55) by itself, so it works as the 인사팀 route's first step (응대 1.5 beats a task's 1)
   instead of a promotion of its own. Humans only */
const GUIDE={r:2,cd:20,gap:12,desk:{x:K(400),y:K(490),w:K(300),h:K(180)},
  ask:['아… 오늘 첫날이라 일이 많네요','첫날이라 힘든데 좀 도와주세요!','오늘 첫날인데 방문객이 왜 이렇게 많죠…'],
  me:['제가 좀 도와드릴게요!','많이 힘드시죠ㅠㅠ'],says:['감사합니다, 덕분에 살았어요!','첫날부터 은인을 만났네요']};
const guideNear=a=>a.f===0&&inRect(a,GUIDE.desk)?G.npcs.find(n=>n.kind==='guide'&&npcActive(n))||null:null;
function guideStep(n){if(G.t<(n.askT||0)||!humans().some(h=>h.alive&&h.guideCd<=G.t&&guideNear(h)))return;n.askT=G.t+GUIDE.gap;say(n,pick(GUIDE.ask),'#2b4a6b');}
function helpGuide(a,n){a.guideCd=G.t+GUIDE.cd;jobDone(a,'hr');gain(a,GUIDE.r);worked(a);say(a,pick(GUIDE.me));say(n,pick(GUIDE.says),'#2b4a6b');pop(a.f,a.x,a.y-36,`안내 +${GUIDE.r}`,'#2f7d4f');tell(a,`안내 데스크를 도왔다 +${GUIDE.r}`);}
/* 지각한 대리 (lobby only, about every other game): lost, they tear round the whole lobby from the front door and only then
   reach the elevator, faster than a sprinting player (262), so you cut them off rather than chase them. The first to greet
   them counts as 응대 and gets a coffee: 회복, so it doesn't count toward promotion and can't decide a team by itself */
const LATE={p:.5,at:[10,25],speed:330,r:VIS.late.pres,hold:1.2,coffee:7,botR:60,botP:.3,run:['늦었다 늦었다!','엘리베이터가 어디였지?!','오늘만 봐주세요!'],
  me:['대리님, 이쪽으로 오세요~','제가 안내해 드릴게요!','엘리베이터는 저쪽이에요!'],
  route:[[100,640],[100,380],[550,300],[950,380],[930,620]]};
function lateCatch(a,n){if(n.caught||!n.on)return;n.caught=true;n.hold=LATE.hold;n.face=Math.atan2(a.y-n.y,a.x-n.x);jobDone(a,'hr');gain(a,LATE.coffee,true);worked(a);
  say(a,pick(LATE.me));say(n,'고마우니까 커피 살게요~','#b5651d');pop(a.f,a.x,a.y-36,`커피 얻어먹음 +${LATE.coffee}`,'#7a4b2a');tell(a,`지각한 대리님께 인사했다 · 회복 +${LATE.coffee}`);}
function lateStep(n,dt){
  if(n.gone)return;
  if(!n.on){if(G.t<n.at)return;n.on=true;n.path=[];say(n,pick(LATE.run),'#b5651d');
    {let x=n.x,y=n.y;for(const q of[...LATE.route.map(([rx,ry])=>({x:K(rx),y:K(ry)})),{x:PADS.elev.x,y:PADS.elev.y-20}]){n.path.push(...findPath(n.f,x,y,q.x,q.y));x=q.x;y=q.y;}}
    for(const h of humans())if(h.alive&&h.f===n.f)tell(h,'지각한 대리 등장: 먼저 인사하면 커피를 사 줘요');}
  if(!isOpen(n.f)||G.lunch||!n.path.length){n.on=false;n.gone=true;return;}
  if(!n.caught)for(const b of G.actors)if(!b.isPlayer&&b.alive&&b.f===n.f&&!b.transit&&!b.sit&&dist(b,n)<LATE.botR&&Math.random()<LATE.botP*dt){lateCatch(b,n);break;}
  if(n.hold>0){n.hold-=dt;return;}
  const p=n.path[0],dx=p.x-n.x,dy=p.y-n.y,d=Math.hypot(dx,dy);if(d<6){n.path.shift();return;}
  const sp=Math.min(d,LATE.speed*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;n.face+=angDiff(Math.atan2(dy,dx),n.face)*Math.min(1,dt*8);
}
function answerQuest(a){if(!a.quest)return;jobDone(a,'hr');const n=a.quest.n;a.quest=null;a.questCd=G.t+15;n.att=null;n.cool=G.t+10;n.path=[];gain(a,2);pop(a.f,a.x,a.y-36,'멘토링 +2','#2f7d4f');tell(a,'신입에게 친절하게 알려줬다 +2');
  if(isHawawa(n))say(n,pick(HAWAWA.thanks)(hwCall(a)),'#3f8f5f');}
/* 하와와: the 6F newbie, who drawls. Calls people "민지 선배" (a three-syllable name loses the surname), just "선배" when the name is long */
const isHawawa=n=>n.kind==='newbie'&&n.f===5;
const hwCall=a=>{const s=String(a.name);return s.length>4?'선배':(/^[가-힣]{3}$/.test(s)?s.slice(1):s)+' 선배';};
const HAWAWA={
  ask:[c=>`${c}니임~ 이거 좀 도와주세요오~`,c=>`${c}니임~ 엑셀이 또 멈췄어요오…`,c=>`${c}니임~ 회의실 예약 어떻게 해요오~?`,c=>`하와와… ${c}님 잠깐만요오~`,c=>`${c}니임~ 이거 제가 다 날린 거 아니죠오…?`,c=>`${c}니임~ 프린터가 저 싫어해요오~`],
  thanks:[c=>`와아~ ${c}니임 최고예요오~!`,()=>'감사합니다아~ 역시 선배니임~'],
  sulk:[()=>'히잉… 바쁘시구나아…',()=>'하와와… 혼자 해볼게요오…'],
};
function bossPrey(n){let best=null,bd=1e9;
  for(const a of G.actors){if(!a.alive||a.f!==n.f||a.transit||immune(a,n)||G.t-(a.met[n.id]??-99)<20)continue;const d=dist(a,n);if(d<bd){bd=d;best=a;}}
  return best;}
/* 어려움: now and then the 옆팀 팀장 picks a person on the floor and comes over for a chat (12 s, every 25-40 s) */
function busyHunt(n){
  const h=n.hunt;if(h&&(G.t>h.until||!h.a.alive||h.a.f!==n.f||h.a.inRest||h.a.chatCd>G.t)){n.hunt=null;n.path=[];}
  if(!n.hunt&&G.t>(n.huntAt??=G.t+rnd(15,30))){n.huntAt=G.t+rnd(25,40);const hs=humans().filter(a=>a.alive&&a.f===n.f&&!a.inRest&&!a.transit&&!(a.chatCd>G.t));if(hs.length)n.hunt={a:pick(hs),until:G.t+12};}
  if(n.hunt&&G.t>(n.rp||0)){n.path=findPath(n.f,n.x,n.y,n.hunt.a.x,n.hunt.a.y,true);n.rp=G.t+1;n.pause=0;}
}
/* talking needs a clear way through: glass walls and shut glass doors let the boss see you, but not chat to you */
/* NPCs and doors: paths keep out of shut doors, so nobody walks through one. An NPC only opens a door when it has to
   (shut in a room, or the door was shut across its way) and never to reach a person (hunts, the boss's lunch search,
   신입 인턴): those stop and look for another way, so a shut door still keeps them out */
const shutWay=(f,x1,y1,x2,y2)=>FLOORS[f].doors.find(d=>!d.open&&segHits(x1,y1,x2,y2,d,4));
function talkLos(f,x1,y1,x2,y2){for(const o of obsOf(f))if((o.sight||o.k==='glass'||(o.glass&&!o.open))&&segHits(x1,y1,x2,y2,o,0))return false;return true;}
function updNpcs(dt){
  for(const n of G.npcs){if(n.kind!=='courier')continue;
    if(!n.on){n.cd-=dt;if(n.cd<=0&&isOpen(n.f)&&!G.lunch){n.on=true;n.left=24;n.dropT=3;n.x=PADS.elev.x;n.y=PADS.elev.y-20;n.path=[];say(n,'택배 왔습니다!','#b5651d');for(const h of humans())if(h.alive&&h.f===n.f)tell(h,'택배 기사 등장: 따라다니면 아이템 상자가 떨어져요');}}
    else{n.left-=dt;n.dropT-=dt;
      if(n.dropT<=0){n.dropT=rnd(5,7);if(G.items.filter(i=>i.f===n.f).length<itemQuota(n.f)+3){spawnItem(n.f,null,{x:n.x,y:n.y+22});pop(n.f,n.x,n.y-40,'택배 상자 툭','#b5651d');}}
      if(n.left<=0||!isOpen(n.f)||G.lunch){n.on=false;n.cd=rnd(35,55);}}}
  for(const n of G.npcs)if(n.kind==='late')lateStep(n,dt);
  for(const n of G.npcs){
    if(!npcActive(n)||n.kind==='late')continue;
    if(n.kind==='guide'){guideStep(n);continue;}
    if(n.kind==='desk'){deskStep(n);continue;}
    const fl=FLOORS[n.f];
    if(n.alert){n.alert.t-=dt;if(n.alert.t<=0){n.face=n.alert.ang;n.hold=2;const w=n.alert.who;n.alert=null;
      if(w&&w.alive&&w.f===n.f&&!immune(w,n)&&sees(n,w))caught(w,n,'turn');}}
    if(n.hold>0){n.hold-=dt;continue;}
    if(n.kind==='boss'){
      const follow=G.ceo&&G.ceo.f===n.f?G.ceo:null;
      if(follow){const tx=follow.x-Math.cos(follow.face)*40+(n.slot?30:-30),ty=follow.y-Math.sin(follow.face)*40,dx=tx-n.x,dy=ty-n.y,d=Math.hypot(dx,dy);
        if(d>4){const sp=Math.min(d,90*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;}n.face+=angDiff(follow.face,n.face)*Math.min(1,dt*4);continue;}
      /* roof lunch: go looking for whoever stayed on the floor (not someone already met in the last 20 s), then
         walk back onto the round by a found path, since the round itself goes in straight lines */
      const prey=roofLunch()?bossPrey(n):null;
      if(prey||n.back){
        if(G.t>(n.rp||0)){const w=fl.wp.at(n.wp),to=prey||{x:w[0],y:w[1]};n.path=findPath(n.f,n.x,n.y,to.x,to.y,true);
          if(!prey&&!n.path.length)n.path=findPath(n.f,n.x,n.y,to.x,to.y);n.rp=G.t+1;n.back=!prey;} // shut in: the way back may go through a door
        const p=n.path.at(0);if(!p){n.back=false;continue;}
        const sd=shutWay(n.f,n.x,n.y,p.x,p.y);if(sd){if(prey){n.path=[];continue;}toggleDoor(n.f,sd,true);}
        const dx=p.x-n.x,dy=p.y-n.y,d=Math.hypot(dx,dy);if(d<6){n.path.shift();if(!n.path.length&&!prey)n.back=false;continue;}
        const sp=Math.min(d,80*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;n.face+=angDiff(Math.atan2(dy,dx),n.face)*Math.min(1,dt*5);continue;}
      if(n.pause>0){n.pause-=dt;n.face+=Math.sin(n.pause*3.2)*dt*2.2;continue;}
      const w=fl.wp.at(n.wp),dx=w[0]-n.x,dy=w[1]-n.y,d=Math.hypot(dx,dy);
      if(d<3){n.wp=(n.wp+1)%fl.wp.length;n.pause=1.6;continue;}
      const sp=Math.min(d,72*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;n.face+=angDiff(Math.atan2(dy,dx),n.face)*Math.min(1,dt*5);
    }else{
      if(n.kind==='busy'&&G.diff==='hard')busyHunt(n);
      const speed=n.kind==='cleaner'?55:n.kind==='busy'?(n.hunt?85:65):n.kind==='newbie'?95:n.kind==='courier'?90:n.kind==='cart'?38:50;
      if(n.kind==='newbie'){
        if(n.att){const a=n.att;if(!a.alive||a.f!==n.f||!a.quest){n.att=null;n.cool=G.t+10;n.path=[];}
          else{const dx=a.x-n.x,dy=a.y-n.y,d=Math.hypot(dx,dy);if(d>30&&!shutWay(n.f,n.x,n.y,a.x,a.y)){const sp=Math.min(d-28,120*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;}n.face=Math.atan2(dy,dx);continue;}}
        else if(G.t>(n.cool||0)){let best=null,bd=230;
          for(const a of G.actors){if(!a.alive||a.f!==n.f||a.inRest||a.transit||a.desk||a.quest||(a.questCd||0)>G.t)continue;const d=dist(a,n);if(d<bd&&sightLos(n.f,n.x,n.y,a.x,a.y)){bd=d;best=a;}}
          if(best){if(bd<36){n.att=best;best.quest={n,t:5,max:5,botT:rnd(.8,1.8)};say(n,isHawawa(n)?pick(HAWAWA.ask)(hwCall(best)):pick(['저 이거 어떻게 해요?','선배님 질문 있어요!','엑셀 함수 뭐 써요?','회의실 예약 어떻게 해요?']),'#3f8f5f');
              tell(best,'신입 인턴의 질문 공세: 느려짐 · E로 답해주면 +2',true);continue;}
            if(!n.rp||G.t>n.rp){n.path=findPath(n.f,n.x,n.y,best.x,best.y,true);n.rp=G.t+.8;n.pause=0;}}}
      }
      if(n.pause>0){n.pause-=dt;continue;}
      if(!n.path.length){
        let p;if(n.kind==='ceo'){const a=n.area;for(let i=0;i<20;i++){p=randFree(n.f);if(Math.hypot(p.x-a.x,p.y-a.y)<240)break;}}else p=randFree(n.f);
        n.path=findPath(n.f,n.x,n.y,p.x,p.y,true);n.pause=rnd(.6,2);
        if(!n.path.length&&!n.hunt&&(n.stuck=(n.stuck||0)+1)>=3){n.stuck=0;n.path=findPath(n.f,n.x,n.y,p.x,p.y);} // shut in a room: walk out through the door
        else if(n.path.length)n.stuck=0;continue;
      }
      const p=n.path.at(0),dx=p.x-n.x,dy=p.y-n.y,d=Math.hypot(dx,dy);
      const sd=shutWay(n.f,n.x,n.y,p.x,p.y);
      if(sd){if(n.hunt||n.kind==='newbie'){n.path=[];n.rp=0;n.pause=rnd(.4,1);continue;}toggleDoor(n.f,sd,true);} // a door shut on the way: open it (chasers turn back)
      if(d<6){n.path.shift();continue;}
      const sp=Math.min(d,speed*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;n.face+=angDiff(Math.atan2(dy,dx),n.face)*Math.min(1,dt*5);
      if(n.kind==='cleaner'){G.traps=G.traps.filter(t=>!(t.f===n.f&&Math.hypot(t.x-n.x,t.y-n.y)<34));n.dropT-=dt;if(n.dropT<=0){n.dropT=rnd(3,4.5);G.wet.push({f:n.f,x:n.x,y:n.y,t:0});}}
    }
  }
  for(const n of G.npcs){if(n.kind!=='cart'||!npcActive(n))continue;
    /* near the cart: 2.5/s up to 70, shown as "회복 +5" every 5 points so it's clear it's working */
    for(const a of G.actors){if(!a.alive||a.f!==n.f||a.transit||dist(a,n)>=95)continue;
      /* 70 and up: the vendor shoos high flyers back to work (a speech bubble, at most every 12 s per cart) */
      if(a.g>=70){if(a.isPlayer&&G.t>(n.shooT||0)){n.shooT=G.t+12;say(n,pick(['아이고 쌩쌩하시네~ 커피는 지친 분들 먼저요','얼굴 좋은데? 힘들 때 또 와요~','에이스는 커피 말고 일하러 가셔야지~','오늘 컨디션 최고네! 화이팅~']),'#7a4b2a');}continue;}
      gain(a,2.5*dt,true);a.cartAcc=(a.cartAcc||0)+2.5*dt;
      if(a.cartAcc>=5){a.cartAcc=0;pop(a.f,a.x,a.y-30,'회복 +5','#7a4b2a');}}}
  // contact & chats
  for(const a of alive()){
    if(a.f<0||a.transit)continue;
    if(a.quest){a.quest.t-=dt;a.slowT=Math.max(a.slowT,.1);if(!a.isPlayer&&a.quest.max-a.quest.t>=a.quest.botT)answerQuest(a);else if(a.quest&&a.quest.t<=0){if(isHawawa(a.quest.n))say(a.quest.n,pick(HAWAWA.sulk)(),'#3f8f5f');a.quest.n.att=null;a.quest.n.cool=G.t+10;a.quest=null;a.questCd=G.t+12;}}
    if(a.errand)errandStep(a,dt);
    if(a.contact){
      a.contact.t-=dt;
      if(!a.isPlayer&&a.contact.botOk&&a.contact.max-a.contact.t>=a.contact.botT){greet(a);continue;}
      if(a.contact.t<=0){const n=a.contact.n;a.contact=null;
        if(n.kind==='ceo'){dmg(a,8,'boss');pop(a.f,a.x,a.y-36,'대표님을 못 본 척 -8','#cf3626');tell(a,'대표님께 인사를 놓쳤다 -8',true);}
        else if(!a.call&&npcActive(n))startCall(a,n);}
      continue;
    }
    if(a.call){a.call.t-=dt;if(!a.isPlayer&&a.call.max-a.call.t>=a.call.botT){answer(a,a.call.botAns);continue;}if(a.call.t<=0)answer(a,null);continue;}
    if(a.inRest||a.chan||a.desk)continue;
    for(const n of watchers(a)){
      if(n.kind==='boss'&&!n.senior&&!n.tut&&a.rank==='임원'){if(G.t-(a.met[n.id]??-99)>=20&&sees(n,a)){a.met[n.id]=G.t;say(n,'상무님 오셨습니까!','#c08a1e');gain(a,1);tell(a,'임원 대우: 부장님이 먼저 인사한다 +1');}continue;}
      if(immune(a,n)||G.t-(a.met[n.id]??-99)<20)continue;
      if(sees(n,a)){
        a.met[n.id]=G.t;a.contact={n,t:1.5,max:1.5};
        if(!a.isPlayer){a.contact.botOk=Math.random()<(GREET_P[a.type]??.6);a.contact.botT=rnd(.3,1.2);}
        else UI.vibrate(a);
        break;
      }
    }
    if(a.contact)continue;
    for(const n of G.npcs){
      if(n.kind!=='busy'||n.f!==a.f||!npcActive(n)||a.chatCd>G.t)continue;
      if(sees(n,a)&&talkLos(n.f,n.x,n.y,a.x,a.y)){a.chatCd=G.t+25;n.hunt=null;a.lockT=3;a.lockWhy='옆팀 팀장 잡담';stand(a);say(n,pick(['주말에 뭐 했어?','점심 뭐 먹지?','요즘 바빠?']),'#5d666e');tell(a,'옆팀 팀장에게 붙잡혔다 (3초)');break;}
    }
  }
}
