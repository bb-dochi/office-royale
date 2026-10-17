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
    const it=G.items.filter(x=>x.f===ROOF&&canTake(b,x.k)).sort((p,q)=>dist(b,p)-dist(b,q))[0];
    if(enemy&&(ed<220||!it)){b.mode='fight';b.target=enemy;b.goal=null;return;}
    if(it){setGoal(b,it,'loot');return;}
    if(b.mode!=='wander'||!b.goal||dist(b,b.goal)<20)setGoal(b,randFree(ROOF),'wander');return;
  }
  if(G.lunch&&G.lunch.t>4&&b.lunchGo){stand(b);const pk=b.lunchPad||'elev';
    if(dist(b,PADS[pk])<34){goRoof(b,pk==='stair'?'L':'R');return;}setGoal(b,PADS[pk],'roof');return;}
  if(b.branch==='mkt'&&b.skillCd<=0&&G.actors.filter(o=>visibleTo(b,o)&&dist(o,b)<200).length>=2&&!watchers(b).some(n=>!immune(b,n)&&sees(n,b)))useSkill(b);
  if(b.branch==='design'&&b.skillCd<=0&&b.g<35&&G.t-b.lastHitT<2)useSkill(b);
  let want=Math.max(b.pref,G.closed);
  if(f<G.closed||(warnFloor(f)&&G.nextClose<b.greed+tagOf(b)+3))want=Math.max(want,f+1);
  want=Math.min(want,topOpen());
  if(f<want){
    stand(b);const pk=G.fire>0?'stair':b.padPref,pad=PADS[pk];
    if(dist(b,pad)<30){if(!startChan(b,pk,+1)){b.padPref=pk==='stair'?'elev':'stair';}return;}
    const provoked=b.lastHitBy&&b.lastHitBy.alive&&b.lastHitBy.f===f&&G.t-b.lastHitT<2&&f>=G.closed;
    if(provoked&&!warnFloor(f)){b.mode='fight';b.target=b.lastHitBy;b.goal=null;return;}
    setGoal(b,pad,'travel');return;
  }
  if(b.docs>0){const n=watchers(b).find(n=>dist(n,b)<320);if(n){if(dist(n,b)<130){submitDoc(b,n);}else{setGoal(b,n,'doc');return;}}}
  if(b.sit){if(b.g>=b.sitGoal||G.t-b.sitStart>12||(enemy&&ed<110)||G.tasks.some(t=>t.ready&&inTaskRange(b,t)))stand(b);else return;}
  const provoked=b.lastHitBy&&b.lastHitBy.alive&&b.lastHitBy.f===f&&visibleTo(b,b.lastHitBy)&&G.t-b.lastHitT<5;
  let best=enemy,aggro=false;
  if(G.star&&G.star.a.alive&&G.star.a.f===f&&G.star.a!==b&&dist(b,G.star.a)<400&&b.type!=='아부꾼'){best=G.star.a;aggro=true;}
  else if(b.type==='폭주')aggro=!!best&&(G.closed>0||ed<200);
  else if(b.type==='정치꾼')aggro=(!!best&&G.closed>0)||provoked;
  else if(b.type==='성실파'||b.type==='아부꾼'){aggro=provoked||(G.final&&!!best);if(provoked)best=b.lastHitBy;}
  else if(b.type==='루팡'){aggro=(best&&best.g<35)||provoked||G.final;if(provoked)best=b.lastHitBy;}
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
    if(s&&(!s.occ||s.occ===b)&&!warnFloor(f)){setGoal(b,s,'rest');return;}
    if(b.coffeeCd<=0&&f>0){setGoal(b,fl.spots.coffee,'coffee');return;}
  }
  if(b.coolerCd<=0&&b.g<60&&dist(b,fl.spots.cooler)<300){setGoal(b,{x:fl.spots.cooler.x-40,y:fl.spots.cooler.y+20},'cooler');return;}
  const door=G.doors[f];
  if(door&&door.v&&door.v.t>4&&dist(b,DOOR)<420&&(b.type==='성실파'||b.type==='아부꾼'||(b.doorRoll??=Math.random())<.15)){setGoal(b,DOOR,'door');return;}
  if(b.type==='루팡'&&!G.final&&Math.random()<.5){if(!b.hide||b.hideF!==f){const s=b.seats[f];b.hide=s&&!s.occ?s:randFree(f);b.hideF=f;}setGoal(b,b.hide,'hide');return;}
  let tk=null,td=1e9;for(const t of G.tasks){if(t.f!==f)continue;if(t.kind==='print'&&b.carry)continue;const d=Math.hypot(b.x-t.x,b.y-t.y)*(t.ready?.6:1);if(d<td){td=d;tk=t;}}
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
function updBot(b,dt){
  b.think-=dt;if(b.think<=0){b.think=.22+Math.random()*.12;think(b);}
  b.pathAge-=dt;b.react-=dt;
  if(locked(b)||b.chan||b.sit||b.f<0)return;
  const fl=FLOORS[b.f];
  if(b.mode==='rest'){const s=b.seats[b.f];if(s&&dist(b,s)<14&&!s.occ){sit(b,s);b.sitGoal=Math.min(100,b.g+15);return;}}
  if(b.mode==='door'&&dist(b,DOOR)<44&&G.doors[b.f].v){openDoor(b);b.mode='idle';return;}
  if(b.mode==='coffee'&&dist(b,fl.spots.coffee)<34&&b.coffeeCd<=0){b.mode='idle';}
  for(const d of fl.doors)if(!d.open&&Math.hypot(b.x-(d.x+d.w/2),b.y-(d.y+d.h/2))<46)toggleDoor(b.f,d,true);
  let vx=0,vy=0;
  if(b.nudge&&b.nudge.t>0){b.nudge.t-=dt;vx=b.nudge.x;vy=b.nudge.y;}
  else if(b.mode==='fight'&&b.target&&visibleTo(b,b.target)){
    const t=b.target,d=dist(b,t),see=shotLos(b.f,b.x,b.y,t.x,t.y);
    if(d>230||!see){if(b.pathAge<=0){b.path=findPath(b.f,b.x,b.y,t.x,t.y);b.pathAge=.6;}[vx,vy]=follow(b);}
    else{
      const ax=(t.x-b.x)/d,ay=(t.y-b.y)/d;let fx=-ay*b.strafe,fy=ax*b.strafe;
      if(d<150){fx-=ax*.8;fy-=ay*.8;}else if(d>200){fx+=ax*.5;fy+=ay*.5;}
      const m=Math.hypot(fx,fy)||1;vx=fx/m;vy=fy/m;if(Math.random()<dt*.6)b.strafe*=-1;
    }
    b.face=Math.atan2(t.y-b.y,t.x-b.x);
    if(b.cd<=0&&b.react<=0&&d<330&&see){
      const careful=b.type!=='폭주'&&!G.final;
      const risky=watchers(b).some(n=>!immune(b,n)&&(sees(n,b)||dist(n,t)<VIS[n.kind].sound*.8));
      if(!(careful&&risky)){throwPaper(b,b.face+(Math.random()-.5)*(b.type==='폭주'?.5:.3));b.react=.15+Math.random()*.45;}
    }
  }else{if(b.mode==='fight')b.mode='idle';[vx,vy]=follow(b);if(vx||vy)b.face=Math.atan2(vy,vx);}
  b.stuckT+=dt;
  if(b.stuckT>.8){
    if((vx||vy)&&Math.hypot(b.x-b.sx,b.y-b.sy)<6){const a=Math.random()*6.28;b.nudge={x:Math.cos(a),y:Math.sin(a),t:.35};b.pathAge=0;b.path=[];}
    b.sx=b.x;b.sy=b.y;b.stuckT=0;
  }
  drive(b,vx,vy,dt);
}
