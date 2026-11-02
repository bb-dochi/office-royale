/* ================= bots ================= */
function setGoal(b,p,mode){
  b.mode=mode;b.target=null;
  if(!b.goal||Math.hypot(b.goal.x-p.x,b.goal.y-p.y)>24||b.pathAge<=0){b.goal={x:p.x,y:p.y};b.path=findPath(b.f,b.x,b.y,p.x,p.y);b.pathAge=1.6;}
}
function botItems(b,enemy,ed){
  if(G.audit&&G.audit.f===b.f)return;
  for(let i=0;i<b.items.length;i++){const k=b.items[i];let use=false;
  const near=G.actors.filter(o=>o!==b&&o.alive&&o.f===b.f&&dist(o,b)<260);
  if(k==='coffee')use=b.g<88;
  else if(k==='stamp')use=G.t-b.lastHitT<2||(enemy&&ed<260);
  else if(k==='stapler')use=enemy&&ed<300;
  else if(k==='card')use=enemy&&ed<190;
  else if(k==='bundle')use=near.length>=2||(enemy&&ed<240);
  else if(k==='ticket')use=b.mode==='travel';
  else if(k==='vip')use=enemy&&ed<300&&watchers(b).some(n=>dist(n,b)<320);
  else if(k==='spill')use=enemy&&ed<160;
  if(use){useItem(b,i);return;}}
}
function think(b){
  if(b.f<0||b.chan||locked(b))return;
  const f=b.f,fl=FLOORS[f];
  const enemy=nearest(b,300,true),ed=enemy?dist(b,enemy):1e9;
  botItems(b,enemy,ed);
  if(f===ROOF){
    /* lunch: light up when someone is on us, bring lighters home, grab lighters, otherwise fight */
    if(G.lunch&&enemy&&ed<190&&b.smokeCd<=0&&(G.t-b.lastHitT<2||Math.random()<.15))smoke(b);
    const L=G.lunch;
    if(L&&L.kind==='bill'){ /* holding a bill: go and pass it on; otherwise keep away from whoever has one */
      if(b.bill){const t=G.actors.filter(o=>o!==b&&o.alive&&o.f===ROOF&&!o.bill&&!(b.billFrom===o&&G.t-b.billT<LUNCH.bill.safe)).sort((p,q)=>dist(b,p)-dist(b,q))[0];
        if(t){b.mode='fight';b.target=t;b.goal=null;return;}}
      else{const h=G.actors.find(o=>o.alive&&o.f===ROOF&&o.bill&&dist(o,b)<170);
        if(h){if(b.smokeCd<=0&&Math.random()<.3)smoke(b);if(Math.random()<.65){if(b.mode!=='flee'||!b.goal||dist(b,b.goal)<30)setGoal(b,[0,1,2,3].map(()=>randFree(ROOF)).sort((p,q)=>dist(q,h)-dist(p,h))[0],'flee');return;}}}}
    if(L&&L.kind==='meal'&&L.zone){ /* hold the serving counter, push out whoever else is in the ring */
      const z=L.zone,rival=G.actors.find(o=>o!==b&&o.alive&&o.f===ROOF&&dist(o,z)<LUNCH.meal.r*1.3);
      if(dist(b,z)<LUNCH.meal.r*.7){if(rival){b.mode='fight';b.target=rival;b.goal=null;return;}b.mode='hold';b.goal=null;b.path=[];return;}
      if(!(enemy&&ed<90)){setGoal(b,z,'meal');return;}}
    if(b.lighter>0&&!(enemy&&ed<110)){const ash=ashOf(b.side).sort((p,q)=>dist(b,p)-dist(b,q))[0];if(ash){setGoal(b,ash,'deliver');return;}}
    const it=G.items.filter(x=>x.f===ROOF&&(x.k==='lighter'?(b.lighter||0)<LUNCH.carry:canTake(b,x.k))).sort((p,q)=>dist(b,p)*(p.k==='lighter'?.6:1)-dist(b,q)*(q.k==='lighter'?.6:1))[0];
    if(enemy&&(ed<160||!it)){b.mode='fight';b.target=enemy;b.goal=null;return;}
    if(it){setGoal(b,it,'loot');return;}
    if(b.mode!=='wander'||!b.goal||dist(b,b.goal)<20)setGoal(b,randFree(ROOF),'wander');return;
  }
  if(roofLunch()&&G.lunch.t>4&&b.lunchGo){goRoof(b);return;} // like people, bots head up from wherever they are
  if(b.branch==='mkt'&&b.skillCd<=0&&G.actors.some(o=>o!==b&&o.alive&&visibleTo(b,o)&&dist(o,b)<220)&&!watchers(b).some(n=>!immune(b,n)&&sees(n,b)))useSkill(b);
  if(b.branch==='design'&&b.skillCd<=0&&b.g<35&&G.t-b.lastHitT<2)useSkill(b);
  if(b.branch==='hr'&&b.skillCd<=0&&G.t-b.lastHitT<3&&G.actors.some(o=>o!==b&&visibleTo(b,o)&&dist(o,b)<150))useSkill(b);
  if(b.branch==='dev'&&b.skillCd<=0&&G.tasks.some(t=>t.f===b.f&&!t.ready&&dist(t,b)<50))useSkill(b);
  let want=Math.max(b.pref,G.closed);
  if(f<G.closed||(f===G.closed&&G.closed<NF-1&&G.nextClose<b.greed+tagOf(b)+3))want=Math.max(want,f+1); // each at their own moment, from well before the warning: leaving together made a crowd at the stairs
  want=Math.min(want,topOpen());
  if(f<want){
    stand(b);const pk=G.fire>0?'stair':b.padPref,pad=PADS[pk];
    const provoked=b.lastHitBy&&b.lastHitBy.alive&&b.lastHitBy.f===f&&G.t-b.lastHitT<2&&f>=G.closed;
    if(provoked){b.mode='fight';b.target=b.lastHitBy;b.goal=null;return;} // on the way up too, even on a closing floor (the queue at the stairs was free hits)
    if(dist(b,pad)<30){if(!startChan(b,pk,+1)){b.padPref=pk==='stair'?'elev':'stair';}return;}
    if(provoked&&!warnFloor(f)){b.mode='fight';b.target=b.lastHitBy;b.goal=null;return;}
    setGoal(b,pad,'travel');return;
  }
  if(b.docs>0){const n=watchers(b).find(n=>dist(n,b)<320);if(n){if(dist(n,b)<130){submitDoc(b,n);}else{setGoal(b,n,'doc');return;}}}
  if(b.desk&&!G.tasks.some(t=>t.ready&&t.by===b))return; // working at the desk: untouchable until it's done
  if(b.sit){if(b.g>=b.sitGoal||G.t-b.sitStart>12||(enemy&&ed<110)||G.tasks.some(t=>t.ready&&inTaskRange(b,t)))stand(b);else return;}
  const provoked=b.lastHitBy&&b.lastHitBy.alive&&b.lastHitBy.f===f&&visibleTo(b,b.lastHitBy)&&G.t-b.lastHitT<5;
  let best=enemy,aggro=false;
  if(G.star&&G.star.a.alive&&G.star.a.f===f&&G.star.a!==b&&dist(b,G.star.a)<400&&b.type!=='아부꾼'){best=G.star.a;aggro=true;}
  else if(b.type==='폭주')aggro=!!best&&(G.closed>0||ed<200);
  else if(b.type==='정치꾼')aggro=(!!best&&G.closed>0)||provoked;
  else if(b.type==='성실파'||b.type==='아부꾼'){aggro=provoked||(G.final&&!!best);if(provoked)best=b.lastHitBy;}
  else if(b.type==='루팡'){aggro=(best&&best.g<35)||provoked||G.final;if(provoked)best=b.lastHitBy;}
  /* 보통 and up: a person who comes close gets jumped, whatever the bot's type (bots still mind the bosses when throwing) */
  if(!aggro&&b.hunter&&!G.lunch&&diff().hunt&&!b.carry){
    const h=G.actors.find(o=>o.isPlayer&&visibleTo(b,o)&&dist(o,b)<diff().hunt&&shotLos(f,b.x,b.y,o.x,o.y)&&G.actors.filter(x=>x!==b&&x.mode==='fight'&&x.target===o).length<diff().huntMax);
    if(h){best=h;aggro=true;}}
  /* last floor: seekers go after the nearest person, walking to them when they're out of sight. They search in spells
     (12–20 s on, 5–9 s off, doing whatever they'd normally do) and pick a fight with anyone close on the way, bots included */
  if(b.seeker&&G.final&&G.finalT>diff().seekAfter&&!b.carry&&!provoked){
    if(!b.seekPh||G.t>b.seekPh.end)b.seekPh=b.seekPh&&b.seekPh.on?{on:false,end:G.t+rnd(5,9)}:{on:true,end:G.t+rnd(12,20)};
    const h=humans().filter(o=>o.alive&&o.f===f).sort((p,q)=>dist(b,p)-dist(b,q))[0];
    if(enemy&&ed<170){best=enemy;aggro=true;}
    else if(h&&b.seekPh.on){if(visibleTo(b,h)&&dist(b,h)<300&&shotLos(f,b.x,b.y,h.x,h.y)){best=h;aggro=true;}else{setGoal(b,h,'seek');return;}}}
  if(aggro&&best&&!(b.carry&&!provoked)){b.mode='fight';b.target=best;b.goal=null;return;}
  if(b.carry){setGoal(b,fl.spots.box,'deliver');return;}
  const dr=G.drops.find(d=>d.f===f&&Math.hypot(d.x-b.x,d.y-b.y)<320);
  if(dr){setGoal(b,dr,'drop');return;}
  if(G.cake&&G.cake.f===f&&dist(b,G.cake)<500){setGoal(b,G.cake,'cake');return;}
  {const cart=G.npcs.find(n=>n.kind==='cart'&&n.f===f&&npcActive(n));if(cart&&b.g<45&&dist(b,cart)<450){setGoal(b,cart,'cart');return;}}
  {
    let it=null,id=b.type==='폭주'||b.type==='정치꾼'?340:240;
    for(const x of G.items){if(x.f!==f||!canTake(b,x.k))continue;const d=dist(b,x);if(d<id&&shotLos(f,b.x,b.y,x.x,x.y)){id=d;it=x;}}
    if(it){setGoal(b,it,'loot');return;}
  }
  if(b.g<38){
    const s=b.seats[f];
    if(s&&(!s.occ||s.occ===b)&&!warnFloor(f)&&b.deskCd<=0){setGoal(b,s,'rest');return;}
    if(b.coffeeCd<=0&&f>0){setGoal(b,fl.spots.coffee,'coffee');return;}
  }
  if(b.coolerCd<=0&&b.g<60&&dist(b,fl.spots.cooler)<300){setGoal(b,{x:fl.spots.cooler.x-40,y:fl.spots.cooler.y+20},'cooler');return;}
  const door=G.doors[f];
  if(door&&door.v&&door.v.t>4&&dist(b,DOOR)<420&&(b.type==='성실파'||b.type==='아부꾼'||(b.doorRoll??=Math.random())<.15)){setGoal(b,DOOR,'door');return;}
  if(b.type==='루팡'&&!G.final&&G.t-b.workT<IDLE*.6&&Math.random()<.5){if(!b.hide||b.hideF!==f){const s=b.seats[f];b.hide=s&&!s.occ?s:randFree(f);b.hideF=f;}setGoal(b,b.hide,'hide');return;}
  let tk=null,td=1e9;for(const t of G.tasks){if(t.f!==f||t.by&&t.by!==b)continue;if(t.kind==='print'&&b.carry)continue;const d=Math.hypot(b.x-t.x,b.y-t.y)*(t.ready?.6:1);if(d<td){td=d;tk=t;}}
  if(tk){
    let p=tk;if(tk.zone){if(!b.taskPt||b.taskPtId!==tk.id){b.taskPt={x:tk.zone.x+rnd(24,tk.zone.w-24),y:tk.zone.y+rnd(24,tk.zone.h-24)};b.taskPtId=tk.id;}p=b.taskPt;}
    else if(tk.kind==='copy'||tk.kind==='print'){p={x:tk.x+K(56),y:tk.y};}
    setGoal(b,p,'task');return;
  }
  if(b.mode!=='wander'||!b.goal||dist(b,b.goal)<20)setGoal(b,randFree(f),'wander');
}
function follow(b){
  if(!b.path.length)return[0,0];
  while(b.path.length>1&&shotLos(b.f,b.x,b.y,b.path[1].x,b.path[1].y,R-2))b.path.shift();
  const p=b.path[0],dx=p.x-b.x,dy=p.y-b.y,d=Math.hypot(dx,dy);
  if(d<6){b.path.shift();return b.path.length?follow(b):[0,0];}
  return[dx/d,dy/d];
}
/* how well this bot moves in a fight (0..1), rolled once from the difficulty's tiers ([share up to, low, high]):
   a 고수 strafes at full speed and switches sides often, a 허당 strafes slowly, keeps one way longer, stops now and then and dodges less */
function moveSk(b){if(b.moveSk==null){const r=Math.random(),t=diff().move.find(t=>r<t[0])||diff().move.at(-1);b.moveSk=rnd(t[1],t[2]);}return b.moveSk;}
/* a paper coming straight at me: step sideways out of its line. One roll per paper; the chance grows with difficulty,
   and a bot hit in the last few seconds is on guard (diff().guard). Like a person it needs a moment to see the paper (it must
   have flown diff().see seconds, so a close throw can't be dodged) and to get its feet back after a sidestep (diff().dodgeCd: shorter on harder levels), so it can't
   weave out of every paper in a volley */
function dodgeCheck(b){
  if(G.t<(b.dodgeCd||0))return;
  const D=diff();
  for(const p of G.proj){
    if(p.f!==b.f||p.o===b||b.dodged===p||p.d<p.sp*D.see)continue;
    const rx=b.x-p.x,ry=b.y-p.y,ahead=rx*p.dx+ry*p.dy,side=ry*p.dx-rx*p.dy;
    if(ahead<=0||ahead>p.sp*.4||ahead>p.rng-p.d||Math.abs(side)>R+10)continue;
    b.dodged=p;
    if(Math.random()>(D.dodge+(G.t-(b.lastHitT??-9)<4?D.guard:0))*(.4+.6*moveSk(b)))continue;
    const s=side>=0?1:-1;b.dodge={x:-p.dy*s,y:p.dx*s,t:.3};b.dodgeCd=G.t+rnd(...D.dodgeCd);return;
  }
}
/* bots lead a moving target too, by part of the way (diff().lead: 쉬움 30%, 보통 60%, 어려움 85%), so strafing
   doesn't make you untouchable; capped at 15° like a person's eye would. They read how the target has been moving
   lately (svx/svy, see drive), so fast weaving still works against them, and never aim at a spot behind a wall */
function botLead(b,t){
  const a0=Math.atan2(t.y-b.y,t.x-b.x),vx=t.svx||0,vy=t.svy||0;if(Math.hypot(vx,vy)<20||locked(t)||t.sit||t.chan)return a0;
  const sp=b.ammo>0?720:560,k=diff().lead,tt=dist(b,t)/sp,px=t.x+vx*tt*k,py=t.y+vy*tt*k;
  if(!shotLos(b.f,b.x,b.y,px,py))return a0;
  const L=15*Math.PI/180;return a0+bendTo(Math.atan2(py-b.y,px-b.x),a0,L);
}
function updBot(b,dt){
  b.think-=dt;if(b.think<=0){b.think=.22+Math.random()*.12;think(b);}
  b.pathAge-=dt;b.react-=dt;
  if(locked(b)||b.chan||b.sit||b.f<0)return;
  const fl=FLOORS[b.f];
  if(b.mode==='rest'){const s=b.seats[b.f];if(s&&dist(b,s)<14&&!s.occ&&b.deskCd<=0){sit(b,s);b.sitGoal=Math.min(100,b.g+15);return;}}
  if(b.mode==='door'&&dist(b,DOOR)<44&&G.doors[b.f].v){openDoor(b);b.mode='idle';return;}
  if(b.mode==='coffee'&&dist(b,fl.spots.coffee)<34&&b.coffeeCd<=0){b.mode='idle';}
  for(const d of fl.doors)if(!d.open&&Math.hypot(b.x-(d.x+d.w/2),b.y-(d.y+d.h/2))<46)toggleDoor(b.f,d,true);
  let vx=0,vy=0;
  if(!(b.dodge&&b.dodge.t>0))dodgeCheck(b);
  if(b.dodge&&b.dodge.t>0){b.dodge.t-=dt;vx=b.dodge.x;vy=b.dodge.y;}
  else if(b.throwT>0)b.throwT-=dt; // plants their feet for a moment to throw: a window to hit back (a paper coming in still makes them dodge)
  else if(b.nudge&&b.nudge.t>0){b.nudge.t-=dt;vx=b.nudge.x;vy=b.nudge.y;}
  else if(b.mode==='fight'&&b.target&&visibleTo(b,b.target)){
    const t=b.target,d=dist(b,t),see=shotLos(b.f,b.x,b.y,t.x,t.y);
    if(d>230||!see){if(b.pathAge<=0){b.path=findPath(b.f,b.x,b.y,t.x,t.y);b.pathAge=.6;}[vx,vy]=follow(b);}
    else{
      const ax=(t.x-b.x)/d,ay=(t.y-b.y)/d;let fx=-ay*b.strafe,fy=ax*b.strafe;
      if(d<150){fx-=ax*.8;fy-=ay*.8;}else if(d>200){fx+=ax*.5;fy+=ay*.5;}
      const sk=moveSk(b),m=(Math.hypot(fx,fy)||1)/(.5+.5*sk);vx=fx/m;vy=fy/m;if(Math.random()<dt*(.25+.6*sk))b.strafe*=-1;
      if(b.idleT>0){b.idleT-=dt;vx=vy=0;}else if(Math.random()<dt*(1-sk)*.6)b.idleT=rnd(.4,.7); // a 허당 stands there for a moment
    }
    b.face=Math.atan2(t.y-b.y,t.x-b.x);
    if(b.cd<=0&&b.react<=0&&d<330&&see){b.face=botLead(b,t);
      const careful=b.type!=='폭주'&&!G.final;
      const D=diff(),risky=watchers(b).some(n=>!immune(b,n)&&(sees(n,b)||dist(n,t)<VIS[n.kind].sound*.8));
      if(!(careful&&risky)){if(throwPaper(b,b.face+(Math.random()-.5)*(b.type==='폭주'?.5:.3)*D.aim))b.throwT=rnd(...D.plant);b.react=Math.max(.08,.15+Math.random()*.45+D.react);}
    }
  }else{if(b.mode==='fight')b.mode='idle';[vx,vy]=follow(b);if(vx||vy)b.face=Math.atan2(vy,vx);}
  b.stuckT+=dt;
  if(b.stuckT>.8){
    if((vx||vy)&&Math.hypot(b.x-b.sx,b.y-b.sy)<6){const a=Math.random()*6.28;b.nudge={x:Math.cos(a),y:Math.sin(a),t:.35};b.pathAge=0;b.path=[];}
    b.sx=b.x;b.sy=b.y;b.stuckT=0;
  }
  drive(b,vx,vy,dt);
}
