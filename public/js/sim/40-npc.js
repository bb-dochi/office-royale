/* ================= NPC senses ================= */
const VIS={boss:{len:230,half:.52,pres:80,sound:260},ceo:{len:345,half:.7,pres:120,sound:390},busy:{len:120,half:.6,pres:0,sound:0}};
function npcActive(n){
  if(n.kind==='ceo')return true;
  if(!isOpen(n.f))return false;
  if(n.kind!=='cleaner'&&G.lunch)return false;
  if(n.kind==='courier'&&!n.on)return false;
  if(n.kind==='boss'){if(G.final)return false;if(n.slot===1&&!(n.f===topOpen()&&G.closed<NF-1))return false;}
  return true;
}
function sees(n,a){
  const v=VIS[n.kind];if(!v||a.f!==n.f||!a.alive)return false;
  if(G.blackout&&G.blackout.f===n.f)return false;
  const d=dist(n,a);
  if(d<v.pres)return sightLos(n.f,n.x,n.y,a.x,a.y);
  if(d>v.len)return false;
  if(Math.abs(angDiff(Math.atan2(a.y-n.y,a.x-n.x),n.face))>v.half)return false;
  return sightLos(n.f,n.x,n.y,a.x,a.y);
}
const immune=(a,n)=>(n.kind==='boss'&&a.rank==='임원')||a.cloakT>0||a.vipT>0||(a.stampT>G.t&&a.stampNpc===n)||a.inRest;
function watchers(a){return G.npcs.filter(n=>(n.kind==='boss'||n.kind==='ceo')&&n.f===a.f&&npcActive(n));}
function caught(a,n,why){
  if(n.kind==='ceo'){const l=Math.ceil(a.g/2);dmg(a,l,'boss');pop(a.f,a.x,a.y-34,`대표님께 적발 -${l}`,'#cf3626');tell(a,`대표님 앞에서 사내정치 적발: 고과 반토막`,true);UI.shake(.25,a);}
  else{dmg(a,10,'boss');pop(a.f,a.x,a.y-34,'현장 적발 -10','#cf3626');tell(a,why==='turn'?'부장님이 고개를 돌렸다: 현장 적발 -10':'부장님 앞에서 던졌다가 현장 적발 -10',true);UI.shake(.2,a);}
  a.flash=.3;
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
  if(ok&&L.ans==='report'&&G.t-a.lastTaskT>20)ok=false;
  if(ok&&L.ans==='doc'){a.docs--;a.shieldN+=1;}
  if(ok){if(L.ok)gain(a,L.ok);a.stampT=G.t+5;a.stampNpc=c.n;pop(a.f,a.x,a.y-36,L.ok?`잘했어 +${L.ok}`:'무사 통과',L.ok?'#2f7d4f':'#5d666e');tell(a,L.ans==='doc'?'결재 완료: +5, 결재 도장 1개':`호출 통과${L.ok?` +${L.ok}`:''} · 눈도장 5초`);}
  else{dmg(a,L.bad,'boss');pop(a.f,a.x,a.y-36,`-${L.bad}`,'#cf3626');if(L.lock){a.lockT=L.lock;a.lockWhy='잡무 지시';}
    tell(a,choice?`틀린 대답: 고과 -${L.bad}${L.lock?' · 잡무 지시 3초':''}`:`대답을 못 했다: 고과 -${L.bad}`,true);}
}
function submitDoc(a,n){
  if(a.docs<=0)return;a.docs--;gain(a,8);a.shieldN+=1;a.stampT=G.t+10;a.stampNpc=n;a.met[n.id]=G.t;a.contact=null;
  pop(a.f,a.x,a.y-36,'결재 완료 +8','#2f7d4f');tell(a,'결재 올리기 +8 · 결재 도장 1개 · 눈도장 10초');
}
function greet(a){
  if(!a.alive||a.f<0)return;
  if(a.contact){
    const n=a.contact.n;a.contact=null;
    const first=G.t-n.lastGreet>1.5;n.lastGreet=G.t;
    const v=n.kind==='ceo'?10:(first?3:1);gain(a,v);a.stampT=G.t+10;a.stampNpc=n;
    say(a,n.kind==='ceo'?'대표님, 안녕하십니까!':pick(['안녕하십니까!','좋은 아침입니다!','부장님 안녕하세요!']));
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
function answerQuest(a){if(!a.quest)return;const n=a.quest.n;a.quest=null;a.questCd=G.t+15;n.att=null;n.cool=G.t+10;n.path=[];gain(a,2);pop(a.f,a.x,a.y-36,'멘토링 +2','#2f7d4f');tell(a,'신입에게 친절하게 알려줬다 +2');}
function updNpcs(dt){
  for(const n of G.npcs){if(n.kind!=='courier')continue;
    if(!n.on){n.cd-=dt;if(n.cd<=0&&isOpen(n.f)&&!G.lunch){n.on=true;n.left=24;n.dropT=3;n.x=PADS.elev.x;n.y=PADS.elev.y-20;n.path=[];say(n,'택배 왔습니다!','#b5651d');for(const h of humans())if(h.alive&&h.f===n.f)tell(h,'택배 기사 등장: 따라다니면 아이템 상자가 떨어져요');}}
    else{n.left-=dt;n.dropT-=dt;
      if(n.dropT<=0){n.dropT=rnd(5,7);if(G.items.filter(i=>i.f===n.f).length<itemQuota(n.f)+3){spawnItem(n.f,null,{x:n.x,y:n.y+22});pop(n.f,n.x,n.y-40,'택배 상자 툭','#b5651d');}}
      if(n.left<=0||!isOpen(n.f)||G.lunch){n.on=false;n.cd=rnd(35,55);}}}
  for(const n of G.npcs){
    if(!npcActive(n))continue;
    const fl=FLOORS[n.f];
    if(n.alert){n.alert.t-=dt;if(n.alert.t<=0){n.face=n.alert.ang;n.hold=2;const w=n.alert.who;n.alert=null;
      if(w&&w.alive&&w.f===n.f&&!immune(w,n)&&sees(n,w))caught(w,n,'turn');}}
    if(n.hold>0){n.hold-=dt;continue;}
    if(n.kind==='boss'){
      const follow=G.ceo&&G.ceo.f===n.f?G.ceo:null;
      if(follow){const tx=follow.x-Math.cos(follow.face)*40+(n.slot?30:-30),ty=follow.y-Math.sin(follow.face)*40,dx=tx-n.x,dy=ty-n.y,d=Math.hypot(dx,dy);
        if(d>4){const sp=Math.min(d,90*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;}n.face+=angDiff(follow.face,n.face)*Math.min(1,dt*4);continue;}
      if(n.pause>0){n.pause-=dt;n.face+=Math.sin(n.pause*3.2)*dt*2.2;continue;}
      const w=fl.wp.at(n.wp),dx=w[0]-n.x,dy=w[1]-n.y,d=Math.hypot(dx,dy);
      if(d<3){n.wp=(n.wp+1)%fl.wp.length;n.pause=1.6;continue;}
      const sp=Math.min(d,72*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;n.face+=angDiff(Math.atan2(dy,dx),n.face)*Math.min(1,dt*5);
    }else{
      const speed=n.kind==='cleaner'?55:n.kind==='busy'?65:n.kind==='newbie'?95:n.kind==='courier'?90:n.kind==='cart'?38:50;
      if(n.kind==='newbie'){
        if(n.att){const a=n.att;if(!a.alive||a.f!==n.f||!a.quest){n.att=null;n.cool=G.t+10;n.path=[];}
          else{const dx=a.x-n.x,dy=a.y-n.y,d=Math.hypot(dx,dy);if(d>30){const sp=Math.min(d-28,120*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;}n.face=Math.atan2(dy,dx);continue;}}
        else if(G.t>(n.cool||0)){let best=null,bd=230;
          for(const a of G.actors){if(!a.alive||a.f!==n.f||a.inRest||a.transit||a.quest||(a.questCd||0)>G.t)continue;const d=dist(a,n);if(d<bd&&sightLos(n.f,n.x,n.y,a.x,a.y)){bd=d;best=a;}}
          if(best){if(bd<36){n.att=best;best.quest={n,t:5,max:5,botT:rnd(.8,1.8)};say(n,pick(['저 이거 어떻게 해요?','선배님 질문 있어요!','엑셀 함수 뭐 써요?','회의실 예약 어떻게 해요?']),'#3f8f5f');
              tell(best,'신입 인턴의 질문 공세: 느려짐 · E로 답해주면 +2',true);continue;}
            if(!n.rp||G.t>n.rp){n.path=findPath(n.f,n.x,n.y,best.x,best.y);n.rp=G.t+.8;n.pause=0;}}}
      }
      if(n.pause>0){n.pause-=dt;continue;}
      if(!n.path.length){
        let p;if(n.kind==='ceo'){const a=n.area;for(let i=0;i<20;i++){p=randFree(n.f);if(Math.hypot(p.x-a.x,p.y-a.y)<240)break;}}else p=randFree(n.f);
        n.path=findPath(n.f,n.x,n.y,p.x,p.y);n.pause=rnd(.6,2);continue;
      }
      const p=n.path.at(0),dx=p.x-n.x,dy=p.y-n.y,d=Math.hypot(dx,dy);
      if(d<6){n.path.shift();continue;}
      const sp=Math.min(d,speed*dt);n.x+=dx/d*sp;n.y+=dy/d*sp;n.face+=angDiff(Math.atan2(dy,dx),n.face)*Math.min(1,dt*5);
      if(n.kind==='cleaner'){G.traps=G.traps.filter(t=>!(t.f===n.f&&Math.hypot(t.x-n.x,t.y-n.y)<34));n.dropT-=dt;if(n.dropT<=0){n.dropT=rnd(3,4.5);G.wet.push({f:n.f,x:n.x,y:n.y,t:0});}}
    }
  }
  for(const n of G.npcs){if(n.kind!=='cart'||!npcActive(n))continue;
    for(const a of G.actors)if(a.alive&&a.f===n.f&&!a.transit&&a.g<70&&dist(a,n)<75)gain(a,1.3*dt);}
  // contact & chats
  for(const a of alive()){
    if(a.f<0||a.transit)continue;
    if(a.quest){a.quest.t-=dt;a.slowT=Math.max(a.slowT,.1);if(!a.isPlayer&&a.quest.max-a.quest.t>=a.quest.botT)answerQuest(a);else if(a.quest&&a.quest.t<=0){a.quest.n.att=null;a.quest.n.cool=G.t+10;a.quest=null;a.questCd=G.t+12;}}
    if(a.contact){
      a.contact.t-=dt;
      if(!a.isPlayer&&a.contact.botOk&&a.contact.max-a.contact.t>=a.contact.botT){greet(a);continue;}
      if(a.contact.t<=0){const n=a.contact.n;a.contact=null;
        if(n.kind==='ceo'){dmg(a,8,'boss');pop(a.f,a.x,a.y-36,'대표님을 못 본 척 -8','#cf3626');tell(a,'대표님께 인사를 놓쳤다 -8',true);}
        else if(!a.call&&npcActive(n))startCall(a,n);}
      continue;
    }
    if(a.call){a.call.t-=dt;if(!a.isPlayer&&a.call.max-a.call.t>=a.call.botT){answer(a,a.call.botAns);continue;}if(a.call.t<=0)answer(a,null);continue;}
    if(a.inRest||a.chan)continue;
    for(const n of watchers(a)){
      if(n.kind==='boss'&&a.rank==='임원'){if(G.t-(a.met[n.id]??-99)>=20&&sees(n,a)){a.met[n.id]=G.t;say(n,'상무님 오셨습니까!','#c08a1e');gain(a,1);tell(a,'임원 대우: 부장님이 먼저 인사한다 +1');}continue;}
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
      if(sees(n,a)){a.chatCd=G.t+25;a.lockT=3;a.lockWhy='옆팀 팀장 잡담';stand(a);say(n,pick(['주말에 뭐 했어?','점심 뭐 먹지?','요즘 바빠?']),'#5d666e');tell(a,'옆팀 팀장에게 붙잡혔다 (3초)');break;}
    }
  }
}
