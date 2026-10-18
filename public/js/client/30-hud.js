/* ================= HUD ================= */
function towerHTML(nowF,newF){
  const counts=new Array(NF).fill(0);
  for(const a of G.actors)if(a.alive){const f=a.transit?a.transit.to:a.f;if(f>=0)counts[f]++;}
  const meF=G.me.alive?(G.me.transit?G.me.transit.to:G.me.f):-9;
  let h=`<div class="fl ceo"><span>7F</span><span>CEO층</span><span class="ct"></span></div>`;
  if(G.lunch){const rc=G.actors.filter(a=>a.alive&&(a.f===ROOF||(a.transit&&a.transit.to===ROOF))).length;h=`<div class="fl warn"><span>RF</span><span>옥상 점심</span><span class="ct">${rc}</span></div>`+h;}
  for(let f=NF-1;f>=0;f--){
    let st=f<G.closed&&f!==nowF?'closed':isLocked(f)&&f!==newF?'locked':'';
    if(nowF===-1&&newF===-1&&warnFloor(f))st+=' warn';
    const cls=['fl',st,f===meF?'me':'',f===nowF?'now':'',f===newF?'new':''].join(' ');
    const ev=(G.ceo&&G.ceo.f===f)?'대표':(G.blackout&&G.blackout.f===f)?'정전':(G.audit&&G.audit.f===f)?'감사':'';
    const ct=st.startsWith('closed')?'✕':st.startsWith('locked')?'🔒':(ev||counts[f]);
    h+=`<div class="${cls}"><span>${FLOORS[f].short}</span><span class="dots"><i style="width:${counts[f]/TOTAL*100}%"></i></span><span class="ct">${ct}</span></div>`;
  }
  return h;
}
let cineT=0;
function drawMini(){
  const c=$('mm').getContext('2d'),W=340,H=235,s=Math.min(W/FW,H/FH),f=viewF,fl=FLOORS[f],me=G.me;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.setTransform(s,0,0,s,(W-FW*s)/2,(H-FH*s)/2);
  c.fillStyle=f<G.closed?'#5a2a24':fl.carpet;c.fillRect(0,0,FW,FH);
  c.fillStyle='rgba(255,255,255,.35)';c.fillRect(fl.rest.x,fl.rest.y,fl.rest.w,fl.rest.h);
  for(const z of fl.meet){c.fillStyle='rgba(150,195,220,.35)';c.fillRect(z.x,z.y,z.w,z.h);}
  for(const o of fl.ob){c.fillStyle=o.k==='glass'?'#7fb3d6':o.k==='wall'?'#2a3036':'#7d868e';c.fillRect(o.x,o.y,Math.max(o.w,10),Math.max(o.h,10));}
  for(const d of fl.doors)if(!d.open){c.fillStyle='#8a6a4a';c.fillRect(d.x,d.y,Math.max(d.w,12),Math.max(d.h,12));}
  for(const k in PADS){const p=PADS[k];c.fillStyle='#f3d77a';c.fillRect(p.x-30,p.y-30,60,60);}
  const d=G.doors[f];c.fillStyle=d&&d.v&&Math.sin(G.t*8)>0?'#cf3626':'#4b555d';c.fillRect(DOOR.x-40,FH-14,80,14);
  for(const t of G.tasks){if(t.f!==f)continue;c.fillStyle=t.ready?'#2f7d4f':'#f3d77a';c.strokeStyle='#1d2328';c.lineWidth=6;c.beginPath();c.arc(t.x,t.y,26,0,7);c.fill();c.stroke();}
  const ms=me.seats[f];if(ms){c.fillStyle='#6fb2ff';c.fillRect(ms.x-18,ms.y-18,36,36);}
  for(const n of G.npcs){if(n.f!==f||!npcActive(n)||(n.kind!=='boss'&&n.kind!=='ceo'))continue;
    c.fillStyle=n.kind==='ceo'?'#c08a1e':'#cf3626';c.beginPath();c.moveTo(n.x,n.y);c.arc(n.x,n.y,140,n.face-.52,n.face+.52);c.closePath();c.globalAlpha=.35;c.fill();c.globalAlpha=1;
    c.beginPath();c.arc(n.x,n.y,26,0,7);c.fill();}
  if(G.star&&G.star.a.alive&&G.star.a.f===f){const a=G.star.a;c.fillStyle='#c08a1e';c.beginPath();c.arc(a.x,a.y,30,0,7);c.fill();}
  if(me.intelT>0)for(const o of G.actors)if(o!==me&&o.alive&&o.f===f){c.fillStyle='#e5483a';c.beginPath();c.arc(o.x,o.y,24,0,7);c.fill();}
  if(me.alive&&me.f===f){c.fillStyle='#2b6cb0';c.strokeStyle='#fbfaf6';c.lineWidth=8;c.beginPath();c.arc(me.x,me.y,30,0,7);c.fill();c.stroke();
    c.strokeStyle='#2b6cb0';c.lineWidth=10;c.beginPath();c.moveTo(me.x,me.y);c.lineTo(me.x+Math.cos(me.face)*70,me.y+Math.sin(me.face)*70);c.stroke();}
}
function closureCine(f){
  $('cineTower').hidden=true;$('cineS').textContent='';$('cineT').textContent=`${f===0?'로비':(f+1)+'층'} 폐쇄!`;
  $('cine').hidden=false;cineT=1.6;
}
let hudT=0,lastItem='x',lastPills='',lastCall=null,lastTl='',mapMode='building',mmBuilt=false;
const KB=k=>isTouch?'':`<kbd class="kb in">${k}</kbd>`;
if(!isTouch){[['greetBtn','E'],['throwBtn','Space'],['skillBtn','Q']].forEach(([id,k])=>$(id).insertAdjacentHTML('beforeend',`<kbd class="kb">${k}</kbd>`));}
let branchT=0;
function openBranch(){branchT=10;$('branchOpts').innerHTML=Object.entries(BRANCH).map(([k,v],i)=>`<button data-b="${k}"><b>${isTouch?'':(i+1)+'. '}${v.n}</b><span>${v.d}</span></button>`).join('');$('branchBox').hidden=false;}
/* the rules pick a team by themselves when the 10 s run out (me.branchAsk) */
function pickBranch(k){if(!G||!k)return;$('branchBox').hidden=true;branchT=0;if(!G.me.branch)ACT.branch(k);}
$('branchOpts').addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();e.stopPropagation();pickBranch(b.dataset.b);});
let lastCd='';
function countdown(){
  const el=$('countdown');if(!G||!G.me||!running||G.lunch||G.closed>=NF-1||G.nextClose>5||G.nextClose<=0){if(lastCd){el.hidden=true;lastCd='';}return;}
  const n=Math.ceil(G.nextClose),f=G.closed,key=n+'|'+f;if(key===lastCd)return;lastCd=key;
  $('cdName').textContent=`${f===0?'로비':(f+1)+'층'} 폐쇄까지`;$('cdNum').textContent=n;el.classList.toggle('mine',G.me.f===f);el.hidden=false;
  if(!reduceMotion)el.animate([{transform:'translate(-50%,-50%) scale(1.35)',opacity:.4},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:280,easing:'ease-out'});
}
/* the effects bar: everything currently acting on me, as coloured chips with time or uses left */
let fxSeen=new Set(),fxSig='';
function fxBar(me){
  const E=[],I=ITEMS,C=k=>CAT[k].c,sec=v=>`${Math.ceil(v)}초`;
  if(!running||!me.alive||G.plaza){if(fxSig){fxSig='';$('fx').innerHTML='';}return;}
  if(me.contact)E.push({k:'contact',g:'!',t:me.contact.n.kind==='ceo'?'대표님과 눈 마주침! 인사':'부장님과 눈 마주침! 인사',bad:1});
  if(me.items[0]){const it=I[me.items[0]];E.push({k:'held',g:it.g,c:it.c,t:`${it.n} 들고 있음 · 공격하면 사용`});}
  if(me.ammo>0)E.push({k:'ammo',g:I.stapler.g,c:I.stapler.c,t:`스테이플러 ${me.ammo}발`,bar:me.ammo/15});
  if(me.shieldN>0)E.push({k:'shield',g:I.stamp.g,c:I.stamp.c,t:`결재 도장 · ${me.shieldN}번 막기`});
  if(me.speedT>0)E.push({k:'speed',g:I.ticket.g,c:I.ticket.c,t:`야근 식권 · 빨라짐 ${sec(me.speedT)}`,bar:me.speedT/8});
  if(me.vipT>0)E.push({k:'vip',g:I.vip.g,c:I.vip.c,t:`임원 인맥 · 감지 면제 ${sec(me.vipT)}`,bar:me.vipT/10});
  if(me.stampT>G.t)E.push({k:'stampT',g:'눈',c:C('def'),t:`눈도장 · 호출 면제 ${sec(me.stampT-G.t)}`,bar:(me.stampT-G.t)/10});
  if(me.cloakT>0)E.push({k:'cloak',g:'위',c:C('ctl'),t:`위장 ${sec(me.cloakT)}`,bar:me.cloakT/4});
  if(me.intelT>0)E.push({k:'intel',g:'정',c:C('ctl'),t:`위치 정보 ${sec(me.intelT)}`,bar:me.intelT/8});
  if(me.docs>0)E.push({k:'docs',g:'결',c:C('heal'),t:`결재 서류 ${me.docs}장 · 부장님께 올리기`});
  if(me.branch==='hr'&&!me.revived)E.push({k:'hr',g:'재',c:C('heal'),t:'재입사권 1회'});
  if(me.sit&&me.sit.owner===me)E.push({k:'rest',g:'휴',c:C('heal'),t:`휴식 중 +${Math.floor(me.sitHeal)}/15`,bar:me.sitHeal/15});
  if(me.carry)E.push({k:'carry',g:'출',t:'출력물 배달 중 · 결재함으로'});
  if(me.slowT>0)E.push({k:'slow',g:'↓',t:'둔화',bad:1});
  if(me.lockT>0)E.push({k:'lock',g:'⏸',t:me.lockWhy,bad:1});
  if(me.stunT>0)E.push({k:'stun',g:'술',t:'회식 중 · 못 움직임',bad:1});
  if(me.inRest)E.push({k:'rest2',g:'WC',t:`화장실 ${Math.ceil(me.restT)}초`,bad:me.restT>10?1:0});
  if(onWet(me))E.push({k:'wet',g:'~',t:'미끄러움',bad:1});
  const sig=E.map(e=>e.k+e.t+(e.bar!=null?Math.round(e.bar*40):'')).join('|');if(sig===fxSig)return;fxSig=sig;
  const now=new Set(E.map(e=>e.k));
  $('fx').innerHTML=E.map(e=>`<div class="fx${e.bad?' bad':''}${fxSeen.has(e.k)?'':' new'}" style="--c:${e.c||(e.bad?'#e5483a':'#9aa3ab')}"><i>${e.g}</i><span>${e.t}</span>${e.bar!=null?`<b style="width:${Math.max(0,Math.min(1,e.bar))*100}%"></b>`:''}</div>`).join('');
  fxSeen=now;
}
function hud(dt){
  if(branchT>0&&G&&G.me){branchT=G.me.branchAsk?Math.max(0,G.me.branchAsk-G.t):branchT-dt;$('branchTm').style.width=Math.max(0,branchT/10*100)+'%';if(branchT<=0||G.me.branch){$('branchBox').hidden=true;branchT=0;}}
  if(cineT>0){cineT-=dt;if(cineT<=0)$('cine').hidden=true;}
  if(!G||!G.me)return;const me=G.me;
  // call box (every frame)
  if(me.call&&me.alive){
    if(lastCall!==me.call){lastCall=me.call;$('callWho').textContent=me.call.n.kind==='ceo'?'대표님':'부장님이 부릅니다';$('callQ').textContent=me.call.line.q;
      $('callOpts').innerHTML=callOptions(me).map((o,i)=>`<button data-k="${o.key}">${i+1}. ${o.t}<small>${o.s}</small></button>`).join('');$('callBox').hidden=false;}
    $('callTm').style.width=Math.max(0,me.call.t/me.call.max*100)+'%';
  }else if(lastCall){lastCall=null;$('callBox').hidden=true;}
  hudT-=dt;if(hudT>0)return;hudT=.08;
  $('gval').textContent=Math.ceil(Math.max(0,me.g));$('gbar').style.width=Math.max(0,me.g)+'%';
  $('gbarWrap').classList.toggle('low',me.g<30);$('grade').textContent=gradeOf(me.g);$('pname').textContent='나 · '+rankName(me);
  {const nx=RANKS.find(([t])=>t>me.peak);if(nx){const pv=[...RANKS].reverse().find(([t])=>t<=me.peak)[0],base=Math.max(pv,50);$('promoT').textContent=`${nx[1]}까지 ${Math.ceil(nx[0]-me.peak)}`;$('promoB').style.width=Math.max(0,Math.min(100,(me.peak-base)/(nx[0]-base)*100))+'%';}else{$('promoT').textContent='최고 직급';$('promoB').style.width='100%';}}
  fxBar(me);
  let zone;
  if(G.tutorial)zone='연습 모드<br>폐쇄 없음';
  else if(G.lunch)zone=`점심시간 ${Math.ceil(G.lunch.t)}초<br>구조조정 일시정지`;
  else if(G.closed<NF-1){const nf=G.closed+WIN;zone=G.warn?`${FLOORS[G.closed].short} ${Math.max(0,Math.ceil(G.nextClose))}초 후 폐쇄<br>막판 실적 x2`:`구조조정까지 ${Math.max(0,Math.ceil(G.nextClose))}초${nf<NF?`<br>${FLOORS[nf].short} 개방 예정`:''}`;}
  else zone=G.finalT>30?'야근 모드 · 전원 감소':`인사 시즌 · 야근까지 ${Math.ceil(30-G.finalT)}초`;
  const cap=`<div class="cap"><span>생존 <b>${aliveCount()}</b>/${TOTAL}</span><span>${viewF>=0?FLOORS[viewF].name:''}</span></div>`;
  const tw=$('tower');tw.classList.toggle('map',mapMode==='floor');
  if(mapMode==='building'){tw.innerHTML=cap+towerHTML(-1,-1)+`<div class="zone">${zone}</div><div class="tap">탭${isTouch?'':'·Tab'}: 층 지도</div>`;mmBuilt=false;}
  else{if(!mmBuilt){tw.innerHTML=`<div id="mmCap"></div><canvas id="mm" width="340" height="235"></canvas><div class="zone" id="mmZone"></div><div class="tap">탭${isTouch?'':'·Tab'}: 건물 단면</div>`;mmBuilt=true;}
    $('mmCap').innerHTML=cap;$('mmZone').innerHTML=zone;drawMini();}
  $('tower').classList.toggle('warn',G.warn||(G.final&&G.finalT>30));
  tb.style.setProperty('--cd',Math.max(0,me.cd)/me.lastCd);
  const sb=$('skillBtn'),B=me.branch&&BRANCH[me.branch];sb.hidden=!(me.alive&&B&&B.cd);
  if(!sb.hidden){sb.style.setProperty('--cd',Math.max(0,me.skillCd)/B.cd);$('skillLabel').textContent=me.skillCd>0?Math.ceil(me.skillCd)+'초':B.sk;}
  const held=me.items[0]&&ITEMS[me.items[0]],tl=me.ammo>0?`스테이플<br>${me.ammo}발`:held?held.n.replace(' ','<br>'):'서류<br>투척';
  if(tl!==lastTl){lastTl=tl;$('throwLabel').innerHTML=tl;tb.classList.toggle('staple',me.ammo>0||!!held);tb.style.setProperty('--ic',held?held.c:'');}
  tb.disabled=!!(me.sit||locked(me));
  const act=running&&me.alive?myAction():null;
  const ph=act?act.label+'|'+act.cls:'';
  if(ph!==lastPills){lastPills=ph;$('actLabel').textContent=act?act.label:'상호작용';gb.disabled=!act;gb.className='rbtn'+(act&&act.cls?' '+act.cls:'');}
}
