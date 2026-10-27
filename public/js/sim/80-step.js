/* ================= step ================= */
function step(dt){
  G.t+=dt;const hs=humans();
  // restructuring (stops once there is a winner, so the winner can't be closed out afterwards)
  if(G.closed<NF-1&&!G.over){
    if(!G.lunch)G.nextClose-=dt;G.warn=G.nextClose<=WARN;
    if(G.nextClose<=0){
      const f=G.closed;G.closed++;G.nextClose=INTERVAL;G.warn=false;UI.shake(.35);
      G.tasks=G.tasks.filter(t=>t.f>=G.closed);G.items=G.items.filter(t=>t.f>=G.closed);G.drops=G.drops.filter(t=>t.f>=G.closed);G.wet=G.wet.filter(t=>t.f>=G.closed);
      const nf=G.closed+WIN-1;let msg='';
      if(nf<NF){assignSeats(nf);fillTasks(nf);for(let i=0;i<itemQuota(nf);i++)spawnItem(nf);msg=`${FLOORS[nf].name} 개방`;for(const h of hs){const s=h.seats[nf];if(h.alive)tell(h,`인사 발령: ${FLOORS[nf].name} ${s?s.name:'자리 없음'}`);}}
      for(const b of G.actors)if(!b.isPlayer)b.pref=Math.min(topOpen(),G.closed+(Math.random()<.3?1:0));
      feed(`${f===0?'로비':(f+1)+'층'} 폐쇄!`,true);
      if(G.closed===NF-1){G.final=true;for(const b of G.actors)if(!b.isPlayer)b.seeker=Math.random()<diff().seek;}
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
    if(!me.alive||me.f<0||locked(me))continue;
    let vx=0,vy=0;
    const inp=me.input||NOINPUT;vx=inp.vx;vy=inp.vy;
    const m=Math.hypot(vx,vy);if(m>1){vx/=m;vy/=m;}
    if(m>.15)me.face=Math.atan2(vy,vx);
    if(me.chan&&m>.35){me.chan=null;tell(me,'층 이동 취소');}
    if(me.sit&&m>.35&&!me.desk)stand(me);
    if(me.wc&&m>.35){if(!me.wc.res)tell(me,'폰 내려놓음');me.wc=null;}
    me.sprint=inp.run&&m>.15&&!me.sit&&!me.chan;
    if(!me.chan&&!me.sit&&!me.wc)drive(me,vx,vy,dt);
    if(me.sprint&&me.f>=0){
      if(me.runCd<=0){const n=watchers(me).find(n=>!immune(me,n)&&sees(n,me));
        if(n){me.runCd=4;dmg(me,4,'boss');say(n,`${n.kind==='ceo'?'자네':'복도에서'} 뛰지 마!`,'#cf3626');pop(me.f,me.x,me.y-40,'-4','#cf3626');tell(me,`${bossTitle(n)}: "복도에서 뛰지 마!" 고과 -4`,true);}}
      if(me.fallCd<=0&&onWet(me)){me.fallCd=3;me.stunT=1;me.sprint=false;dmg(me,4,'slip');pop(me.f,me.x,me.y-40,'꽈당! -4','#cf3626');tell(me,'뛰다가 미끄러졌다: 고과 -4',true);UI.shake(.2,me);}
    }
    if(inp.fire)throwPaper(me,autoAim(me));
  }
  for(const a of G.actors){
    if(!a.alive)continue;
    a.cd-=dt;a.runCd-=dt;a.fallCd-=dt;a.slipT-=dt;a.intelT-=dt;a.cloakT-=dt;a.skillCd-=dt;a.rushT-=dt;a.flash-=dt;a.rapidT-=dt;a.speedT-=dt;a.stunT-=dt;a.vipT-=dt;a.slowT-=dt;a.lockT-=dt;a.inv-=dt;a.greetLock-=dt;a.coffeeCd-=dt;a.coolerCd-=dt;a.cleanCd-=dt;a.deskCd-=dt;a.wcCd-=dt;a.smokeCd-=dt;
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
    if(a.desk)deskStepA(a,dt);
    if(a.wc)wcStep(a,dt);
    if(!a.isPlayer&&a.f>=0&&!a.dummy)updBot(a,dt);
  }
  const al=alive().filter(a=>a.f>=0);
  // seats, restroom, pantry
  for(const a of al){
    if((!a.isPlayer||diff().regen)&&!G.final&&G.t-a.lastHitT>6&&a.g<60&&!a.inRest&&a.f>=G.closed)gain(a,.5*dt); // players only on 쉬움
    if(a.sit){a.x=a.sit.x;a.y=a.sit.y;a.sitT+=dt;} // 고과 at your own desk now comes from the monitor work (deskStepA)
    /* idle clock: nothing done for IDLE s (no task, delivery, favour or hit) and 고과 starts to leak, so hiding upstairs doesn't pay */
    if(!G.tutorial&&!G.lunch&&!G.final&&a.f!==ROOF&&!a.desk&&diff().idle){const idle=G.t-a.workT; // 쉬움: no idle penalty
      if(idle>IDLE){dmg(a,IDLE_DRAIN*dt,'idle');if(idle-dt<=IDLE)tell(a,'업무 태만: 할 일을 안 하면 고과가 깎여요',true);}}
    const fl=FLOORS[a.f];
    const wasIn=a.inRest;a.inRest=inRect(a,fl.rest);
    if(a.inRest){a.restT+=dt;if(a.restT>10){dmg(a,dt,'rest');if(a.restT-dt<=10)tell(a,'자리 비움이 길어졌다: 고과 감소 중',true);}}else a.restT=0;
    if(a.coffeeCd<=0&&Math.hypot(a.x-fl.spots.coffee.x,a.y-fl.spots.coffee.y)<34){gain(a,5,true);a.coffeeCd=35;pop(a.f,a.x,a.y-30,'회복 +5','#7a4b2a');} // the pantry machine: a small top-up, not a heal
    if(a.coolerCd<=0&&Math.hypot(a.x-fl.spots.cooler.x,a.y-fl.spots.cooler.y)<56){gain(a,4,true);a.coolerCd=10;pop(a.f,a.x,a.y-30,'회복 +4','#3f6f99');}
  }
  // separation (people at their desks stay put)
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
    const v=al.find(a=>a!==t.o&&a.f===t.f&&!a.desk&&Math.hypot(a.x-t.x,a.y-t.y)<26);
    if(v){v.slowT=1.5;v.slipT=2.5;hit(v,t.o,v.sprint?9:5,v.sprint?'뛰다가 커피에 꽈당 -9':'커피에 미끄러짐 -5');if(v.sprint)v.stunT=1;G.traps.splice(i,1);}else if(t.t>40||t.f<G.closed)G.traps.splice(i,1);}
  // items + drops + delivery
  for(let i=G.items.length-1;i>=0;i--){const it=G.items[i];it.t+=dt;
    const a=al.find(a=>a.f===it.f&&!a.sit&&Math.hypot(a.x-it.x,a.y-it.y)<24&&(it.k==='lighter'?a.side&&(a.lighter||0)<LUNCH.carry:canTake(a,it.k))&&!(it.nb===a&&G.t<it.nbT));
    /* standing on an attack item while still holding one: say why nothing happens (every 6 s at most) */
    if(!a&&STORE.has(it.k))for(const h of humans())if(h.alive&&h.f===it.f&&!canTake(h,it.k)&&G.t>(h.fullT||0)&&Math.hypot(h.x-it.x,h.y-it.y)<24){h.fullT=G.t+6;tell(h,'들고 있는 공격 아이템부터 써야 새로 주울 수 있어요');}
    if(a){G.items.splice(i,1);
      if(it.k==='lighter'){a.lighter=(a.lighter||0)+1;pop(a.f,a.x,a.y-30,`라이터 ${a.lighter}`,'#e0603d');if(a.lighter===1)tell(a,'라이터! 우리 재떨이로 가져가요');}
      else if(it.k==='coffee'){gain(a,7,true);pop(a.f,a.x,a.y-30,'회복 +7','#7a4b2a');}
      else if(it.k==='food'){gain(a,15);pop(a.f,a.x,a.y-30,'+15 '+pick(['치킨','짜장면','피자','김밥','떡볶이']),'#2f7d4f');}
      else if(!STORE.has(it.k)){applyItem(a,it.k);if(a.isPlayer){const I=ITEMS[it.k];tell(a,`${I.n} · ${I.s}`);}}
      else if(it.k==='stapler'){a.ammo=15;pop(a.f,a.x,a.y-30,'스테이플러 장전 15발',ITEMS.stapler.c);tell(a,'스테이플러 · 15발 연사');}
      else{a.items.push(it.k);if(a.isPlayer){const I=ITEMS[it.k];pop(a.f,a.x,a.y-30,I.n,I.c);tell(a,`${I.n} · ${I.s}`);}}}
  }
  for(let i=G.drops.length-1;i>=0;i--){const d=G.drops[i];const a=al.find(a=>a.f===d.f&&!a.carry&&Math.hypot(a.x-d.x,a.y-d.y)<22);
    if(a){G.drops.splice(i,1);a.carry=true;pop(a.f,a.x,a.y-30,'출력물 주움','#1d2328');tell(a,'떨어진 출력물을 주웠다: 결재함으로 배달');}}
  for(const a of al){if(!a.carry)continue;const b=FLOORS[a.f].spots.box;if(Math.hypot(a.x-b.x,a.y-b.y)<42){a.carry=false;const dbl=warnFloor(a.f)?2:1;jobDone(a,'dev');gain(a,12*dbl);a.lastTaskT=G.t;a.tasksDone++;worked(a);
    pop(a.f,a.x,a.y-30,`+${12*dbl} 출력물 배달`,'#2f7d4f');tell(a,`배달 완료 +${12*dbl}`);}}
  // tasks
  G.respawn=G.respawn.filter(r=>r.at>G.t);
  for(let i=G.tasks.length-1;i>=0&&!G.lunch;i--){
    const t=G.tasks[i];
    let on=al.filter(a=>inTaskRange(a,t)&&!locked(a)&&!a.chan);
    /* a task belongs to whoever started it: only they fill it and hand it in. If they stay away for 2.5 s
       (or drop out) it goes back on the board from zero, so nobody can walk in and take a finished one */
    if(t.by){if(on.includes(t.by))t.awayT=0;else if((t.awayT+=dt)>2.5||!t.by.alive){t.by=null;t.awayT=0;t.prog=0;t.ready=false;t.react={};}}
    if(!t.by&&on.length&&!t.ready){t.by=on.slice().sort((p,q)=>Math.hypot(p.x-t.x,p.y-t.y)-Math.hypot(q.x-t.x,q.y-t.y))[0];}
    for(const h of on)if(h.isPlayer&&t.by&&h!==t.by&&G.t>(h.busyT||0)){h.busyT=G.t+6;tell(h,`${t.by.name}님이 하고 있는 업무예요`);}
    on=on.filter(a=>a===t.by);
    if(!t.ready){
      const work=t.kind==='server'?on.filter(a=>Math.hypot(a.vx,a.vy)<5):on;
      if(t.kind==='server'&&on.length&&!work.length)t.prog=0;
      if(work.length){
        let rate=1/t.need;
        if(t.seat&&work.some(a=>t.seat.owner===a&&a.sit===t.seat))rate*=1.5;
        {const d=Math.max(0,...work.map(a=>a.branch==='dev'?teamK(a):0));rate*=1+d;} // 개발: 대리 1.5배, 팀장 2배
        if(work.some(a=>a.rushT>0))rate*=2; // 개발팀장 야근 모드
        t.prog+=rate*dt;
        if(t.prog>=1){
          if(t.kind==='print'){const w=work.filter(a=>!a.carry).sort((a,b)=>dist(a,t)-dist(b,t))[0];
            if(w){w.carry=true;pop(w.f,w.x,w.y-30,'출력 완료: 결재함으로','#1d2328');tell(w,'출력물을 들었다: 결재함으로 배달 (맞으면 떨어뜨림)');G.tasks.splice(i,1);}else t.prog=1;}
          else{t.ready=true;t.prog=1;}
        }
      }else if(!t.by)t.prog=Math.max(0,t.prog-dt*.1);
    }else{
      /* bots hand it in after a short reaction; people after 1 s on their own, or right away with E */
      for(const a of on){if(t.react[a.id]===undefined)t.react[a.id]=G.t+(a.isPlayer?1:rnd(.25,.85));else if(G.t>=t.react[a.id]){submitTask(a,t);break;}}
    }
  }
  // closed floors + overtime
  for(const a of G.over?[]:al){if(a.f<G.closed&&!(G.lunch&&G.lunch.kind==='ladder')){dmg(a,4*dt,'zone');}if(G.final&&G.finalT>30)dmg(a,(1.4+(G.finalT-30)*.05)*dt,'overtime');}
  // deaths (none after the match is decided: the result is final)
  for(const a of G.over?[]:alive()){
    if(a.g>0)continue;
    a.g=0;a.alive=false;a.outT=G.t;a.chan=null;a.contact=null;a.call=null;stand(a);const left=aliveCount();a.place=left+1;
    const killer=(a.cause==='paper')&&a.lastHitBy&&G.t-a.lastHitT<4?a.lastHitBy:null;a.killer=killer;
    if(killer&&killer.alive){worked(killer);const RI=['인턴','사원','대리','팀장','임원'],v=10+(RI.indexOf(a.rank)>RI.indexOf(killer.rank)?6:0);gain(killer,v);killer.kills=(killer.kills||0)+1;
      pop(killer.f,killer.x,killer.y-52,`처리 +${v}`,'#2f7d4f');} // the killer's screen shows its own banner
    if(a.f>=0){a.items.forEach((k,j)=>spawnItem(a.f,k,{x:a.x+12+j*8,y:a.y+j*8}));a.items=[];spawnItem(a.f,null,{x:a.x-12,y:a.y+6});if(a.carry)G.drops.push({f:a.f,x:a.x,y:a.y-10});}
    a.carry=false;
    /* only news that matters to the viewer: my own end, or another real person's (bots dropping out show in the head count) */
    feed(v=>a===v?'내가 권고사직 처리되었습니다':killer===v||!a.isPlayer?null:`${a.name}님 권고사직${killer?` · ${killer.name}님 서류`:''}`,a.isPlayer);
    if(a.isPlayer)UI.result(false,800,a);
  }
  if(!G.over&&aliveCount()<=1){
    G.over=true;const w=G.actors.find(a=>a.alive);
    if(w){feed(v=>`${w===v?'내가':w.name+'님이'} CEO실에 입성했습니다`,true);G.winner=w;}
    for(const h of humans())UI.result(h===w,1200,h);
  }
  for(const p of G.pops)p.t+=dt;G.pops=G.pops.filter(p=>p.t<(p.say?2.4:1.1));

}
