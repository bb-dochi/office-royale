/* ================= step ================= */
function step(dt){
  G.t+=dt;const hs=humans();
  // restructuring
  if(G.closed<NF-1){
    if(!G.lunch)G.nextClose-=dt;G.warn=G.nextClose<=WARN;
    if(G.nextClose<=0){
      const f=G.closed;G.closed++;G.nextClose=INTERVAL;G.warn=false;UI.shake(.35);
      G.tasks=G.tasks.filter(t=>t.f>=G.closed);G.items=G.items.filter(t=>t.f>=G.closed);G.drops=G.drops.filter(t=>t.f>=G.closed);G.wet=G.wet.filter(t=>t.f>=G.closed);
      const nf=G.closed+WIN-1;let msg='';
      if(nf<NF){assignSeats(nf);fillTasks(nf);for(let i=0;i<itemQuota(nf);i++)spawnItem(nf);msg=`${FLOORS[nf].name} 개방`;for(const h of hs){const s=h.seats[nf];if(h.alive)tell(h,`인사 발령: ${FLOORS[nf].name} ${s?s.name:'자리 없음'}`);}}
      for(const b of G.actors)if(!b.isPlayer)b.pref=Math.min(topOpen(),G.closed+(Math.random()<.3?1:0));
      feed(`${f===0?'로비':(f+1)+'층'} 폐쇄!`,true);
      if(G.closed===NF-1){G.final=true;}
      UI.closure(f,nf<NF?nf:-1,msg);
    }
  }else if(G.final){G.finalT+=dt;if(G.finalT>30&&G.finalT-dt<=30)feed('야근 모드: 전원 고과가 계속 줄어듭니다',true);}
  updEvents(dt);
  updNpcs(dt);
  // doors
  for(const d of G.doors){
    if(!isOpen(d.f)){d.v=null;continue;}
    if(!d.v){d.cd-=dt;if(d.cd<=0){const r=Math.random();d.v={type:r<.3?'cleaner':r<.58?'courier':r<.9?'sales':'interview',t:0,ph:Math.random()*6};for(const h of hs)if(h.f===d.f&&h.alive)tell(h,`${d.f===0?'정문':'출입문'}에서 노크 소리가 납니다`);}}
    else{d.v.t+=dt;if(d.v.t>20){for(const a of alive())if(a.f===d.f){dmg(a,2,'door');pop(a.f,a.x,a.y-30,'-2','#cf3626');}for(const h of hs)if(h.f===d.f&&h.alive)tell(h,'부장님: "누가 문 좀 열어!" 층 전체 -2',true);d.v=null;d.cd=rnd(20,35);}}
  }
  // spawns
  G.fillT-=dt;if(G.fillT<=0){G.fillT=1.5;for(let f=G.closed;f<=topOpen();f++)fillTasks(f);}
  G.itemT-=dt;
  if(G.itemT<=0){G.itemT=6;for(let f=G.closed;f<=topOpen();f++){if(G.items.filter(i=>i.f===f).length<itemQuota(f))spawnItem(f);fillTasks(f);}}
  for(let f=0;f<NF;f++)for(const d of FLOORS[f].doors){if(!d.open)continue;d.t+=dt;if(d.t>10&&!G.actors.some(a=>a.alive&&a.f===f&&Math.hypot(a.x-(d.x+d.w/2),a.y-(d.y+d.h/2))<60))toggleDoor(f,d,false);}
  for(const w of G.wet)w.t+=dt;G.wet=G.wet.filter(w=>w.t<18);
  // transit
  for(const a of G.actors){if(!a.alive||!a.transit)continue;a.transit.t-=dt;if(a.transit.t<=0){if(a.transit.to===ROOF)arriveRoof(a,a.transit.side);else arrive(a,a.transit.to,'elev');}}
  for(const d of G.dings)d.t-=dt;G.dings=G.dings.filter(d=>d.t>0);
  // humans
  for(const me of hs){
    if(me.branchAsk&&!me.branch&&G.t>=me.branchAsk)chooseBranch(me,pick(Object.keys(BRANCH)));
    if(!me.alive||me.f<0||locked(me))continue;
    let vx=0,vy=0;
    const inp=me.input||NOINPUT;vx=inp.vx;vy=inp.vy;
    const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}
    if(m>.15)me.face=Math.atan2(vy,vx);
    if(me.chan&&m>.35){me.chan=null;tell(me,'층 이동 취소');}
    if(me.sit&&m>.35)stand(me);
    me.sprint=inp.run&&m>.15&&!me.sit&&!me.chan;
    if(!me.chan&&!me.sit)drive(me,vx,vy,dt);
    if(me.sprint&&me.f>=0){
      if(me.runCd<=0){const n=watchers(me).find(n=>!immune(me,n)&&sees(n,me));
        if(n){me.runCd=4;dmg(me,4,'boss');say(n,`${n.kind==='ceo'?'자네':'복도에서'} 뛰지 마!`,'#cf3626');pop(me.f,me.x,me.y-40,'-4','#cf3626');tell(me,`${n.kind==='ceo'?'대표님':'부장님'}: "복도에서 뛰지 마!" 고과 -4`,true);}}
      if(me.fallCd<=0&&onWet(me)){me.fallCd=3;me.stunT=1;me.sprint=false;dmg(me,4,'slip');pop(me.f,me.x,me.y-40,'꽈당! -4','#cf3626');tell(me,'뛰다가 미끄러졌다: 고과 -4',true);UI.shake(.2,me);}
    }
    if(inp.fire)throwPaper(me,autoAim(me));
  }
  for(const a of G.actors){
    if(!a.alive)continue;
    a.cd-=dt;a.runCd-=dt;a.fallCd-=dt;a.slipT-=dt;a.intelT-=dt;a.cloakT-=dt;a.skillCd-=dt;a.flash-=dt;a.rapidT-=dt;a.speedT-=dt;a.stunT-=dt;a.vipT-=dt;a.slowT-=dt;a.lockT-=dt;a.inv-=dt;a.greetLock-=dt;a.coffeeCd-=dt;a.coolerCd-=dt;a.cleanCd-=dt;
    if(a.f<0)continue;
    if(a.chan&&!locked(a)){
      if(dist(a,PADS[a.chan.pad])>36){a.chan=null;}
      else{a.chan.t-=dt;if(a.chan.t<=0){const{pad,dir}=a.chan;a.chan=null;const to=a.f+dir;
        if(isOpen(to)){
          if(pad==='stair')arrive(a,to,'stair');
          else if(G.fire>0){tell(a,'소방 훈련 중: 엘리베이터 정지');}
          else{a.transit={to,t:1.1};a.f=-1;G.dings.push({f:to,t:1.1});tell(a,'엘리베이터 탑승');}
        }}}
    }
    if(!a.isPlayer&&a.f>=0)updBot(a,dt);
  }
  const al=alive().filter(a=>a.f>=0);
  // seats, restroom, pantry
  for(const a of al){
    if(!G.final&&G.t-a.lastHitT>6&&a.g<60&&!a.inRest&&a.f>=G.closed)gain(a,.5*dt);
    if(a.sit){a.x=a.sit.x;a.y=a.sit.y;if(a.sit.owner===a){a.sitT+=dt;if(a.sitT>1&&a.sitHeal<15){const h=Math.min(dt,15-a.sitHeal);a.sitHeal+=h;gain(a,h);}}}
    const fl=FLOORS[a.f];
    const wasIn=a.inRest;a.inRest=inRect(a,fl.rest);
    if(a.inRest){a.restT+=dt;if(a.restT>10){dmg(a,dt,'rest');if(a.restT-dt<=10)tell(a,'자리 비움이 길어졌다: 고과 감소 중',true);}}else a.restT=0;
    if(a.inRest&&!wasIn)tell(a,'화장실: 부장님 호출 면제 · 10초 넘으면 자리 비움');
    if(a.coffeeCd<=0&&Math.hypot(a.x-fl.spots.coffee.x,a.y-fl.spots.coffee.y)<34){gain(a,12);a.coffeeCd=20;pop(a.f,a.x,a.y-30,'+12 커피','#7a4b2a');}
    if(a.coolerCd<=0&&Math.hypot(a.x-fl.spots.cooler.x,a.y-fl.spots.cooler.y)<56){gain(a,4);a.coolerCd=10;pop(a.f,a.x,a.y-30,'+4 정수기','#3f6f99');}
  }
  // separation
  for(let i=0;i<al.length;i++)for(let j=i+1;j<al.length;j++){const a=al[i],b=al[j];if(a.f!==b.f||a.sit||b.sit)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>0&&d<R*2){const p=(R*2-d)/2;a.x-=dx/d*p;a.y-=dy/d*p;b.x+=dx/d*p;b.y+=dy/d*p;}}
  // projectiles
  for(let i=G.proj.length-1;i>=0;i--){
    const p=G.proj[i],sp=p.sp*dt;p.x+=p.dx*sp;p.y+=p.dy*sp;p.d+=sp;p.spin+=dt*14;let dead=p.d>p.rng||p.x<0||p.y<0||p.x>FW||p.y>FH;
    if(!dead)for(const o of obsOf(p.f))if(p.x>o.x&&p.x<o.x+o.w&&p.y>o.y&&p.y<o.y+o.h){dead=true;break;}
    if(!dead)for(const a of al){if(a===p.o||a.f!==p.f||a.inRest||ally(p.o,a))continue;if(Math.hypot(a.x-p.x,a.y-p.y)<R+5){if(p.bundle){dead=true;break;}hit(a,p.o,p.staple||p.flyer?3:5,null,p);dead=true;break;}}
    if(dead){if(p.bundle)burst(p);G.proj.splice(i,1);}
  }
  for(const b of G.bursts)b.t+=dt;G.bursts=G.bursts.filter(b=>b.t<.5);
  // traps
  for(let i=G.traps.length-1;i>=0;i--){const t=G.traps[i];t.t+=dt;
    const v=al.find(a=>a!==t.o&&a.f===t.f&&Math.hypot(a.x-t.x,a.y-t.y)<26);
    if(v){v.slowT=1.5;v.slipT=2.5;hit(v,t.o,v.sprint?9:5,v.sprint?'뛰다가 커피에 꽈당 -9':'커피에 미끄러짐 -5');if(v.sprint)v.stunT=1;G.traps.splice(i,1);}else if(t.t>40||t.f<G.closed)G.traps.splice(i,1);}
  // items + drops + delivery
  for(let i=G.items.length-1;i>=0;i--){const it=G.items[i];it.t+=dt;
    const a=al.find(a=>a.f===it.f&&!a.sit&&Math.hypot(a.x-it.x,a.y-it.y)<24&&canTake(a,it.k)&&!(it.nb===a&&G.t<it.nbT));
    if(a){G.items.splice(i,1);
      if(it.k==='coffee'){gain(a,12);pop(a.f,a.x,a.y-30,'+12 아이스 아메리카노','#7a4b2a');}
      else if(it.k==='food'){gain(a,15);pop(a.f,a.x,a.y-30,'+15 '+pick(['치킨','짜장면','피자','김밥','떡볶이']),'#2f7d4f');}
      else if(!STORE.has(it.k)){applyItem(a,it.k);if(a.isPlayer){const I=ITEMS[it.k];tell(a,`${CAT[I.cat].n} · ${I.n}: ${I.d}`);}}
      else if(it.k==='stapler'){a.ammo=15;pop(a.f,a.x,a.y-30,'스테이플러 장전 15발',ITEMS.stapler.c);tell(a,'스테이플러 장전: 공격하면 15발 연사');}
      else{a.items.push(it.k);if(a.isPlayer){const I=ITEMS[it.k];pop(a.f,a.x,a.y-30,I.n+' 들었다',I.c);tell(a,`${I.n}: ${I.d} · 다음 공격 때 사용`);}}}
  }
  for(let i=G.drops.length-1;i>=0;i--){const d=G.drops[i];const a=al.find(a=>a.f===d.f&&!a.carry&&Math.hypot(a.x-d.x,a.y-d.y)<22);
    if(a){G.drops.splice(i,1);a.carry=true;pop(a.f,a.x,a.y-30,'출력물 주움','#1d2328');tell(a,'떨어진 출력물을 주웠다: 결재함으로 배달');}}
  for(const a of al){if(!a.carry)continue;const b=FLOORS[a.f].spots.box;if(Math.hypot(a.x-b.x,a.y-b.y)<42){a.carry=false;const dbl=warnFloor(a.f)?2:1;gain(a,12*dbl);a.lastTaskT=G.t;a.tasksDone++;
    pop(a.f,a.x,a.y-30,`+${12*dbl} 출력물 배달`,'#2f7d4f');tell(a,`배달 완료 +${12*dbl}`);}}
  // tasks
  for(let i=G.tasks.length-1;i>=0&&!G.lunch;i--){
    const t=G.tasks[i];
    const on=al.filter(a=>inTaskRange(a,t)&&!locked(a)&&!a.chan);
    if(!t.ready){
      const work=t.kind==='server'?on.filter(a=>Math.hypot(a.vx,a.vy)<5):on;
      if(t.kind==='server'&&on.length&&!work.length)t.prog=0;
      if(work.length){
        let rate=(1/t.need)*(1+.5*(work.length-1));
        if(t.seat&&work.some(a=>t.seat.owner===a&&a.sit===t.seat))rate*=1.5;
        if(work.some(a=>a.branch==='dev'))rate*=2;
        t.prog+=rate*dt;
        if(t.prog>=1){
          if(t.kind==='print'){const w=work.filter(a=>!a.carry).sort((a,b)=>dist(a,t)-dist(b,t))[0];
            if(w){w.carry=true;pop(w.f,w.x,w.y-30,'출력 완료: 결재함으로','#1d2328');tell(w,'출력물을 들었다: 결재함으로 배달 (맞으면 떨어뜨림)');G.tasks.splice(i,1);}else t.prog=1;}
          else{t.ready=true;t.prog=1;}
        }
      }else t.prog=Math.max(0,t.prog-dt*.1);
    }else{
      for(const a of on){if(a.isPlayer)continue;if(t.react[a.id]===undefined)t.react[a.id]=G.t+rnd(.25,.85);else if(G.t>=t.react[a.id]){submitTask(a,t);break;}}
    }
  }
  // closed floors + overtime
  for(const a of al){if(a.f<G.closed){dmg(a,4*dt,'zone');}if(G.final&&G.finalT>30)dmg(a,(1.4+(G.finalT-30)*.05)*dt,'overtime');}
  // deaths
  for(const a of alive()){
    if(a.g>0)continue;
    if(a.branch==='hr'&&!a.revived){a.revived=true;a.branch=null;a.rank='인턴';a.peak=50;a.g=20;a.inv=1.5;pop(a.f,a.x,a.y-44,'인사팀장 특권: 인턴으로 재입사','#2f7d4f');
      feed(v=>a===v?'인사팀장 특권 발동: 인턴으로 재입사 (고과 20)':`${a.name}님이 인턴으로 재입사했습니다`,a.isPlayer);continue;}
    a.g=0;a.alive=false;a.chan=null;a.contact=null;a.call=null;stand(a);const left=aliveCount();a.place=left+1;
    const killer=(a.cause==='paper')&&a.lastHitBy&&G.t-a.lastHitT<4?a.lastHitBy:null;a.killer=killer;
    if(killer&&killer.alive){const RI=['인턴','대리','팀장','임원'],v=10+(RI.indexOf(a.rank)>RI.indexOf(killer.rank)?6:0);gain(killer,v);killer.kills=(killer.kills||0)+1;
      pop(killer.f,killer.x,killer.y-52,`처리 +${v}`,'#2f7d4f');tell(killer,`${a.name}님 처리: 고과 +${v}${v>10?' (윗사람 처리 보너스)':''}`);}
    if(a.f>=0){a.items.forEach((k,j)=>spawnItem(a.f,k,{x:a.x+12+j*8,y:a.y+j*8}));a.items=[];spawnItem(a.f,null,{x:a.x-12,y:a.y+6});if(a.carry)G.drops.push({f:a.f,x:a.x,y:a.y-10});}
    a.carry=false;
    feed(v=>a===v?'내가 권고사직 처리되었습니다':`${a.name} ${rankName(a)}님 권고사직${killer?` · ${killer===v?'내':killer.name+'님'} 서류`:''}`,a.isPlayer);
    if(a.isPlayer)UI.result(false,800,a);
  }
  if(!G.over&&aliveCount()<=1){
    G.over=true;const w=G.actors.find(a=>a.alive);
    if(w){feed(v=>`${w===v?'내가':w.name+'님이'} CEO실에 입성했습니다`,true);G.winner=w;}
    for(const h of humans())UI.result(h===w,1200,h);
  }
  for(const p of G.pops)p.t+=dt;G.pops=G.pops.filter(p=>p.t<(p.say?2.4:1.1));

}
