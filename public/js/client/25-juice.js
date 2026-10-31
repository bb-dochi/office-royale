/* ================= hit feel: sound, paper scraps, squash, hit-stop, hit markers =================
   Works the same in solo and online because it only watches what the renderer already sees (flash, alive, rank,
   projectiles, items…) and turns changes into effects. The rules never call in here. */

/* ---------- sound: tiny synth for effects, one streamed file at a time for music ---------- */
const AU={ctx:null,out:null,noise:null,mute:false,music:.5,sfx:1}; // music, sfx: the sliders, 0..1
try{AU.mute=localStorage.getItem('or-mute')==='1';
  const m=localStorage.getItem('or-vol-music'),s=localStorage.getItem('or-vol-sfx');if(m!==null)AU.music=+m;if(s!==null)AU.sfx=+s;}catch{}
/* squared so the sliders feel even to the ear */
const sfxGain=()=>AU.mute?0:AU.sfx*AU.sfx*.55;
const BGM={el:null,gain:null,file:'',stopT:0};
const bgmGain=()=>BGM.file&&!AU.mute?AU.music*AU.music:0;
function bgmFade(sec,to=bgmGain()){const g=BGM.gain;if(!g)return;const t=AU.ctx.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(to,t+sec);}
/* makes the player match the current wish: nothing to hear (muted, slider at 0, tab hidden) means it pauses and stops downloading */
function bgmSync(fade=.8){
  if(!AU.ctx)return; // before the first tap: auInit calls back
  clearTimeout(BGM.stopT);
  if(!bgmGain()||document.hidden){bgmFade(fade);BGM.stopT=setTimeout(()=>{if(BGM.el)BGM.el.pause();},fade*1000);return;}
  if(!BGM.el){BGM.el=new Audio();BGM.el.loop=true;BGM.gain=AU.ctx.createGain();BGM.gain.gain.value=0; // through a gain node: iPhones ignore audio.volume
    AU.ctx.createMediaElementSource(BGM.el).connect(BGM.gain);BGM.gain.connect(AU.ctx.destination);}
  if(!BGM.el.src.endsWith(BGM.file)){
    if(!BGM.el.paused){bgmFade(.5,0);BGM.stopT=setTimeout(()=>{BGM.el.src=BGM.file;bgmSync();},500);return;} // changing songs: the old one fades out first
    BGM.el.src=BGM.file;}
  const p=BGM.el.play();if(p)p.catch(()=>{}); // refused until a real tap: auInit tries again on the next one
  bgmFade(fade);
}
function bgmPlay(file){BGM.file=file;bgmSync();}
function bgmStop(){BGM.file='';bgmSync();}
function auInit(){
  if(AU.ctx){if(AU.ctx.state!=='running')AU.ctx.resume();}
  else{
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    AU.ctx=new C();AU.out=AU.ctx.createGain();AU.out.gain.value=sfxGain();AU.out.connect(AU.ctx.destination);
    const n=AU.ctx.sampleRate,b=AU.ctx.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;AU.noise=b;
  }
  if(bgmGain()&&!document.hidden&&(!BGM.el||BGM.el.paused))bgmSync();
}
/* browsers only allow sound after the first tap or key; on phones that means the finger coming up, not going down */
for(const t of['pointerdown','pointerup','touchend','click','keydown'])addEventListener(t,auInit,{capture:true});
document.addEventListener('visibilitychange',()=>{if(AU.ctx)auInit();bgmSync(.2);});
function setMute(m){AU.mute=m;try{localStorage.setItem('or-mute',m?'1':'0');}catch{}if(AU.out)AU.out.gain.value=sfxGain();bgmSync(.2);
  $('volMute').textContent=m?'소리 켜기':'소리 전부 끄기';
  for(const b of document.querySelectorAll('.mutebtn')){b.textContent=m?'🔇':'🔊';if(b.closest('.msys'))b.setAttribute('aria-label',m?'소리 켜기':'소리 끄기');}}
function setVol(k,v){AU[k]=v;try{localStorage.setItem(k==='music'?'or-vol-music':'or-vol-sfx',v);}catch{}
  if(AU.mute)setMute(false);else{if(AU.out)AU.out.gain.value=sfxGain();bgmSync(.1);}} // moving a slider while muted means they want sound back
function tone(f0,f1,dur,type='sine',vol=.3,at=0){
  const c=AU.ctx;if(!c||AU.mute)return;const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(AU.out);o.start(t);o.stop(t+dur+.02);
}
function hiss(dur,vol,f0,f1=f0,q=1,at=0,kind='bandpass'){
  const c=AU.ctx;if(!c||AU.mute||!AU.noise)return;const t=c.currentTime+at,s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();
  s.buffer=AU.noise;s.playbackRate.value=.8+Math.random()*.4;fl.type=kind;fl.Q.value=q;fl.frequency.setValueAtTime(f0,t);fl.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(fl);fl.connect(g);g.connect(AU.out);s.start(t,Math.random()*.5);s.stop(t+dur+.02);
}
const SFX={
  throw:v=>hiss(.13,.22*v,900,3200,1.2),
  staple:v=>{tone(2200,1400,.03,'square',.08*v);hiss(.04,.18*v,5000,5000,2);},
  hit:v=>{hiss(.09,.5*v,2200,700,.8,0,'lowpass');tone(240,110,.1,'triangle',.28*v);},
  hurt:()=>{hiss(.14,.6,1400,300,.7,0,'lowpass');tone(150,60,.18,'sawtooth',.18);},
  confirm:()=>{tone(1320,1320,.05,'sine',.16);tone(1760,1760,.07,'sine',.14,.045);},
  ko:v=>{tone(420,70,.38,'square',.12*v);hiss(.3,.35*v,1800,300,.6,.02,'lowpass');},
  koMine:()=>{tone(180,90,.12,'square',.2);hiss(.08,.5,900,200,.6,0,'lowpass');tone(880,880,.08,'triangle',.18,.12);tone(1175,1175,.14,'triangle',.18,.2);},
  down:()=>{tone(392,98,.7,'triangle',.25);tone(196,49,.8,'sawtooth',.08,.05);},
  pickup:()=>{tone(660,660,.06,'sine',.18);tone(990,990,.09,'sine',.16,.06);},
  promote:()=>[523,659,784,1046].forEach((f,i)=>tone(f,f,i===3?.35:.12,'triangle',.2,i*.09)),
  warn:()=>{tone(880,880,.1,'square',.08);tone(880,880,.1,'square',.08,.18);},
  closure:()=>{for(let i=0;i<3;i++){tone(330,330,.16,'sawtooth',.09,i*.34);tone(247,247,.16,'sawtooth',.09,i*.34+.17);}},
};
/* louder near me, silent off my floor or far away */
const sfxVol=o=>{if(!o||o.f!==viewF)return 0;const d=Math.hypot(o.x-cam.x,o.y-cam.y);return Math.max(0,1-d/900);};

/* ---------- paper scraps: one Points cloud, square points read as bits of paper ---------- */
const PN=220,PA={x:new Float32Array(PN),y:new Float32Array(PN),z:new Float32Array(PN),vx:new Float32Array(PN),vy:new Float32Array(PN),vz:new Float32Array(PN),life:new Float32Array(PN)};
let pHead=0;
const pGeo=new THREE.BufferGeometry();
pGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(PN*3).fill(-99),3));
pGeo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(PN*3),3));
const pPts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.16,vertexColors:true,sizeAttenuation:true,depthWrite:false}));
pPts.frustumCulled=false;scene.add(pPts);
const _c=new THREE.Color();
/* n scraps at game position (x,y), thrown along angle dir (null = all around), coloured from cols */
function scraps(x,y,n,dir,cols,power=1){
  if(reduceMotion)n=Math.ceil(n/3);
  const col=pGeo.attributes.color.array;
  for(let k=0;k<n;k++){const i=pHead;pHead=(pHead+1)%PN;
    const a=dir==null?Math.random()*Math.PI*2:dir+(Math.random()-.5)*1.6,sp=(1.5+Math.random()*3)*power;
    PA.x[i]=x*U;PA.z[i]=y*U;PA.y[i]=.9+Math.random()*.4;PA.vx[i]=Math.cos(a)*sp;PA.vz[i]=Math.sin(a)*sp;PA.vy[i]=(2+Math.random()*3)*power;PA.life[i]=.55+Math.random()*.45;
    _c.set(cols[k%cols.length]);col[i*3]=_c.r;col[i*3+1]=_c.g;col[i*3+2]=_c.b;}
  pGeo.attributes.color.needsUpdate=true;
}
function scrapsStep(dt){
  const pos=pGeo.attributes.position.array;let any=false;
  for(let i=0;i<PN;i++){
    if(PA.life[i]<=0){if(pos[i*3+1]!==-99){pos[i*3+1]=-99;any=true;}continue;}
    any=true;PA.life[i]-=dt;PA.vy[i]-=11*dt;
    PA.x[i]+=PA.vx[i]*dt;PA.z[i]+=PA.vz[i]*dt;PA.y[i]+=PA.vy[i]*dt;
    if(PA.y[i]<.04){PA.y[i]=.04;PA.vy[i]*=-.25;PA.vx[i]*=.6;PA.vz[i]*=.6;}
    pos[i*3]=PA.x[i];pos[i*3+1]=PA.life[i]>0?PA.y[i]:-99;pos[i*3+2]=PA.z[i];}
  if(any)pGeo.attributes.position.needsUpdate=true;
}
/* what a rank gives you, shown on the promotion slip */
/* what this promotion gives me, in my team's terms (대리: the 부서 혜택 starts, 팀장: the full one and the Q skill) */
function rankPerks(r){const p=[`공격력 ×${DMG[r]}`],b=G&&G.me&&G.me.branch,B=b&&BRANCH[b],q=isTouch?'':'Q ';
  if(r==='대리'&&B)p.push(`부서 혜택: ${B.pw}`);
  if(r==='팀장')p.push(...(B?[`혜택 강화: ${B.pt}`,`팀 스킬 ${q}${B.sk}: ${B.kt}`]:[`팀 스킬 ${q}`.trim()]));
  if(r==='임원')p.push('부장님 프리패스','팀 스킬 강화');return p.join(' · ');}
let bannerAnim=null;
function banner(stamp,title,sub,gold,col,dur=2400){
  const b=$('banner');$('bannerStamp').textContent=stamp;$('bannerTitle').textContent=title;
  $('bannerSub').innerHTML=(sub||'').split(' · ').filter(Boolean).map(x=>`<i>${x}</i>`).join(''); // each point as its own chip
  b.classList.toggle('gold',!!gold);b.style.setProperty('--bc',col||'');b.classList.toggle('tinted',!!col);b.hidden=false;
  /* in the tutorial the guide card sits at the top: put the slip just under it instead of on top of it */
  const tc=typeof TUT!=='undefined'&&TUT.on&&!$('tut').hidden?$('tut').getBoundingClientRect():null;b.style.top=tc?`${Math.round(tc.bottom+12)}px`:'';
  if(bannerAnim)bannerAnim.cancel();
  if(reduceMotion){bannerAnim=b.animate([{opacity:1},{opacity:1},{opacity:0}],{duration:dur});}
  else{bannerAnim=b.animate([{opacity:0,transform:'translateX(-50%) translateY(10px)'},{opacity:1,transform:'translateX(-50%)',offset:.08},{opacity:1,transform:'translateX(-50%)',offset:.9},{opacity:0,transform:'translateX(-50%) translateY(-6px)'}],{duration:dur,easing:'ease-out'});
    $('bannerStamp').animate([{transform:'rotate(-12deg) scale(2.4)',opacity:0},{transform:'rotate(-12deg) scale(.92)',opacity:1,offset:.7},{transform:'rotate(-12deg) scale(1)'}],{duration:260,delay:90,easing:'ease-in',fill:'backwards'});}
  bannerAnim.onfinish=()=>{b.hidden=true;bannerAnim=null;};
}
const RI_J=['인턴','사원','대리','팀장','임원'];
const PAPER=['#fbfaf6','#fbfaf6','#e9e4d6','#e5483a'],CONFETTI=['#f3d77a','#e5483a','#2b6cb0','#2f9e57','#fbfaf6'];

/* ---------- watching state for changes ---------- */
const JU={g:null,st:new Map(),proj:new WeakSet(),marks:[],stamps:[],hurt:0,warn:false,closed:0,kills:0};
let hitStop=0; // solo only: the rules run slower for a blink after a hit that involves me
function juiceFrame(dt){
  scrapsStep(dt);
  JU.hurt=Math.max(0,JU.hurt-dt);for(const m of JU.marks)m.t+=dt;JU.marks=JU.marks.filter(m=>m.t<.3);for(const s of JU.stamps)s.t+=dt;JU.stamps=JU.stamps.filter(s=>s.t<.9);
  if(!G||!G.me||G.plaza)return;
  const me=G.me;
  if(JU.g!==G){JU.g=G;JU.kills=me.kills||0;JU.st.clear();JU.proj=new WeakSet();for(const p of G.proj)JU.proj.add(p);JU.warn=G.warn;JU.closed=G.closed;
    for(const a of G.actors)JU.st.set(a.id,{flash:a.flash,alive:a.alive,rank:a.rank,branch:a.branch,ammo:a.ammo,items:a.items.length,sq:0});return;}
  if(G.warn&&!JU.warn)SFX.warn();JU.warn=G.warn;
  if(G.closed>JU.closed)SFX.closure();JU.closed=G.closed;
  for(const p of G.proj)if(!JU.proj.has(p)){JU.proj.add(p);const v=p.o===me?1:sfxVol(p)*.5;if(v>0)(p.staple?SFX.staple:SFX.throw)(v);}
  for(const a of G.actors){
    let s=JU.st.get(a.id);if(!s){s={flash:a.flash,alive:a.alive,rank:a.rank,branch:a.branch,ammo:a.ammo,items:a.items.length,sq:0};JU.st.set(a.id,s);continue;}
    const v=a===me?1:sfxVol(a),byMe=a!==me&&a.hitBy===me.id;
    /* got hit: the flash timer jumps back up */
    if(a.alive&&a.flash>.08&&a.flash>s.flash+.04){
      s.sq=.16;
      const src=a.hitBy?G.actors.find(o=>o.id===a.hitBy):null,dir=src?Math.atan2(a.y-src.y,a.x-src.x):null;
      if(a.f===viewF)scraps(a.x,a.y,byMe||a===me?14:8,dir,PAPER);
      if(a===me){SFX.hurt();JU.hurt=.45;hitStop=Math.max(hitStop,.09);if(navigator.vibrate&&isTouch)try{navigator.vibrate(30);}catch{}}
      else if(byMe){SFX.hit(1);SFX.confirm();JU.marks.push({id:a.id,t:0});hitStop=Math.max(hitStop,.06);}
      else if(v>0)SFX.hit(v*.6);
    }
    /* knocked out */
    if(s.alive&&!a.alive){
      if(a.f===viewF)scraps(a.x,a.y,34,null,PAPER,1.3);
      if(a===me)SFX.down();
      else if(byMe&&(me.kills||0)>JU.kills){JU.kills=me.kills;SFX.koMine();JU.stamps.push({x:a.x,y:a.y,f:a.f,t:0});hitStop=Math.max(hitStop,.14);
        banner('해고',`${a.name} 처리`,`고과 +${RI_J.indexOf(s.rank)>RI_J.indexOf(me.rank)?16:10} · 윗사람 처리하면 더 받아요`);}
      else if(v>0)SFX.ko(v);
    }
    if(a===me){
      /* promotions stay up longer (they list what the new rank unlocks); the 사원 one also announces the team 발령 */
      const promo=a.alive&&s.rank&&a.rank!==s.rank&&RI_J.indexOf(a.rank)>RI_J.indexOf(s.rank),newTeam=!!a.branch&&!s.branch;
      if(promo){SFX.promote();scraps(a.x,a.y,40,null,CONFETTI,1.2);
        if(newTeam)banner('발령',`${a.rank} 승진 · ${teamShort(a.branch)}팀 발령`,'',true,null,3500);
        else banner('승진',`${a.rank} 승진!`,rankPerks(a.rank),true,null,4500);}
      if(a.ammo>s.ammo||a.items.length>s.items)SFX.pickup();
      /* my team was just decided by my first achievement: a 발령 slip (teams have no colour; their prop shows) */
      if(newTeam&&!promo){SFX.confirm();banner('발령',`${teamShort(a.branch)}팀 발령`,'',true,null,3500);}
    }
    /* squash and stretch on the inner rig (poseChar leaves its scale alone) */
    const m=actorM.get(a);
    if(m&&(s.sq>0||s.sqOn)){s.sq=Math.max(0,s.sq-dt);const k=s.sq/.16;m.userData.inner.scale.set(1+.22*k,1-.26*k,1+.22*k);s.sqOn=s.sq>0;}
    s.flash=a.flash;s.alive=a.alive;s.rank=a.rank;s.branch=a.branch;s.ammo=a.ammo;s.items=a.items.length;
  }
}
/* drawn on the 2D overlay after everything else: hit markers, the 'fired' stamp, red edges when I get hit */
function juiceOverlay(f){
  for(const mk of JU.marks){const a=G.actors.find(o=>o.id===mk.id);if(!a||a.f!==f)continue;const p=scr(a.x,a.y,1.0);if(!p)continue;
    const k=mk.t/.3,r=10+k*8,al=1-k;ctx.lineCap='round';
    for(const w of[[6,'rgba(29,35,40,'+al+')'],[3,'rgba(251,250,246,'+al+')']]){ctx.lineWidth=w[0];ctx.strokeStyle=w[1];ctx.beginPath();
      for(const[sx,sy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.moveTo(p[0]+sx*r*.45,p[1]+sy*r*.45);ctx.lineTo(p[0]+sx*r,p[1]+sy*r);}ctx.stroke();}
    ctx.lineCap='butt';}
  for(const s of JU.stamps){if(s.f!==f)continue;const p=scr(s.x,s.y,1.4);if(!p)continue;
    const k=Math.min(1,s.t/.12),sc=2.2-1.2*k,al=s.t>.6?Math.max(0,1-(s.t-.6)/.3):1;
    ctx.save();ctx.translate(p[0],p[1]-20);ctx.rotate(-.18);ctx.scale(sc,sc);ctx.globalAlpha=al;
    ctx.strokeStyle='#cf3626';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,26,0,7);ctx.stroke();ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,21,0,7);ctx.stroke();
    ctx.fillStyle='#cf3626';ctx.font=DF(15);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('해고',0,1);ctx.restore();ctx.textAlign='left';ctx.textBaseline='alphabetic';}
  if(JU.hurt>0&&!reduceMotion){const a=JU.hurt/.45*.55,gr=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.35,VW/2,VH/2,Math.max(VW,VH)*.72);
    gr.addColorStop(0,'rgba(207,54,38,0)');gr.addColorStop(1,`rgba(207,54,38,${a})`);ctx.fillStyle=gr;ctx.fillRect(0,0,VW,VH);}
}
/* outside a match every 🔊 button (and the lobby's 설정 tab) opens this one panel next to itself; levels are set here and carry into the match */
let soundAt=null;
function soundOpen(a){const s=$('sound');if(!s.hidden&&soundAt===a){s.hidden=true;return;}soundAt=a;s.hidden=false;
  const r=a.getBoundingClientRect(),w=s.offsetWidth,h=s.offsetHeight,tab=a.closest('#dock');
  s.style.left=Math.max(8,Math.min(tab?r.left-w-8:r.right-w,innerWidth-w-8))+'px';
  s.style.top=(tab?Math.max(8,Math.min(r.top,innerHeight-h-8)):r.bottom+h+14>innerHeight?Math.max(8,r.top-h-6):r.bottom+6)+'px';}
for(const b of document.querySelectorAll('.mutebtn'))b.addEventListener('click',e=>{e.stopPropagation();if(b.closest('.msys'))setMute(!AU.mute);else soundOpen(b);}); // on the in-game map: plain on/off
for(const[id,k]of[['volMusic','music'],['volSfx','sfx']]){const i=$(id),n=i.nextElementSibling;i.value=n.textContent=Math.round(AU[k]*100);
  i.addEventListener('input',()=>{n.textContent=i.value;setVol(k,i.value/100);});}
$('volSfx').addEventListener('change',()=>SFX.pickup()); // effects are silent in the lobby otherwise: a blip to judge the level by
$('volMute').addEventListener('click',()=>setMute(!AU.mute));
addEventListener('pointerdown',e=>{if(!e.target.closest('#sound,.mutebtn,[data-go=sound]'))$('sound').hidden=true;},true);
addEventListener('pointerup',()=>{const f=document.activeElement;if(f&&f.closest('#sound'))f.blur();},true); // a focused slider would swallow WASD
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sound').hidden){e.stopImmediatePropagation();$('sound').hidden=true;}},true);
setMute(AU.mute);
