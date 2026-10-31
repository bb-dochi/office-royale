/* ================= 명예 사원 =================
   The latest finished week's 1~3위 stand on a podium on the left of the lobby, near the back wall, in the outfit they last
   wore (the server freezes that when the week ends: server/src/rank.js). E on it opens every past week.
   The podium exists only in the lobby: matches run the same FLOORS, so hallSet adds its obstacle and path cells and
   hallStop takes them away again, and nothing goes into sim/. */
const HL_X=588,HL_W=56,HL_BOX={x:HL_X-HL_W*1.5,y:168,w:HL_W*3,h:46,k:'hall',sight:0};   // HL_X: the middle of the podium; HL_W: the width of one plinth
/* 2위 left, 1위 middle, 3위 right; lift: the height of each plinth, c: the metal of its statue */
const HL_SPOT=[{x:HL_X,y:182,lift:.85,c:'#e3b53c'},{x:HL_X-HL_W,y:182,lift:.58,c:'#c5ced8'},{x:HL_X+HL_W,y:182,lift:.38,c:'#b9794a'}];
const HL={weeks:[],week:null,top:[],cache:new Map(),group:null,cells:[],open:false};
const hallURL=w=>rankURL(`?uid=${rankUid()}${w?`&week=${w}`:''}`,'hall');
function hallLoad(){fetch(hallURL()).then(r=>r.json()).then(r=>{if(!r||!r.weeks)return;HL.weeks=r.weeks;HL.week=r.week;HL.top=r.top;if(r.week)HL.cache.set(r.week,r.top);hallSet();
  const w=r.weeks[r.weeks.length-1];CEO.name=w?`${w.first} 대표님`:'대표님';}).catch(()=>{});}
/* a round red 인감 with worn ink */
function hallStamp(){
  const C=document.createElement('canvas');C.width=C.height=320;const x=C.getContext('2d');x.strokeStyle=x.fillStyle='#c8283a';
  x.lineWidth=14;x.beginPath();x.arc(160,160,146,0,7);x.stroke();x.lineWidth=4;x.beginPath();x.arc(160,160,124,0,7);x.stroke();
  x.textAlign='center';x.textBaseline='middle';x.font=STAMP_F(88);x.fillText('명예',160,116);x.fillText('사원',160,208);
  x.globalCompositeOperation='destination-out';for(let i=0;i<270;i++){x.globalAlpha=Math.random()*.7;x.beginPath();x.arc(Math.random()*320,Math.random()*320,Math.random()*3,0,7);x.fill();}
  const t=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;
  return new THREE.Mesh(new THREE.PlaneGeometry(.77,.74),ownMat(new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false})));
}
/* small white plinths side by side: a small number on top in front of the feet, the stamp on the front of the 1위 one */
function hallPodium(){
  const g=new THREE.Group(),flat=(m,x,y,z)=>{m.rotation.x=-Math.PI/2;m.position.set(x*U,y,z*U);g.add(m);return m;},front=HL_BOX.y+HL_BOX.h-8;
  HL_SPOT.forEach((s,i)=>{const x=s.x-HL_W/2;bx(g,x,HL_BOX.y,HL_W,HL_BOX.h,0,s.lift-.03,lam('#d9d4c6'));bx(g,x,HL_BOX.y,HL_W,HL_BOX.h,s.lift-.03,.03,lam('#f6f3ea'),false);
    flat(textPlane(String(i+1),18,14,null,'#6b7076',DF(12),8),s.x,s.lift+.01,front);});
  const st=hallStamp();st.position.set(HL_X*U,HL_SPOT[0].lift/2,(HL_BOX.y+HL_BOX.h)*U+.012);st.rotation.z=-.03;g.add(st);
  return g;
}
/* a statue: the whole figure in one metal, outfit shapes and all. See-through parts (ring, aura, shadows) stay as they are */
function hallCast(m,c){const u=m.userData,mat=ownMat(new THREE.MeshStandardMaterial({color:c,roughness:.36,metalness:.3}));
  m.traverse(o=>{if(o.isMesh&&!o.material.transparent)o.material=mat;});}
/* every time the lobby is built, and again when the week's list arrives. Until some week has a record there is no podium at all */
function hallSet(){
  if(!G||!G.plaza)return;G.actors=G.actors.filter(a=>!a.statue);if(!HL.top.length){hallStop();return;}const fl=FLOORS[0];
  if(!HL.group)HL.group=hallPodium();
  if(!HL.group.parent)scene.add(HL.group);
  if(!fl.ob.includes(HL_BOX)){fl.ob.push(HL_BOX);refreshObs(fl);HL.cells=[];
    for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++){const px=gx*CS+CS/2,py=gy*CS+CS/2,i=gy*GW+gx;
      if(!fl.blocked[i]&&px>HL_BOX.x-R-1&&px<HL_BOX.x+HL_BOX.w+R+1&&py>HL_BOX.y-R-1&&py<HL_BOX.y+HL_BOX.h+R+1){fl.blocked[i]=1;HL.cells.push(i);}}}
  HL.top.slice(0,3).forEach((e,i)=>{const s=HL_SPOT[i],a=mk(`${i+1}위 ${e.name}`,false,'명예 사원','#2b6cb0',{x:s.x,y:s.y});
    a.f=0;a.alive=true;a.face=Math.PI/2;a.statue=s.c;a.lift=s.lift;const f=cleanFit(e.fit)||{...DEFAULT_FIT};a.fit={...f,fx:null,gear:(f.gear||[]).filter(g=>g!=='halo')};G.actors.push(a);});
}
function hallStop(){const fl=FLOORS[0],i=fl.ob.indexOf(HL_BOX);if(i>=0){fl.ob.splice(i,1);refreshObs(fl);for(const c of HL.cells)fl.blocked[c]=0;HL.cells=[];}
  if(HL.group&&HL.group.parent)scene.remove(HL.group);}
/* what E does near the podium: pzTarget asks this */
const hallNear=me=>HL.top.length>0&&Math.abs(me.x-HL_X)<HL_BOX.w/2+50&&me.y>HL_BOX.y-40&&me.y<HL_BOX.y+HL_BOX.h+70;
/* ---------- the sheet: one week's three on their steps, ‹ › under them to the other weeks ---------- */
const hallRange=w=>{const mon=Date.parse(w+'T00:00:00+09:00'),d=t=>{const x=new Date(t+9*3600e3);return`${x.getUTCMonth()+1}/${x.getUTCDate()}`;};return`${d(mon)} ~ ${d(mon+7*864e5-1)}`;};
/* 10월 3주차: the month its Monday is in, counted in that month's Mondays */
const hallName=w=>{const[,m,d]=w.split('-').map(Number);return`${m}월 ${Math.ceil(d/7)}주차`;};
function hallFig(e,i){
  if(!e)return`<figure class="hlf p${i+1} none"><div class="hlstep">${i+1}</div></figure>`;
  return`<figure class="hlf p${i+1}${e.mine?' mine':''}"><img alt="" src="${charShot(cleanFit(e.fit)||DEFAULT_FIT,'full')}"><figcaption><b>${esc(e.name)}${e.mine?' <span class="me">(나)</span>':''}</b><small>${e.score.toLocaleString()}점</small><small>업무 ${e.tasks} · 해고 ${e.kills}</small></figcaption><div class="hlstep">${i+1}</div></figure>`;}
function hallShow(week){
  const n=HL.weeks.findIndex(x=>x.week===week),top=HL.cache.get(week);HL.week=week;
  $('hallPod').innerHTML=!week?'<p class="rkmsg">아직 오른 사람이 없어요.<br>이번 주 랭킹 1~3위가 다음 주 로비에 서요.</p>':top?[0,1,2].map(i=>hallFig(top[i],i)).join(''):'<p class="rkmsg">불러오는 중…</p>';
  $('hallNav').hidden=!week;if(week){$('hallName').textContent=hallName(week);$('hallDays').textContent=hallRange(week);$('hallPrev').disabled=n<=0;$('hallNext').disabled=n>=HL.weeks.length-1;}
}
function hallPick(week){if(HL.cache.has(week)){hallShow(week);return;}hallShow(week);
  fetch(hallURL(week)).then(r=>r.json()).then(r=>{HL.cache.set(r.week,r.top);if(HL.week===r.week)hallShow(r.week);}).catch(()=>{$('hallPod').innerHTML='<p class="rkmsg">랭킹 서버에 연결하지 못했어요.</p>';});}
function hallOpen(){$('hallSheet').hidden=false;$('hallPod').innerHTML='<p class="rkmsg">불러오는 중…</p>';$('hallNav').hidden=true;
  fetch(hallURL()).then(r=>r.json()).then(r=>{HL.weeks=r.weeks;if(r.week)HL.cache.set(r.week,r.top);hallShow(r.week);}).catch(()=>{$('hallPod').innerHTML='<p class="rkmsg">랭킹 서버에 연결하지 못했어요.</p>';});}
const hallClose=()=>{$('hallSheet').hidden=true;};
for(const[id,d]of[['hallPrev',-1],['hallNext',1]])$(id).addEventListener('click',()=>{const w=HL.weeks[HL.weeks.findIndex(x=>x.week===HL.week)+d];if(w)hallPick(w.week);});
$('hallX').addEventListener('click',hallClose);
$('hallSheet').addEventListener('click',e=>{if(e.target===$('hallSheet'))hallClose();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('hallSheet').hidden){e.stopImmediatePropagation();hallClose();}},true);
if(PZ.on){hallSet();hallLoad();}   // the first time, the lobby is up before this file has loaded
