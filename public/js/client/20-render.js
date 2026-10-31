/* ================= render ================= */
/* ================= 3D quarter-view renderer ================= */
/* Game logic stays in 2D pixel space (x right, y down). The scene maps px -> world units: X=x*U, Z=y*U, Y is up. */
/* UIS: overlay text grows on big screens (1 up to 1400×800, at most 1.5×) so labels still read from a distance */
let UIS=1;
const F=(w,s)=>`${w>=800?700:w} ${Math.round((s+1)*UIS)}px 'Noto Sans KR','Apple SD Gothic Neo',sans-serif`;
const DF=s=>`900 ${Math.round(s*UIS)}px 'Noto Sans KR','Apple SD Gothic Neo',sans-serif`;
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function txt(t,x,y,font,color,align='left'){ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(t,x,y);ctx.textAlign='left';}
const U=1/36,W3=FW*U,D3=FH*U,WALL_H=2.4;
/* no three.js or no WebGL: say so instead of leaving an empty screen (the rest of this file cannot run) */
const gl=(()=>{try{return new THREE.WebGLRenderer({antialias:true,stencil:true});}catch(e){document.getElementById('glFail').hidden=false;throw e;}})();
gl.setPixelRatio(Math.min(window.devicePixelRatio||1,isTouch?1.5:2));
gl.shadowMap.enabled=true;gl.shadowMap.type=THREE.PCFSoftShadowMap;gl.autoClear=false;
gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;
gl.domElement.id='gl';cv.parentNode.insertBefore(gl.domElement,cv);
const scene=new THREE.Scene();scene.background=new THREE.Color('#2a3036');
const cam3=new THREE.PerspectiveCamera(45,1,.1,300);
scene.add(new THREE.HemisphereLight(0xdfe9f5,0x7a6a5c,1.2));
const SUN=2.1,sun=new THREE.DirectionalLight(0xfff1dc,SUN);
sun.position.set(W3/2+12,34,D3/2+18);sun.target.position.set(W3/2,0,D3/2);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
Object.assign(sun.shadow.camera,{left:-30,right:30,top:26,bottom:-26,near:1,far:100});sun.shadow.bias=-.0006;sun.shadow.normalBias=.02;scene.add(sun);
/* the shadow map only covers what is on screen (sharper than spreading it over the whole floor) and follows the camera
   in whole shadow-texel steps, so shadows don't crawl or shimmer while the view slides */
const SUN_OFF=new THREE.Vector3(12,34,18),SUN_D=SUN_OFF.clone().normalize(),SUN_R=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),SUN_D).normalize(),SUN_U=new THREE.Vector3().crossVectors(SUN_D,SUN_R);
const sunT=new THREE.Vector3();let sunHalf=0;
function followSun(x,z,half){
  const sc=sun.shadow.camera;if(Math.abs(half-sunHalf)>.01){sunHalf=half;Object.assign(sc,{left:-half,right:half,top:half,bottom:-half});sc.updateProjectionMatrix();}
  const tex=half*2/sun.shadow.mapSize.x;sunT.set(x,0,z);
  const r=sunT.dot(SUN_R),u=sunT.dot(SUN_U);sunT.addScaledVector(SUN_R,Math.round(r/tex)*tex-r).addScaledVector(SUN_U,Math.round(u/tex)*tex-u);
  sun.target.position.copy(sunT);sun.position.copy(sunT).add(SUN_OFF);
}
function glResize(){gl.setSize(VW,VH,false);cam3.aspect=VW/VH;cam3.updateProjectionMatrix();}
addEventListener('resize',glResize);glResize();

const MC={};
const lam=(c,opt)=>{const k=c+(opt?JSON.stringify(opt):'');return MC[k]||(MC[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,flatShading:true,roughness:.82,metalness:0},opt||{})));};
const basic=(c,opt)=>new THREE.MeshBasicMaterial(Object.assign({color:c},opt||{}));
const GEO={box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(1,1,1,20),disc:new THREE.CircleGeometry(1,32),ring:new THREE.RingGeometry(.84,1,40),sph:new THREE.SphereGeometry(1,16,12)};

/* ---------- static floor ---------- */
let floorGroup=null,builtF=-1,wallMs=[],doorMs=[],seatMs=[],staticTags=[];
const own=[];
function add(g,mesh){g.add(mesh);return mesh;}
function bx(g,x,y,w,h,y0,ht,m,cast=true){
  const mesh=new THREE.Mesh(GEO.box,m);mesh.scale.set(Math.max(w*U,.02),ht,Math.max(h*U,.02));
  mesh.position.set((x+w/2)*U,y0+ht/2,(y+h/2)*U);mesh.castShadow=cast;mesh.receiveShadow=true;return add(g,mesh);
}
function cy(g,cx,cyy,r,y0,ht,m,cast=true){
  const mesh=new THREE.Mesh(GEO.cyl,m);mesh.scale.set(r*U,ht,r*U);mesh.position.set(cx*U,y0+ht/2,cyy*U);
  mesh.castShadow=cast;mesh.receiveShadow=true;return add(g,mesh);
}
/* floor colours for the office look (the rules keep their own carpet colours for the minimap) */
const CARPET={0:'#e8e2d6',1:'#8a4f42',2:'#56677d',3:'#5c7560',4:'#6c5878',5:'#7a5b42'};
function floorTex(f){
  const fl=FLOORS[f],c=document.createElement('canvas');c.width=FW;c.height=FH;const x=c.getContext('2d');
  const base=new THREE.Color(CARPET[f]||fl.carpet),g=fl.grid,tc=new THREE.Color();
  x.fillStyle='#'+base.getHexString();x.fillRect(0,0,FW,FH);
  /* carpet tiles: each tile a little lighter or darker, with a soft inner square and dark seams */
  for(let yy=0,j=0;yy<FH;yy+=g,j++)for(let xx=0,i=0;xx<FW;xx+=g,i++){
    const v=(((i*7+j*13)%5)-2)*.025;tc.copy(base).offsetHSL(0,0,v);x.fillStyle='#'+tc.getHexString();x.fillRect(xx,yy,g,g);
    x.fillStyle=f===0?'rgba(255,255,255,.12)':'rgba(255,225,200,.06)';x.fillRect(xx+g*.14,yy+g*.14,g*.72,g*.72);}
  x.strokeStyle=f===0?'rgba(120,110,95,.35)':'rgba(0,0,0,.16)';x.lineWidth=2;x.beginPath();
  for(let xx=0;xx<=FW;xx+=g){x.moveTo(xx,0);x.lineTo(xx,FH);}for(let yy=0;yy<=FH;yy+=g){x.moveTo(0,yy);x.lineTo(FW,yy);}x.stroke();
  const r=fl.rest;x.fillStyle='#e4e8ea';x.fillRect(r.x,r.y,r.w,r.h);x.strokeStyle='rgba(29,35,40,.1)';x.lineWidth=1.5;x.beginPath();
  for(let xx=r.x;xx<r.x+r.w;xx+=20){x.moveTo(xx,r.y);x.lineTo(xx,r.y+r.h);}for(let yy=r.y;yy<r.y+r.h;yy+=20){x.moveTo(r.x,yy);x.lineTo(r.x+r.w,yy);}x.stroke();
  if(f===ROOF){x.fillStyle='rgba(61,139,224,.18)';x.fillRect(0,0,K(350),FH);x.fillStyle='rgba(224,140,61,.18)';x.fillRect(K(750),0,FW-K(750),FH);
    x.strokeStyle='#e0c23d';x.lineWidth=12;x.setLineDash([28,20]);x.strokeRect(8,8,FW-16,FH-16);x.setLineDash([]);}
  else{x.fillStyle='rgba(255,255,255,.28)';x.fillRect(K(870),0,K(230),K(170));
    if(f!==0)sunPatches(x);
    for(const o of fl.ob)if(o.k==='cluster'){x.fillStyle='rgba(29,35,40,.07)';x.fillRect(o.x-26,o.y-34,o.w+52,o.h+68);}
    if(f===3){x.fillStyle='rgba(80,140,200,.18)';x.fillRect(K(780),K(480),K(260),K(160));}
    if(f===5)for(const z of fl.meet){x.fillStyle='rgba(140,60,40,.16)';x.fillRect(z.x+30,z.y+30,z.w-60,z.h-60);}
    if(f===0){x.fillStyle='#5d666e';x.fillRect(DOOR.x-80,FH-74,160,44);x.fillStyle='#fbfaf6';x.font=DF(20);x.textAlign='center';x.fillText('WELCOME',DOOR.x,FH-45);x.textAlign='left';}}
  for(const z of fl.meet){x.fillStyle='rgba(255,255,255,.2)';x.fillRect(z.x,z.y,z.w,z.h);}
  x.textBaseline='alphabetic';
  if(f===0){x.strokeStyle='rgba(29,35,40,.1)';x.lineWidth=8;x.beginPath();x.arc(FW/2,K(300),K(70),0,7);x.stroke();
    x.font=DF(34);x.fillStyle='rgba(29,35,40,.14)';x.textAlign='center';x.fillText('OFFICE ROYALE',FW/2,K(306));}
  else{x.font=DF(90);x.fillStyle='rgba(29,35,40,.07)';x.textAlign='center';x.fillText(fl.short,FW/2,FH/2+170);}
  x.textAlign='left';x.font=F(800,16);x.fillStyle='rgba(29,35,40,.5)';
  for(const[t,lx,ly]of fl.labels)x.fillText(t,lx,ly);
  if(f!==ROOF){x.textAlign='center';x.font=F(800,15);x.fillStyle='rgba(29,35,40,.62)';for(const k in PADS){const p=PADS[k];x.fillText(p.n,p.x,p.y+50);}
    x.fillText(f===0?'정문':'출입문',DOOR.x,FH-18);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function disposeGroup(g){g.traverse(o=>{if(o.geometry&&!Object.values(GEO).includes(o.geometry)&&!o.geometry.userData.shared)o.geometry.dispose();
  if(o.material&&o.material.userData&&o.material.userData.own){if(o.material.map)o.material.map.dispose();o.material.dispose();}});}
function ownMat(m){m.userData.own=true;return m;}
/* shirt colours for the seat workers (the 'desk' NPCs the rules put at a few chairs per floor) */
const EXTRA_COLORS=['#4f7c99','#8e6c8a','#6f8f3a','#b0803a','#5b6fa8','#a35d7a','#3f8f8f','#c46b6b'];
/* Building a floor takes ~90 ms (big canvas texture + mesh merging), which showed up as a hitch on every floor change.
   Built floors are cached (most recent FLOOR_KEEP) and the floors you are likely to visit next are built in idle time. */
const FLOOR_KEEP=4,FC=new Map();
const floorState=()=>({g:floorGroup,f:builtF,wallMs,doorMs,seatMs,staticTags,floorAnim,bg:scene.background});
function applyFloor(c){
  if(floorGroup&&floorGroup!==c.g)floorGroup.visible=false;
  ({g:floorGroup,f:builtF,wallMs,doorMs,seatMs,staticTags,floorAnim}=c);scene.background=c.bg;floorGroup.visible=true;c.used=performance.now();
}
function dropFloor(c){scene.remove(c.g);disposeGroup(c.g);}
function getFloor(f){
  let c=FC.get(f);
  if(!c){const prev=floorGroup?floorState():null;makeFloor(f);c=floorState();FC.set(f,c);if(prev&&prev.g!==c.g){c.g.visible=false;applyFloor(prev);}
    for(const[k,o]of[...FC].sort((a,b)=>(a[1].used||0)-(b[1].used||0)))if(FC.size>FLOOR_KEEP&&o.g!==floorGroup&&k!==f){dropFloor(o);FC.delete(k);}}
  return c;
}
function buildFloor(f){applyFloor(getFloor(f));}
function resetFloors(){for(const c of FC.values())dropFloor(c);FC.clear();floorGroup=null;builtF=-1;}
let prewarmT=0;
function prewarmFloors(){
  if(!G||performance.now()<prewarmT)return;prewarmT=performance.now()+400;
  const want=[G.closed,G.closed+1,G.closed+2,G.closed+3].filter(f=>f>=0&&f<NF&&!FC.has(f));
  if(!want.length)return;
  const go=()=>{if(!FC.has(want[0]))getFloor(want[0]);};
  if(window.requestIdleCallback)requestIdleCallback(go,{timeout:2000});else setTimeout(go,50);
}
function makeFloor(f){
  floorAnim=[];const fl=FLOORS[f],g=new THREE.Group();floorGroup=g;builtF=f;wallMs=[];doorMs=[];seatMs=[];staticTags=[];
  scene.background=new THREE.Color(f===ROOF?'#9fc6e0':'#2a3036');
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(W3,D3),ownMat(new THREE.MeshLambertMaterial({map:floorTex(f)})));
  pl.rotation.x=-Math.PI/2;pl.position.set(W3/2,0,D3/2);pl.receiveShadow=true;g.add(pl);
  /* perimeter: back and side walls full height, the camera-facing front wall kept low */
  const per=f===ROOF?.35:WALL_H,pc=f===ROOF?'#b9bec2':'#efe6d8';
  const pw=(x,y,w,h,ht)=>{const m=bx(g,x,y,w,h,0,ht,ownMat(new THREE.MeshLambertMaterial({color:pc,transparent:true,opacity:1})));if(ht>1)wallMs.push(m);};
  pw(-10,-10,FW+20,10,per);pw(-10,0,10,FH,per);pw(FW,0,10,FH,per);pw(-10,FH,FW+20,10,f===ROOF?.35:.45);
  if(f!==ROOF){
    /* lower wall panel, chair rail and skirting on the back and side walls */
    const LOW=lam(f===5?'#8c6d4a':'#c9b49a'),TRIM=lam(f===5?'#5a3b28':'#7a5b42');
    for(const[x0,y0,w0,h0]of[[0,0,FW,3],[0,0,3,FH],[FW-3,0,3,FH]]){bx(g,x0,y0,w0,h0,0,.9,LOW,false);bx(g,x0,y0,w0,h0+(w0>h0?2:0),.9,.06,TRIM,false);bx(g,x0,y0,w0,h0+(w0>h0?2:0),0,.14,TRIM,false);}
    if(f!==0)for(const wx of[K(250),K(450),K(650),K(850)])windowOn(g,wx);
  }
  for(const o of fl.ob)obMesh(g,o,f);
  for(const d of fl.doors){
    const hz=d.w>d.h,m=d.glass?ownMat(new THREE.MeshLambertMaterial({color:'#9fcbe3',transparent:true,opacity:.55,depthWrite:false})):lam('#8a6a4a');
    const closed=bx(g,d.x,d.y,d.w,d.h,0,2.2,m);
    const ow=hz?bx(g,d.x,d.y+d.h,6,d.w*.85,0,2.2,m):bx(g,d.x+d.w,d.y,d.h*.85,6,0,2.2,m);
    closed.userData.dyn=ow.userData.dyn=true;doorMs.push({d,closed,ow});
  }
  for(const s of fl.seats){if(s.bench)continue;   // rooftop bench seats are drawn with their table (picnicSet)
    const c=new THREE.Group(),m=ownMat(new THREE.MeshStandardMaterial({color:'#30353c',flatShading:true,roughness:.82}));
    officeChair(c,m);c.scale.setScalar(.82);
    c.position.set(s.x*U,0,s.y*U);c.rotation.y=Math.atan2(Math.cos(s.face),Math.sin(s.face));g.add(c);seatMs.push({s,m});
  }
  if(f!==ROOF){
    for(const k in PADS){const p=PADS[k];
      if(k==='stair'){for(let i=0;i<6;i++)bx(g,p.x-30,p.y-30+i*10,60,10,0,.08+i*.09,lam('#a8adb1'));}
      else{bx(g,p.x-30,p.y-30,60,60,0,.05,lam('#8f989f'),false);
        bx(g,p.x-34,p.y-38,68,8,0,2.3,lam('#7d868e'));
        bx(g,p.x-26,p.y-31,25,2,0,2.0,lam('#c3c9cd'),false);bx(g,p.x+1,p.y-31,25,2,0,2.0,lam('#c3c9cd'),false);}
    }
    bx(g,DOOR.x-36,FH-4,72,6,0,2.1,ownMat(new THREE.MeshLambertMaterial({color:'#c8d7e1',transparent:true,opacity:.6,depthWrite:false})),false);
  }
  decor(g,f,fl);
  mergeStatic(g);
  scene.add(g);
}
/* Bake every static, opaque prop that shares a material into one mesh: a floor drops from several hundred draw calls to a few dozen. */
function mergeStatic(g){
  g.updateMatrixWorld(true);
  g.traverse(o=>{if(o.userData.dyn)o.traverse(c=>{c.userData.skip=true;});});
  const buckets=new Map();
  g.traverse(o=>{
    if(!o.isMesh||o.userData.skip||!o.visible)return;const m=o.material;
    if(!m||Array.isArray(m)||m.userData.own||m.transparent||m.map)return;
    const key=m.uuid+(o.castShadow?'c':'n');let b=buckets.get(key);if(!b)buckets.set(key,b={m,cast:o.castShadow,list:[]});b.list.push(o);
  });
  const nm=new THREE.Matrix3(),v=new THREE.Vector3();
  for(const b of buckets.values()){
    if(b.list.length<2)continue;
    let nv=0,ni=0;for(const o of b.list){const gm=o.geometry;nv+=gm.attributes.position.count;ni+=gm.index?gm.index.count:gm.attributes.position.count;}
    const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);
    let vo=0,io=0;
    for(const o of b.list){
      const gm=o.geometry,P=gm.attributes.position,N=gm.attributes.normal;nm.getNormalMatrix(o.matrixWorld);
      for(let i=0;i<P.count;i++){
        v.fromBufferAttribute(P,i).applyMatrix4(o.matrixWorld);pos[(vo+i)*3]=v.x;pos[(vo+i)*3+1]=v.y;pos[(vo+i)*3+2]=v.z;
        if(N){v.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();nor[(vo+i)*3]=v.x;nor[(vo+i)*3+1]=v.y;nor[(vo+i)*3+2]=v.z;}
      }
      if(gm.index){const I=gm.index.array;for(let i=0;i<I.length;i++)idx[io++]=I[i]+vo;}
      else for(let i=0;i<P.count;i++)idx[io++]=vo+i;
      vo+=P.count;o.parent.remove(o);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setIndex(new THREE.BufferAttribute(idx,1));
    geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,b.m);mesh.castShadow=b.cast;mesh.receiveShadow=true;g.add(mesh);
  }
}
function windowOn(g,wx){
  const W=120,frame=lam('#d9d6cf'),glass=lam('#a9d2ea',{emissive:'#bfe3f7',emissiveIntensity:.35,roughness:.2});
  bx(g,wx-W/2,-1,W,1,1,1.15,glass,false);
  bx(g,wx-W/2-3,-1,W+6,4,.96,.07,frame,false);bx(g,wx-W/2-3,-1,W+6,3,2.13,.07,frame,false);
  for(const dx of[-W/2,0,W/2])bx(g,wx+dx-2,-1,4,3,1,1.15,frame,false);
  for(let i=0;i<5;i++)bx(g,wx-W/2+2,1,W-4,2,2.05-i*.065,.025,lam('#f2efe9'),false);
}
/* small builders in world units (metres-ish) for detailed props; p = [x px, y px], rot = yaw */
function part(par,w,h,d,m,x,y,z,rx=0,ry=0,rz=0){const o=new THREE.Mesh(GEO.box,typeof m==='string'?lam(m):m);o.scale.set(w,h,d);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=o.receiveShadow=true;par.add(o);return o;}
function pcyl(par,rt,rb,h,seg,m,x,y,z,rx=0,rz=0){const o=new THREE.Mesh(cylGeo(rt,rb,seg),typeof m==='string'?lam(m):m);o.scale.set(1,h,1);o.position.set(x,y,z);o.rotation.set(rx,0,rz);o.castShadow=o.receiveShadow=true;par.add(o);return o;}
const CYLG={};function cylGeo(rt,rb,seg){const k=rt+'|'+rb+'|'+seg;if(!CYLG[k]){CYLG[k]=new THREE.CylinderGeometry(rt,rb,1,seg);CYLG[k].userData.shared=true;}return CYLG[k];}
function at(g,xpx,ypx,rot=0){const o=new THREE.Group();o.position.set(xpx*U,0,ypx*U);o.rotation.y=rot;g.add(o);return o;}
const SCR_T={};
function screenMat(hue){
  if(SCR_T[hue])return SCR_T[hue];
  const c=document.createElement('canvas');c.width=128;c.height=80;const x=c.getContext('2d');
  x.fillStyle=hue;x.fillRect(0,0,128,80);x.fillStyle='rgba(255,255,255,.85)';x.fillRect(0,0,128,9);
  for(let i=0;i<6;i++){x.fillStyle=`rgba(255,255,255,${.35+(i%2)*.2})`;x.fillRect(10,16+i*10,40+((i*29)%60),4);}
  x.fillStyle='#e5483a';x.fillRect(90,50,8,22);x.fillStyle='#f3d77a';x.fillRect(102,40,8,32);x.fillStyle='#5fd38a';x.fillRect(114,30,8,42);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return SCR_T[hue]=new THREE.MeshStandardMaterial({map:t,emissive:'#ffffff',emissiveMap:t,emissiveIntensity:.55});
}
const SCREEN_HUES=['#2f6fb3','#3b5998','#2f7d4f','#6b4fa0','#3a8f6a','#b5653a'];
function monitorAt(par,x,z,rot,hue){
  const m=new THREE.Group();m.position.set(x,.765,z);m.rotation.y=rot;par.add(m);
  part(m,.32,.02,.2,'#2a2d31',0,.01,0);part(m,.06,.32,.05,'#2a2d31',0,.18,-.03);
  part(m,.8,.48,.05,'#1f2226',0,.47,0);
  const s=new THREE.Mesh(new THREE.PlaneGeometry(.72,.4),screenMat(hue));s.position.set(0,.47,.027);m.add(s);
  return m;
}
function officeChair(par,seatM){
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;part(par,.52,.06,.09,'#2c3036',Math.cos(a)*.24,.12,Math.sin(a)*.24,0,-a,0);pcyl(par,.05,.05,.06,6,'#1d2024',Math.cos(a)*.48,.04,Math.sin(a)*.48);}
  pcyl(par,.045,.045,.42,6,'#9aa0a6',0,.36,0);
  part(par,.62,.1,.6,seatM,0,.6,0);
  part(par,.58,.66,.08,seatM,0,1.03,-.29,-.08,0,0);
  for(const sx of[-.33,.33]){part(par,.07,.05,.36,'#2c3036',sx,.84,0);part(par,.05,.22,.05,'#2c3036',sx,.72,0);}
}
/* one desk of a cubicle pod: quadrant rect in px, the seat is on the side away from the spine */
function cubicleDesk(g,qx,qy,qw,qh,seatSide,i){
  const d=at(g,qx+qw/2,qy+qh/2,seatSide>0?0:Math.PI),W=qw*U-.12,D=qh*U-.1;   // local +z points at the seat
  part(d,W,.05,D,'#f1eee8',0,.74,0);part(d,W,.02,D,'#c9c4bb',0,.71,0);
  for(const sx of[-W/2+.04,W/2-.04])part(d,.06,.7,D-.1,'#7d8187',sx,.36,0);
  part(d,.5,.6,D-.12,'#9aa0a6',W/2-.36,.32,0);for(let k=0;k<3;k++)part(d,.46,.16,.02,'#b4b9be',W/2-.36,.5-k*.19,D/2-.05);
  const hue=SCREEN_HUES[i%SCREEN_HUES.length];monitorAt(d,-.1,-D/2+.22,0,hue);if(i%3===1)monitorAt(d,.62,-D/2+.26,-.35,SCREEN_HUES[(i+2)%6]);
  part(d,.56,.02,.18,'#2c3036',-.1,.775,.1);part(d,.08,.02,.12,'#2c3036',.3,.775,.12);
  pcyl(d,.055,.05,.12,8,['#cf3626','#2b6cb0','#e0c23d','#fbfaf6','#3fbf6a'][i%5],-W/2+.3,.83,0);
  for(let k=0;k<3;k++)part(d,.26,.012,.36,k%2?'#f6f3ea':'#ffffff',W/2-.4,.775+k*.013,-.05,0,.12*k,0);
  for(const[sx,c]of[[-.42,'#f3d77a'],[-.34,'#f29bb0'],[.22,'#9fe0a8']])part(d,.08,.08,.006,c,sx,1.14,-D/2+.25);
}
function cubiclePod(g,o){
  const x=o.x,y=o.y,w=o.w,h=o.h,mx=x+w/2,my=y+h/2,PANEL=lam('#5f7a96'),FR=lam('#b8bcc0');
  /* fabric panels with aluminium caps: spine, cross panel and both ends */
  bx(g,x,my-2,w,4,0,1.2,PANEL);bx(g,x-1,my-3,w+2,6,1.2,.04,FR,false);
  bx(g,mx-2,y,4,h,0,1.2,PANEL);bx(g,mx-3,y-1,6,h+2,1.2,.04,FR,false);
  for(const ex of[x-2,x+w-2]){bx(g,ex,y,4,h,0,1.2,PANEL);bx(g,ex-1,y-1,6,h+2,1.2,.04,FR,false);}
  /* pinned notes on the spine */
  for(const[dx,dy,c]of[[-70,-3,'#f6f3ea'],[-50,-3,'#f3d77a'],[60,3,'#ffffff'],[80,3,'#9fe0a8']])bx(g,mx+dx,my+dy,12,1,.85,.3,lam(c),false);
  const hw=w/2,hh=h/2;let i=Math.round(x+y);
  for(const[qx,qy,side]of[[x,y,-1],[x+hw,y,-1],[x,y+hh,1],[x+hw,y+hh,1]])cubicleDesk(g,qx+3,qy+(side<0?0:3),hw-6,hh-3,side,i++);
  if(o.dept)staticTags.push({t:o.dept,x:mx,y:my,h:1.45,small:true});
}
function waterCooler(g,mx,my){
  const c=at(g,mx,my);part(c,.42,1.0,.42,'#eceae5',0,.5,0);part(c,.34,.05,.06,'#9aa0a6',0,.72,.22);
  part(c,.06,.07,.05,'#2b6cb0',-.07,.8,.22);part(c,.06,.07,.05,'#cf3626',.07,.8,.22);
  pcyl(c,.17,.17,.5,10,lam('#7fc2ea',{transparent:true,opacity:.75,roughness:.15}),0,1.25,0);pcyl(c,.08,.16,.09,10,'#7fc2ea',0,1.54,0);
}
function plantAt(g,mx,my,s=1){
  const p=at(g,mx,my);p.scale.setScalar(s);
  pcyl(p,.24,.18,.45,8,'#b06a3b',0,.22,0);pcyl(p,.25,.25,.05,8,'#8c5230',0,.45,0);
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,h=.85+(i%3)*.22;const lf=new THREE.Mesh(new THREE.ConeGeometry(.11,h,4),lam(i%2?'#4f8f45':'#3f7a3a'));
    lf.position.set(Math.cos(a)*.12,.48+h/2,Math.sin(a)*.12);lf.rotation.set(Math.sin(a)*.45,0,-Math.cos(a)*.45);lf.castShadow=true;p.add(lf);}
}
/* 사내 게시판 on the back wall of the 사내 카페, left of the coffee counter: a wood-framed cork board with papers,
   sticky notes and a photo pinned up. E in front of it opens the update notes (client/49-board.js) and NEW! floats
   over it while one is unread. It hangs off the wall bottom-out, so the high camera sees its face, not a strip */
const BOARD_W=3.3,BOARD_H=1.32;
function boardTex(){
  const c=document.createElement('canvas');c.width=1000;c.height=400;const x=c.getContext('2d'),f=(w,s)=>`${w} ${s}px 'Noto Sans KR',sans-serif`;
  x.fillStyle='#bf8f57';x.fillRect(0,0,1000,400);
  let sd=7;const rn=()=>(sd=(sd*16807)%2147483647)/2147483647;   // same speckles every build
  for(let i=0;i<2600;i++){x.fillStyle=rn()<.5?'rgba(120,80,40,.28)':'rgba(240,205,150,.3)';x.fillRect(rn()*1000,rn()*400,2+rn()*3,2+rn()*3);}
  x.fillStyle='#2f5d46';x.fillRect(370,14,260,46);x.fillStyle='#fbfaf6';x.font=f(900,30);x.textAlign='center';x.textBaseline='middle';x.fillText('사내 게시판',500,38);
  const pin=(px,py,col)=>{x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.arc(px+3,py+4,9,0,7);x.fill();x.fillStyle=col;x.beginPath();x.arc(px,py,9,0,7);x.fill();
    x.fillStyle='rgba(255,255,255,.6)';x.beginPath();x.arc(px-3,py-3,3,0,7);x.fill();};
  /* paper(x,y,w,h,tilt,colour,draw the content in its own coordinates, pin colour) */
  const paper=(px,py,w,h,rot,bg,body,pc)=>{x.save();x.translate(px+w/2,py+h/2);x.rotate(rot);x.translate(-w/2,-h/2);
    x.fillStyle='rgba(0,0,0,.22)';x.fillRect(5,6,w,h);x.fillStyle=bg;x.fillRect(0,0,w,h);x.textAlign='left';x.textBaseline='alphabetic';body(w,h);x.restore();
    pin(px+w/2,py+12,pc);};
  const lines=(x0,y0,w,n,gap=20)=>{x.fillStyle='rgba(60,70,80,.35)';for(let i=0;i<n;i++)x.fillRect(x0,y0+i*gap,w*(i%3===2?.6:1),5);};
  paper(36,84,190,250,-.04,'#fbfaf6',(w)=>{x.fillStyle='#cf3626';x.font=f(900,26);x.fillText('업데이트',18,48);x.fillText('안내',18,80);
    x.fillStyle='#2a3036';x.font=f(700,15);x.fillText('경영지원팀',18,108);lines(18,130,w-36,5,22);},'#cf3626');
  paper(250,92,130,130,.06,'#f7dc6f',()=>{x.fillStyle='#4a3a12';x.font=f(900,24);x.fillText('칼퇴',22,58);x.fillText('금지!',22,92);},'#2b6cb0');
  paper(268,248,120,116,-.07,'#f5c6d0',()=>{x.fillStyle='#5a2a35';x.font=f(800,17);x.fillText('분실물',16,40);x.font=f(700,14);x.fillText('사원증 1개',16,68);x.fillText('안내데스크로',16,90);},'#3f8f5f');
  paper(410,80,180,240,.03,'#fbfaf6',(w)=>{x.fillStyle='#2a3036';x.font=f(900,22);x.fillText('이번 주 랭킹',16,40);
    for(let i=0;i<5;i++){x.fillStyle=i?'#7a8ea6':'#c08a1e';x.font=f(900,18);x.fillText(i+1+'',18,78+i*32);x.fillStyle='rgba(60,70,80,.35)';x.fillRect(44,66+i*32,w-64-i*12,6);}},'#e0c23d');
  paper(616,98,140,170,-.05,'#fbfaf6',()=>{const gr=x.createLinearGradient(0,12,0,120);gr.addColorStop(0,'#8ec5e8');gr.addColorStop(1,'#d9eef9');x.fillStyle=gr;x.fillRect(12,12,116,108);
    x.fillStyle='#4f8f45';x.beginPath();x.moveTo(12,120);x.lineTo(50,78);x.lineTo(84,104);x.lineTo(110,86);x.lineTo(128,100);x.lineTo(128,120);x.fill();
    for(const[cx,col]of[[44,'#cf3626'],[70,'#2b6cb0'],[96,'#e0c23d']]){x.fillStyle=col;x.fillRect(cx-6,98,12,18);x.fillStyle='#f1c9a5';x.beginPath();x.arc(cx,92,6,0,7);x.fill();}
    x.fillStyle='#2a3036';x.font=f(800,16);x.textAlign='center';x.fillText('워크숍 단체사진',70,150);},'#cf3626');
  paper(782,84,184,232,.05,'#d8ecf7',(w)=>{x.fillStyle='#2b4a6b';x.font=f(900,22);x.fillText('이번 주 점심',16,40);x.font=f(700,15);
    ['월  김치찌개','화  돈까스','수  비빔밥','목  짜장면','금  ???'].forEach((t,i)=>x.fillText(t,18,76+i*30));},'#3f8f5f');
  paper(140,350,110,40,.02,'#fbfaf6',()=>{x.fillStyle='#2a3036';x.font=f(800,14);x.fillText('동호회 모집',14,26);},'#8e5c8a');
  paper(800,334,150,52,-.03,'#f7dc6f',()=>{x.fillStyle='#4a3a12';x.font=f(800,15);x.fillText('커피는 셀프 ☕',14,32);},'#cf3626');
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
function noticeBoard(g,b){
  const p=new THREE.Group();p.position.set(b.x*U,2.32,.02);p.rotation.x=-.42;g.add(p);   // hinged at the top edge on the wall
  part(p,BOARD_W+.16,BOARD_H+.16,.08,'#6b4a2e',0,-BOARD_H/2,.04);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W,BOARD_H),ownMat(new THREE.MeshLambertMaterial({map:boardTex()})));face.position.set(0,-BOARD_H/2,.085);p.add(face);
  for(const sx of[-1,1])part(p,.04,.3,.04,'#4b555d',sx*(BOARD_W/2-.3),.05,-.02);   // hanging wires
}
function obMesh(g,o,f){
  const k=o.k,x=o.x,y=o.y,w=o.w,h=o.h,mx=x+w/2,my=y+h/2;
  switch(k){
    case 'wall':{const m=bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#efe7db',transparent:true,opacity:1})));wallMs.push(m);
      bx(g,x-1,y-1,w+2,h+2,0,.14,lam('#c9a58d'),false);break;}
    case 'glass':{bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#bfe3f5',transparent:true,opacity:.3,depthWrite:false})),false);
      bx(g,x,y,w,h,WALL_H-.07,.07,lam('#e9e1d4'));bx(g,x,y,w,h,0,.1,lam('#d8cfc2'),false);break;}
    case 'cluster':cubiclePod(g,o);break;
    case 'counter':{bx(g,x,y,w,h,0,.95,lam('#e8e2d3'));bx(g,x-2,y-2,w+4,h+4,.95,.05,lam('#fbf8f0'));
      bx(g,K(935),K(10),K(30),K(30),1,.5,lam('#2a3036'));bx(g,K(990),K(12),K(44),K(28),1,.38,lam('#d0d4d6'));break;}
    case 'cooler':waterCooler(g,mx,my);break;
    case 'printer':{bx(g,x,y,w,h,0,.95,lam('#d6d9db'));bx(g,x,y,w,h,.95,.07,lam('#b4b9be'));bx(g,x+10,y+8,w-20,6,1.02,.04,lam('#2a3036'),false);bx(g,x+14,y+20,w-28,14,1.02,.03,lam('#ffffff'),false);
      bx(g,x+w-4,y+h-14,2,10,.9,.08,lam('#5fd38a',{emissive:'#5fd38a',emissiveIntensity:.7}),false);break;}
    case 'copier':{bx(g,x,y,w,h,0,1.05,lam('#d4d7da'));bx(g,x,y,w,h,1.05,.08,lam('#b4b9be'));bx(g,x+6,y+6,w-12,h-24,1.13,.03,lam('#2c3036'),false);bx(g,x+8,y+8,w-16,h-28,1.16,.02,lam('#ffffff'),false);
      for(let i=0;i<2;i++)bx(g,x+w-1,y+6,1,h-12,.3+i*.3,.03,lam('#9aa0a6'),false);bx(g,x+w-3,y+h-16,2,10,1.0,.08,lam('#5fd38a',{emissive:'#5fd38a',emissiveIntensity:.6}),false);break;}
    case 'box':{bx(g,x,y,w,h,0,.55,lam('#8c6d3a'));bx(g,x+3,y+3,w-6,6,.55,.03,lam('#e3c27a'),false);staticTags.push({t:'결재함',x:mx,y:my,h:1.0,small:true});break;}
    case 'reception':{bx(g,x,y,w,h,0,1.05,lam('#3d4a54'));bx(g,x+6,y+6,w-12,14,1.05,.04,lam('#e8e2d3'),false);break;}
    case 'plant':plantAt(g,mx,my,Math.max(.8,w*U*1.1));break;
    case 'rtable':{const t=at(g,mx,my);pcyl(t,w/2*U,w/2*U,.05,10,'#a8865f',0,.74,0);pcyl(t,.08,.1,.7,8,'#5d666e',0,.37,0);pcyl(t,.4,.45,.04,10,'#5d666e',0,.02,0);
      cupAt(g,mx-10,my-6,'#fbfaf6');cupAt(g,mx+12,my+8,'#cf3626');break;}
    case 'stairhouse':{bx(g,x,y,w,h,0,2.9,lam('#7d868e'));const dx=x<FW/2?x+w-6:x;bx(g,dx,my-40,6,80,0,2.2,lam('#8a6a4a'));staticTags.push({t:x<FW/2?'왼쪽 문':'오른쪽 문',x:mx,y:my,h:3.2});break;}
    case 'ac':{bx(g,x,y,w,h,0,1.0,lam('#c3c9cd'));for(const c of[x+w*.3,x+w*.7])cy(g,c,my,h*.32,1.0,.04,lam('#5d666e'),false);break;}
    case 'tank':{cy(g,mx,my,w/2,0,2.4,lam('#6f8fa6'));cy(g,mx,my,w/2-8,2.4,.06,lam('#4f6f86'),false);break;}
    case 'ashtray':{cy(g,mx,my,w/2,0,.7,lam('#4b555d'));break;}
    case 'bench':{bx(g,x,y,w,h,0,.45,lam('#8a6a4a'));break;}
    case 'picnic':picnicSet(g,o);break;
    case 'pillar':{const m=bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#e9e6df',transparent:true,opacity:1})));wallMs.push(m);break;}
    case 'sofa':{bx(g,x,y,w,h,0,.42,lam('#7d5b4a'));bx(g,x,y,w,10,.42,.45,lam('#6d4e3f'));break;}
    case 'gate':{bx(g,x,y,w,h,0,1.0,lam('#9aa3ab'));bx(g,mx-4,y+3,8,8,1.0,.04,lam('#2f7d4f',{emissive:'#2f7d4f',emissiveIntensity:.6}),false);break;}
    case 'table':{bx(g,x,y,w,h,.7,.05,lam('#a8865f'));bx(g,x+2,y+2,w-4,h-4,.66,.04,lam('#8c6d4a'),false);for(const[lx,ly]of[[x+6,y+6],[x+w-10,y+6],[x+6,y+h-10],[x+w-10,y+h-10]])bx(g,lx,ly,4,4,0,.66,lam('#5d666e'));break;}
    case 'exec':{bx(g,x,y,w,h,0,.8,lam('#5a3b28'));bx(g,mx-20,y+6,40,4,.8,.4,lam('#2a3036'));break;}
    case 'cabinet':{bx(g,x,y,w,h,0,1.9,lam('#8d949b'));for(let i=0;i<5;i++){bx(g,x+3,y+h,w-6,1,.12+i*.36,.3,lam('#a7aeb5'),false);bx(g,x+w/2-6,y+h+1,12,1,.3+i*.36,.04,lam('#5d666e'),false);}break;}
    case 'rack':{bx(g,x,y,w,h,0,2.1,lam('#22303c'));for(let xx=x+8;xx<x+w-6;xx+=14)bx(g,xx,y+h,5,1,1.6,.06,lam('#5fd38a',{emissive:'#5fd38a',emissiveIntensity:.9}),false);break;}
    case 'hall':break;   // only walked around: 52-hall.js draws the 명예 사원 itself, and the floor is kept for matches
    default:bx(g,x,y,w,h,0,.8,lam('#9aa3ab'));
  }
}

/* ---------- set dressing: props that sit on desks, counters and against walls, never in walkways ---------- */
let floorAnim=[];
function textPlane(text,wPx,hPx,bg,fg,font,ppu=4){
  const c=document.createElement('canvas');c.width=Math.round(wPx*ppu);c.height=Math.round(hPx*ppu);const x=c.getContext('2d');
  if(bg){x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);}
  x.fillStyle=fg;x.font=font.replace(/(\d+)px/,(m,n)=>Math.round(n*ppu)+'px');x.textAlign='center';x.textBaseline='middle';
  /* shrink any line that would not fit the plate */
  const base=x.font;
  String(text).split('\n').forEach((ln,i,arr)=>{x.font=base;const w=x.measureText(ln).width,max=c.width*.9;
    if(w>max)x.font=base.replace(/(\d+)px/,(m,n)=>Math.floor(n*max/w)+'px');
    x.fillText(ln,c.width/2,c.height/2+(i-(arr.length-1)/2)*c.height/arr.length*.9);});
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  return new THREE.Mesh(new THREE.PlaneGeometry(wPx*U,hPx*U),ownMat(new THREE.MeshLambertMaterial({map:t,transparent:!bg})));
}
function onBackWall(g,m,x,yUp){m.position.set(x*U,yUp,.03);g.add(m);return m;}
function onLeftWall(g,m,y,yUp){m.rotation.y=Math.PI/2;m.position.set(.03,yUp,y*U);g.add(m);return m;}
function onRightWall(g,m,y,yUp){m.rotation.y=-Math.PI/2;m.position.set(W3-.03,yUp,y*U);g.add(m);return m;}
function clock(g,x){
  const face=new THREE.Mesh(GEO.cyl,lam('#fbfaf6'));face.scale.set(.32,.04,.32);face.rotation.x=Math.PI/2;face.position.set(x*U,1.95,.04);g.add(face);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.32,.035,8,28),lam('#3d4a54'));rim.position.set(x*U,1.95,.06);g.add(rim);
  const hand=(len,wid,col)=>{const p=new THREE.Group();p.userData.dyn=true;p.position.set(x*U,1.95,.08);const h=new THREE.Mesh(GEO.box,lam(col));h.scale.set(wid,len,.01);h.position.y=len/2;p.add(h);g.add(p);return p;};
  const hh=hand(.17,.035,'#1d2328'),mh=hand(.26,.025,'#1d2328'),sh=hand(.27,.012,'#cf3626');
  floorAnim.push(()=>{const t=9*3600+G.t*60;sh.rotation.z=-(t%60)/60*Math.PI*2;mh.rotation.z=-(t%3600)/3600*Math.PI*2;hh.rotation.z=-(t%43200)/43200*Math.PI*2;});
}
function poster(g,x,title,sub,col){
  const fr=bx(g,x-46,-1,92,2,1.05,1.05,lam('#3d4a54'),false);fr.position.z=.02;
  const p=textPlane(title+'\n'+sub,84,33,col,'#fbfaf6',F(800,11));onBackWall(g,p,x,1.575);p.position.z=.05;
}
function whiteboard(g,y,lines){
  const b=new THREE.Mesh(GEO.box,lam('#9aa3ab'));b.scale.set(.05,.95,180*U);b.position.set(.03,1.55,y*U);g.add(b);
  const c=document.createElement('canvas');c.width=360;c.height=190;const x=c.getContext('2d');x.fillStyle='#fbfaf6';x.fillRect(0,0,360,190);
  x.font="700 22px 'Noto Sans KR',sans-serif";x.fillStyle='#2b6cb0';lines.forEach((l,i)=>x.fillText(l,18,40+i*36));
  x.strokeStyle='#cf3626';x.lineWidth=4;x.beginPath();x.moveTo(230,150);x.lineTo(270,110);x.lineTo(300,130);x.lineTo(340,70);x.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  const p=new THREE.Mesh(new THREE.PlaneGeometry(170*U,.85),ownMat(new THREE.MeshLambertMaterial({map:t})));onLeftWall(g,p,y,1.55);p.position.x=.07;
}
function shelf(g,y,len,right){
  const x0=right?FW-14:0,m=bx(g,x0,y,14,len,0,1.8,lam('#8c6d4a'));
  const BOOK=['#cf3626','#2b6cb0','#e0c23d','#2f7d4f','#8e5c8a','#d07d4e'];
  for(let lv=0;lv<3;lv++)for(let yy=y+4;yy<y+len-8;yy+=9+((yy*7)%5)){
    const h=.32+((yy*13+lv)%5)*.03;bx(g,x0+(right?0:2),yy,12,6,.15+lv*.55,h,lam(BOOK[(yy+lv*3)%6]),false);}
  return m;
}
function mug(g,x,y,col){cy(g,x,y,3.2,.77,.13,lam(col),false);}
function meetingProps(g,fl){
  for(const z of fl.meet){
    /* wall TV on the room's top edge */
    const tv=bx(g,z.x+z.w/2-50,z.y-2,100,4,1.08,.82,lam('#1d2328'),false);
    const scr=textPlane('3분기 실적\n▲ 12%',92,26,'#2b4a6b','#e8f1fb',F(800,11));scr.position.set((z.x+z.w/2)*U,1.49,(z.y+2)*U+.01);g.add(scr);
  }
  for(const o of fl.ob){if(o.k!=='table')continue;
    const n=Math.max(2,Math.floor(o.w/40));
    for(let i=0;i<n;i++){const cx=o.x+(i+.5)*o.w/n;
      for(const[cyy,face]of[[o.y-14,Math.PI/2],[o.y+o.h+14,-Math.PI/2]]){
        const c=new THREE.Group();officeChair(c,lam('#30353c'));c.scale.setScalar(.72);
        c.position.set(cx*U,0,cyy*U);c.rotation.y=toYaw(face);g.add(c);}}
    tableProps(g,o.x,o.y,o.w,o.h);
  }
}
/* coffee on meeting tables: cups on saucers, a pot, a laptop, papers, a donut box */
function cupAt(g,xpx,ypx,col){const c=at(g,xpx,ypx);pcyl(c,.09,.09,.015,10,'#fbfaf6',0,.755,0);pcyl(c,.055,.045,.11,10,col,0,.82,0);pcyl(c,.047,.047,.01,10,'#5a3b28',0,.876,0);
  part(c,.02,.06,.04,col,.065,.82,0);}
function tableProps(g,x,y,w,h){
  const n=Math.max(2,Math.floor(w/40)),CUP=['#fbfaf6','#cf3626','#2b6cb0','#e0c23d'];
  for(let i=0;i<n;i++){const cx=x+(i+.5)*w/n;cupAt(g,cx-6,y+12,CUP[i%4]);if(i%2)cupAt(g,cx+8,y+h-12,CUP[(i+2)%4]);}
  const pot=at(g,x+w/2+26,y+h/2);pcyl(pot,.1,.12,.26,10,'#2a2d31',0,.88,0);pcyl(pot,.06,.1,.06,10,'#5d666e',0,1.03,0);part(pot,.04,.12,.03,'#2a2d31',.13,.9,0);
  const lp=at(g,x+w/2-24,y+h/2,.3);part(lp,.42,.02,.3,'#c3c9cd',0,.755,0);const sc=part(lp,.42,.28,.015,'#9edceb',0,.9,-.15,-.35,0,0);sc.material=lam('#9edceb',{emissive:'#4fa8bd',emissiveIntensity:.3});
  for(let k=0;k<2;k++)part(at(g,x+22+k*16,y+h/2+4,.2*k),.3,.012,.4,k?'#f6f3ea':'#ffffff',0,.755+k*.013,0);
  if(w>140){const dz=at(g,x+w-34,y+h/2-4,-.2);part(dz,.42,.06,.3,'#f3d77a',0,.78,0);for(let k=0;k<3;k++){const d=new THREE.Mesh(new THREE.TorusGeometry(.055,.028,6,12),lam(['#c8955a','#f29bb0','#7a4b2a'][k]));d.rotation.x=Math.PI/2;d.position.set(-.12+k*.12,.83,0);dz.add(d);}}
}
function restroomProps(g,fl){
  const r=fl.rest;
  for(let i=0;i<3;i++){const yy=r.y+40+i*50;
    bx(g,0,yy-14,16,28,0,.85,lam('#fbfaf6'));cy(g,8,yy,8,.85,.02,lam('#c3c9cd'),false);}
  const mir=new THREE.Mesh(new THREE.PlaneGeometry(150*U,.55),lam('#cfe6f2',{emissive:'#cfe6f2',emissiveIntensity:.25}));onLeftWall(g,mir,r.y+90,1.55);
  bx(g,r.x+r.w-30,0,22,8,1.1,.4,lam('#c3c9cd'),false); // hand dryer
  /* the stall's toilet (화캉스), facing the door; a low partition beside it */
  if(fl.spots.toilet){const t=at(g,fl.spots.toilet.x,fl.spots.toilet.y-6);
    pcyl(t,.2,.15,.4,12,'#fbfaf6',0,.2,.04);pcyl(t,.23,.23,.04,12,'#dfe5e8',0,.42,.04);part(t,.44,.42,.16,'#fbfaf6',0,.6,-.22);part(t,.12,.03,.05,'#c3c9cd',.12,.83,-.22);
    part(t,.05,1.3,.95,'#c9d3da',-.52,.65,-.05);}
}
function pantryProps(g){
  bx(g,K(880),0,K(220),14,1.55,.65,lam('#e8e2d3'));
  for(let i=0;i<4;i++)mug(g,K(1045)+i*10,K(28),['#fbfaf6','#cf3626','#2b6cb0','#e0c23d'][i]);
  for(let i=0;i<4;i++){const s=new THREE.Mesh(GEO.sph,lam(['#e5483a','#e0c23d','#3fbf6a','#e5483a'][i]));s.scale.setScalar(.06);s.position.set(K(910)*U+i*.09,1.02,K(30)*U+(i%2)*.06);g.add(s);}
}
const STAMP_F=s=>`900 ${s}px 'Noto Sans KR','Apple SD Gothic Neo',sans-serif`;   // stamps are textures of a fixed size, so no screen scale (DF)
/* the wall sign: the I of OFFICE is a red necktie */
function wallLogo(){
  const W=470,H=76,P=4,S=52*P,C=document.createElement('canvas');C.width=W*P;C.height=H*P;const x=C.getContext('2d');x.font=STAMP_F(S);
  const str=[...'OFFICE ROYALE'],slot=.4*S,base=C.height/2+.365*S,ws=str.map(c=>c==='I'?slot:x.measureText(c).width);let px=(C.width-ws.reduce((a,b)=>a+b))/2;
  const poly=(...p)=>{x.beginPath();for(let i=0;i<p.length;i+=2)x.lineTo(p[i],p[i+1]);x.closePath();x.fill();};
  str.forEach((c,i)=>{if(c==='I'){const m=px+slot/2,top=base-.76*S,bot=base+.07*S;x.fillStyle='#c8283a';
      poly(m-.17*S,top,m+.17*S,top,m+.1*S,top+.15*S,m-.1*S,top+.15*S);poly(m-.085*S,top+.17*S,m+.085*S,top+.17*S,m+.205*S,bot-.2*S,m,bot,m-.205*S,bot-.2*S);}
    else{x.fillStyle='#2a3036';x.fillText(c,px,base);}px+=ws[i];});
  const t=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  return new THREE.Mesh(new THREE.PlaneGeometry(W*U,H*U),ownMat(new THREE.MeshLambertMaterial({map:t,transparent:true,depthWrite:false})));
}
function lobbyProps(g){
  const sign=wallLogo();onBackWall(g,sign,FW/2,1.7);
  const sub=textPlane('인사평가 서바이벌',300,26,null,'#5d666e',F(800,18));onBackWall(g,sub,FW/2,.55);sub.position.z=.16; // on the lower panel under the chair rail, clear of the sign above it
  sub.material.depthWrite=false;sub.renderOrder=1;   // the empty part of the sign must not hide this
  /* revolving door at the front entrance */
  const rv=new THREE.Group();rv.position.set(DOOR.x*U,0,(FH+20)*U);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2,24,1,true,0,Math.PI*2),ownMat(new THREE.MeshLambertMaterial({color:'#c8d7e1',transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide})));glass.position.y=1.1;rv.add(glass);
  const wings=new THREE.Group();wings.userData.dyn=true;for(let i=0;i<4;i++){const w=new THREE.Mesh(GEO.box,lam('#9fcbe3',{transparent:true,opacity:.6}));w.scale.set(1.05,2.1,.04);w.position.set(Math.cos(i*Math.PI/2)*.52,1.05,Math.sin(i*Math.PI/2)*.52);w.rotation.y=-i*Math.PI/2;wings.add(w);}
  rv.add(wings);g.add(rv);floorAnim.push(dt=>{wings.rotation.y+=dt*.6;});
  /* info screen at the reception */
  const by=K(560)+8,bh=1.0;bx(g,K(550)-49,by-3,98,3,1.12,bh+.08,lam('#1d2328'),false);
  for(const sx of[-34,34])bx(g,K(550)+sx-2,by-3,4,3,1.05,.08,lam('#5d666e'),false);   // framed board on two short feet on the desk top
  noticeBoard(g,FLOORS[0].spots.board);
  const scr=textPlane('방문 등록\n1F 안내데스크',90,34,'#2b4a6b','#e8f1fb',F(800,11));scr.position.set(K(550)*U,1.16+bh/2,by*U+.01);g.add(scr);
}
function execProps(g){
  shelf(g,K(200),K(180),true); // the back-wall posters on this floor are the executive ones (see decor)
}
function serverProps(g){
  for(let x=K(800);x<K(1030);x+=24)bx(g,x,K(482),18,6,2.25,.06,lam('#3d4a54'),false);
}
function roofProps(g){
  /* railing instead of the low parapet */
  const postM=lam('#7d868e'),railM=lam('#9aa3ab');
  const rail=(x1,y1,x2,y2)=>{bx(g,Math.min(x1,x2)-2,Math.min(y1,y2)-2,Math.abs(x2-x1)+4,Math.abs(y2-y1)+4,1.05,.06,railM,false);
    const n=Math.max(1,Math.round(Math.hypot(x2-x1,y2-y1)/90));for(let i=0;i<=n;i++){const px=x1+(x2-x1)*i/n,py=y1+(y2-y1)*i/n;bx(g,px-2,py-2,4,4,0,1.08,postM,false);}};
  rail(-4,-4,FW+4,-4);rail(-4,-4,-4,FH+4);rail(FW+4,-4,FW+4,FH+4);rail(-4,FH+4,FW+4,FH+4);
  /* neighbouring buildings below and around the roof */
  const BLD=['#8fa2b3','#a5b4c2','#7f93a6','#b6c2cd','#94a7b8'];let s=7;const rnd2=()=>{s=(s*9301+49297)%233280;return s/233280;};
  for(let i=0;i<26;i++){const side=i%4,w=120+rnd2()*200,d=120+rnd2()*200,h=-14+rnd2()*18;let x,y;
    if(side===0){x=-200+rnd2()*(FW+400);y=-260-rnd2()*300;}else if(side===1){x=-420-rnd2()*200;y=rnd2()*FH;}else if(side===2){x=FW+120+rnd2()*200;y=rnd2()*FH;}else{x=-200+rnd2()*(FW+400);y=FH+160+rnd2()*200;}
    bx(g,x,y,w,d,-16,16+h,lam(BLD[i%5]),false);
    for(let k=0;k<3;k++)bx(g,x+10,y+d,w-20,1,-16+3+k*3.6+(16+h-14),.8,lam('#d8e6f0',{emissive:'#d8e6f0',emissiveIntensity:.2}),false);}
  /* parasols over the ashtrays */
  for(const o of FLOORS[ROOF].ob){if(o.k!=='ashtray')continue;const cx=o.x+o.w/2,cyy=o.y+o.h/2;
    cy(g,cx,cyy,2.5,0,2.3,lam('#d8d8dc'),false);
    const c=new THREE.Mesh(new THREE.ConeGeometry(1.2,.5,10),lam(cx<FW/2?'#3d8be0':'#e08c3d'));c.position.set(cx*U,2.4,cyy*U);c.castShadow=true;g.add(c);
    const smoke=new THREE.Mesh(GEO.sph,basic('#e9edf0',{transparent:true,opacity:.35,depthWrite:false}));smoke.scale.setScalar(.12);g.add(smoke);
    const ph=cx*.01;floorAnim.push(()=>{const k=(G.t*.6+ph)%1;smoke.position.set(cx*U+Math.sin(G.t+ph)*.08,.8+k*1.2,cyy*U);smoke.scale.setScalar(.1+k*.22);smoke.material.opacity=.4*(1-k);});}
  /* smokers from other teams, puffing away by the corner ashtrays (scenery: no collisions, can't be hit) */
  for(const[ax,ay,c,fa]of[[K(170)+30,K(90)+20,'#5b6fa8',2.4],[K(170)+30,K(640)+10,'#6f8f3a',-2.4],[K(900)-12,K(90)+22,'#b55a4a',.7],[K(900)-10,K(640)+12,'#7a6aa8',-.7]]){
    const ch=makeChar(c,null,4000+Math.round(ax));ch.position.set(ax*U,0,ay*U);ch.rotation.y=fa;g.add(ch);
    for(let i=0;i<2;i++){const pf=new THREE.Mesh(GEO.sph,basic('#eef1f3',{transparent:true,opacity:.4,depthWrite:false}));g.add(pf);const ph=i*.5+ax*.003;
      floorAnim.push(()=>{const k=(G.t*.45+ph)%1;pf.position.set(ax*U+Math.sin(G.t*.8+ph)*.15+.2,1.5+k*1.4,ay*U-.1);pf.scale.setScalar(.12+k*.35);pf.material.opacity=.45*(1-k);});}}
  /* spinning fans on the AC units */
  for(const o of FLOORS[ROOF].ob){if(o.k!=='ac')continue;
    for(const c of[o.x+o.w*.3,o.x+o.w*.7]){const fan=new THREE.Group();fan.userData.dyn=true;fan.position.set(c*U,1.06,(o.y+o.h/2)*U);
      for(let i=0;i<3;i++){const b=new THREE.Mesh(GEO.box,lam('#3d4a54'));b.scale.set(.06,.02,o.h*.28*U);b.position.z=o.h*.14*U;const p=new THREE.Group();p.rotation.y=i*Math.PI*2/3;p.add(b);fan.add(p);}
      g.add(fan);floorAnim.push(dt=>{fan.rotation.y+=dt*9;});}}
}
/* rooftop lunch spot: a long table with a bench on each side and lunch boxes laid out (the long side runs along x) */
/* an open lunch box: coloured case, rice with a pickled plum, egg roll, broccoli, sausages, chopsticks, the lid set beside it */
function bento(b,col,r){
  const Y=.775,ball=(c,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(GEO.sph,lam(c));m.scale.set(sx,sy,sz);m.position.set(x,y,z);m.castShadow=true;b.add(m);};
  part(b,.3,.055,.21,col,0,Y+.028,0);part(b,.27,.01,.18,'#2a2522',0,Y+.052,0);   // case and its dark lining
  part(b,.012,.03,.18,col,.015,Y+.06,0);part(b,.125,.03,.012,col,.085,Y+.06,0);   // dividers
  part(b,.13,.03,.17,'#fbfaf6',-.065,Y+.06,0);ball('#c63a4a',-.065,Y+.078,0,.018,.012,.018);   // rice + plum
  for(const dz of[-.05,-.012])part(b,.05,.03,.032,'#f2c94c',.05,Y+.07,dz);   // egg roll
  ball('#3f8f45',.115,Y+.075,-.04,.026,.022,.026);ball('#4fa356',.1,Y+.08,-.025,.02,.018,.02);   // broccoli
  for(const dx of[.06,.105]){const s=pcyl(b,.014,.014,.06,8,'#d0533f',dx,Y+.07,.045,0,Math.PI/2);s.rotation.y=.3;}   // sausages
  for(const dz of[-.006,.006])part(b,.24,.008,.008,'#a77a4a',.0,Y+.004,.135+dz,0,.05,0);   // chopsticks
  if(r()<.6){const l=part(b,.3,.02,.21,col,-.33,Y+.01,.02,0,.25,0);l.material=lam(dark2(col));}   // lid
}
const dark2=c=>'#'+new THREE.Color(c).multiplyScalar(.8).getHexString();
function picnicSet(g,o){
  const t=at(g,o.x+o.w/2,o.y+o.h/2),L=o.w*U,D=o.h*U,BZ=D/2+K(17)*U,TOP=lam('#b88a5a'),LEG=lam('#6b5440'),SEAT=lam('#8a6a4a');
  part(t,L-.1,.07,D-.1,TOP,0,.74,0);for(const sx of[-1,1])for(const sz of[-1,1])part(t,.08,.7,.08,LEG,sx*(L/2-.3),.36,sz*(D/2-.25));
  /* the benches sit on the seat lines the rules use (17px off each long side) */
  for(const sz of[-1,1]){part(t,L-.2,.07,.42,SEAT,0,.42,sz*BZ);for(const sx of[-1,1])part(t,.08,.4,.08,LEG,sx*(L/2-.4),.2,sz*BZ);}
  /* a few things left on the table: lunch boxes here and there, water bottles and coffee cups */
  const BOX=['#cf3626','#2b6cb0','#e0c23d','#2f7d4f','#e08c3d'];let s=Math.round(o.x*7+o.y*13);const r=()=>{s=(s*9301+49297)%233280;return s/233280;};
  const spots=[];for(const sx of[-.36,0,.36])for(const sz of[-1,1])spots.push([sx*L,sz*D*.22]);spots.sort(()=>r()-.5);
  spots.slice(0,2+Math.floor(r()*2)).forEach(([x,z],i)=>{const b=at(t,0,0);b.position.set(x,-.775*.4,z);b.scale.setScalar(1.4);b.rotation.y=(r()-.5)*.6;bento(b,BOX[(i+Math.floor(r()*5))%5],r);});
  for(const[x,z]of spots.slice(3,3+2+Math.floor(r()*2))){const xx=x+(r()-.5)*.3,zz=z+(r()-.5)*.1;
    if(r()<.5){pcyl(t,.04,.04,.2,10,lam('#bfe3f5',{transparent:true,opacity:.7,roughness:.2}),xx,.875,zz);pcyl(t,.022,.022,.03,8,'#2b6cb0',xx,.99,zz);}   // water bottle
    else{pcyl(t,.045,.035,.12,10,'#fbfaf6',xx,.835,zz);pcyl(t,.047,.047,.02,10,'#5a3b28',xx,.9,zz);pcyl(t,.046,.04,.04,10,'#c8955a',xx,.81,zz);}}   // takeaway coffee with a sleeve
}
function sunPatches(x){
  for(const wx of[K(250),K(450),K(650),K(850)]){
    const gr=x.createLinearGradient(0,0,0,170);gr.addColorStop(0,'rgba(255,248,220,.38)');gr.addColorStop(1,'rgba(255,248,220,0)');x.fillStyle=gr;
    x.beginPath();x.moveTo(wx-60,0);x.lineTo(wx+60,0);x.lineTo(wx+110,170);x.lineTo(wx-10,170);x.closePath();x.fill();}
}
/* is this spot (px) clear of furniture, doors, lifts, restroom and meeting rooms? */
function clearSpot(fl,x,y,r){
  for(const o of fl.ob)if(x>o.x-r&&x<o.x+o.w+r&&y>o.y-r&&y<o.y+o.h+r)return false;
  for(const d of fl.doors)if(Math.hypot(x-(d.x+d.w/2),y-(d.y+d.h/2))<r+60)return false;
  for(const k in PADS)if(Math.hypot(x-PADS[k].x,y-PADS[k].y)<r+70)return false;
  if(Math.hypot(x-DOOR.x,y-DOOR.y)<r+110)return false;
  const inR=z=>x>z.x-r&&x<z.x+z.w+r&&y>z.y-r&&y<z.y+z.h+r;if(inR(fl.rest))return false;for(const z of fl.meet)if(inR(z))return false;
  for(const s of fl.seats)if(Math.hypot(x-s.x,y-s.y)<r+26)return false;
  return true;
}
function wallDecor(g,f,fl){
  if(f===ROOF)return;
  /* keep plants out from in front of posters, the clock and the whiteboard */
  const boards=f===0?[[FW/2,0,230],[FLOORS[0].spots.board.x,0,BOARD_W/U/2+30]]:[[480,0,70],[1050,0,70],[770,0,40]];if(f>0&&f<5)boards.push([0,330,110]);
  const blocksBoard=(x,y)=>boards.some(([bx0,by0,r])=>by0===0?y<60&&Math.abs(x-bx0)<r:x<60&&Math.abs(y-by0)<r);
  const tryPlant=(x,y,s)=>{if(clearSpot(fl,x,y,22)&&!blocksBoard(x,y)){plantAt(g,x,y,s);return true;}return false;};
  /* between the windows on the back wall, then down both side walls */
  for(const x of[K(350),K(550),K(750),K(150),K(950)])tryPlant(x,26,1);
  for(let y=K(220);y<FH-K(120);y+=K(150)){tryPlant(24,y,.95);tryPlant(FW-24,y+K(60),.95);}
  /* a bin at the end of every cubicle pod, a coat rack near the lifts */
  for(const o of fl.ob)if(o.k==='cluster'){for(const[x,y]of[[o.x-16,o.y+o.h-8],[o.x+o.w+16,o.y+8]])if(clearSpot(fl,x,y,10)){const b=at(g,x,y);pcyl(b,.17,.14,.38,8,'#3d4a54',0,.19,0);pcyl(b,.18,.18,.03,8,'#2c3036',0,.385,0);break;}}
  for(const[x,y]of[[K(160),FH-K(40)],[FW-K(170),FH-K(40)],[K(260),26]])if(clearSpot(fl,x,y,14)){const c=at(g,x,y);pcyl(c,.03,.03,1.75,6,'#5a3b28',0,.88,0);pcyl(c,.22,.25,.04,8,'#5a3b28',0,.02,0);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;part(c,.03,.03,.18,'#5a3b28',Math.cos(a)*.08,1.68,Math.sin(a)*.08,.6*Math.sin(a),0,-.6*Math.cos(a));}
    part(c,.34,.5,.12,['#2b3a55','#8a4f42','#4b555d'][f%3],.1,1.32,0,0,0,.12);break;}
}
function decor(g,f,fl){
  if(f===ROOF){roofProps(g);return;}
  if(f===0)lobbyProps(g);
  else if(f===5){clock(g,770);poster(g,480,'경영 방침','성과로 말한다','#5a3b28');poster(g,1050,'임원층','정숙해 주세요','#2a2d31');}
  else{clock(g,770);poster(g,480,['이달의 목표','칼퇴 금지','고과는 실력','인사가 만사','보고는 짧게'][f%5],'경영지원팀',['#2b6cb0','#cf3626','#2f7d4f','#8e5c8a','#c08a1e'][f%5]);
    poster(g,1050,'안전 제일','복도에서 뛰지 마세요','#3d4a54');}
  if(f>0&&f<5)whiteboard(g,330,['주간 업무','· 보고서 마감','· 결재 받기']);
  if(f===5)execProps(g);else shelf(g,300,160,true);
  restroomProps(g,fl);
  if(f>0)pantryProps(g);
  if(f===3)serverProps(g);
  meetingProps(g,fl);
  wallDecor(g,f,fl);
  if(f>0)for(let y=K(390);y<K(420);y+=8)bx(g,0,y,12,7,.0+((y/8)%3)*.12,.11,lam('#fbfaf6'),false);
  /* screens and server lights flicker a little */
  const led=lam('#5fd38a',{emissive:'#5fd38a',emissiveIntensity:.9});
  floorAnim.push(()=>{for(const k in SCR_T)SCR_T[k].emissiveIntensity=.52+Math.sin(G.t*3)*.05;led.emissiveIntensity=Math.sin(G.t*7)>0?1.1:.2;});
}

/* ---------- characters ---------- */
/* Round 2-3 head-tall office workers built from three swappable slots — head (hair, face), top, bottom —
   so outfits can later be sold as items. outfitFor() decides what everyone wears; a server-sent outfit can replace it. */
const SG=(g)=>{g.userData.shared=true;return g;};
/* Toy-figure look: a big soft head (~45% of the height) on a pear-shaped body. Body, legs and sleeves are lathe profiles,
   so each part is one smooth surface instead of spheres and capsules pushed together. Lathe phi 0 faces +z (the front). */
const LP=(pts,ps=0,pl=Math.PI*2,seg=24)=>SG(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg,ps,pl));
const TAU=Math.PI*2,JGAP=.3,MOUTH_ARC=Math.PI*.7;
/* a flat outline extruded with a soft bevel: tie blade, knot, collar points */
const XS=(pts,depth,bev)=>SG(new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],p[1]))),{depth,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:2,curveSegments:4}));
const CHECK_P=[[.25,.38],[.254,.44],[.255,.5],[.255,.58],[.253,.65],[.247,.7],[.232,.74],[.214,.772],[.178,.81],[.1,.846],[.02,.854]];   // 체크셔츠: hangs open over the trousers
const TORSO_P=[[0,.5],[.228,.5],[.235,.55],[.236,.62],[.226,.69],[.205,.75],[.16,.8],[.09,.83],[0,.84]],
  JACKET_P=[[.252,.43],[.255,.5],[.256,.58],[.25,.65],[.238,.7],[.214,.76],[.168,.81],[.1,.845],[.02,.855]],
  CARDI_P=[[.248,.45],[.25,.5],[.251,.58],[.246,.65],[.234,.7],[.21,.76],[.165,.81],[.1,.843],[.02,.852]],
  VEST_P=[[.248,.46],[.25,.52],[.25,.6],[.243,.67],[.226,.73],[.19,.785]];
/* radius of a lathe profile at height y */
const profR=(P,y)=>{for(let i=1;i<P.length;i++)if(y<=P[i][1]){const a=P[i-1],b=P[i];return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);}return P[P.length-1][0];};
const NECK_P=[[.186,.785],[.18,.81],[.168,.83],[.14,.84]];   // outside of the collar stand, low to high (the 사원증 strap rides over it)
const LOOSE_P=[[.2,.44],[.232,.443],[.239,.46],[.24,.5],[.243,.56],[.245,.62],[.24,.68],[.222,.74]];   // 후드티·티셔츠: from the hem up to the shoulders, one line (tops differ at the neck)
const TEE_P=LOOSE_P.concat([[.2,.772],[.174,.794]]);
/* 티셔츠 round neck: a lathe can only end level, so its top rows are pulled back along its own surface to a neckline that
   stays at y .794 round the back and dips at the front. The skin (teeNeck) lies just under the whole shoulder and shows through */
function scoopNeck(geo){const P=geo.attributes.position;
  for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i),z=P.getZ(i),r=Math.hypot(x,z)||1,f=Math.max(0,z/r)**3,cut=.794-.03*f;
    if(y>cut){const rc=profR(TEE_P,cut);P.setXYZ(i,x/r*rc,cut,z/r*rc);}}
  return geo;}
/* 체크셔츠 collar, one sheet that wraps the neck: a thin band round the back that comes round to the front, where each side ends in
   a point. Its lower edge is lifted off the shirt; `under`: a darker layer just below it, the shadow in the gap */
function wrapCollar(under){const G=.13,N=12,geo=LP(Array.from({length:N},(_,i)=>[.16,i/(N-1)]),G,TAU-G*2,96),P=geo.attributes.position;
  for(let i=0;i<P.count;i++){const x=P.getX(i),z=P.getZ(i),t=1-P.getY(i),ph=Math.atan2(x,z),d=Math.abs(ph)-G,TOP=.812-.012*Math.max(0,Math.cos(ph)),   // at the front its top edge sits on the line the shirt body starts at
      tip=d<.3?d/.3:Math.max(0,1-(d-.3)/.6),low=Math.min(TOP-.002,.836-Math.min(1,d/.08)*(.05+.055*tip)),y=TOP+(low-(under?.004:0)-TOP)*t,lift=.004+.012*Math.sin(t*Math.PI/2),r=profR(CHECK_P,y)+lift-under;
    P.setXYZ(i,Math.sin(ph)*r,y,Math.cos(ph)*r);}
  geo.computeVertexNormals();return geo;}
const TEE_FRONT=TEE_P.concat([[.14,.818],[.06,.843]]),HOODIE_FRONT=LOOSE_P.concat([[.17,.8],[.09,.835]]);   // their whole outline, up to the neck (what lies on them follows it)
const CHECK_GAP=.27;   // half the opening at the front of the 체크셔츠 (radians)
const CUP_G=new THREE.CylinderGeometry(1,.8,1,16);   // 커피: a takeaway cup, wider at the top
const PILLOW_G=new THREE.TorusGeometry(.215,.07,10,24,TAU-1.44),CROWN_RIM=new THREE.TorusGeometry(.152,.017,8,36).rotateX(Math.PI/2),TROPHY_H=new THREE.TorusGeometry(.055,.013,8,16,Math.PI);   // 목베개, 왕관 (성과 rewards)
/* 왕관: one flaring gold wall whose top edge rises to five points with round dips between. dir 1 = the outside, -1 = the inside */
function crownWall(dir,out){const N=70,M=6,R=[],I=[];
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){const t=i/N*TAU,k=j/M,top=.085+.115*(1-Math.abs(Math.sin(t*2.5))),y=k*top,r=(.145+y*.42)-(out?0:.008);R.push(Math.sin(t)*r,y,Math.cos(t)*r);}
  for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;if(dir>0)I.push(a,b,c,b,d,c);else I.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(R,3));g.setIndex(I);g.computeVertexNormals();return SG(g);}
const TROPHY_G=new THREE.LatheGeometry([[0,-.12],[.085,-.12],[.085,-.1],[.03,-.08],[.02,-.02],[.03,0],[.09,.05],[.125,.14],[.13,.2],[.118,.2],[.108,.14],[.08,.075],[0,.04]].map(p=>new THREE.Vector2(p[0],p[1])),24);
const CROWN_OUT=crownWall(1,true),CROWN_IN=crownWall(-1,false);
const FRECKLES=[[[.197,-.084,.006],[.168,-.057,.009],[.227,-.031,.0075],[.168,-.089,.011],[.269,-.051,.006],[.226,-.067,.0075],[.165,-.035,.009]],   // 주근깨: scattered (fixed), sizes mixed, each cheek its own
  [[.208,-.057,.009],[.172,-.055,.0075],[.167,-.091,.0075],[.249,-.062,.011],[.271,-.09,.009],[.242,-.033,.009],[.205,-.034,.006]]];
const MESSY=[[0,1,.2],[.5,.8,0],[-.5,.8,.1],[.75,.35,-.3],[-.75,.4,-.2],[.3,.7,-.6],[-.35,.6,-.7],[0,.3,-1],[.25,.9,.4],[-.2,.85,.45],[.55,.1,-.8],[-.5,.1,-.85]];   // 부스스 tuft directions
const CG={head:SG(new THREE.SphereGeometry(1,32,22)),ball:SG(new THREE.SphereGeometry(1,22,14)),blob:SG(new THREE.SphereGeometry(1,12,8)),dot:SG(new THREE.SphereGeometry(1,8,6)),
  capDome:SG(new THREE.SphereGeometry(1,28,10,0,TAU,0,Math.PI*.5)),
  tie:XS([[-.017,0],[.017,0],[.03,-.16],[0,-.195],[-.03,-.16]],.008,.004),tieKnot:XS([[-.028,.02],[.028,.02],[.018,-.02],[-.018,-.02]],.014,.005),
  /* dress-shirt collar: two spread points (drawn around their own centre) and the stand round the back of the neck */
  flapR:XS([[-.04,.03],[-.028,-.022],[.022,-.05],[.046,.034]],.006,.004),flapL:XS([[.04,.03],[-.046,.034],[-.022,-.05],[.028,-.022]],.006,.004),
  /* collar stand: a full ring that rolls over at the top and back down inside, so the clothes under it never show through */
  neckband:LP(NECK_P.concat([[.115,.834],[.108,.8]]),0,TAU,24),
  smile:SG(new THREE.TorusGeometry(1,.2,6,16,MOUTH_ARC)),
  /* straight long hair: a curtain hanging from the head, open at the face; the inner layer faces inward so the opening never shows through */
  /* long straight hair: one thick curtain (the profile runs down the outside, round the ends and back up the inside)
     wrapping the sides and back and open at the face; its two front edges are rounded off with thin capsules */
  apronHem:LP([[.258,.33],[.259,.36]],-.87,1.74,12),apronTie:LP([[.243,.49],[.245,.515]],.85,TAU-1.7,16),rim:SG(new THREE.TorusGeometry(1,.1,10,36)),
  ring:SG(new THREE.TorusGeometry(1,.14,6,18)),
  /* 후드티·티셔츠: worn loose over the hips (a shirt tucks in) */
  hoodiePocket:LP([[.244,.452],[.2445,.47],[.2445,.5],[.2465,.54]],-.58,1.16,20),hoodiePocketTop:LP([[.2465,.538],[.248,.542],[.2485,.548]],-.58,1.16,20),   // curved round the body
  hoodieBody:LP(LOOSE_P.concat([[.17,.8],[.09,.835],[0,.845]])),teeBody:scoopNeck(LP(TEE_P)),teeNeck:LP([[.218,.74],[.197,.772],[.171,.794],[.14,.818],[.06,.843],[0,.846]]),hemRib:LP([[.238,.432],[.244,.44],[.244,.462],[.24,.468]]),
  /* 체크셔츠: the open shirt; its pattern is a texture (checkMat), not raised parts */
  checkShirt:LP(CHECK_P.slice(0,8).concat([[.19,.8]]),CHECK_GAP,TAU-CHECK_GAP*2),checkCollar:wrapCollar(0),checkCollarIn:wrapCollar(.0035),
  belt:LP([[.2385,.515],[.2395,.535],[.2385,.555]]),cuff:LP([[.0665,-.25],[.068,-.235],[.0695,-.218]],0,TAU,16),
  torso:LP(TORSO_P),
  hips:LP([[0,.35],[.15,.352],[.205,.365],[.226,.395],[.233,.45],[.236,.535],[.2,.545],[0,.545]]),
  jacket:LP(JACKET_P,JGAP,TAU-JGAP*2),cardigan:LP(CARDI_P,.16,TAU-.32),
  vest:LP(VEST_P,.42,TAU-.84),
  apron:LP([[.252,.33],[.254,.42],[.25,.52],[.246,.6],[.238,.67],[.222,.72]],-.85,1.7,12),
  skirt:LP([[0,.27],[.3,.27],[.285,.33],[.256,.4],[.237,.46],[.233,.53],[0,.53]]),   // tapers in under jacket and vest hems
  leg:LP([[0,-.3],[.092,-.3],[.102,-.26],[.098,-.17],[.105,-.06],[.112,0],[0,.03]],0,TAU,16),
  /* 반바지: a bare leg (thinner, with a calf) and the short leg over its top, a little A-line, with a rolled hem */
  sock:LP([[0,-.3],[.074,-.3],[.076,-.26],[.083,-.215],[.086,-.205],[.083,-.195],[0,-.19]],0,TAU,16),shoeCollar:LP([[.06,-.31],[.098,-.3],[.096,-.268],[.088,-.255],[.078,-.256]],0,TAU,16),
  legAnkle:LP([[0,-.34],[.058,-.34],[.06,-.31],[.063,-.28],[.07,-.24],[.081,-.19],[.087,-.15],[.082,-.09],[.088,-.03],[.09,0],[0,.02]],0,TAU,16),
  legBare:LP([[0,-.3],[.068,-.3],[.072,-.26],[.08,-.2],[.087,-.15],[.082,-.09],[.088,-.03],[.09,0],[0,.02]],0,TAU,16),
  shorts:LP([[0,-.135],[.134,-.135],[.126,-.06],[.118,0],[.114,.04],[0,.04]],0,TAU,20),   // low to high, like every lathe here (the other way its faces turn inward and it shows hollow)
  shortsHem:LP([[.133,-.14],[.141,-.133],[.141,-.117],[.133,-.112]],0,TAU,20),
  /* 반팔: the arm under a short sleeve, slimmer than a sleeve and narrowing to a wrist that meets the hand */
  armBare:LP([[0,-.28],[.046,-.28],[.05,-.255],[.06,-.2],[.068,-.14],[.073,-.08],[.075,-.02],[.07,.03],[.05,.065],[0,.08]],0,TAU,16),
  teeSleeve:LP([[.07,-.112],[.083,-.11],[.083,-.05],[.082,.0],[.074,.045],[.05,.07],[0,.08]],0,TAU,16),
  watchBand:LP([[.0675,-.25],[.0715,-.246],[.0715,-.218],[.0675,-.214]],0,TAU,28),pjBody:LP([[.22,.36],[.252,.364],[.254,.42]].concat(LOOSE_P.slice(3),[[.17,.8],[.09,.835],[0,.845]])),   // 금시계, 긴 파자마 상의
  toshi:LP([.071,.071,.072,.073,.074,.075,.076,.077,.079].map((r,i)=>[r,-.245+i*.15/8]),0,TAU,20),   // 토시: evenly spaced, so the picture isn't squeezed
  sleeve:LP([[0,-.25],[.064,-.25],[.068,-.2],[.076,-.09],[.082,-.02],[.076,.03],[.052,.065],[0,.08]],0,TAU,16)};
/* toy-shot fill: lift the shaded side a little (like a white studio bounce) without washing out the colours */
function softFill(m){m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n\treflectedLight.indirectDiffuse+=diffuseColor.rgb*.22;');};
  m.customProgramCacheKey=()=>'softFill';return m;}
const ringGeo=new THREE.RingGeometry(.46,.56,36),shGeo=new THREE.CircleGeometry(.34,20);
const HAIRS=['#3a2d28','#6b3e2e','#2e2a28','#8a5a3a','#4a3a35','#1f1b1a','#7a5a40'];
const SHIRTS_L=['#f4f6f8','#dfe8f2','#f7e8d6','#e6efe1','#f3e3ea'],TIES=['#b8322a','#2b5c9e','#d9a441','#2f7d4f','#5a3b6e'],PANTS=['#2f3540','#3d4a54','#5a4632','#4b555d','#2b3a55','#6b5a48'];
const SKINS=['#ffe4cc','#fbd8bb','#f3c7a4','#e6b48f','#ffeadb'];
function outfitFor(kind,seed,color){
  const r=k=>{const h=Math.sin(seed*12.9898+k*78.233)*43758.5453;return h-Math.floor(h);},pk=(a,k)=>a[Math.floor(r(k)*a.length)];
  const skin=pk(SKINS,9);
  switch(kind){
    case 'boss':return{skin:'#fdd9bc',hair:{style:'bald',color:'#8f8f95'},face:{glasses:1,mustache:1},top:{shirt:'#eef1f4',jacket:'#4a4f57',tie:'#b8322a'},bottom:{pants:'#3a3f47',shoes:'#1d2024'}};
    case 'ceo':return{skin:'#fdd9bc',hair:{style:'side',color:'#e2e2e6'},face:{glasses:1},top:{shirt:'#ffffff',jacket:'#1f2228',tie:'#d9a441',pin:1},bottom:{pants:'#1f2228',shoes:'#0f0f10'}};
    case 'cleaner':return{skin:'#f3c7a4',hair:{style:'updo',color:'#1f1b1a'},top:{shirt:'#4f8f8f',apron:'#e9e6df'},bottom:{pants:'#4b555d',shoes:'#f2efe9'}};
    case 'busy':return{skin,hair:{style:'side',color:'#3a2d28'},face:{glasses:1},top:{shirt:'#dfe7ee',vest:'#5d666e',tie:'#2b5c9e'},bottom:{pants:'#2f3540',shoes:'#1d2024'}};
    case 'newbie':return{skin,hair:{style:'short',color:'#2e2a28'},top:{shirt:'#fbfaf6',cardigan:'#9fcf9f',badge:1},bottom:{pants:'#c8b89a',shoes:'#5a4632'}};
    case 'courier':return{skin,hair:{style:'cap',color:'#3d4a54'},top:{shirt:'#b5651d'},bottom:{pants:'#5a4632',shoes:'#2c3036'}};
    case 'cart':return{skin,hair:{style:'chef',color:'#fbfaf6'},face:{mustache:1},top:{shirt:'#fbfaf6',apron:'#7a4b2a'},bottom:{pants:'#2f3540',shoes:'#1d2024'}};
    case 'late':return{skin,hair:{style:'side',color:'#3a2d28'},top:{shirt:'#dfe8f2',jacket:'#5b6fa8',tie:'#b8322a',badge:1},bottom:{pants:'#2f3540',shoes:'#1d2024'}};
  }
  /* office workers: `color` is their signature colour (jacket, cardigan or shirt) */
  const look=Math.floor(r(1)*5),long=r(2)<.4;
  const top={shirt:look===2?color:pk(SHIRTS_L,3),badge:r(4)<.6};
  if(look===0)top.jacket=color;else if(look===1)top.cardigan=color;else if(look===3)top.vest=color;else if(look===4)top.shirt=color;
  if(look!==1&&r(5)<.7)top.tie=pk(TIES,6);
  return{skin,hair:{style:long?pk(['long','bun'],7):pk(['short','side','short'],7),color:pk(HAIRS,8)},face:{glasses:r(10)<.2?1:0},
    top,bottom:{pants:pk(PANTS,11),skirt:long&&r(12)<.5,shoes:r(13)<.5?'#1d2024':'#5a4632'}};
}
const _m4=new THREE.Matrix4(),_m3=new THREE.Matrix3(),_v=new THREE.Vector3();
function bakeParts(group,mat){
  const list=group.children.filter(c=>c.isMesh);if(!list.length)return;
  let nv=0,ni=0;for(const m of list){const gm=m.geometry;nv+=gm.attributes.position.count;ni+=gm.index?gm.index.count:gm.attributes.position.count;}
  const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),col=new Float32Array(nv*3),idx=new Uint32Array(ni);let vo=0,io=0;
  for(const m of list){
    m.updateMatrix();_m4.copy(m.matrix);_m3.getNormalMatrix(_m4);
    const gm=m.geometry,P=gm.attributes.position,N=gm.attributes.normal,c=m.material.color;
    for(let i=0;i<P.count;i++){_v.fromBufferAttribute(P,i).applyMatrix4(_m4);pos.set([_v.x,_v.y,_v.z],(vo+i)*3);
      _v.fromBufferAttribute(N,i).applyMatrix3(_m3).normalize();nor.set([_v.x,_v.y,_v.z],(vo+i)*3);const q=m.material.userData.rainbow?RAINBOW_C[(((.75-_v.y)/.085|0)%7+7)%7]:c;col.set([q.r,q.g,q.b],(vo+i)*3);}
    if(gm.index){const I=gm.index.array;for(let i=0;i<I.length;i++)idx[io++]=I[i]+vo;}else for(let i=0;i<P.count;i++)idx[io++]=vo+i;
    vo+=P.count;group.remove(m);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setIndex(new THREE.BufferAttribute(idx,1));geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;group.add(mesh);
}
let dressCardEl=null;const dressCard=()=>dressCardEl||(dressCardEl=document.querySelector('#home .homecard'));
/* ---------- dressing room choices (also sent to the server, which cleans them the same way: server/src/outfit.js) ---------- */
const FIT={hair:['short','side','long','bun','bald','twin','slick','messy','pony','allback','perm','buzz'],eye:['normal','sparkle','sleepy','smile','dead'],shoe:['loafer','sneaker','slipper'],shoeC:['#1d2024'],top:['shirt','jacket','cardigan','vest','hoodie','check','tee','pj'],bottom:['pants','skirt','shorts','pj'],
  hairC:['#1f1b1a','#3a2d28','#6b3e2e','#8a5a3a','#c9a25a','#9a9aa0','#cf6f8a','#2b6cb0'],skin:['#ffe4cc','#fbd8bb','#f3c7a4','#e6b48f','#c98d6a'],
  topC:['#2b6cb0','#4a4f57','#1f2228','#8e6c8a','#c46b6b','#3f8f8f','#9fcf9f','#e0c23d','#f4f6f8'],shirtC:['#f4f6f8','#dfe8f2','#f7e8d6','#e6efe1','#f3e3ea','#2f3540'],
  tie:[null,'#b8322a','#2b5c9e','#d9a441','#2f7d4f','#5a3b6e'],bottomC:['#2f3540','#3d4a54','#2b3a55','#5a4632','#6b5a48','#c8b89a','#4b555d']};
/* 무지개 머리: this hair colour isn't drawn as itself: the hair is painted in layers like 무지개떡, by height (bakeParts) */
const RAINBOW='#ff00fe',RAINBOW_C=['#e8607a','#f2a25c','#f5df7a','#8fd08a','#7fbfe8','#8f8fe0','#c08fe0'].map(c=>new THREE.Color(c));
const PJ_C='#7fa8d9',TEE_C='#1f2228';   // 거래소 티셔츠: always black   // 줄무늬 파자마: one fixed colour, top and bottom
const DEFAULT_FIT={hair:'short',hairC:'#3a2d28',skin:'#fbd8bb',top:'jacket',topC:'#2b6cb0',shirtC:'#f4f6f8',tie:'#b8322a',badge:true,glasses:false,eye:'normal',bottom:'pants',bottomC:'#2f3540',shoe:'loafer',shoeC:'#1d2024'};
/* 성과 rewards: the shared list in js/shared/rewards.js */
const RW_GEAR=REWARDS.gear,RW_HAIR=REWARDS.hair,RW_FX=REWARDS.fx,RW_COLOR=REWARDS.color,RW_TITLES=REWARDS.titles;
const titleOf=t=>{const[k,i]=String(t||'').split(':');return(RW_TITLES[k]||[])[i-1]||null;};   // 'days:2' → '개근상'
function cleanFit(f){
  if(!f||typeof f!=='object')return null;const col=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v.toLowerCase():null,pk=(v,l)=>l.includes(v)?v:l[0];
  return{hair:pk(f.hair,FIT.hair),hairC:col(f.hairC)||'#3a2d28',skin:col(f.skin)||'#fbd8bb',top:pk(f.top,FIT.top),topC:col(f.topC)||'#2b6cb0',shirtC:col(f.shirtC)||'#f4f6f8',
    tie:col(f.tie),badge:!!f.badge,glasses:!!f.glasses,eye:pk(f.eye,FIT.eye),freckles:!!f.freckles,stamp:!!f.stamp,haloT:[1,2,3].includes(+f.haloT)?+f.haloT:0,bottom:pk(f.bottom,FIT.bottom),bottomC:col(f.bottomC)||'#2f3540',shoe:pk(f.shoe,FIT.shoe),shoeC:col(f.shoeC)||'#1d2024',
    gear:Array.isArray(f.gear)?[...new Set(f.gear.filter(g=>RW_GEAR[g]))]:[],fx:RW_FX[f.fx]?f.fx:null,thr:REWARDS.thr[f.thr]?f.thr:null,title:titleOf(f.title)?f.title:null};
}
/* the 인사기록카드 photo: my character from the chest up, drawn once per outfit by a small renderer of its own */
let photoGL=null;const photoCache=new Map();
function charPhoto(fit){
  const key=JSON.stringify(fit);if(photoCache.has(key))return photoCache.get(key);
  const W=120,H=146;
  if(!photoGL){photoGL=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});photoGL.setPixelRatio(2);photoGL.setSize(W,H,false);
    photoGL.toneMapping=gl.toneMapping;photoGL.toneMappingExposure=gl.toneMappingExposure;}
  const sc=new THREE.Scene();sc.background=new THREE.Color('#e9e6dc');sc.add(new THREE.HemisphereLight(0xdfe9f5,0x7a6a5c,1.3));
  const sunP=new THREE.DirectionalLight(0xfff1dc,1.8);sunP.position.set(1.5,3,4);sc.add(sunP);
  const m=makeChar('#2b6cb0',null,1,fitToOutfit(fit));sc.add(m);
  const c=new THREE.PerspectiveCamera(24,W/H,.1,20);c.position.set(0,1.02,3.1);c.lookAt(0,.98,0);
  photoGL.render(sc,c);const url=photoGL.domElement.toDataURL('image/png');photoCache.set(key,url);return url;
}
/* 옷장 thumbnails: the default outfit wearing one option, framed on the part it changes (head / chest / arms / legs / feet).
   One small renderer of their own; each character is thrown away after its picture (only its baked mesh is its own) */
let shotGL=null;const shotCache=new Map();
const SHOT_VIEW={full:[.9,4.9,.25],halo:[.85,4,.2],sash:[.62,1.55,.25],trophy:[.55,1.5,-.65],crown:[1.5,1.6,.2],neck:[.84,1.35,.4],note:[.6,1.45,.3],badge:[.6,1.05,.15],wrist:[.46,.95,.95],cup:[.45,1.2,-.75],tail:[.3,1.75,2.8],back:[.42,2.1,2.5],dragon:[.5,1.4,1.0],head:[1.16,2.15,.6],face:[1.12,1.6,.15],chest:[.7,1.75,.35],arms:[.6,2.6,.6],legs:[.36,2.2,.5],feet:[.08,1.2,.6]};   // look-at height, distance, turn
const shotKnown=(fit,view)=>shotCache.get(view+JSON.stringify(fit));   // an already drawn picture, or undefined
function charShot(fit,view){
  const key=view+JSON.stringify(fit);if(shotCache.has(key))return shotCache.get(key);
  const S=64;if(!shotGL){shotGL=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});shotGL.setPixelRatio(2);shotGL.setSize(S,S,false);
    shotGL.toneMapping=gl.toneMapping;shotGL.toneMappingExposure=gl.toneMappingExposure;}
  const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xdfe9f5,0x7a6a5c,1.3));
  const sunP=new THREE.DirectionalLight(0xfff1dc,1.8);sunP.position.set(1.5,3,4);sc.add(sunP);
  const[y,d,turn]=SHOT_VIEW[view]||SHOT_VIEW.chest,m=makeChar('#2b6cb0',null,1,fitToOutfit(fit));m.rotation.y=turn;sc.add(m);
  const c=new THREE.PerspectiveCamera(26,1,.1,20);c.position.set(0,y+(view==='feet'?.55:.12),d);c.lookAt(0,y,0);
  shotGL.render(sc,c);const url=shotGL.domElement.toDataURL('image/png');shotCache.set(key,url);
  const u=m.userData;m.traverse(o=>{if(!o.isMesh)return;if(o.material===u.bm)o.geometry.dispose();if(o.material.isMeshBasicMaterial||o.material.map)o.material.dispose();});u.bm.dispose();
  return url;
}
/* 체크셔츠 pattern, flat on the cloth: a tile of the colour with dark bands and a thin pale line each way. nx, ny: tiles round
   and down. One texture per look; each character gets its own material (it may turn see-through) */
const checkTex=new Map();
function checkMat(c,nx,ny){const key=c+nx+'x'+ny;let t=checkTex.get(key);
  if(!t){const C=document.createElement('canvas'),S=64;C.width=C.height=S;const x=C.getContext('2d');x.fillStyle=c;x.fillRect(0,0,S,S);
    x.fillStyle='rgba(0,0,0,.3)';x.fillRect(0,0,S,24);x.fillRect(0,0,24,S);x.fillStyle='rgba(255,255,255,.4)';x.fillRect(0,44,S,4);x.fillRect(44,0,4,S);
    t=new THREE.CanvasTexture(C);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(nx,ny);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;checkTex.set(key,t);}
  return new THREE.MeshStandardMaterial({map:t,roughness:.62,metalness:0});}
/* 후광: one piece, its colour the wearer's place last week (1 금, 2 은, 3 동) */
const haloMs={},HALO_RGB={1:'255,205,70',2:'168,186,222',3:'214,136,78'};
function haloMat(t){const n=HALO_RGB[t]?t:1;if(!haloMs[n]){const C=document.createElement('canvas');C.width=C.height=128;const x=C.getContext('2d'),g=x.createRadialGradient(64,64,6,64,64,63),c=a=>`rgba(${HALO_RGB[n]},${a})`;g.addColorStop(0,c(.85));g.addColorStop(.5,c(.55));g.addColorStop(.8,c(.16));g.addColorStop(1,c(0));x.fillStyle=g;x.fillRect(0,0,128,128);const m=new THREE.CanvasTexture(C);m.colorSpace=THREE.SRGBColorSpace;
    haloMs[n]={s:new THREE.SpriteMaterial({map:m,transparent:true,depthWrite:false}),f:new THREE.MeshBasicMaterial({map:m,transparent:true,opacity:.6,depthWrite:false})};}return haloMs[n];}
let stampTex=null;const STAMP_G=new THREE.PlaneGeometry(1,1);
function stampMat(){if(!stampTex){const C=document.createElement('canvas');C.width=C.height=96;const x=C.getContext('2d');x.strokeStyle=x.fillStyle='#c8283a';x.lineWidth=7;x.strokeRect(6,6,84,84);x.font='900 40px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('반',48,31);x.fillText('려',48,67);stampTex=new THREE.CanvasTexture(C);stampTex.colorSpace=THREE.SRGBColorSpace;stampTex.anisotropy=4;}
  return new THREE.MeshStandardMaterial({map:stampTex,transparent:true,depthWrite:false,roughness:.6,metalness:0});}
/* 금시계: a Datejust-like face (fluted bezel, a champagne sunburst dial, baton markers, gold hands, a date window) and a three-row bracelet, painted */
const watchTex={};
function watchMat(k){let t=watchTex[k];
  if(!t){const C=document.createElement('canvas'),x=C.getContext('2d');
    if(k==='band'){C.width=256;C.height=48;x.fillStyle='#e0ae3e';x.fillRect(0,0,256,48);const g=x.createLinearGradient(0,0,0,48);g.addColorStop(0,'#a97a22');g.addColorStop(.5,'#f6d778');g.addColorStop(1,'#a97a22');x.fillStyle=g;x.fillRect(0,0,256,48);
      x.fillStyle='#7d5716';x.fillRect(0,15,256,2);x.fillRect(0,31,256,2);for(let i=0;i<256;i+=32){x.fillRect(i,0,2,15);x.fillRect(i+16,15,2,18);x.fillRect(i,33,2,15);}}
    else{const S=C.width=C.height=256,c=S/2;x.fillStyle='#d9a93f';x.fillRect(0,0,S,S);
      for(let i=0;i<72;i++){const a=i/72*TAU;x.strokeStyle=i%2?'#f7dd86':'#a97a22';x.lineWidth=4;x.beginPath();x.moveTo(c+Math.cos(a)*100,c+Math.sin(a)*100);x.lineTo(c+Math.cos(a)*127,c+Math.sin(a)*127);x.stroke();}
      const g=x.createConicGradient(0,c,c);for(let i=0;i<=8;i++)g.addColorStop(i/8,i%2?'#f3e0a4':'#c9a65a');x.fillStyle=g;x.beginPath();x.arc(c,c,98,0,TAU);x.fill();
      x.strokeStyle='#8a6a22';x.lineWidth=3;for(let i=0;i<12;i++){const a=i/12*TAU;x.lineWidth=i%3?5:8;x.beginPath();x.moveTo(c+Math.sin(a)*66,c-Math.cos(a)*66);x.lineTo(c+Math.sin(a)*90,c-Math.cos(a)*90);x.stroke();}
      x.fillStyle='#fbf7ea';x.fillRect(c+50,c-13,34,26);x.fillStyle='#222';x.font='900 21px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('20',c+67,c+1);
      x.lineCap='round';x.strokeStyle='#4a3710';for(const[l,w,a]of[[50,9,-.95],[78,7,.82]]){x.lineWidth=w;x.beginPath();x.moveTo(c,c);x.lineTo(c+Math.sin(a)*l,c-Math.cos(a)*l);x.stroke();}x.fillStyle='#4a3710';x.beginPath();x.arc(c,c,8,0,TAU);x.fill();}
    t=watchTex[k]=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;if(k==='band'){t.wrapS=THREE.RepeatWrapping;t.repeat.set(2,1);}}
  return new THREE.MeshStandardMaterial({map:t,roughness:.4,metalness:0});}
/* 어깨띠: a red sash across the body from one shoulder to the other hip and round the back, with gold edges and "우수 사원" on the front.
   It lies over everything on the top (only the 사원증 goes over it), following that top's outline, so one shape per kind of top */
const sashG=new Map(),sashY=sf=>.625+.195*sf;let sashMatC=null;
function sashGeo(key,R,lift){let g=sashG.get(key);if(g)return g;
  const P=[],V=[],I=[],N=60,w=.06;let b=0;
  /* one plain band, like a hoop tilted across the body: it hangs just clear of the outermost layer and of the right shoulder, and only runs under the left arm. It doesn't try to lie on the cloth,
     so there's nothing to crease. Up on the shoulder it lowers and turns to lie flat, rounding over the top */
  for(const side of[1,-1]){for(let i=0;i<=N;i++){const t=i/N,f=side>0?t*Math.PI-Math.PI/2:t*Math.PI+Math.PI/2,sf=Math.sin(f),s=Math.max(0,sf)**3,y=sashY(sf)-.022*s,r0=R(y)+.008,r=r0+(.255-r0)*s,x=r*sf,a=1.047-.84*s;let z=r*.86*Math.cos(f);if(side>0)z=Math.max(z,lift(x));
      for(const j of[-1,1]){P.push(x-j*w*Math.cos(a),y+j*w*Math.sin(a),z);V.push(side>0?t:.98,(j+1)/2);}}
    for(let i=0;i<N;i++){const a=b+i*2;I.push(a,a+1,a+2,a+1,a+3,a+2);}b+=(N+1)*2;}
  g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(V,2));g.setIndex(I);g.computeVertexNormals();sashG.set(key,g);return g;}
function sashMat(){if(!sashMatC){const C=document.createElement('canvas');C.width=512;C.height=104;const x=C.getContext('2d');x.fillStyle='#c8283a';x.fillRect(0,0,512,104);x.fillStyle='#f0c850';x.fillRect(0,6,512,6);x.fillRect(0,92,512,6);
    x.font='900 46px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('우수 사원',178,54);const t=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
    sashMatC=new THREE.MeshStandardMaterial({map:t,roughness:.55,metalness:0,side:THREE.DoubleSide});}
  return sashMatC;}
/* 줄무늬 파자마: pale stripes running down the cloth, n of them round the part */
const stripeTex=new Map();
function stripeMat(c,n){const key=c+n;let t=stripeTex.get(key);
  if(!t){const C=document.createElement('canvas'),S=64;C.width=C.height=S;const x=C.getContext('2d');x.fillStyle=c;x.fillRect(0,0,S,S);x.fillStyle='rgba(255,255,255,.62)';x.fillRect(0,0,20,S);
    t=new THREE.CanvasTexture(C);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(n,1);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;stripeTex.set(key,t);}
  return new THREE.MeshStandardMaterial({map:t,roughness:.62,metalness:0});}
/* 용문신 토시: a skin-coloured sleeve guard tattooed all round, worn over any top: a dragon (antlers, open jaws, spines, claws) on
   each arm's front-outer side among clouds, flames and waves. The sleeve is about three times as wide round as it is long, so
   everything is drawn in a space squeezed sideways (scale .3) to come out in proportion */
const dragonTex=new Map();
function dragonMat(skin){let t=dragonTex.get(skin);
  if(!t){const C=document.createElement('canvas'),S=512,W=S/.3;C.width=C.height=S;const x=C.getContext('2d');x.fillStyle=skin;x.fillRect(0,0,S,S);x.scale(.6,2);   // 512 canvas: drawn in the 853×256 space below
    const NV='#16324f',TL='#2f7f9f',RD='#c0392b',OR='#f0862a',GD='#f2c230',W2=W/2;
    const blob=(a,b,rx,ry,c)=>{x.fillStyle=c;x.beginPath();x.ellipse(a,b,rx,ry,0,0,7);x.fill();};
    const poly=(c,...p)=>{x.fillStyle=c;x.beginPath();p.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();};
    /* 구름: three puffs and a curl */
    const cloud=(a,b)=>{for(const[d,e,r]of[[-34,4,26],[0,-8,32],[36,5,24]])blob(a+d,b+e,r,r*.72,NV);for(const[d,e,r]of[[-34,4,18],[0,-8,23],[36,5,16]])blob(a+d,b+e,r,r*.68,'#dfe9ef');
      x.strokeStyle=TL;x.lineWidth=4;x.beginPath();x.arc(a,b-6,11,.4,5.2);x.stroke();};
    /* 불꽃: a tongue of fire with a yellow heart */
    const flame=(a,b,s)=>{poly(RD,[a,b-34*s],[a+19*s,b-4*s],[a+11*s,b+18*s],[a-11*s,b+18*s],[a-19*s,b-4*s]);poly(OR,[a,b-20*s],[a+11*s,b+2*s],[a+6*s,b+14*s],[a-6*s,b+14*s],[a-11*s,b+2*s]);poly(GD,[a,b-6*s],[a+5*s,b+6*s],[a,b+12*s],[a-5*s,b+6*s]);};
    /* 파도 along the lower edge */
    for(let a=-30;a<W+60;a+=70){blob(a,258,44,30,NV);blob(a,262,34,24,TL);blob(a,266,22,18,'#dfe9ef');}
    for(const[a,b]of[[300,50],[430,150],[560,60],[640,170],[20,70],[840,150],[120+W2,30]])cloud(a,b);
    for(const[a,b,s]of[[250,130,1],[370,70,.8],[500,140,.9],[610,100,.7],[60,190,.8],[800,70,.9]])flame(a,b,s);
    const dragon=(cx,flip)=>{x.save();x.translate(cx,0);
      const P=[];for(let i=0;i<=48;i++){const k=i/48;P.push([flip*Math.sin(k*7.6)*(84-k*30),108+k*118]);}
      /* spines down the back, then a body that thins to the tail */
      for(let i=2;i<46;i+=2){const[a,b]=P[i],[c,d]=P[i+1],l=Math.hypot(c-a,d-b)||1,nx=-(d-b)/l*flip,ny=(c-a)/l*flip,w=30-i*.35;poly(RD,[a+nx*w,b+ny*w],[a+nx*(w+26)-(c-a),b+ny*(w+22)-(d-b)],[a+nx*w+(c-a)*2,b+ny*w+(d-b)*2]);}
      P.forEach(([a,b],i)=>blob(a,b,40-i*.6,26-i*.38,NV));P.forEach(([a,b],i)=>blob(a,b,31-i*.47,19-i*.28,TL));
      for(let i=2;i<46;i+=3){const[a,b]=P[i];blob(a,b,11-i*.15,6-i*.08,NV);}   // scales
      P.forEach(([a,b],i)=>{if(i%2===0)blob(a-flip*(13-i*.2),b,7-i*.1,5,GD);});   // gold belly
      const[ta,tb]=P[48];flame(ta,tb+6,.7);   // tail fire
      /* legs with claws */
      for(const[i,s]of[[11,-1],[29,1]]){const[a,b]=P[i],e=a+s*flip*74,f=b+8;x.strokeStyle=NV;x.lineWidth=15;x.lineCap='round';x.beginPath();x.moveTo(a,b);x.lineTo(e,f);x.stroke();for(const q of[-1,0,1])poly(GD,[e-11,f-4+q*8],[e+11,f-4+q*8],[e+s*flip*34,f+q*16]);}
      /* antlers, mane, the head from the front with open jaws */
      x.strokeStyle=GD;x.lineWidth=11;x.lineCap='round';for(const s of[-1,1]){x.beginPath();x.moveTo(s*30,38);x.lineTo(s*62,8);x.moveTo(s*48,20);x.lineTo(s*88,24);x.moveTo(s*56,13);x.lineTo(s*46,-6);x.stroke();}
      poly(RD,[-104,76],[-84,34],[-62,52],[-40,20],[-18,40],[0,16],[18,40],[40,20],[62,52],[84,34],[104,76],[60,84],[-60,84]);
      blob(0,62,84,44,NV);blob(0,60,72,34,TL);
      for(const s of[-1,1]){poly(GD,[s*16,50],[s*62,38],[s*58,62],[s*22,62]);blob(s*40,53,8,8,'#10151b');poly(NV,[s*12,38],[s*70,26],[s*66,36],[s*14,46]);}   // angry eyes under heavy brows
      poly(NV,[-62,82],[62,82],[42,118],[-42,118]);poly(RD,[-50,88],[50,88],[32,110],[-32,110]);for(const a of[-34,-12,12,34])poly('#fbfaf6',[a-9,88],[a+9,88],[a,104]);   // jaws, teeth
      blob(-14,76,6,4,'#10151b');blob(14,76,6,4,'#10151b');
      x.strokeStyle=OR;x.lineWidth=6;for(const s of[-1,1]){x.beginPath();x.moveTo(s*50,92);x.quadraticCurveTo(s*120,92,s*112,136);x.stroke();}   // whiskers
      x.restore();};
    dragon(133,1);dragon(720,-1);t=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;dragonTex.set(skin,t);}
  return new THREE.MeshStandardMaterial({map:t,roughness:.58,metalness:0});}
function myFit(){try{return cleanFit(JSON.parse(localStorage.getItem('or-fit')))||{...DEFAULT_FIT};}catch{return{...DEFAULT_FIT};}}
function fitToOutfit(c){
  const top={shirt:c.top==='check'?'#f4f6f8':['shirt','hoodie','tee','pj'].includes(c.top)?c.topC:c.shirtC,badge:c.badge};if(c.top!=='shirt')top[c.top]=c.topC;if(c.top==='pj')top.pj=top.shirt=PJ_C;if(c.top==='tee')top.tee=top.shirt=TEE_C;if(c.tie)top.tie=c.tie;
  return{skin:c.skin,hair:{style:c.hair,color:c.hairC},face:{glasses:c.glasses?1:0,eye:c.eye,freckles:!!c.freckles,stamp:!!c.stamp},top,bottom:{pants:c.bottom==='pj'?PJ_C:c.bottomC,skirt:c.bottom==='skirt',shorts:c.bottom==='shorts',pj:c.bottom==='pj',shoes:c.shoeC||'#1d2024',shoeT:c.shoe},gear:new Set(c.gear||[]),haloT:c.haloT};
}
function makeChar(color,kind,seed,outfit){
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  const o=outfit||outfitFor(kind,seed|0,color),mats=[],M={};
  const mt=c=>{if(!M[c]){M[c]=new THREE.MeshLambertMaterial({color:c});M[c].userData.rainbow=c===RAINBOW;mats.push(M[c]);}return M[c];};
  const add=(par,geo,c,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mt(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;par.add(m);return m;};
  const piv=(par,x,y,z)=>{const p=new THREE.Group();p.position.set(x,y,z);par.add(p);return p;};
  const T=o.top,B=o.bottom,ZS=.86;   // the body is a little flatter front-to-back than side-to-side
  const dark=(c,k)=>c===RAINBOW?c:'#'+tmpC.set(c).multiplyScalar(k).getHexString();
  const painted=(par,geo,m,sz=1)=>{const g=piv(par,0,0,0),me=new THREE.Mesh(geo,m);me.scale.set(1,1,sz);me.castShadow=true;g.add(me);mats.push(m);};   // not baked: it keeps its own texture
  /* bottom slot: hips + legs + boots (skirt variant) */
  const bottom=piv(inner,0,0,0);
  if(B.pj)painted(bottom,CG.hips,stripeMat(B.pants,16),ZS);else add(bottom,CG.hips,B.pants,0,0,0,1,1,ZS);
  const legL=piv(bottom,-.098,.4,0),legR=piv(bottom,.098,.4,0),shoe=B.shoes||'#1d2024';
  for(const l of[legL,legR]){
    if(B.shorts||B.skirt){add(l,B.shoeT==='slipper'?CG.legAnkle:CG.legBare,o.skin,0,0,0);   // 반바지·치마: a slim bare leg with a calf (over a bare foot it narrows to an ankle)
      if(B.shorts){add(l,CG.shorts,B.pants,0,0,0);add(l,CG.shortsHem,dark(B.pants,.86),0,0,0);}   // the short leg flaring a little to a turned-up hem
      if(B.shoeT!=='slipper'){add(l,CG.sock,'#f4f2ec',0,0,0);add(l,CG.shoeCollar,shoe,0,0,0);}}   // an ankle sock going down into the shoe's opening
    else if(B.pj)painted(l,CG.leg,stripeMat(B.pants,9));
    else add(l,CG.leg,B.pants,0,0,0);
    if(B.shoeT==='slipper'){   // 슬리퍼: a slim flat sole under a bare foot, a thick band covering the instep, toes in front
      add(l,GEO.cyl,dark(shoe,.8),0,-.37,.04,.092,.032,.148);   // the sole: flat, an oval just round the foot
      add(l,CG.blob,o.skin,0,-.335,.045,.076,.042,.135);
      for(const x of[-.042,-.014,.014,.04])add(l,CG.dot,o.skin,x,-.338,.172-Math.abs(x)*.5,.017,.017,.019);
      add(l,CG.capDome,shoe,0,-.352,.065,.096,.08,.09);}
    else if(B.shoeT==='sneaker'){   // 운동화: a chunky white midsole on a grey outsole, laces, a heel tab
      add(l,CG.blob,shoe,0,-.32,.03,.1,.075,.145);
      add(l,GEO.cyl,'#f4f2ec',0,-.368,.035,.108,.042,.152);add(l,GEO.cyl,'#9aa0a6',0,-.392,.035,.108,.012,.152);
      for(const[z,y]of[[.07,-.249],[.1,-.255],[.128,-.265]])add(l,GEO.box,'#fbfaf6',0,y,z,.056,.01,.013).rotation.x=-.4;   // laces across the top
      add(l,GEO.box,'#f4f2ec',0,-.275,-.11,.03,.045,.014).rotation.x=.25;}   // heel tab
    else{add(l,CG.blob,shoe,0,-.33,.035,.1,.065,.14);add(l,GEO.cyl,dark(shoe,.55),0,-.385,.035,.1,.022,.14);}}
  if(B.skirt)add(bottom,CG.skirt,B.pants,0,0,0,1,1,ZS);
  /* top slot: torso, belt, outer layer, collar, arms */
  const top=piv(inner,0,0,0);
  /* pulled on over the head: no belt, collar points or tie (체크셔츠 has its collar, open over a tee). One smooth body from the
     hem over the hips up to the neck, not a tucked torso with a band added */
  const loose=T.hoodie||T.tee||T.pj;if(T.pj)painted(top,CG.pjBody,stripeMat(T.pj,18),ZS);else add(top,T.tee||T.check?CG.teeBody:T.hoodie?CG.hoodieBody:CG.torso,T.shirt,0,0,0,1,1,ZS);   // 파자마: worn loose over the waist
  if(T.hoodie)add(top,CG.hemRib,dark(T.shirt,.82),0,0,0,1,1,ZS);
  if(!loose&&!T.apron&&!B.skirt&&!T.jacket&&!T.cardigan&&!T.vest&&!T.check){add(top,CG.belt,'#2a2522',0,0,0,1,1,ZS);add(top,GEO.box,'#c9b07a',0,.535,.207,.05,.036,.016);}
  const outer=T.jacket||T.cardigan||T.check,OP=T.jacket?JACKET_P:T.check?CHECK_P:CARDI_P;
  /* front of the outermost layer at (x,y), and a thin bar between two points (lanyard straps, glasses arms) */
  const ell=(P,x,y)=>{const r=profR(P,y);return r*ZS*Math.sqrt(Math.max(0,1-(x/r)**2));};
  const front=(x,y)=>Math.max(ell(T.tee?TEE_FRONT:T.hoodie||T.pj?HOODIE_FRONT:TORSO_P,x,y),outer?ell(OP,x,y):0,T.vest&&y<.785?ell(VEST_P,x,y):0);
  const Yv=new THREE.Vector3(0,1,0),dv=new THREE.Vector3();
  const bar=(par,c,ax,ay,az,bx,by,bz,w,d)=>{dv.set(bx-ax,by-ay,bz-az);const m=add(par,GEO.box,c,(ax+bx)/2,(ay+by)/2,(az+bz)/2,w,dv.length(),d);m.quaternion.setFromUnitVectors(Yv,dv.normalize());return m;};
  if(T.jacket)add(top,CG.jacket,T.jacket,0,0,0,1,1,ZS);
  if(T.cardigan){add(top,CG.cardigan,T.cardigan,0,0,0,1,1,ZS);const ph=.25;for(const y of[.5,.58,.66]){const r=profR(CARDI_P,y);add(top,CG.dot,dark(T.cardigan,.6),r*Math.sin(ph),y,r*ZS*Math.cos(ph)+.002,.018,.018,.01).rotation.y=ph;}}
  if(T.vest)add(top,CG.vest,T.vest,0,0,0,1,1,ZS);
  if(T.apron){const ac=T.apron,ad=dark(ac,.82);   // apron: hem trim, two front pockets, shoulder straps, waist ties with a bow at the back
    add(top,CG.apron,ac,0,0,0,1,1,ZS);add(top,CG.apronHem,ad,0,0,0,1,1,ZS);
    for(const s of[-1,1]){const px=s*.065,pz=.218;const pk=add(top,GEO.box,dark(ac,.93),px,.44,pz,.11,.085,.012);pk.rotation.y=s*.28;
      add(top,GEO.box,ad,px,.485,pz+.002,.11,.014,.014).rotation.y=s*.28;
      bar(top,ad,s*.165,.715,.13,s*.115,.81,.05,.03,.012);}
    add(top,CG.apronTie,ac,0,0,0,1,1,ZS);for(const s of[-1,1])add(top,CG.blob,ac,s*.045,.5,-.215,.05,.032,.025).rotation.z=s*.4;add(top,CG.dot,ad,0,.5,-.215,.018,.02,.02);}
  /* shirt collar, the same on everyone: a stand round the neck and two spread points with a button where they meet.
     It always shows, laid over whatever is outermost (shirt, vest, cardigan or jacket). */
  const cc=T.check||(loose?dark(T.shirt,.84):dark(T.shirt,1.05)),nb=outer?1.06:1;if(!T.tee&&!T.check)add(top,CG.neckband,cc,0,0,0,nb,1,nb*ZS);   // the stand sits a little wider over a cardigan or jacket
  /* 티셔츠: bare shoulders and neck under the shirt; the shirt's scooped neckline (scoopNeck) shows them */
  if(T.tee||T.check)add(top,CG.teeNeck,o.skin,0,0,0,1,1,ZS);
  if(T.check){add(top,CG.checkCollar,cc,0,0,0,1,1,ZS);add(top,CG.checkCollarIn,dark(cc,.55),0,0,0,1,1,ZS);}
  if(T.pj)for(const y of[.72,.64,.56,.48,.4])add(top,CG.dot,'#f4f2ec',0,y,front(0,y)+.008,.017,.017,.008);   // 파자마: buttons down the front
  if((!loose||T.pj)&&!T.check)for(const s of[-1,1]){const x=s*.052,y=.758,z=front(x,y)+.011,slope=(front(x,y-.03)-front(x,y+.03))/.06;
    add(top,s>0?CG.flapR:CG.flapL,cc,x,y,z,1,1,1).rotation.set(-Math.atan(slope),s*.32,0);}
  const GR=o.gear||new Set(),tie=loose||T.check?null:T.tie;   // 성과 rewards worn (RW_GEAR)
  /* a flat part stuck on the chest, turned with the surface. cx: off-centre, clear of the 사원증 */
  const stick=(geo,c,x,y,sx,sy,e,rz=0)=>add(top,geo,c,x,y,front(x,y)+e,sx,sy,.006).rotation.set(0,Math.asin(Math.max(-1,Math.min(1,x/.26))),rz);
  if(T.hoodie){const hc=dark(T.shirt,.9);   // the hood lying behind the neck, two drawstrings, a pouch pocket
    add(top,CG.ball,hc,0,.795,-.06,.245,.115,.195);for(const s of[-1,1]){bar(top,'#f4f2ec',s*.04,.775,front(s*.04,.775)+.012,s*.05,.68,front(s*.05,.68)+.01,.012,.006);}
    add(top,CG.hoodiePocket,dark(T.shirt,.86),0,0,0,1,1,ZS);add(top,CG.hoodiePocketTop,dark(T.shirt,.7),0,0,0,1,1,ZS);
    /* 리눅스 펭귄 on the chest: on a white patch so it shows on any colour */
    const cx=-.125,cy=.655;stick(CG.dot,'#f6f4ee',cx,cy,.066,.066,.004);
    stick(CG.dot,'#1b1c1f',cx,cy-.004,.04,.05,.008);stick(CG.dot,'#f6f4ee',cx,cy-.012,.025,.033,.012);stick(CG.dot,'#1b1c1f',cx,cy+.036,.024,.024,.01);
    for(const s of[-1,1]){stick(CG.dot,'#f6f4ee',cx+s*.009,cy+.04,.007,.008,.016);stick(CG.dot,'#f2b632',cx+s*.02,cy-.052,.017,.009,.012);}
    stick(CG.dot,'#f2b632',cx,cy+.029,.011,.006,.016);}
  /* 바이낸스 mark on a 티셔츠: five yellow diamonds */
  if(T.tee){const cx=-.125,cy=.65,d=.034;for(const[dx,dy,r]of[[0,0,.0165],[-d,0,.0115],[d,0,.0115],[0,d,.021],[0,-d,.021]])stick(GEO.box,'#f3ba2f',cx+dx,cy+dy,r*1.6,r*1.6,.006,Math.PI/4);}
  /* 체크셔츠: rings round the body and lines down it, dark and pale in turn */
  if(T.check)painted(top,CG.checkShirt,checkMat(T.check,9,6),ZS);
  if(!tie&&!T.check&&!loose)add(top,CG.dot,dark(T.shirt,.7),0,.775,front(0,.775)+.014,.012,.012,.008);
  if(tie){add(top,CG.tie,tie,0,.742,.19,1,1,1).rotation.x=-.12;add(top,CG.tieKnot,tie,0,.768,front(0,.768)+.012,1,1,1).rotation.x=-.35;}
  /* 어깨띠: its height over the body at (x,y), riding over the tie at the middle of the chest */
  const SASH=GR.has('sash'),sashR=y=>Math.max(profR(T.tee?TEE_FRONT:T.hoodie||T.pj?HOODIE_FRONT:TORSO_P,Math.max(y,.505)),outer?profR(OP,y):0,T.vest&&y<.785?profR(VEST_P,y):0,y<.56?.236:0,T.pj&&y<.43?.256:0)+.024,sashLift=x=>tie?.231-Math.max(0,Math.abs(x)-.03)*2.5:0,sashZ=(x,y)=>{const r=sashR(y);return Math.max(r*ZS*Math.sqrt(Math.max(0,1-(x/r)**2)),sashLift(x));};
  if(T.badge||GR.has('goldBadge')){const cy=.585,cz=Math.max(front(0,cy)+(loose?.009:.012),tie?.234:0,SASH?sashZ(0,cy)+.008:0);   // ID card hanging at the middle of the chest from both sides of the neck
    const gold=GR.has('goldBadge'),strap=gold?'#d9a441':'#2b6cb0';   // 금장 사원증: gold strap and card with a dark band
    /* the strap starts up at the neck, right under the face, so it rides over the collar stand there too */
    const neckZ=(x,y)=>y<.785?0:nb*ZS*Math.sqrt(Math.max(0,profR(NECK_P,y)**2-(x/nb)**2))+.008;
    const lz=(x,y)=>Math.max(front(x,y)+(loose&&!T.pj?.006:y>.7&&Math.abs(x)<.11?.032:.01),loose&&!T.pj?0:neckZ(x,y),tie&&Math.abs(x)<.04?.226:0,SASH&&Math.abs(y-sashY(x/sashR(y)))<.075?sashZ(x,y)+.006:0);   // rides over the chest, the collar points, the tie and the 어깨띠 in short pieces
    const ty=.835;for(const[nx,ex]of[[-.075,-.026],[.075,.026]])for(let i=0,N=7;i<N;i++){const x0=nx+(ex-nx)*i/N,y0=ty+(cy+.05-ty)*i/N,x1=nx+(ex-nx)*(i+1)/N,y1=ty+(cy+.05-ty)*(i+1)/N;
      bar(top,strap,x0,y0,lz(x0,y0),x1,y1,lz(x1,y1),.013,.006);}
    add(top,GEO.box,gold?'#f2c94c':'#fbfaf6',0,cy,cz,.08,.095,.014);add(top,GEO.box,gold?'#2a2d31':'#2b6cb0',0,cy+.032,cz+.008,.08,.02,.004);add(top,GEO.box,gold?'#b8892a':'#9aa3ab',0,cy+.052,cz,.03,.016,.012);
    if(gold)add(top,CG.dot,'#fff4c2',.018,cy-.018,cz+.008,.014,.014,.004);}   // a little shine
  /* 포스트잇: three notes stuck on the front at slight angles (and one on the right sleeve, below) */
  if(GR.has('postit'))for(const[x,y,c,r]of[[-.13,.66,'#f7e463',.25],[.11,.47,'#f59ab8',-.3],[-.06,.43,'#8fd0f0',.15]])
    add(top,GEO.box,c,x,y,front(x,y)+.006,.075,.075,.006).rotation.set(0,Math.asin(Math.max(-1,Math.min(1,x/.26))),r);
  /* 목베개: a fat U round the back of the neck, open at the front */
  if(GR.has('pillow')){const pc='#7fb3d9';add(top,PILLOW_G,pc,0,.81,0).rotation.set(Math.PI/2,0,Math.PI/2+.72);   // the gap (1.44 rad) faces front
    for(const s of[-1,1])add(top,CG.ball,pc,s*.142,.81,.162,.07,.07,.07);   // round ends
    for(const a of[-.9,0,.9])add(top,CG.dot,dark(pc,.8),.215*Math.sin(a+Math.PI),.81+.06,.215*Math.cos(a+Math.PI)*1,.012,.012,.012);}   // stitches along the top
  if(T.pin)add(top,CG.dot,'#d9a441',.12,.68,front(.12,.68)+.004,.022,.022,.012).rotation.y=.5;
  if(SASH)painted(top,sashGeo((T.jacket?'j':T.check?'c':T.cardigan?'k':T.tee?'t':T.hoodie?'h':T.pj?'p':T.vest?'v':'s')+(tie?'t':''),sashR,sashLift),sashMat());
  const sleeve=outer||T.shirt,cuff=T.check?dark(T.check,.8):outer?T.shirt:dark(T.shirt,.9);
  const armL=piv(top,-.268,.71,0),armR=piv(top,.268,.71,0);
  for(const[a,s]of[[armL,1],[armR,-1]]){
    if(T.tee){add(a,CG.armBare,o.skin,0,0,0);add(a,CG.teeSleeve,T.shirt,0,0,0);}   // 티셔츠: a bare arm tapering to the wrist, a short sleeve
    else{if(T.check)painted(a,CG.sleeve,checkMat(T.check,4,4));else if(T.pj)painted(a,CG.sleeve,stripeMat(T.pj,7));else add(a,CG.sleeve,sleeve,0,0,0);add(a,CG.cuff,cuff,0,0,0);}
    if(GR.has('dragon'))painted(a,CG.toshi,dragonMat(o.skin));   // 용문신 토시: over any sleeve or bare arm
    if(GR.has('watch')&&s>0){const n=new THREE.Vector3(-.55,0,.83),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1),cy=-.232,g=piv(a,0,0,0),k=T.tee?.8:1;g.scale.set(k,1,k);mats.push(watchMat('band'));   // 금시계: a gold link bracelet snug round the left wrist (a bare arm is thinner), a fluted gold case with a champagne dial turned out and up
      const b=new THREE.Mesh(CG.watchBand,mats[mats.length-1]);b.castShadow=true;g.add(b);const c=new THREE.Mesh(GEO.cyl,lam('#c9962f'));c.position.set(n.x*.071,cy,n.z*.071);c.scale.set(.047,.016,.047);c.quaternion.setFromUnitVectors(Y,n);g.add(c);
      const dm=watchMat('face');mats.push(dm);const d=new THREE.Mesh(GEO.disc,dm);d.position.set(n.x*.0795,cy,n.z*.0795);d.quaternion.setFromUnitVectors(Z,n);d.scale.setScalar(.0465);g.add(d);}
    add(a,CG.blob,o.skin,0,-.315,.01,.078,.088,.07);add(a,CG.dot,o.skin,s*.05,-.29,.035,.03,.04,.03);}   // mitten + thumb
  let coffee=null;if(GR.has('coffee')){coffee=piv(armR,0,-.325,.095);const C=(geo,c,y,r,h)=>{const m=new THREE.Mesh(geo,lam(c));m.position.y=y;m.scale.set(r,h,r);m.castShadow=true;coffee.add(m);};
    C(CUP_G,'#f6f4ee',0,.058,.15);C(CUP_G,'#b98a5a',-.005,.058,.075);C(GEO.cyl,'#3a2d28',.083,.062,.018);C(GEO.cyl,'#3a2d28',.098,.042,.014);}   // 커피: a takeaway cup in the right hand
  if(GR.has('postit'))add(armR,GEO.box,'#f7e463',.086,-.035,.01,.006,.065,.065).rotation.set(0,.2,.2);   // one more high on the right sleeve
  /* head slot: face + hair. Face parts sit on the head ellipsoid and turn with its surface. */
  /* the head tips back a little so the face still reads from the high game camera */
  const HT=.18,head=piv(inner,0,.935,0),HY=.18,HA=.38,HB=.34,HCZ=.35;head.rotation.x=-HT;head.scale.setScalar(.92);
  add(head,CG.head,o.skin,0,HY,0,HA,HB,HCZ);
  const Zf=new THREE.Vector3(0,0,1),nrm=new THREE.Vector3(),qz=new THREE.Quaternion();
  let fp=head;   // where face() puts parts: the head, or one of the expression groups below
  const face=(c,x,y,out,sx,sy,sz,rz=0,geo=CG.dot)=>{
    const z=HCZ*Math.sqrt(Math.max(0,1-(x/HA)**2-(y/HB)**2));nrm.set(x/HA/HA,y/HB/HB,z/HCZ/HCZ).normalize();
    const m=add(fp,geo,c,x+nrm.x*out,HY+y+nrm.y*out,z+nrm.z*out,sx,sy,sz);m.quaternion.setFromUnitVectors(Zf,nrm);
    if(rz)m.quaternion.multiply(qz.setFromAxisAngle(Zf,rz));return m;};
  const F=o.face||{},H=o.hair,hc=H.color,fur=H.style==='chef'||hc===RAINBOW?'#3a2d28':hc;   // brows and mustache (a chef's hair is the white hat)
  for(const s of[-1,1]){
    const ex=s*.135,E=F.eye;   // eyes (옷장 눈 모양): 기본 / 초롱초롱 / 게슴츠레 / 실눈
    if(E==='smile'){const r=.045,h=MOUTH_ARC/2;face('#2a2522',ex,-.035,.004,r,r,.03,Math.PI/2-h,CG.smile);   // 실눈: a closed ∩ arc with round ends, like the mouth
      for(const sx of[-1,1])face('#2a2522',ex+sx*r*Math.sin(h),-.035+r*Math.cos(h),.004,.0092,.0092,.0092);}
    else if(E==='dead')for(const r of[.785,-.785])face('#2a2522',ex,-.012,.004,.06,.0145,.012,r,CG.blob);   // 기절 표정: ✕ eyes (and the open mouth below)
    else if(E==='sparkle'){face('#2a2522',ex,-.012,0,.058,.08,.03,0,CG.blob);face('#6b4430',ex,-.03,.012,.04,.048,.012,0,CG.blob);   // big eye, a brown lens low in it
      face('#ffffff',ex+.02,.024,.026,.024,.026,.01);face('#ffffff',ex-.018,-.045,.024,.011,.011,.006);face('#ffffff',ex+.026,-.02,.022,.007,.007,.004);}   // three highlights
    else{face('#2a2522',ex,-.01,0,.05,.07,.03,0,CG.blob);face('#ffffff',ex+.016,E==='sleepy'?-.012:.02,.024,.016,.018,.008);   // eye + highlight
      if(E==='sleepy')face(o.skin,ex,-.012,.012,.058,.08,.034,0,CG.capDome);}   // 게슴츠레: a half-round lid over the top half of the eye
    face('#f6aaa5',s*.225,-.075,.006,.06,.036,1,0,GEO.disc);   // blush, painted on
    if(F.freckles)for(const[x,y,r]of FRECKLES[s<0?0:1])face('#a9683f',s*x,y,.016,r,r,1,0,GEO.disc);   // 주근깨: standing off enough to clear the flat blush disc's edge
    {const ex=s*.392,ey=HY-.055,ez=.01;   // ear: a thin rounded flap angled back a little, with a darker hollow
      add(head,CG.blob,o.skin,ex,ey,ez,.03,.062,.047).rotation.y=s*-.35;add(head,CG.blob,dark(o.skin,.86),ex+s*.017,ey,ez+.004,.012,.036,.026).rotation.y=s*-.35;}
  }
  if(F.eye!=='dead')face(o.skin,0,-.048,.01,.026,.02,.02);   // nose
  /* two expressions, each baked to one mesh and swapped by visibility: smiling, and angry once 고과 is in the red */
  if(GR.has('cig')){const P=k=>[.04+.1*k,HY-.095-.05*k,.335+.115*k];   // 담배: from the corner of the mouth out and down, a filter, the paper, a lit end
    bar(head,'#c98f4e',...P(0),...P(.3),.02,.02);bar(head,'#f6f4ee',...P(.3),...P(.92),.02,.02);bar(head,'#e0603d',...P(.92),...P(1),.021,.021);}
  const dead=F.eye==='dead',happy=piv(head,0,0,0),angry=piv(head,0,0,0),brows=H.style!=='cap'&&H.style!=='scarf'&&!dead;
  /* mouth: a shallow arc (less than a half circle) with round ends; y is the centre of the arc's circle */
  const mouth=(y,frown)=>{const r=.035,h=MOUTH_ARC/2,mc='#8a3a36';face(mc,0,y,.004,r,r,.03,(frown?Math.PI/2:-Math.PI/2)-h,CG.smile);
    for(const sx of[-1,1])face(mc,sx*r*Math.sin(h),y+(frown?1:-1)*r*Math.cos(h),.004,.0072,.0072,.0072);};
  fp=happy;if(!dead)mouth(-.08,false);if(brows)for(const s of[-1,1])face(dark(fur,.85),s*.14,.095,.004,.044,.012,.014,s*-.12);
  fp=angry;if(!dead)mouth(-.15,true);   // turned-down mouth
  for(const s of[-1,1]){if(brows)face(dark(fur,.75),s*.13,.072,.01,.052,.017,.018,s*.42);   // brows pulled down toward the nose
    face('#ee7a6c',s*.225,-.075,.007,.062,.038,1,0,GEO.disc);}   // flushed cheeks over the blush
  fp=head;
  if(F.stamp){const y=.052,z=HCZ*Math.sqrt(1-(y/HB)**2),n=new THREE.Vector3(0,y/HB/HB,z/HCZ/HCZ).normalize(),q=new THREE.Quaternion().setFromUnitVectors(Zf,n),g=piv(head,0,0,0),mm=stampMat();mats.push(mm);   // 이마의 반려 도장: a red stamp mark low on the forehead, under any fringe
    const m=new THREE.Mesh(STAMP_G,mm);m.position.set(n.x*.012,HY+y+n.y*.012,z+n.z*.012);m.quaternion.copy(q).multiply(qz.setFromAxisAngle(Zf,-.18));m.scale.setScalar(.105);g.add(m);}
  if(dead){face('#2a2522',0,-.105,.008,.05,.062,1,0,GEO.disc);face('#f6aaa5',0,-.105,.01,.038,.05,1,0,GEO.disc);}   // 기절 표정: a tall round mouth hanging open
  /* 다크서클: two soft violet crescents under the eyes */
  if(GR.has('eyebags'))for(const s of[-1,1]){face('#a58aa8',s*.135,-.07,.003,.06,.022,1,s*.12,GEO.disc);face('#8f7393',s*.135,-.078,.004,.045,.012,1,s*.12,GEO.disc);}
  /* 선글라스: wide dark lenses joined by a bridge (worn instead of glasses) */
  if(GR.has('shades')){const gy=HY-.004,gz=.37;
    for(const s of[-1,1]){const l=add(head,CG.blob,'#16181b',s*.128,gy,gz,.105,.07,.03);l.rotation.y=s*.2;
      add(head,CG.dot,'#5a6270',s*.15,gy+.02,gz+.026,.022,.014,.006);}   // glint
    add(head,GEO.box,'#16181b',0,gy+.006,gz+.012,.085,.02,.02);}   // bridge at the lenses' middle, its ends sunk into them
  if(F.glasses&&!GR.has('shades')){const gc='#2a2d31',gy=HY-.007,gz=.372;   // big round rims standing off the face, joined by a bridge, with small hinges
    for(const s of[-1,1]){add(head,CG.rim,gc,s*.13,gy,gz-.01,.094,.086,.16).rotation.y=s*.16;add(head,CG.dot,gc,s*.223,gy+.018,gz-.03,.014,.014,.018);}
    add(head,GEO.cyl,gc,0,gy+.016,gz+.002,.008,.06,.008).rotation.z=Math.PI/2;}
  if(F.mustache)for(const s of[-1,1])face(fur,s*.045,-.074,.01,.06,.024,.024,s*.3);
  if(H.style==='bald'){for(const s of[-1,1])add(head,CG.blob,hc,s*.345,HY+.01,-.09,.07,.1,.12);add(head,CG.ball,hc,0,HY-.02,-.28,.27,.13,.11);}
  else if(H.style==='chef'){const d=add(head,CG.capDome,hc,0,HY+.03,-.01,.385,.36,.38);d.rotation.x=-.1;
    add(head,GEO.cyl,hc,0,HY+.36,-.02,.29,.26,.29);for(const[x,z]of[[0,0],[-.14,-.04],[.14,-.04],[0,-.15],[-.08,.11],[.08,.11]])add(head,CG.blob,hc,x,HY+.5,z-.02,.17,.13,.17);}
  else if(H.style==='scarf'||H.style==='cap'){const d=add(head,CG.capDome,hc,0,HY+.02,-.01,.39,.37,.385);d.rotation.x=-.18;
    if(H.style==='cap'){add(head,GEO.cyl,hc,0,HY+.12,.3,.22,.022,.15).rotation.x=.18;add(head,CG.dot,dark(hc,.7),0,HY+.37,-.05,.03,.02,.03);}
    else add(head,CG.blob,hc,0,HY+.02,-.36,.08,.07,.06);}
  else if(H.style==='buzz')add(head,CG.head,hc===RAINBOW?hc:'#'+tmpC.set(hc).lerp(new THREE.Color(o.skin),.3).getHexString(),0,HY+.025,-.035,.392,.355,.36);   // 반삭: a close cap, a little skin showing through
  else{const ab=H.style==='allback';add(head,CG.head,hc,0,HY+(ab?.07:.05),ab?-.1:-.06,.41,.38,.38);   // 올백 sits further back: the forehead shows   // a solid hair volume set back on the head, so the hairline is a clean curve and not a thin shell edge
    if(ab||H.style==='perm'){}   // no bangs (뽀글 파마 gets curls below)
    else if(H.style==='side'||H.style==='slick'){const b=face(hc,-.06,.165,-.004,.27,.1,.065,.32,CG.ball);b.position.y+=.015;}   // bangs: flat sweeps tucked into the hair
    /* bangs: two round sweeps pressed flat against the forehead, parted about 3:7 so they don't read as a pair of brows */
    else{face(hc,-.15,.17,-.008,.085,.075,.026,.45,CG.ball);face(hc,.05,.16,-.008,.2,.09,.028,-.22,CG.ball);}
    if(H.style==='long'){add(head,CG.ball,hc,0,HY-.2,-.17,.36,.36,.2);add(head,CG.ball,hc,0,HY-.42,-.23,.3,.24,.12);   // falls down the back past the shoulders
      for(const s of[-1,1]){add(head,CG.ball,hc,s*.31,HY-.15,-.05,.1,.24,.14);add(head,CG.ball,hc,s*.29,HY-.36,-.08,.085,.17,.1);}}
    if(H.style==='bun')add(head,CG.ball,hc,0,HY+.32,-.2,.13,.13,.13);
    if(ab)add(head,CG.ball,dark(hc,1.5),.1,HY+.39,.06,.1,.035,.14).rotation.z=-.4;   // pomade shine
    if(H.style==='slick'){add(head,CG.ball,hc,.05,HY+.33,.1,.25,.12,.19).rotation.z=-.25;face(dark(hc,.55),.2,.21,-.002,.014,.07,.01,.1,CG.blob);}   // 2대8: a lifted front wave and the parting line
    if(H.style==='messy')for(const[x,y,z]of MESSY){dv.set(x,y,z).normalize();add(head,CG.blob,hc,dv.x*.4,HY+.05+dv.y*.37,-.06+dv.z*.37,.055,.055,.15).quaternion.setFromUnitVectors(Zf,dv);}   // 부스스: tufts sticking out
    if(H.style==='perm'){for(let i=0;i<40;i++){const y=1-i/39*1.3,r=Math.sqrt(Math.max(0,1-y*y)),t=i*2.4;dv.set(Math.cos(t)*r,y,Math.sin(t)*r);   // 뽀글 파마: curls all over
        if(dv.z>.3&&dv.y<.5)continue;add(head,CG.ball,hc,dv.x*.41,HY+.05+dv.y*.38,-.06+dv.z*.38,.1,.1,.1);}   // keeping the face clear
      for(const x of[-.15,0,.15])face(hc,x,.21,0,.075,.065,.06,0,CG.ball);}
    if(H.style==='pony'){add(head,CG.ball,'#cf3626',0,HY+.17,-.45,.075,.06,.06);   // 포니테일: a red tie high at the back, a fat tail swinging out and down
      add(head,CG.ball,hc,0,HY+.04,-.57,.12,.2,.12).rotation.x=.6;add(head,CG.ball,hc,0,HY-.17,-.63,.095,.16,.095).rotation.x=.25;add(head,CG.ball,hc,0,HY-.34,-.62,.06,.09,.06);}
    if(H.style==='twin')for(const s of[-1,1]){add(head,CG.ball,'#cf3626',s*.37,HY+.1,-.12,.05,.055,.055);   // 양갈래: a red tie on each side, the tails hanging out and down
      add(head,CG.ball,hc,s*.44,HY-.07,-.14,.1,.19,.1).rotation.z=s*.3;add(head,CG.ball,hc,s*.48,HY-.26,-.15,.075,.13,.075).rotation.z=s*.12;}
    if(H.style==='updo'){add(head,CG.ball,hc,0,HY+.42,-.1,.14,.12,.14);add(head,CG.ring,'#cf6f8a',0,HY+.36,-.08,.1,.1,.2).rotation.x=Math.PI/2+.25;}}   // hair tied up in a top knot
  /* 왕관: a small gold crown sitting on top of the hair, wherever the top of that hair is */
  if(GR.has('crown')){const cy=HY+({bald:.33,buzz:.36,bun:.43,perm:.47,messy:.44,allback:.44,slick:.45}[H.style]??.41),cz=-.06,gd='#ecb83a';
    add(head,CROWN_OUT,gd,0,cy,cz);add(head,CROWN_IN,'#b5761f',0,cy,cz);add(head,CROWN_RIM,'#f4cc5c',0,cy+.004,cz);}
  /* role props */
  if(kind==='courier'){const bxm=new THREE.Mesh(GEO.box,lam('#c8955a'));bxm.scale.set(.42,.32,.32);bxm.position.set(0,.72,.36);bxm.castShadow=true;inner.add(bxm);}
  if(kind==='cart'){const ct=new THREE.Group();const b=new THREE.Mesh(GEO.box,lam('#7a4b2a'));b.scale.set(.75,.55,.5);b.position.y=.42;b.castShadow=true;ct.add(b);
    const tp=new THREE.Mesh(GEO.box,lam('#e8e2d3'));tp.scale.set(.78,.04,.53);tp.position.y=.72;ct.add(tp);
    for(let i=0;i<3;i++){const c=new THREE.Mesh(GEO.cyl,lam('#fbfaf6'));c.scale.set(.05,.1,.05);c.position.set(-.2+i*.2,.8,0);ct.add(c);}
    const um=new THREE.Mesh(new THREE.ConeGeometry(.55,.28,10),lam('#cf3626'));um.position.y=1.85;ct.add(um);const pole=new THREE.Mesh(GEO.cyl,lam('#d8d8dc'));pole.scale.set(.02,1.1,.02);pole.position.y=1.25;ct.add(pole);
    ct.position.z=.6;inner.add(ct);
    const zone=new THREE.Mesh(GEO.disc,basic('#3fbf6a',{transparent:true,opacity:.14,depthWrite:false}));zone.rotation.x=-Math.PI/2;zone.position.y=.018;zone.scale.setScalar(95*U);g.add(zone);
    const ring=new THREE.Mesh(GEO.ring,basic('#3fbf6a',{transparent:true,opacity:.5,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;ring.scale.setScalar(95*U);g.add(ring);}
  let mop=null;   // the cleaner holds the mop in the right hand and sweeps it side to side (poseRig)
  if(kind==='cleaner'){mop=piv(inner,.31,.43,.14);const st=new THREE.Mesh(GEO.cyl,lam('#7d6a52'));st.scale.set(.022,1.05,.022);st.position.y=.025;mop.add(st);
    const mh=new THREE.Mesh(GEO.box,lam('#e9e6df'));mh.scale.set(.3,.06,.14);mh.position.y=-.5;mh.rotation.x=.35;mh.castShadow=true;mop.add(mh);}
  /* 바지에 낀 휴지: a strip of toilet paper stuck in the waistband at the back, four sheets on hinges that stream out on the run (poseRig) */
  let tissue=null;if(GR.has('tissue')){tissue=[];const[hy,hr]=T.jacket?[.43,.252]:T.check?[.38,.25]:T.cardigan?[.45,.248]:T.vest?[.46,.248]:T.pj?[.36,.252]:loose?[.445,.232]:[.5,.232],y0=hy-.003;let par=piv(inner,0,y0,-Math.max(hr*ZS-.008,.204));   // comes out from under the top's hem, whichever top it is: the hinge is below the hem, so it can't swing out through the cloth
    for(let i=0,n=Math.round((y0-.03)/.124);i<n;i++){const h=par;h.rotation.x=.1;tissue.push(h);const m=new THREE.Mesh(GEO.box,lam('#f7f5ee'));m.scale.set(.085,.12,.008);m.position.y=-.06;m.castShadow=true;h.add(m);
      const c=new THREE.Mesh(GEO.box,lam('#d8d4c8'));c.scale.set(.085,.005,.01);c.position.y=-.12;h.add(c);par=piv(h,0,-.124,0);}}
  /* 트로피: a little gold cup held up in one hand (the left one if the right has the coffee) */
  if(GR.has('trophy')){const hand=GR.has('coffee')?armL:armR,trophy=piv(hand,hand===armL?-.05:.05,-.235,.21);trophy.scale.setScalar(.82);const gm=lam('#ecb83a',{flatShading:false,roughness:.32}),put=(geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;trophy.add(m);return m;};
    put(TROPHY_G,gm);for(const s of[-1,1]){const h=put(TROPHY_H,gm);h.position.set(s*.115,.135,0);h.rotation.z=-s*Math.PI/2;}const b=put(GEO.box,lam('#5a3b28'));b.scale.set(.2,.05,.2);b.position.y=-.145;}
  /* 후광: a soft gold glow round the whole body, a sprite kept behind me as seen from the camera (poseRig), so nothing of me is covered */
  let halo=null,haloF=null;if(GR.has('halo')){halo=new THREE.Sprite(haloMat(o.haloT).s);halo.position.set(0,.82,-.65);halo.scale.set(2.1,2.5,1);inner.add(halo);
    haloF=new THREE.Mesh(GEO.disc,haloMat(o.haloT).f);haloF.rotation.x=-Math.PI/2;haloF.position.y=.018;haloF.scale.setScalar(1.25);g.add(haloF);}   // and a pool of the same light on the floor, so it doesn't stop dead at my feet
  const carry=new THREE.Mesh(GEO.box,lam('#fbfaf6'));carry.scale.set(.32,.04,.4);carry.position.set(0,.8,.42);carry.visible=false;inner.add(carry);
  const sh=new THREE.Mesh(shGeo,basic('#1d2328',{transparent:true,opacity:.18,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.012;g.add(sh);
  const ring=new THREE.Mesh(ringGeo,basic('#2b6cb0',{transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.016;ring.visible=false;g.add(ring);
  const aura=new THREE.Mesh(GEO.disc,basic('#e5483a',{transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending}));aura.rotation.x=-Math.PI/2;aura.position.y=.02;aura.scale.setScalar(.85);aura.visible=false;g.add(aura);
  /* ~30 little parts would cost ~30 draw calls per character (twice with shadows); bake each rigid piece into one mesh */
  const cm=softFill(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,metalness:0}));   // a soft vinyl sheen instead of flat matte
  for(const p of[bottom,legL,legR,top,armL,armR,head,happy,angry])bakeParts(p,cm);angry.visible=false;
  for(const m of Object.values(M))m.dispose();
  const keep=mats.filter(m=>!Object.values(M).includes(m));
  g.userData={inner,bm:cm,mats:[cm,...keep],ring,aura,carry,cloak:false,rig:{legL,legR,armL,armR,head},coffee,tissue,halo,haloF,mop,mood:{happy,angry},slots:{head,top,bottom},outfit:o,walk:0};
  scene.add(g);return g;
}
/* team props: once someone is 발령, their character carries a team prop instead of any team colour on the UI.
   개발 = a laptop tucked flat under the left arm, 마케팅 = a megaphone pointed forward, 인사 = a clipboard held up
   in front of the chest: three different silhouettes, all in object colours so they never clash with the rank colours.
   Chunky so they read from the quarter view; attached to the rig so they swing with the arms. */
const PROP_G={horn:new THREE.CylinderGeometry(.13,.045,.3,14,1,true),grip:new THREE.CylinderGeometry(.03,.03,.12,8),
  band:new THREE.TorusGeometry(.42,.042,10,32,Math.PI),cap:new THREE.CylinderGeometry(1,1,1,20)};
/* 개발 also wears a headset: the laptop alone is hard to spot. One chunky cream band that hugs the hair (light, so it
   shows on dark hair from above), round cream ear cups with a slightly darker cap on the outside, a grey cushion against the head */
function headset(R){
  const g=new THREE.Group(),M=(geo,c,x,y,z)=>{const m=new THREE.Mesh(geo,lam(c));m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  M(PROP_G.band,'#f3f1ea',0,0,0).scale.set(1,.96,1.15);
  for(const s of[-1,1]){M(CG.ball,'#f3f1ea',s*.44,-.05,0).scale.set(.07,.125,.12);
    const cap=M(PROP_G.cap,'#dcd7cb',s*.5,-.05,0);cap.rotation.z=Math.PI/2;cap.scale.set(.085,.02,.085);
    M(CG.ball,'#8a929a',s*.395,-.05,0).scale.set(.03,.11,.105);}
  g.position.set(0,.2,-.03);R.head.add(g);return g;
}
function teamProp(m,team){
  const u=m.userData;if(u.team===team)return;u.team=team;if(u.coffee)u.coffee.visible=team!=='hr';   // the clipboard takes that hand
  if(u.prop){u.prop.parent&&u.prop.parent.remove(u.prop);u.prop=null;}
  if(u.prop2){u.prop2.parent&&u.prop2.parent.remove(u.prop2);u.prop2=null;}
  if(!team)return;const R=u.rig,g=new THREE.Group(),M=(geo,c,x,y,z)=>{const o=new THREE.Mesh(geo,lam(c));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  if(team==='dev'){const lid=M(GEO.box,'#c3c9cd',0,0,0);lid.scale.set(.035,.3,.42);lid.material=lam('#c3c9cd',{metalness:.5,roughness:.35});
    const base=M(GEO.box,'#aeb4b9',-.035,0,0);base.scale.set(.03,.3,.42);base.material=lam('#aeb4b9',{metalness:.5,roughness:.35});
    const glow=M(GEO.box,'#dfe9f2',.019,0,0);glow.scale.set(.004,.1,.1);glow.material=lam('#dfe9f2',{emissive:'#dfe9f2',emissiveIntensity:.6});
    g.position.set(.075,-.17,.02);R.armL.add(g);u.prop2=headset(R);}
  else if(team==='mkt'){g.scale.setScalar(1.3);const h=M(PROP_G.horn,'#fbfaf6',0,0,.18);h.rotation.x=Math.PI/2;h.material=lam('#fbfaf6',{side:THREE.DoubleSide});
    const r=M(GEO.box,'#e0603d',0,0,.06);r.scale.set(.1,.1,.05);M(PROP_G.grip,'#2a2d31',0,-.07,.04);
    g.position.set(0,-.3,.05);R.armL.add(g);}
  else if(team==='hr'){g.scale.setScalar(1.15);const bd=M(GEO.box,'#9a6b3f',0,0,0);bd.scale.set(.22,.3,.02);const pp=M(GEO.box,'#fbfaf6',0,-.02,.012);pp.scale.set(.18,.24,.01);
    const cl=M(GEO.box,'#9aa0a6',0,.14,.016);cl.scale.set(.09,.04,.03);for(let i=0;i<3;i++){const l=M(GEO.box,'#8a949c',0,.04-i*.06,.018);l.scale.set(.13,.012,.004);}
    g.position.set(-.06,-.3,.16);g.rotation.set(-.35,.5,0);R.armR.add(g);}
  u.prop=g;
}
const tmpC=new THREE.Color(),WHITE=new THREE.Color('#ffffff');
const toYaw=face=>Math.atan2(Math.cos(face),Math.sin(face));
function setCloak(u,alpha){
  const want=alpha<1;if(u.cloak===want&&(!want||u.alpha===alpha))return;u.cloak=want;u.alpha=alpha;if(u.halo)u.halo.visible=u.haloF.visible=!want;
  for(const m of u.mats){m.transparent=want;m.opacity=alpha;m.depthWrite=!want;m.needsUpdate=true;}
}
/* 성과 running trails (RW_FX, 임원 rewards): little bits left behind anyone running who wears one. They shrink
   away instead of fading, so one shared material per kind is enough (칼바람 streaks are see-through, all at once) */
const TRAIL={list:[],mats:null,MAX:260,geo:{gold:new THREE.OctahedronGeometry(1,0),paper:GEO.box,wind:GEO.box,windS:new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),windA:new THREE.RingGeometry(.42,.5,28,1,0,2.2).rotateX(-Math.PI/2)}};
/* 수행원: three small figures in black suits and sunglasses, running after the wearer along their path (슈슈슉). When the
   wearer stops they catch up and shrink away; the 옷장 preview (force) stands them behind me */
const ESC={list:new Map(),mat:null,GAP:[.12,.24,.36],SIZE:.58};
/* a 수행원 is a lighter figure of its own: the same shapes as a character (jacket, shirt, collar, tie, hair) in fewer sides, about a third
   of the triangles, no cast shadow (a flat disc instead), one model shared by all of them. It keeps a character's rig, so poseRig runs it */
let escortTpl=null;
function escortChar(){
  if(!escortTpl){const S=new THREE.SphereGeometry(1,12,8),s6=new THREE.SphereGeometry(1,8,6),K='#1f2228',SK='#fbd8bb',HR='#1f1b1a',M={},ms=[],root=new THREE.Group(),inner=new THREE.Group(),ZS=.86;root.add(inner);
    const add=(par,geo,c,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,M[c]||(ms.push(M[c]=new THREE.MeshLambertMaterial({color:c})),M[c]));m.position.set(x,y,z);m.scale.set(sx,sy,sz);par.add(m);return m;};
    const piv=(par,n,x,y,z)=>{const g=new THREE.Group();g.name=n;g.position.set(x,y,z);par.add(g);return g;};
    const body=piv(inner,'body',0,0,0),legL=piv(inner,'legL',-.098,.4,0),legR=piv(inner,'legR',.098,.4,0),armL=piv(inner,'armL',-.268,.71,0),armR=piv(inner,'armR',.268,.71,0),head=piv(inner,'head',0,.935,0);
    add(body,LP([[0,.35],[.15,.352],[.226,.395],[.236,.535],[.2,.545],[0,.545]],0,TAU,12),K,0,0,0,1,1,ZS);   // hips
    add(body,LP(TORSO_P,0,TAU,12),'#f4f6f8',0,0,0,1,1,ZS);add(body,LP(JACKET_P,JGAP,TAU-JGAP*2,12),K,0,0,0,1,1,ZS);add(body,LP(NECK_P.concat([[.108,.8]]),0,TAU,10),'#f4f6f8',0,0,0,1.06,1,1.06*ZS);   // shirt, open jacket, collar
    add(body,CG.tie,'#101114',0,.742,.19).rotation.x=-.12;add(body,CG.tieKnot,'#101114',0,.768,.2).rotation.x=-.35;
    for(const s of[-1,1])add(body,s>0?CG.flapR:CG.flapL,'#f4f6f8',s*.052,.758,.2).rotation.set(-.6,s*.32,0);
    const LEG=LP([[0,-.3],[.092,-.3],[.1,-.2],[.105,-.06],[.112,0],[0,.03]],0,TAU,8),SL=LP([[0,-.25],[.064,-.25],[.076,-.09],[.082,-.02],[.076,.03],[.052,.065],[0,.08]],0,TAU,8);
    for(const l of[legL,legR]){add(l,LEG,K);add(l,s6,'#101114',0,-.33,.035,.1,.065,.14);}
    for(const[a,s]of[[armL,1],[armR,-1]]){add(a,SL,K);add(a,s6,SK,0,-.315,.01,.078,.088,.07);add(a,s6,SK,s*.05,-.29,.035,.03,.04,.03);}
    head.rotation.x=-.18;head.scale.setScalar(.92);add(head,S,SK,0,.18,0,.38,.34,.35);add(head,S,'#3a3532',0,.205,-.035,.392,.355,.36);add(head,new THREE.SphereGeometry(1,16,4,Math.PI/2-1.2,2.4,.45,.77),'#3a3532',0,.205,-.035,.397,.36,.368);   // 반삭: a close cap, the side hair kept, and a patch filling the notch over the forehead to one straight line
    for(const s of[-1,1]){add(head,s6,'#101114',s*.13,.17,.335,.105,.07,.03).rotation.y=s*.2;add(head,s6,'#9aa4b2',s*.15,.19,.362,.026,.016,.006);add(head,s6,SK,s*.39,.125,.01,.03,.06,.047);}add(head,GEO.box,'#101114',0,.186,.355,.08,.018,.018);add(head,new THREE.TorusGeometry(.035,.0075,4,8,MOUTH_ARC),'#8a3a36',0,.135,.325).rotation.set(-.15,0,-Math.PI/2-MOUTH_ARC/2);   // sunglasses with a glint, ears, a smile
    const mat=softFill(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,metalness:0}));for(const g of[body,legL,legR,armL,armR,head])bakeParts(g,mat);for(const m of ms)m.dispose();
    root.traverse(o=>{if(o.isMesh)o.castShadow=false;});escortTpl=root;}
  const g=escortTpl.clone(true),n=x=>g.getObjectByName(x),sh=new THREE.Mesh(GEO.disc,ESC.mat);sh.rotation.x=-Math.PI/2;sh.position.y=.012;sh.scale.setScalar(.3);g.add(sh);
  g.userData={inner:g.children[0],rig:{legL:n('legL'),legR:n('legR'),armL:n('armL'),armR:n('armR'),head:n('head')},walk:0};g.visible=false;scene.add(g);return g;
}
function escortStep(a,m,dt,force){const u=m.userData,now=G.t;
  if(!ESC.mat)ESC.mat=basic('#14161a',{transparent:true,opacity:.5,depthWrite:false});
  let e=ESC.list.get(a);
  if(!e){e={hist:[],k:0,fig:ESC.GAP.map(escortChar)};ESC.list.set(a,e);}
  e.seen=true;e.hist.push({t:now,x:m.position.x,z:m.position.z,r:m.rotation.y});while(e.hist.length&&now-e.hist[0].t>.8)e.hist.shift();
  e.k+=((force||u.mvT>0?1:0)-e.k)*Math.min(1,dt*9);
  e.fig.forEach((g,i)=>{const back=ESC.GAP[i];let h=e.hist[0];for(const s of e.hist){if(now-s.t>=back)h=s;else break;}
    const side=(i-1)*.3,cs=Math.cos(h.r),sn=Math.sin(h.r);g.visible=e.k>.03;poseRig(g.userData,force?'idle':e.k>.4?'run':'idle',dt);
    if(force){g.position.set(m.position.x+(i-1)*.75,0,m.position.z-.45-(i===1?.3:0));g.rotation.y=0;g.scale.setScalar(ESC.SIZE);return;}
    g.position.set(h.x+cs*side,0,h.z-sn*side);g.rotation.y=h.r;g.scale.setScalar(ESC.SIZE*e.k);});
  if(!force&&u.mvT>0&&TRAIL.list.length<TRAIL.MAX&&Math.random()<dt*14){const fx=Math.cos(a.face),fz=Math.sin(a.face),w=(Math.random()-.5)*.7;   // 슉: a thin streak behind them
    if(!TRAIL.mats)TRAIL.mats=trailMats();const p={k:'wind',t:0,life:.3,s:.6,spin:0,m:new THREE.Mesh(TRAIL.geo.wind,ESC.mat),v:new THREE.Vector3(-fx*2.2,0,-fz*2.2)};
    p.m.position.set(m.position.x-fx*.9-fz*w,.3+Math.random()*.8,m.position.z-fz*.9+fx*w);p.m.rotation.y=-a.face;scene.add(p.m);TRAIL.list.push(p);}
}
/* 칼바람: a thin bright streak, sharp at both ends. 담배연기: a soft puff */
function windTex(){const C=document.createElement('canvas');C.width=128;C.height=16;const x=C.getContext('2d'),g=x.createLinearGradient(0,0,128,0);g.addColorStop(0,'rgba(47,127,214,0)');g.addColorStop(.7,'#2f7fd6');g.addColorStop(1,'#d5ecff');x.fillStyle=g;x.beginPath();x.moveTo(0,8);x.quadraticCurveTo(100,0,128,8);x.quadraticCurveTo(100,16,0,8);x.fill();
  const t=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;return t;}
let smokeMap=null;
function smokeTex(){if(!smokeMap){const C=document.createElement('canvas');C.width=C.height=64;const x=C.getContext('2d'),g=x.createRadialGradient(32,32,4,32,32,31);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.55,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);smokeMap=new THREE.CanvasTexture(C);}return smokeMap;}
function starTex(){const C=document.createElement('canvas');C.width=C.height=64;const x=C.getContext('2d'),c=32,g=x.createRadialGradient(c,c,1,c,c,30);g.addColorStop(0,'rgba(255,214,90,.75)');g.addColorStop(.45,'rgba(255,190,40,.28)');g.addColorStop(1,'rgba(255,180,20,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  const f=x.createRadialGradient(c,c,0,c,c,28);f.addColorStop(0,'#fffbe0');f.addColorStop(.35,'#ffe06a');f.addColorStop(1,'#f0a400');x.fillStyle=f;x.beginPath();for(let i=0;i<8;i++){const a=i/8*TAU,r=i%2?5:29;x.lineTo(c+Math.sin(a)*r,c-Math.cos(a)*r);}x.closePath();x.fill();const t=new THREE.CanvasTexture(C);t.colorSpace=THREE.SRGBColorSpace;return t;}
const trailMats=()=>({star:new THREE.SpriteMaterial({map:starTex(),transparent:true,depthWrite:false}),gold:basic('#ffbf1f'),paper:lam('#ffffff',{emissive:'#ffffff',emissiveIntensity:.35}),wind:basic('#5b9bd5',{transparent:true,opacity:.85,depthWrite:false}),windS:basic('#ffffff',{map:windTex(),transparent:true,depthWrite:false}),windA:basic('#4a9be8',{transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide})});
function trailEmit(a,m,dt,force){
  const k=a.fit&&a.fit.fx,u=m.userData;if(!k||!RW_FX[k])return;
  if(k==='escort'){escortStep(a,m,dt,force);return;}
  if(!(force||u.mvT>0)){u.fxT=0;return;}
  const every={gold:.02,paper:.05,wind:.05,smoke:.075}[k];u.fxT=(u.fxT||0)+dt;
  if(!TRAIL.mats)TRAIL.mats=trailMats();
  const fx=Math.cos(a.face),fz=Math.sin(a.face),r=Math.random;
  while(u.fxT>=every&&TRAIL.list.length<TRAIL.MAX){u.fxT-=every;
    /* the 옷장 preview (force) faces the camera, so bits start beside me instead of hidden behind */
    const sd=force?(r()<.5?-1:1)*(.28+r()*.25):0,X=m.position.x-fz*sd+(force?fx*.35:0),Z=m.position.z+fx*sd+(force?fz*.35:0);
    if(k==='smoke'){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex(),color:'#70747b',transparent:true,depthWrite:false,opacity:.9})),p={k,t:0,life:1.3,s:.34+r()*.2,own:true,m:sp,v:new THREE.Vector3((r()-.5)*.3-fx*.35,.5+r()*.3,(r()-.5)*.3-fz*.35)};
      sp.position.set(X-fx*.2+(r()-.5)*.15,1.15+r()*.15,Z-fz*.2+(r()-.5)*.15);sp.scale.setScalar(p.s);scene.add(sp);TRAIL.list.push(p);continue;}
    if(k==='gold'&&r()<.85){const sp=new THREE.Sprite(TRAIL.mats.star),p={k:'star',t:0,life:.75+r()*.45,s:.32+r()*.34,ph:r()*6.28,m:sp,v:new THREE.Vector3((r()-.5)*.5-fx*.3,.65+r()*.7,(r()-.5)*.5-fz*.3)};sp.position.set(X-fx*.15+(r()-.5)*.6,.1+r()*1.05,Z-fz*.15+(r()-.5)*.6);sp.scale.setScalar(.01);scene.add(sp);TRAIL.list.push(p);continue;}   // 금가루: mostly twinkling four-point stars among the flakes
    const kk=k==='wind'?(r()<.22?'windA':'windS'):k,p={k:kk,t:0,m:new THREE.Mesh(TRAIL.geo[kk],TRAIL.mats[kk]),v:new THREE.Vector3()};scene.add(p.m);
    if(kk==='windA'){p.life=.32;p.s=.8+r()*.5;p.own=true;p.m.material=TRAIL.mats.windA.clone();p.spin=(r()<.5?-1:1)*11;p.m.position.set(m.position.x,.3+r()*.9,m.position.z);p.m.rotation.y=r()*6.28;p.m.scale.setScalar(p.s);TRAIL.list.push(p);continue;}   // a crescent slicing round me
    if(kk==='windS'){const s2=r()<.5?-1:1,dx=force?-fz*s2:fx,dz=force?fx*s2:fz,w=(r()-.5)*.8;p.life=.34;p.s=.9+r()*.8;p.w=.07+r()*.07;
      p.m.position.set((force?m.position.x:X)-dx*.5-dz*w,.2+r()*1.1,(force?m.position.z+.15:Z)-dz*.5+dx*w);p.v.set(-dx*4.5,0,-dz*4.5);p.m.rotation.y=-Math.atan2(dz,dx);p.m.scale.set(p.s,1,p.w);TRAIL.list.push(p);continue;}   // a long thin gust going past
    if(k==='gold'){p.life=.8;p.s=.045+r()*.035;p.m.position.set(X-fx*.15+(r()-.5)*.35,.06+r()*.3,Z-fz*.15+(r()-.5)*.35);p.v.set((r()-.5)*.3,.7+r()*.5,(r()-.5)*.3);p.spin=6;}
    else if(k==='paper'){p.life=1.4;p.s=1;p.m.scale.set(.18,.006,.23);p.m.position.set(X-fx*.25+(r()-.5)*.3,.75+r()*.5,Z-fz*.25+(r()-.5)*.3);p.v.set(-fx*.9+(r()-.5)*1.7,1+r()*.8,-fz*.9+(r()-.5)*1.7);p.spin=5+r()*4;p.m.rotation.set(r()*3,r()*3,0);}
    else{p.life=.4;p.s=.4+r()*.35;   // streaks along the run (in the 옷장 preview: across, so they show from the front)
      const s2=r()<.5?-1:1,dx=force?-fz*s2:fx,dz=force?fx*s2:fz,w=(r()-.5)*.5,bx=force?m.position.x:X,bz=force?m.position.z+.15:Z;
      p.m.position.set(bx-dx*.35-dz*w,.35+r()*.9,bz-dz*.35+dx*w);p.v.set(-dx*2.6,0,-dz*2.6);p.m.rotation.y=-Math.atan2(dz,dx);p.spin=0;}
    TRAIL.list.push(p);}
}
/* 옷장 이펙트 탭: my character throws what I've chosen, every moment, so the choice can be seen moving (there is no throw pose in the game) */
const TD={list:[],t:0,last:0};
function thrDemo(a,m,dt){const R=m.userData.rig,T=(TD.t+=dt)%1.6,hit=.3;
  R.armR.rotation.x=T<.24?-T/.24*2.6:T<.42?-2.6+(T-.24)/.18*2.9:.3*Math.max(0,1-(T-.42)/.3);
  if(TD.last<hit&&T>=hit){const k=a.fit&&a.fit.thr,g=k?thrownMesh(k,{}):new THREE.Group();if(!k)g.add(new THREE.Mesh(paperGeo,lam('#ffffff')));
    const y=m.rotation.y,fw=[Math.sin(y),Math.cos(y)],rt=[Math.cos(y),-Math.sin(y)],v=new THREE.Vector3(fw[0]*1.2+rt[0]*.32,.25,fw[1]*1.2+rt[1]*.32);
    g.position.set(m.position.x+rt[0]*.3+fw[0]*.2,1.05,m.position.z+rt[1]*.3+fw[1]*.2);g.scale.setScalar(.8);scene.add(g);TD.list.push({g,t:0,v,yaw:Math.atan2(v.x,v.z)});}
  TD.last=T;}
function thrDemoStep(dt){for(let i=TD.list.length-1;i>=0;i--){const p=TD.list[i];p.t+=dt;
    if(p.ring){const k=p.t/.25;if(k>=1){scene.remove(p.ring);p.ring.material.dispose();TD.list.splice(i,1);continue;}p.ring.scale.setScalar(.05+k*.13);p.ring.material.opacity=.55*(1-k);continue;}
    p.g.position.addScaledVector(p.v,dt);p.g.rotation.y=p.g.userData.aim?p.yaw:p.g.rotation.y+dt*12;if(p.g.userData.tumble)p.g.rotation.x+=dt*10;if(p.g.userData.spinKids)for(const c of p.g.children)c.rotation.y+=dt*12;
    if(p.t>.55){const r=new THREE.Mesh(GEO.ring,basic('#ffffff',{transparent:true,opacity:.55,depthWrite:false}));r.position.copy(p.g.position);r.quaternion.copy(cam3.quaternion);scene.add(r);scene.remove(p.g);p.g=null;p.ring=r;p.t=0;}}}
function trailStep(dt){
  thrDemoStep(dt);
  for(const[a,e]of ESC.list){if(!G.actors.includes(a)){for(const g of e.fig)scene.remove(g);ESC.list.delete(a);continue;}if(!e.seen)for(const g of e.fig)g.visible=false;e.seen=false;}   // nobody drew them this frame: left the floor, or changed effect
  for(let i=TRAIL.list.length-1;i>=0;i--){const p=TRAIL.list[i];p.t+=dt;const q=1-p.t/p.life;
    if(q<=0){scene.remove(p.m);if(p.own)p.m.material.dispose();TRAIL.list.splice(i,1);continue;}
    if(p.k==='paper'){p.v.y-=2.6*dt;p.v.x*=1-dt*1.5;p.v.z*=1-dt*1.5;if(p.m.position.y<.03){p.v.set(0,0,0);p.m.position.y=.03;}}   // flutters down and lies on the floor a moment
    p.m.position.addScaledVector(p.v,dt);
    if(p.k==='star'){p.v.y*=1-dt*1.2;p.m.scale.setScalar(p.s*Math.min(1,p.t*9,q*2.2)*(.62+.38*Math.sin(p.t*19+p.ph)));continue;}
    if(p.k==='smoke'){p.m.scale.setScalar(p.s*(1+(1-q)*2.2));p.m.material.opacity=.9*q;continue;}
    if(p.k==='windS'){p.m.scale.set(p.s*(.4+q*.6),1,p.w*q);continue;}
    if(p.k==='windA'){p.m.rotation.y+=p.spin*dt;p.m.scale.setScalar(p.s*(1.5-q*.5));p.m.material.opacity=.9*q;continue;}
    if(p.k==='gold'){p.m.rotation.y+=p.spin*dt;p.m.scale.setScalar(p.s*Math.min(1,q*1.6));}
    else if(p.k==='paper'){if(p.m.position.y>.031){p.m.rotation.x+=p.spin*dt;p.m.rotation.z+=p.spin*.6*dt;}else p.m.rotation.set(0,p.m.rotation.y,0);const k=Math.min(1,q*3);p.m.scale.set(.18*k,.006,.23*k);}
    else p.m.scale.set(p.s*q,.03,.03);}
}
function poseChar(m,o,dt,isNpc){
  const u=m.userData;m.position.set(o.x*U,o.lift||0,o.y*U);
  const want=toYaw(o.face);let cur=m.rotation.y,d=want-cur;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;m.rotation.y=cur+d*Math.min(1,dt*14);if(o.statue)return;
  /* walking = moving faster than 12 px/s (by speed, not per-frame distance, so slow walkers like the cleaner
     still step on 144 Hz screens); held for a moment so a stuttery network sample doesn't freeze the legs */
  const px=u.px===undefined?o.x:u.px,py=u.py===undefined?o.y:u.py;u.px=o.x;u.py=o.y;
  u.mvT=Math.hypot(o.x-px,o.y-py)/Math.max(dt,1e-3)>12?.15:(u.mvT||0)-dt;const mv=u.mvT>0;
  const sit=!isNpc&&(!!o.sit||!!o.wc);
  u.inner.rotation.z=!isNpc&&o.stunT>0?Math.sin(G.t*12)*.25:0;
  poseRig(u,sit?'sit':mv?(o.sprint?'run':'walk'):'idle',dt,!isNpc&&o.carry,sit&&(o.wc||o.sit.bench)?SIT_BENCH:SIT_CHAIR); // the toilet seat is low like a bench
}
/* arms and legs: walk / run swing, seated typing, a little idle sway */
/* how far to raise the body when seated so the hips (bottom at y .35) rest on the seat: office chair top .53, rooftop bench top .455 */
const SIT_CHAIR=.18,SIT_BENCH=.1;
function poseRig(u,mode,dt,carry,sitY=SIT_CHAIR){
  const R=u.rig;if(!R)return;
  u.walk+=dt*(mode==='run'?17:mode==='walk'?11:2);
  const sw=mode==='walk'?Math.sin(u.walk)*.6:mode==='run'?Math.sin(u.walk)*.95:0;
  u.inner.position.y=mode==='sit'?sitY:mode==='idle'?0:Math.abs(Math.cos(u.walk))*.05;
  R.legL.rotation.x=mode==='sit'?-1.4:sw;R.legR.rotation.x=mode==='sit'?-1.4:-sw;
  if(mode==='sit'){R.armL.rotation.x=-1.0+Math.sin(u.walk*9)*.06;R.armR.rotation.x=-1.0+Math.sin(u.walk*9+1.7)*.06;}
  else if(carry){R.armL.rotation.x=R.armR.rotation.x=-1.15;}
  else{R.armL.rotation.x=-sw*.8;R.armR.rotation.x=sw*.8;}
  if(u.halo){const k=1+Math.sin(u.walk*.5)*.04,g=u.inner.parent,p=g.position,dx=cam3.position.x-p.x,dy=cam3.position.y-.82,dz=cam3.position.z-p.z,l=Math.hypot(dx,dy,dz)||1,c=Math.cos(g.rotation.y),n=Math.sin(g.rotation.y),b=.65/l;u.halo.scale.set(2.1*k,2.5*k,1);u.halo.position.set(-(dx*c-dz*n)*b,.82-dy*b,-(dx*n+dz*c)*b);}
  if(u.tissue){const k=mode==='run'?.72:mode==='walk'?.44:.1,w=u.walk*.8;u.tissue.forEach((h,i)=>{h.rotation.x=(i?k*.3:k)+Math.sin(w-i*1.2)*k*.55;h.rotation.z=i?Math.sin(w*.7-i)*k*.3:0;});}
  if(u.mop&&mode!=='sit'){R.armR.rotation.x=-.45;u.mop.rotation.set(-.35,0,Math.sin(u.walk*.55)*(mode==='idle'?.12:.3));}
  R.armL.rotation.z=-.14;R.armR.rotation.z=.14;
  R.head.rotation.y=mode==='idle'?Math.sin(u.walk*.6)*.18:0;
}

/* ---------- dynamic pools ---------- */
const actorM=new Map(),npcM=new Map(),coneM=new Map(),OTHER_HUMAN='#7b4fd6'; /* other people in an online room */
function syncSet(map,list,make,upd,drop){
  const seen=new Set();
  for(const o of list){let m=map.get(o);if(!m){m=make(o);if(!m)continue;map.set(o,m);scene.add(m);}seen.add(o);upd(o,m);}
  for(const[o,m]of map)if(!seen.has(o)){scene.remove(m);map.delete(o);if(drop)drop(m);}
}
const smokeM=new Map(),itemM=new Map(),trapM=new Map(),wetM=new Map(),taskM=new Map(),dropM=new Map(),projM=new Map(),burstM=new Map(),airM=new Map();
const cubeGeo=new THREE.BoxGeometry(.42,.42,.42),haloGeo=new THREE.SphereGeometry(.5,16,12);
const BAND_G=new THREE.TorusGeometry(.17,.025,6,16,Math.PI),FLAME_G=new THREE.ConeGeometry(.045,.14,8);
/* each item looks like what it is (the glow under it still tells the category colour) */
function itemModel(k){
  const m=new THREE.Group(),P=(w,h,d,c,x=0,y=0,z=0,o)=>{const b=new THREE.Mesh(GEO.box,lam(c,o));b.scale.set(w,h,d);b.position.set(x,y,z);b.castShadow=true;m.add(b);return b;},
    C=(rt,rb,h,c,x=0,y=0,z=0,o)=>{const b=new THREE.Mesh(cylGeo(rt,rb,14),lam(c,o));b.scale.set(1,h,1);b.position.set(x,y,z);b.castShadow=true;m.add(b);return b;};
  if(k==='coffee'){C(.13,.1,.36,'#f3efe6');C(.135,.135,.06,'#3d2a1e',0,.2);C(.14,.14,.04,'#7a4b2a',0,.04);P(.03,.18,.03,'#3fbf6a',.05,.3,0);}
  else if(k==='spill'){C(.12,.09,.3,'#fbfaf6');C(.125,.125,.04,'#5b3a24',0,.15);const s=C(.18,.18,.01,'#6b4a2e',.14,-.15,.08);s.material=lam('#6b4a2e',{transparent:true,opacity:.8});}
  else if(k==='stapler'){P(.42,.07,.12,'#2a2d31',0,-.05);P(.4,.07,.11,'#cf3626',0,.04,0);P(.08,.05,.11,'#9aa0a6',.17,.09,0);}
  else if(k==='bundle'){for(let i=0;i<4;i++)P(.36,.05,.46,i%2?'#ffffff':'#f1eee6',(i%2)*.02,-.08+i*.055,0,{}).rotation.y=i*.12;P(.38,.03,.06,'#cf3626',0,.06,0);}
  else if(k==='card'){const c=P(.42,.02,.27,'#1d2328',0,0,0,{metalness:.4,roughness:.4});c.rotation.x=-.5;P(.1,.02,.08,'#e0b52a',-.1,.02,-.02).rotation.x=-.5;}
  else if(k==='stamp'){C(.06,.07,.26,'#7a4b2a',0,.04);C(.1,.12,.1,'#3d2a1e',0,-.13);C(.12,.12,.02,'#cf3626',0,-.19);}
  else if(k==='vip'){const band=new THREE.Mesh(BAND_G,lam('#2a2d31'));band.position.y=.02;m.add(band);
    for(const x of[-.17,.17])C(.08,.08,.08,'#2a2d31',x,-.02,0).rotation.z=Math.PI/2;}
  else if(k==='ticket'){P(.4,.015,.2,'#f3d77a').rotation.x=-.4;P(.06,.02,.2,'#e0c23d',.12,.005,0).rotation.x=-.4;}
  else if(k==='food'){P(.4,.28,.3,'#c8955a',0,-.04);P(.42,.04,.32,'#a87642',0,.11);P(.06,.12,.02,'#7a4b2a',0,.19,0);}
  else if(k==='lighter'){P(.12,.24,.07,'#e0603d',0,-.04,0,{metalness:.3});P(.12,.05,.07,'#c3c9cd',0,.11,0,{metalness:.6});
    const fl=new THREE.Mesh(FLAME_G,lam('#ffb340',{emissive:'#ff8a1f',emissiveIntensity:1}));fl.position.y=.21;m.add(fl);}
  else P(.42,.42,.42,ITEMS[k].c);
  return m;
}
function makeItem(it){
  const c=ITEMS[it.k].c,g=new THREE.Group();
  {const md=itemModel(it.k);md.scale.setScalar(1.5);g.add(md);}
  g.add(new THREE.Mesh(haloGeo,basic(c,{transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending})));
  return g;
}
/* spilled water (청소 아주머니's wet floor): a few shapes drawn once, a pool with runs and stray drops;
   each puddle picks one and a turn from where it lies, so the same spill looks the same to everyone */
const PUDDLE_TEX=[0,1,2,3].map(v=>{
  const S=128,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');
  const r=k=>{const h=Math.sin((v+1)*91.7+k*12.9898)*43758.5453;return h-Math.floor(h);};
  const blob=(cx,cy,R,k)=>{x.beginPath();for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,
    rr=R*(1+.16*Math.sin(a*2+r(k)*6)+.1*Math.sin(a*3+r(k+1)*6)+.05*Math.sin(a*6+r(k+2)*6)),px=cx+Math.cos(a)*rr,py=cy+Math.sin(a)*rr;i?x.lineTo(px,py):x.moveTo(px,py);}
    x.closePath();x.fill();};
  x.fillStyle='#fff';blob(64,64,30,0);
  for(let i=0;i<3;i++){const a=r(10+i)*Math.PI*2,d=22+r(20+i)*10;blob(64+Math.cos(a)*d,64+Math.sin(a)*d,10+r(30+i)*9,40+i*3);}   // runs off the main pool
  for(let i=0;i<5;i++){const a=r(50+i)*Math.PI*2,d=44+r(60+i)*14;blob(64+Math.cos(a)*d,64+Math.sin(a)*d,1.8+r(70+i)*3,80+i*3);}   // stray drops
  /* water colour over the shape only: clearer in the middle, a deeper rim, and a glint */
  x.globalCompositeOperation='source-atop';
  const g=x.createRadialGradient(58,58,4,64,64,62);g.addColorStop(0,'#cfeaf8');g.addColorStop(.55,'#a6d4f0');g.addColorStop(1,'#6fafdc');x.fillStyle=g;x.fillRect(0,0,S,S);
  x.strokeStyle='rgba(255,255,255,.85)';x.lineCap='round';x.lineWidth=3;x.beginPath();x.arc(60,60,17,Math.PI*1.1,Math.PI*1.45);x.stroke();
  x.lineWidth=2;x.beginPath();x.arc(60,60,11,Math.PI*1.15,Math.PI*1.3);x.stroke();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;});
const puddleGeo=new THREE.PlaneGeometry(1,1);
function puddle(w){const h=Math.abs(Math.round(w.x*7+w.y*13)),m=new THREE.Mesh(puddleGeo,new THREE.MeshBasicMaterial({map:PUDDLE_TEX[h%4],transparent:true,opacity:0,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.rotation.z=(h%360)*Math.PI/180;return m;}
function flatDisc(color,op){const m=new THREE.Mesh(GEO.disc,basic(color,{transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
function makeTask(t){
  const g=new THREE.Group();
  if(t.zone){const m=new THREE.Mesh(GEO.box,basic('#f3d77a',{transparent:true,opacity:.18,depthWrite:false}));m.scale.set((t.zone.w-8)*U,.02,(t.zone.h-8)*U);m.position.set((t.zone.x+t.zone.w/2)*U,.02,(t.zone.y+t.zone.h/2)*U);g.add(m);}
  else{const r=(t.kind==='copy'||t.kind==='print'?K(46):t.r)*U,m=new THREE.Mesh(GEO.ring,basic('#f3d77a',{transparent:true,opacity:.85}));m.rotation.x=-Math.PI/2;m.scale.setScalar(r);m.position.set(t.x*U,.02,t.y*U);g.add(m);
    const d=flatDisc('#f3d77a',.16);d.scale.setScalar(r);d.position.set(t.x*U,.015,t.y*U);g.add(d);}
  return g;
}
const paperGeo=new THREE.BoxGeometry(.3,.03,.4);
/* what a thrown 서류 looks like (the thrower's 옷장 choice; the same size as a 서류, and only the look changes) */
const planeGeo=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.36,-.24,.08,-.24,0,-.05,-.2,0,0,.36,0,-.05,-.2,.24,.08,-.24],3));g.computeVertexNormals();return g;})();
function keyTop(glow){if(!keyTop.t){const C=document.createElement('canvas');C.width=128;C.height=48;const x=C.getContext('2d');x.fillStyle='#2b2f36';x.fillRect(0,0,128,48);x.fillStyle='#e8e6df';
    for(let r=0;r<4;r++)for(let i=0;i<12;i++)x.fillRect(4+i*10,4+r*10,8,8);x.fillRect(30,44-0,60,2);keyTop.t=new THREE.CanvasTexture(C);keyTop.t.colorSpace=THREE.SRGBColorSpace;}
  const e=lam('#2b2f36',glow),t=new THREE.MeshLambertMaterial({map:keyTop.t,...glow});return[e,e,t,e,e,e];}
const STICKY_C=['#ffe94a','#ff5fa8','#b6ff4a'],THROWN_G={sticky:new THREE.BoxGeometry(.28,.014,.28),key:new THREE.BoxGeometry(.34,.028,.13),handle:new THREE.TorusGeometry(.055,.018,6,14)};
function thrownMesh(k,glow){const g=new THREE.Group();
  if(k==='plane'){const m=lam('#fbfaf6',glow).clone();m.side=THREE.DoubleSide;g.add(new THREE.Mesh(planeGeo,m));g.userData.aim=true;}
  else if(k==='keyboard')g.add(new THREE.Mesh(THROWN_G.key,keyTop(glow)));
  else if(k==='sticky'){const n=1+(Math.random()*2|0);for(let i=0;i<n;i++){const c=STICKY_C[Math.random()*3|0],m=new THREE.Mesh(THROWN_G.sticky,lam(c,i?{emissive:c,emissiveIntensity:.4,transparent:true,opacity:.5}:{emissive:c,emissiveIntensity:.4}));m.position.z=i*-.5;if(i)m.scale.setScalar(.85);g.add(m);}g.userData.aim=g.userData.spinKids=true;}   // a neon 포스트잇, a random colour; sometimes a second, see-through one trailing it like a shadow (only the look: one hit)
  else if(k==='trophy'){const gm=lam('#ecb83a',{flatShading:false,roughness:.32,emissive:'#7a5208',emissiveIntensity:.3});g.add(new THREE.Mesh(TROPHY_G,gm));for(const s of[-1,1]){const h=new THREE.Mesh(TROPHY_H,gm);h.position.set(s*.115,.135,0);h.rotation.z=-s*Math.PI/2;g.add(h);}const b=new THREE.Mesh(GEO.box,lam('#5a3b28'));b.scale.set(.2,.05,.2);b.position.y=-.145;g.add(b);g.userData.tumble=true;}
  else{const c=new THREE.Mesh(GEO.cyl,lam('#f6f4ee',glow));c.scale.set(.1,.18,.1);g.add(c);const t=new THREE.Mesh(GEO.cyl,lam('#6b4430',glow));t.scale.set(.085,.01,.085);t.position.y=.09;g.add(t);
    const h=new THREE.Mesh(THROWN_G.handle,lam('#f6f4ee',glow));h.position.x=.115;g.add(h);g.userData.tumble=true;}
  g.userData.big=k==='mug'?1.5:k==='keyboard'?1.6:k==='trophy'?.76:1;return g;}
function makeProj(p){
  const g=new THREE.Group(),mine=p.o===G.me;
  if(p.bundle){for(let i=0;i<3;i++){const m=new THREE.Mesh(paperGeo,lam('#fbfaf6',{emissive:'#e5483a',emissiveIntensity:.25}));m.position.y=i*.05;m.rotation.y=i*.3;g.add(m);}}
  else if(p.staple){const m=new THREE.Mesh(GEO.box,lam(mine?'#2b6cb0':'#5d666e'));m.scale.set(.22,.05,.08);g.add(m);}
  else{const k=!p.flyer&&p.o&&p.o.fit&&p.o.fit.thr,glow={emissive:mine?'#2b6cb0':'#ffffff',emissiveIntensity:mine?.35:.2};
    if(k){const t=thrownMesh(k,glow);t.scale.setScalar((mine?1.25:1)*t.userData.big);g.add(t);g.userData.aim=t.userData.aim;g.userData.tumble=t.userData.tumble;g.userData.kids=t.userData.spinKids&&t.children;}
    else{const m=new THREE.Mesh(paperGeo,lam(p.flyer?'#f3d77a':'#ffffff',glow));if(mine)m.scale.setScalar(1.25);g.add(m);}}
  g.children.forEach(c=>c.castShadow=true);return g;
}
function makeBurst(){const m=new THREE.Mesh(GEO.ring,basic('#e5483a',{transparent:true,opacity:.9,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
function makeAir(d){
  const g=new THREE.Group();
  const crate=new THREE.Mesh(GEO.box,lam('#b5874a'));crate.scale.set(.75,.6,.75);crate.position.y=.3;crate.castShadow=true;g.add(crate);
  const chute=new THREE.Mesh(new THREE.SphereGeometry(.85,16,8,0,Math.PI*2,0,Math.PI/2),lam(d.k==='food'?'#e5483a':'#3d8be0',{side:THREE.DoubleSide}));chute.position.y=1.6;g.add(chute);
  g.userData.chute=chute;const sh=flatDisc('#000000',.25);g.userData.sh=sh;return g;
}
let cakeM=null;
const visitor=new THREE.Mesh(new THREE.CapsuleGeometry(.3,.5,4,10),lam('#5d666e'));visitor.visible=false;scene.add(visitor);

/* vision cones */
const CONE_N=26;
function makeCone(n){
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array((CONE_N+2)*3),3));
  const idx=[];for(let i=1;i<=CONE_N;i++)idx.push(0,i,i+1);geo.setIndex(idx);
  const col=n.kind==='ceo'?'#c08a1e':n.kind==='busy'?'#96a0aa':'#ffc93c';
  const g=new THREE.Group();
  const fan=new THREE.Mesh(geo,basic(col,{transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide}));fan.renderOrder=2;fan.frustumCulled=false;g.add(fan);
  const pres=flatDisc(col,.13);pres.renderOrder=1;g.add(pres);
  const snd=new THREE.Mesh(GEO.ring,basic('#1d2328',{transparent:true,opacity:.12,depthWrite:false}));snd.rotation.x=-Math.PI/2;g.add(snd);
  g.userData={fan,pres,snd};return g;
}
function segT(x1,y1,dx,dy,o){
  const x2=x1+dx,y2=y1+dy,mxx=o.x+o.w,mxy=o.y+o.h;
  if((x1<o.x&&x2<o.x)||(x1>mxx&&x2>mxx)||(y1<o.y&&y2<o.y)||(y1>mxy&&y2>mxy))return null;
  let t0=0,t1=1;
  if(dx===0){if(x1<o.x||x1>mxx)return null;}
  else{let a=(o.x-x1)/dx,b=(mxx-x1)/dx;if(a>b){const t=a;a=b;b=t;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return null;}
  if(dy===0){if(y1<o.y||y1>mxy)return null;}
  else{let a=(o.y-y1)/dy,b=(mxy-y1)/dy;if(a>b){const t=a;a=b;b=t;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return null;}
  return t0;
}
function rayLen(f,x,y,ang,len){
  const dx=Math.cos(ang)*len,dy=Math.sin(ang)*len;let best=1;
  for(const o of obsOf(f)){if(!o.sight)continue;const t=segT(x,y,dx,dy,o);if(t!==null&&t<best)best=t;}
  return best*len;
}
function updCone(n,m){
  const v=VIS[n.kind],u=m.userData,p=u.fan.geometry.attributes.position.array;
  p[0]=n.x*U;p[1]=.03;p[2]=n.y*U;
  for(let i=0;i<=CONE_N;i++){const a=n.face-v.half+2*v.half*i/CONE_N,d=rayLen(n.f,n.x,n.y,a,v.len);
    p[(i+1)*3]=(n.x+Math.cos(a)*d)*U;p[(i+1)*3+1]=.03;p[(i+1)*3+2]=(n.y+Math.sin(a)*d)*U;}
  u.fan.geometry.attributes.position.needsUpdate=true;
  u.pres.visible=!!v.pres;if(v.pres){u.pres.scale.setScalar(v.pres*U);u.pres.position.set(n.x*U,.02,n.y*U);}
  u.snd.visible=!!v.sound;if(v.sound){u.snd.scale.setScalar(v.sound*U);u.snd.position.set(n.x*U,.018,n.y*U);}
}

/* fog of war: visible area to stencil, the rest shaded */
const VIS_N=isTouch?72:96,VR=600;
/* the visible area is a fan of triangles. Besides evenly spaced rays it casts rays at every wall corner (and just
   either side of it), so the edge of the fog sits exactly on the corners and doesn't jump between rays as I move */
const VIS_MAX=2400;
const visGeo=new THREE.BufferGeometry();visGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(VIS_MAX*9),3));
const visMesh=new THREE.Mesh(visGeo,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,stencilWrite:true,stencilRef:1,
  stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilFail:THREE.ReplaceStencilOp,side:THREE.DoubleSide}));
visMesh.renderOrder=999;visMesh.frustumCulled=false;scene.add(visMesh);
const fogScene=new THREE.Scene(),fogCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
fogScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:'#221c33',transparent:true,opacity:.48,depthTest:false,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:THREE.NotEqualStencilFunc})));
let fogOn=false;
const fogAng=[],fogPt=[];
function updFog(me){
  const x=me.x,y=me.y,A=fogAng;A.length=0;
  for(let i=0;i<VIS_N;i++)A.push(i/VIS_N*Math.PI*2-Math.PI);
  for(const o of obsOf(me.f)){if(!o.sight)continue;
    for(const[cx,cy]of[[o.x,o.y],[o.x+o.w,o.y],[o.x,o.y+o.h],[o.x+o.w,o.y+o.h]]){const dx=cx-x,dy=cy-y;if(dx*dx+dy*dy>VR*VR)continue;const a=Math.atan2(dy,dx);A.push(a-.0004,a,a+.0004);}}
  A.sort((p,q)=>p-q);const n=Math.min(A.length,VIS_MAX);
  for(let i=0;i<n;i++){const a=A[i],d=Math.min(VR,rayLen(me.f,x,y,a,VR)+8);fogPt[i*2]=x+Math.cos(a)*d;fogPt[i*2+1]=y+Math.sin(a)*d;}
  const p=visGeo.attributes.position.array;
  for(let i=0;i<n;i++){const j=(i+1)%n,k=i*9;
    p[k]=x*U;p[k+1]=.02;p[k+2]=y*U;
    p[k+3]=fogPt[i*2]*U;p[k+4]=.02;p[k+5]=fogPt[i*2+1]*U;
    p[k+6]=fogPt[j*2]*U;p[k+7]=.02;p[k+8]=fogPt[j*2+1]*U;}
  visGeo.setDrawRange(0,n*3);visGeo.attributes.position.needsUpdate=true;
}
const seenBy=(me,o)=>(ally(me,o)||!(G.smokes&&inSmoke(o)&&Math.hypot(o.x-me.x,o.y-me.y)>50))&&(!fogOn||me.intelT>0||ally(me,o)||(Math.hypot(o.x-me.x,o.y-me.y)<VR&&sightLos(me.f,me.x,me.y,o.x,o.y)));

/* aim arc around me */
const aimArc=new THREE.Group();{const m=new THREE.Mesh(new THREE.RingGeometry(.62,.82,24,1,-.45,.9),basic('#2b6cb0',{transparent:true,opacity:.75,depthWrite:false}));m.rotation.x=-Math.PI/2;aimArc.add(m);aimArc.userData.m=m;}
aimArc.position.y=.03;scene.add(aimArc);

/* ---------- screen <-> world ---------- */
const pv=new THREE.Vector3(),rc=new THREE.Raycaster(),ndc=new THREE.Vector2(),gplane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitV=new THREE.Vector3();
function scr(x,y,h){pv.set(x*U,h,y*U).project(cam3);if(pv.z>1||pv.z<-1)return null;return[(pv.x+1)/2*VW,(1-pv.y)/2*VH];}
function screenToWorld(cx,cy){ndc.set(cx/VW*2-1,-(cy/VH)*2+1);rc.setFromCamera(ndc,cam3);return rc.ray.intersectPlane(gplane,hitV)?{x:hitV.x/U,y:hitV.z/U}:{x:G.me.x,y:G.me.y};}
let mouse={x:0,y:0,t:-1e9};
cv.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')mouse={x:e.clientX,y:e.clientY,t:performance.now()};});
const aimAngle=a=>{if(a===G.me&&performance.now()-mouse.t<1500){const w=screenToWorld(mouse.x,mouse.y);return Math.atan2(w.y-a.y,w.x-a.x);}return autoAim(a);};

/* ---------- overlay helpers (screen space, drawn on the 2D canvas above the 3D view) ---------- */
/* a label whose anchor is on screen is nudged in so it isn't cut off at the edge (phones are narrow) */
const edgeX=(x,w)=>x<0||x>VW?x:Math.max(w/2+4,Math.min(VW-w/2-4,x));
function tag(x,y,text,bg,fg,size=12){
  ctx.font=F(800,size);const w=ctx.measureText(text).width+12*UIS;x=edgeX(x,w);ctx.fillStyle=bg;rr(x-w/2,y-10*UIS,w,19*UIS,6*UIS);ctx.fill();
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.fillText(text,x,y+4*UIS);ctx.textAlign='left';
}
/* name tag in a match: a chip in front of the name with the rank. One colour family: grey for 인턴, then a blue that
   gets richer with every promotion, so a higher rank reads as "more" without a rainbow */
const RANK_TIER={인턴:{g:['#a9b0b6','#8a929a']},사원:{g:['#97a8bb','#7a8ea6']},대리:{g:['#7f9ccc','#5f80b4']},
  팀장:{g:['#5f8ee0','#3d6cc4']},임원:{g:['#3f7cf0','#1f52c8']}};
const rankWord=a=>a.rank||'인턴';
function nameTag(x,y,name,a,bg,fg){
  const T=RANK_TIER[a.rank]||RANK_TIER.인턴,ch=rankWord(a);
  ctx.font=F(800,10);const s=UIS,cw=ctx.measureText(ch).width+8*s;ctx.font=F(800,12);const nw=ctx.measureText(name).width,w=nw+cw+14*s,h=19*s;x=edgeX(x,w);const l=x-w/2;
  ctx.fillStyle=bg;rr(l,y-10*s,w,h,6*s);ctx.fill();if(a===G.me){ctx.strokeStyle='#fbfaf6';ctx.lineWidth=1.5*s;ctx.stroke();} // me: a dark tag with a white rim
  const cx=l+2*s,cy=y-8*s,chh=h-4*s,gr=ctx.createLinearGradient(0,cy,0,cy+chh);T.g.forEach((c,i)=>gr.addColorStop(i/(T.g.length-1),c));
  ctx.fillStyle=gr;rr(cx,cy,cw,chh,4*s);ctx.fill();
  ctx.font=F(800,10);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(ch,cx+cw/2,y+3.5*s);
  ctx.font=F(800,12);ctx.fillStyle=fg;ctx.fillText(name,l+cw+(w-cw)/2,y+4*s);ctx.textAlign='left';
}
/* a 칭호: a red 도장 stamped over a name tag, a little crooked (the lobby and in a match) */
function titleStamp(x,y,title){
  const s=UIS;ctx.font=F(900,11);const w=ctx.measureText(title).width+14*s,h=17*s;x=edgeX(x,w);
  ctx.save();ctx.translate(x,y-21*s);ctx.rotate(-.05);ctx.fillStyle='#fbfaf6';rr(-w/2,-h/2,w,h,3*s);ctx.fill();ctx.strokeStyle='#c8283a';ctx.lineWidth=2*s;ctx.stroke();
  ctx.fillStyle='#c8283a';ctx.textAlign='center';ctx.fillText(title,0,4*s);ctx.restore();ctx.textAlign='left';
}
function outlined(t,x,y,font,color){ctx.font=font;x=edgeX(x,ctx.measureText(t).width+6);ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(251,250,246,.95)';ctx.strokeText(t,x,y);ctx.fillStyle=color;ctx.fillText(t,x,y);ctx.textAlign='left';}
const bubbleMemo=new Map(); // text+UIS -> {lines,w}: wrap + width don't change frame to frame
function bubble(text,x,y,color,alpha){
  ctx.font=F(800,13);const key=text+'|'+UIS;let memo=bubbleMemo.get(key);
  if(!memo){let lines=[text];
    if(ctx.measureText(text).width>220*UIS){const sp=[...text.matchAll(/ /g)].map(m=>m.index);   // long lines break at the space nearest the middle
      if(sp.length){const i=sp.reduce((b,v)=>Math.abs(v-text.length/2)<Math.abs(b-text.length/2)?v:b);lines=[text.slice(0,i),text.slice(i+1)];}}
    if(bubbleMemo.size>200)bubbleMemo.clear();bubbleMemo.set(key,memo={lines,w:Math.max(...lines.map(l=>ctx.measureText(l).width))+20});}
  const lines=memo.lines,w=Math.min(240*UIS,memo.w),h=(lines.length*16+10)*UIS,c=color&&color!=='#1d2328'?color:'#3d4a54';
  const ax=x;x=edgeX(x,w); // the tail stays over the speaker
  ctx.globalAlpha=alpha;ctx.fillStyle='rgba(255,255,255,.97)';rr(x-w/2,y-h,w,h,12);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(ax-7,y-1);ctx.lineTo(ax,y+8);ctx.lineTo(ax+7,y-1);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(ax-7,y);ctx.lineTo(ax,y+8);ctx.lineTo(ax+7,y);ctx.stroke();
  ctx.fillStyle='#1d2328';ctx.textAlign='center';lines.forEach((l,i)=>ctx.fillText(l,x,y-h+(i*16+18)*UIS,w-12));ctx.textAlign='left';ctx.globalAlpha=1;
}
function glyph(k,x,y,s){
  const it=ITEMS[k];ctx.fillStyle=it.c;rr(x-s/2,y-s/2,s,s,s*.24);ctx.fill();ctx.strokeStyle='#fbfaf6';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fbfaf6';ctx.font=F(800,it.g.length>1?s*.36:s*.52);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(it.g,x,y+1);ctx.textBaseline='alphabetic';ctx.textAlign='left';
}

/* ---------- main render ---------- */
const tmpV=new THREE.Vector3(),dirV=new THREE.Vector3(),fpEye=new THREE.Vector3(),fpLook=new THREE.Vector3(),fpQ=new THREE.Vector3();
let fpK=0,fpSeat=null; // first-person blend at my desk (0 = normal view) and the seat it looks from
function render(dt){
  if(!G||!G.me)return; // online: nothing to draw until the first snapshot
  UIS=Math.max(1,Math.min(1.5,VW/1400,VH/800));
  const me=G.me;
  const focus=me.alive?me:(specTarget()||leader()||me);if(focus.f>=0)viewF=focus.f;
  const f=viewF;
  if(builtF!==f)buildFloor(f);
  prewarmFloors();
  for(const fn of floorAnim)fn(dt);
  if(!isFinite(cam.x)||!isFinite(cam.y))cam={x:focus.x||FW/2,y:focus.y||FH/2}; // never let a bad frame strand the camera
  const k=Math.min(1,dt*7);cam.x+=(focus.x-cam.x)*k;cam.y+=(focus.y-cam.y)*k;
  const zoom=VW<VH?1.4:VW<700?1.15:1,sx=shake>0?(Math.random()-.5)*.35:0,sz=shake>0?(Math.random()-.5)*.35:0;
  cam3.position.set(cam.x*U+sx,16.5*zoom,cam.y*U+10.5*zoom+sz);
  /* at my desk the camera glides down into my eyes, looking at the monitor (the work itself is the #desk panel) */
  const fpOn=(running||G.plaza)&&me.alive&&!!me.desk&&!!me.sit&&me.f===f;if(fpOn)fpSeat=me.sit;
  fpK+=((fpOn?1:0)-fpK)*Math.min(1,dt*5);if(fpK<.002||!fpSeat||fpSeat.f!==f)fpK=0;
  if(fpK>0){const s=fpSeat,e=fpK*fpK*(3-2*fpK),dx=Math.cos(s.face),dy=Math.sin(s.face);
    fpEye.set((s.x-dx*6)*U,1.42,(s.y-dy*6)*U);fpLook.set((s.x+dx*64)*U,1.15,(s.y+dy*64)*U);
    cam3.position.lerp(fpEye,e);fpQ.set(cam.x*U,0,cam.y*U-.4).lerp(fpLook,e);cam3.lookAt(fpQ);}
  else cam3.lookAt(cam.x*U,0,cam.y*U-.4);
  followSun(cam.x*U,cam.y*U-1,(9+5*VW/VH)*zoom);
  /* dressing room: a close look at me in the free space beside the 사원증 card, measured from where the card really is
     (2026-10-30: phones cut my feet under the card, PC stood me far from it). Card on the right: I stand in the middle of the space left of it.
     Card below: the camera backs off until my whole body (with the name tag) fits the space above it */
  if(!(G.plaza&&typeof PZ!=='undefined'&&PZ.dress)&&!$('dRot').hidden)$('dRot').hidden=true;
  {const dressing=!!(G.plaza&&typeof PZ!=='undefined'&&PZ.dress);if(sun.castShadow===dressing)sun.castShadow=!dressing;}   // no sun shadows in the 사원증 close-up
  if(G.plaza&&typeof PZ!=='undefined'&&PZ.dress){const c=dressCard().getBoundingClientRect(),side=c.left>VW*.4;
    const z=PZ.dz=(PZ.dz||0)+((PZ.zoom||0)-(PZ.dz||0))*Math.min(1,dt*6);   // 얼굴·헤어 tabs: in close on the head
    if(side){cam3.position.set(me.x*U,2.1-z*.8,me.y*U+4.0-z*2.1);cam3.lookAt(me.x*U,.75+z*.45,me.y*U);cam3.setViewOffset(VW,VH,VW/2-c.left/2,0,VW,VH);}
    else{const H=Math.max(120,c.top-46),d=Math.min(10,Math.max(3,VH*1.95/(2*Math.tan(cam3.fov*Math.PI/360)*.9*H)))*(1-z*.55),ly=.95+z*.3;   // the strip under my feet is kept for the 돌려 보기 buttons
      cam3.position.set(me.x*U,ly+d*.29*(1-z*.6),me.y*U+d*.96);cam3.lookAt(me.x*U,ly,me.y*U);cam3.setViewOffset(VW,VH,0,VH/2-H/2,VW,VH);}
    /* the 돌려 보기 buttons sit under my feet, in the space beside / above the card */
    const rb=$('dRot'),show=CR.tab==='wear';if(rb.hidden===show)rb.hidden=!show;
    if(show){cam3.updateMatrixWorld();tmpV.set(me.x*U,0,me.y*U).project(cam3);   // my feet on screen
      const l=Math.round((tmpV.x+1)/2*VW),t=Math.round(Math.min((1-tmpV.y)/2*VH+30,(side?VH:c.top)-42));   // a pixel or two of drift is ignored: the buttons trembled on phones
      if(Math.abs(l-(parseFloat(rb.style.left)||0))>2)rb.style.left=l+'px';if(Math.abs(t-(parseFloat(rb.style.top)||0))>2)rb.style.top=t+'px';}}
  else if(G.plaza&&typeof PZ!=='undefined'&&PZ.cardH>0)cam3.setViewOffset(VW,VH,0,Math.min(VH*.3,PZ.cardH/2),VW,VH);
  else if(cam3.view&&cam3.view.enabled)cam3.clearViewOffset();
  const onFloor=me.alive&&me.f===f&&!me.transit;
  fogOn=onFloor&&!(G.blackout&&G.blackout.f===f)&&fpK<.05&&!(G.plaza&&typeof PZ!=='undefined'&&PZ.dress);   // the sight fog fell across the face in the 사원증 close-up

  /* fade walls that stand between the camera and me */
  let hits=null;
  if(onFloor&&fpK<.05){tmpV.set(me.x*U,1,me.y*U);rc.set(cam3.position,dirV.copy(tmpV).sub(cam3.position).normalize());const lim=cam3.position.distanceTo(tmpV);
    hits=new Set(rc.intersectObjects(wallMs,false).filter(h=>h.distance<lim).map(h=>h.object));}
  for(const w of wallMs){const tg=hits&&hits.has(w)?.2:1;w.material.opacity+=(tg-w.material.opacity)*Math.min(1,dt*10);w.material.depthWrite=w.material.opacity>.9;}
  for(const dm of doorMs){dm.closed.visible=!dm.d.open;dm.ow.visible=dm.d.open;}
  for(const sm of seatMs)sm.m.color.set(sm.s.owner===me?'#2b6cb0':'#30353c');

  /* drop meshes left over from a previous game */
  for(const[a,m]of actorM)if(!G.actors.includes(a)){scene.remove(m);actorM.delete(a);}
  for(const[n,m]of npcM)if(!G.npcs.includes(n)){scene.remove(m);npcM.delete(n);}
  /* actors */
  for(const a of G.actors){
    let m=actorM.get(a);if(!m){m=makeChar(a.color,null,a.id,a.fit?fitToOutfit(a.fit):null);if(a.statue)hallCast(m,a.statue);actorM.set(a,m);}
    const vis=a.alive&&a.f===f&&!a.transit&&(a===me||a.statue||seenBy(me,a))&&!(a.cloakT>0&&a!==me&&!ally(me,a))
      &&!(G.plaza&&PZ.dress&&a!==me&&Math.hypot(a.x-me.x,a.y-me.y)<150); // dressing room close-up: just me
    m.visible=vis&&!(a===me&&fpK>.3);if(!m.visible)continue;
    poseChar(m,a,dt,false);const u=m.userData;{const dressing=G.plaza&&typeof PZ!=='undefined'&&PZ.dress&&a===me;trailEmit(a,m,dt,dressing);if(dressing&&DR.cat==='fx')thrDemo(a,m,dt);}teamProp(m,a.branch&&TEAMS.includes(a.branch)?a.branch:null);
    setCloak(u,a.cloakT>0?.4:1);
    /* on the roof everyone wears their team colour (전담파 blue, 연초파 red) */
    const team=a.f===ROOF&&a.side?(a.side==='L'?'#4fa3e0':'#e0603d'):null;
    u.ring.visible=a.isPlayer||ally(me,a)||!!team;if(u.ring.visible)u.ring.material.color.set(team||(a===me?'#fbfaf6':ally(me,a)?'#3fbf6a':OTHER_HUMAN));
    const aura=a.ammo>0?CAT.atk.c:a.speedT>0?CAT.move.c:a.shieldN>0||a.vipT>0?CAT.def.c:null;
    u.aura.visible=!!aura;if(aura){u.aura.material.color.set(aura);u.aura.scale.setScalar(.8+Math.sin(G.t*6)*.06);}
    u.carry.visible=!!a.carry;
    /* hit: a white flash. Stunned (법카 회식) or held (면담 etc.): a fast amber blink for as long as it lasts */
    if(a.flash>0)u.bm.emissive.setScalar(Math.min(.55,a.flash*2));
    else if((a.stunT>0||a.lockT>0)&&Math.sin(G.t*22)>0)u.bm.emissive.setRGB(.6,.42,.05);
    else u.bm.emissive.setScalar(0);
    {const mad=a.alive&&a.g<30;if(u.mood.angry.visible!==mad){u.mood.angry.visible=mad;u.mood.happy.visible=!mad;}}   // same red line as the 고과 bar
  }
  trailStep(dt);
  /* npcs + cones */
  const npcs=G.npcs.filter(n=>n.f===f&&npcActive(n));
  for(const n of G.npcs){let m=npcM.get(n);if(!m&&n.kind==='desk'){const k=parseInt(String(n.id).slice(1))||0;m=makeChar(EXTRA_COLORS[k%EXTRA_COLORS.length],null,1000+k);npcM.set(n,m);}
    if(!m){const col=n.senior?'#2b2f3a':{boss:'#55617a',ceo:'#2a2a2e',cleaner:'#9fb7ad',busy:'#7d8790',newbie:'#bfe3c8',courier:'#b5651d',cart:'#fbfaf6',late:'#5b6fa8'}[n.kind]||'#7d8790';m=makeChar(col,n.kind,7,isHawawa(n)?{...outfitFor('newbie',7,col),hair:{style:'short',color:'#26305c'}}:n.kind==='guide'?fitToOutfit(GUIDE_FIT):undefined);if(n.kind==='ceo')m.scale.setScalar(1.12);else if(n.senior)m.scale.setScalar(1.06);npcM.set(n,m);}
    m.visible=npcs.includes(n);if(!m.visible)continue;
    if(n.kind==='desk'){m.position.set(n.x*U,0,n.y*U);m.rotation.y=toYaw(n.face);poseRig(m.userData,'sit',dt);}else poseChar(m,n,dt,true);}
  /* an 임원 doesn't have to greet a plain 부장님, so their cones are just clutter (전무님 and 대표님 still count) */
  const exempt=n=>n.kind==='boss'&&!n.senior&&me.rank==='임원';
  const coneList=G.blackout&&G.blackout.f===f?[]:npcs.filter(n=>VIS[n.kind]&&!exempt(n)&&!n.caught);
  syncSet(coneM,coneList,makeCone,updCone);
  /* items, traps, wet, tasks, drops */
  syncSet(itemM,G.items.filter(i=>i.f===f),makeItem,(it,m)=>{m.position.set(it.x*U,.5+Math.sin(G.t*4+it.x)*.07,it.y*U);m.children[0].rotation.y+=dt*1.4;m.children[1].scale.setScalar(1+Math.sin(G.t*4+it.x)*.14);});
  syncSet(trapM,G.traps.filter(t=>t.f===f),()=>flatDisc('#6b4a2e',.6),(t,m)=>{m.scale.set(26*U,17*U,1);m.position.set(t.x*U,.025,t.y*U);});
  syncSet(wetM,G.wet.filter(w=>w.f===f),puddle,(w,m)=>{const k=Math.min(1,.55+w.t*1.5)*120*U;m.scale.set(k,k,1);m.position.set(w.x*U,.022,w.y*U);m.material.opacity=Math.min(1,(18-w.t)/3)*.75;},m=>m.material.dispose()); // spreads out as it lands
  syncSet(taskM,G.tasks.filter(t=>t.f===f),makeTask,(t,m)=>{const c=t.by===me?(t.ready?'#2f9e57':'#4f93e0'):t.by?'#9aa3ab':t.ready?'#2f9e57':'#f3d77a';for(const ch of m.children)ch.material.color.set(c);});
  syncSet(dropM,G.drops.filter(d=>d.f===f),()=>{const m=new THREE.Mesh(GEO.box,lam('#fbfaf6'));m.scale.set(.32,.05,.42);m.castShadow=true;return m;},(d,m)=>{m.position.set(d.x*U,.04,d.y*U);m.rotation.y=.3;});
  if(G.cake&&G.cake.f===f){if(!cakeM){cakeM=new THREE.Group();const b=new THREE.Mesh(GEO.cyl,lam('#f6d3dc'));b.scale.set(.38,.32,.38);b.position.y=.16;b.castShadow=true;cakeM.add(b);
      const c=new THREE.Mesh(GEO.cyl,lam('#cf3626',{emissive:'#cf3626',emissiveIntensity:.5}));c.scale.set(.04,.22,.04);c.position.y=.43;cakeM.add(c);scene.add(cakeM);}
    cakeM.visible=true;cakeM.position.set(G.cake.x*U,0,G.cake.y*U);}else if(cakeM)cakeM.visible=false;
  /* projectiles, bursts, airdrops */
  syncSet(projM,G.proj.filter(p=>p.f===f),makeProj,(p,m)=>{m.position.set(p.x*U,1.0,p.y*U);m.rotation.y=p.bundle?p.d/40:p.staple||m.userData.aim?toYaw(Math.atan2(p.dy,p.dx)):p.spin;if(m.userData.tumble)m.rotation.x=p.spin;if(m.userData.kids)for(const c of m.userData.kids)c.rotation.y=p.spin;});
  syncSet(burstM,G.bursts.filter(b=>b.f===f),makeBurst,(b,m)=>{const kk=b.t/.5;m.scale.setScalar((20+kk*80)*U);m.position.set(b.x*U,.05,b.y*U);m.material.opacity=Math.max(0,1-kk);});
  syncSet(smokeM,(G.smokes||[]).filter(s=>s.f===f),s=>{const g=new THREE.Group(),col=s.side==='L'?'#e3eef7':'#c9c4bd';
      for(let i=0;i<7;i++){const b=new THREE.Mesh(GEO.sph,basic(col,{transparent:true,opacity:.5,depthWrite:false}));const a=i/7*6.28;b.position.set(i?Math.cos(a)*.55:0,.5+(i%3)*.25,i?Math.sin(a)*.55:0);b.userData.ph=a;g.add(b);}return g;},
    (s,m)=>{const k=Math.min(1,s.t/.6),out=Math.max(0,Math.min(1,(s.life-s.t)/1.2)),R=s.r*U;m.position.set(s.x*U,0,s.y*U);
      m.children.forEach((b,i)=>{b.scale.setScalar(R*(.45+.15*Math.sin(G.t*1.5+b.userData.ph))*k);b.material.opacity=.62*out;});m.rotation.y+=dt*.15;});
  syncSet(airM,f===ROOF&&G.airdrops?G.airdrops:[],makeAir,(d,m)=>{const kk=Math.min(1,d.t/1.2);m.position.set(d.x*U,(1-kk)*8,d.y*U);m.userData.chute.visible=kk<1;});
  /* visitor knocking at the front door */
  const dv=f!==ROOF&&G.doors[f]&&G.doors[f].v;visitor.visible=!!dv;if(dv){visitor.position.set((DOOR.x+(dv.type==='interview'?Math.sin(G.t*10)*2:0))*U,.55,(FH+26)*U);}
  /* aim arc */
  const canAim=running&&onFloor&&!me.sit&&!locked(me)&&!me.chan;
  let aimA=me.face,aimT=null,aimStrong=false;
  if(canAim){const mouseOn=performance.now()-mouse.t<1500;
    if(mouseOn){const w=screenToWorld(mouse.x,mouse.y);aimA=Math.atan2(w.y-me.y,w.x-me.x);aimT={x:w.x,y:w.y,t:null};aimStrong=true;}
    else{const t=nearest(me,340,true);if(t){aimA=Math.atan2(t.y-me.y,t.x-me.x);aimT={x:t.x,y:t.y,t};aimStrong=true;}}}
  aimArc.visible=canAim;if(canAim){aimArc.position.set(me.x*U,.03,me.y*U);aimArc.rotation.y=-aimA;aimArc.userData.m.material.color.set(me.ammo>0?'#e5483a':'#2b6cb0');aimArc.userData.m.material.opacity=aimStrong?.85:.45;}
  /* fog + draw */
  visMesh.visible=fogOn;if(fogOn)updFog(me);
  sun.intensity=G.blackout&&G.blackout.f===f?.3:SUN;
  gl.clear(true,true,true);gl.render(scene,cam3);if(fogOn)gl.render(fogScene,fogCam);

  /* ================= overlay ================= */
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,VW,VH);
  if(me.alive&&me.transit){
    ctx.fillStyle='#3a4249';ctx.fillRect(0,0,VW,VH);ctx.fillStyle='#c3c9cd';ctx.fillRect(VW/2-90,VH/2-110,88,220);ctx.fillRect(VW/2+2,VH/2-110,88,220);
    txt(me.transit.to===ROOF?'▲ 옥상':`▲ ${FLOORS[me.transit.to].short}`,VW/2,VH/2-130,DF(34),'#f3d77a','center');txt('엘리베이터 이동 중',VW/2,VH/2+145,F(800,14),'#fbfaf6','center');return;
  }
  if(fpK>.5){juiceOverlay(f);return;}
  for(const st of staticTags){const s=scr(st.x,st.y,st.h);if(s)outlined(st.t,s[0],s[1],F(800,st.small?11:13),'rgba(29,35,40,.75)');}
  if(f!==ROOF){const p=PADS.elev;const s=scr(p.x,p.y-34,2.6);if(s)outlined(G.fire>0?'운행 정지':'▲▼',s[0],s[1],F(800,13),G.fire>0?'#cf3626':'#1d2328');
    for(const d of G.dings)if(d.f===f){const s2=scr(p.x,p.y,2.8+d.t);if(s2)outlined('띵!',s2[0],s2[1],DF(22),'#c08a1e');}
    if(dv){const s=scr(DOOR.x,FH,2.2);if(s){if(Math.sin(G.t*6+dv.ph)>0)outlined(dv.type==='sales'?'똑똑똑!':'똑똑',s[0]+44,s[1],DF(18),'#1d2328');
      ctx.fillStyle='#cf3626';ctx.fillRect(s[0]-30,s[1]+8,60*(1-dv.t/20),4);}}}
  /* the stall: a sign over the toilet, or how long until my phone is charged again */
  {const sp=f!==ROOF&&FLOORS[f].spots.toilet;if(sp&&!(me.wc&&me.f===f)){const p=scr(sp.x,sp.y,1.5);if(p){const busy=G.actors.some(o=>o.wc&&o.f===f);
    tag(p[0],p[1],busy?'🚽 사용 중':me.wcCd>0?`🚽 폰 충전 중 ${Math.ceil(me.wcCd)}초`:'🚽 화캉스 즐기기',busy||me.wcCd>0?'rgba(93,102,110,.9)':'#2f9e57','#fbfaf6',11);}}}
  for(const sm of seatMs){const s=sm.s;if(s.owner===me&&s.occ!==me){const p=scr(s.x,s.y,1.25);if(p)tag(p[0],p[1],'내 자리','#2b6cb0','#fbfaf6',11);}}
  for(const t of G.tasks){if(t.f!==f)continue;
    const ix=t.kind==='copy'||t.kind==='print'?t.x+K(52):t.x,iy=t.zone?t.y:t.y-30;const p=scr(ix,iy,1.7+Math.sin(G.t*4+t.id)*.08);if(!p)continue;
    /* whose task it is: mine glows blue with a big ring and a percentage, someone else's is greyed out with their name */
    const mine=t.by===me,other=t.by&&!mine,dbl=warnFloor(f),rad=mine?16:13;
    if(mine&&!t.ready){ctx.beginPath();ctx.arc(p[0],p[1],rad+9,0,7);ctx.fillStyle='rgba(43,108,176,.18)';ctx.fill();}
    ctx.beginPath();ctx.arc(p[0],p[1],rad,0,7);ctx.fillStyle=t.ready?'#2f7d4f':other?'#c9cfd4':mine?'#cfe3fb':'#f3d77a';ctx.fill();ctx.strokeStyle=mine?'#2b6cb0':'#1d2328';ctx.lineWidth=mine?3:2;ctx.stroke();
    if(t.prog>0&&!t.ready){ctx.beginPath();ctx.arc(p[0],p[1],rad+5,-Math.PI/2,-Math.PI/2+t.prog*Math.PI*2);ctx.strokeStyle=mine?'#2b6cb0':other?'#7d868e':'#2f7d4f';ctx.lineWidth=mine?6:4;ctx.lineCap='round';ctx.stroke();ctx.lineCap='butt';}
    if(t.ready||!mine)txt(t.ready?'✓':'!',p[0],p[1]+6,DF(17),t.ready?'#fbfaf6':'#1d2328','center'); // mine: the blue ring is the whole read-out
    if(mine)tag(p[0],p[1]-30,t.ready?'내 업무 · 제출!':`내 업무 · ${t.name}`,'#2b6cb0','#fbfaf6',12);
    else if(other)outlined(`${t.by.name} 진행 중`,p[0],p[1]-22,F(800,11),'rgba(93,102,110,.95)');
    else outlined(`${t.name} +${t.reward*(dbl?2:1)}`,p[0],p[1]-22,F(800,11),dbl?'#cf3626':'rgba(29,35,40,.85)');}
  for(const d of G.drops){if(d.f!==f)continue;const p=scr(d.x,d.y,.3);if(p)outlined('출력물',p[0],p[1]+18,F(800,10),'rgba(29,35,40,.8)');}
  if(G.cake&&G.cake.f===f){const p=scr(G.cake.x,G.cake.y,.2);if(p)outlined('생일 케이크 +8',p[0],p[1]+22,F(800,11),'#cf3626');}
  for(const it of G.items){if(it.f!==f)continue; // the 3D model shows what it is; just the name under it
    const q=scr(it.x,it.y,0);if(q)outlined(ITEMS[it.k].n,q[0],q[1]+22,F(800,10),'rgba(29,35,40,.85)');}
  for(const t of G.traps)if(t.f===f&&t.o===me){const p=scr(t.x,t.y,0);if(p)outlined('내 함정',p[0],p[1]+4,F(800,10),CAT.ctl.c);}
  /* aim dots + reticle */
  if(canAim&&aimStrong&&aimT){
    const col=me.ammo>0?'229,72,58':'43,108,176',len=Math.min(me.ammo>0?300:340,Math.hypot(aimT.x-me.x,aimT.y-me.y));
    for(let d=R+30;d<len-14;d+=22){const kk=1-d/len,p=scr(me.x+Math.cos(aimA)*d,me.y+Math.sin(aimA)*d,.05);if(!p)continue;ctx.fillStyle=`rgba(${col},${.2+.45*kk})`;ctx.beginPath();ctx.arc(p[0],p[1],2.4+1.6*kk,0,7);ctx.fill();}
    const p=scr(aimT.x,aimT.y,aimT.t?.6:.02);if(p){const rad=aimT.t?24:11,spin=G.t*1.5;ctx.strokeStyle=`rgba(${col},.95)`;ctx.lineWidth=2.5;
      for(let i=0;i<4;i++){const b=spin+i*Math.PI/2;ctx.beginPath();ctx.arc(p[0],p[1],rad,b+.25,b+Math.PI/2-.25);ctx.stroke();}
      ctx.fillStyle=`rgba(${col},.95)`;ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,7);ctx.fill();}
  }
  /* actor labels */
  for(const a of G.actors){const m=actorM.get(a);if(!m||!m.visible)continue;
    const dressing=G.plaza&&a===me&&typeof PZ!=='undefined'&&PZ.dress,p=scr(a.x,a.y,(dressing?1.5:1.75)+(a.lift||0));if(!p)continue;const x=p[0],y=dressing?Math.max(p[1],48*UIS):p[1];   // 사원증 close-up: closer to me and never off the top, 칭호 included
    if(G.plaza){const nm=a===me?(store.get('or-name')||a.name):a.name,bg=a===me?'#2b6cb0':a.isPlayer?OTHER_HUMAN:'rgba(251,250,246,.94)',fg=a===me||a.isPlayer?'#fbfaf6':'#1d2328';tag(x,y-12,nm,bg,fg);}
    else nameTag(x,y-12,a===me?'나':a.name,a,a===me?'#1d2328':a.isPlayer?OTHER_HUMAN:'rgba(251,250,246,.94)',a===me||a.isPlayer?'#fbfaf6':'#1d2328');
    {const ttl=a.fit&&titleOf(a.fit.title);if(ttl)titleStamp(x,y-12,ttl);}
    if(G.plaza&&a.room){const near=a!==me&&!isTouch&&!NETC.room&&pzNear()===a;tag(x,y-36,`${a===me?'내 방':'같이 하기'} ${a.room[0]} · ${a.room[1]}/${ROOM_MAX}${near?' · E 참가':''}`,'#f3d77a','#1d2328',12);}
    if(!G.plaza){ctx.fillStyle='#1d2328';ctx.fillRect(x-18,y+1,36,5);ctx.fillStyle=a.g<30?'#cf3626':'#2f7d4f';ctx.fillRect(x-17,y+2,34*Math.max(0,a.g)/100,3);}
    if(a.items.length&&a!==me)glyph(a.items[0],x+28,y-12,14);
    if(a.f===ROOF&&a.side)outlined(`${teamOf(a.side)}${a.lighter>0?` · 라이터 ${a.lighter}`:''}`,x,y+20,F(800,11),a.side==='L'?'#2b7fc4':'#c0452a');
    if(a.f===ROOF&&a.bill)tag(x,y-38,a===me?'🧾 내가 계산서!':'🧾 계산서','#cf3626','#fbfaf6',12);
    if(a.ammo>0&&a===me){const q=scr(a.x,a.y,0);if(q)outlined(`스테이플 ${a.ammo}`,q[0],q[1]+26,F(800,10),'#3f6f99');}
    const st=a.stunT>0?'회식 중':a.lockT>0?a.lockWhy:a.call?'호출당함':a.working?'근무 중 · 못 건드림':'';
    if(st)outlined(st,x,y-30,F(800,12),'#c08a1e');
    if(G.star&&G.star.a===a)outlined('★ 우수사원',x,y-(st?48:30),DF(16),'#c08a1e');
    if(a.chan){const q=scr(a.x,a.y,.05);if(q){const kk=1-a.chan.t/a.chan.max;ctx.beginPath();ctx.arc(q[0],q[1],28,-Math.PI/2,-Math.PI/2+kk*Math.PI*2);ctx.strokeStyle=a===me?'#4f93e0':'#f3d77a';ctx.lineWidth=5;ctx.stroke();
      outlined(a.chan.max-a.chan.t<a.chan.tag?'사원증 태그':'이동 중',q[0],q[1]+44,F(800,10),'#1d2328');}}
  }
  /* lobby: what E (the 💬 button on phones) does right here */
  if(G.plaza&&PZ.boardNew&&!PZ.dress&&!(pzTarget()||{}).board){const b=FLOORS[0].spots.board,p=b&&scr(b.x,8,2.55);if(p)tag(p[0],p[1]-10+(reduceMotion?0:Math.sin(G.t*4)*3),'NEW!','#cf3626','#fbfaf6',13);}
  if(G.plaza){const t=pzTarget();if(t&&!t.quiet){const p=scr(t.x,t.y,1.9);if(p)tag(p[0],p[1]-(t.bot?34:14),isTouch?t.label:`E ${t.label}`,'#1d2328','#fbfaf6');}}
  /* npc labels */
  for(const n of npcs){const p=scr(n.x,n.y,n.kind==='ceo'?2.0:1.8);if(!p)continue;
    if(n.kind==='desk'){if(n.ask&&n.job){tag(p[0],p[1]-6,`부탁 있어요 +${n.job.r}`,'#3f6f99','#fbfaf6');outlined('!',p[0],p[1]-26,DF(26),'#3f6f99');}continue;}
    const lbl={boss:n.senior?'전무님':'부장님',ceo:'대표님',cleaner:'청소 아주머니',busy:'옆팀 팀장',newbie:isHawawa(n)?'신입 하와와':'신입 인턴',courier:'택배 기사',cart:'커피카트',guide:'안내원',late:'지각한 대리'}[n.kind];
    tag(p[0],p[1]-6,lbl,n.senior?'#7a1f17':{boss:'#cf3626',ceo:'#c08a1e',newbie:'#3f8f5f',courier:'#b5651d',cart:'#7a4b2a',guide:'#2b4a6b',late:'#b5651d'}[n.kind]||'#5d666e','#fbfaf6');
    if(n.kind==='cart')outlined('고과 70까지 회복',p[0],p[1]+18*UIS,F(700,10),'#7a4b2a');
    if(n.kind==='newbie'&&n.att)outlined('?',p[0]+18,p[1]-24,DF(24),'#3f8f5f');
    if(me.contact&&me.contact.n===n){const kk=me.contact.t/me.contact.max;outlined('!',p[0],p[1]-26,DF(30),'#cf3626');ctx.beginPath();ctx.arc(p[0],p[1]-36,16,-Math.PI/2,-Math.PI/2+kk*Math.PI*2);ctx.strokeStyle='#cf3626';ctx.lineWidth=3;ctx.stroke();}
    if(n.alert)outlined('?',p[0]+18,p[1]-24,DF(24),'#c08a1e');
  }
  /* blackout */
  if(G.blackout&&G.blackout.f===f){
    ctx.save();ctx.beginPath();ctx.rect(0,0,VW,VH);
    if(me.alive&&me.f===f){const c=scr(me.x,me.y,.5),e=scr(me.x+140,me.y,.5);if(c&&e)ctx.arc(c[0],c[1],Math.abs(e[0]-c[0]),0,Math.PI*2,true);}
    ctx.fillStyle='rgba(8,10,14,.86)';ctx.fill('evenodd');ctx.restore();
    txt('정전',VW/2,120,DF(32),'rgba(243,215,122,.85)','center');
  }
  if(f<G.closed){
    const pulse=.5+.5*Math.sin(G.t*4);ctx.fillStyle=`rgba(200,30,20,${.16+.08*pulse})`;ctx.fillRect(0,0,VW,VH);
    const gr=ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.3,VW/2,VH/2,Math.max(VW,VH)*.75);gr.addColorStop(0,'rgba(200,30,20,0)');gr.addColorStop(1,`rgba(200,30,20,${.45+.2*pulse})`);ctx.fillStyle=gr;ctx.fillRect(0,0,VW,VH);
  }else if(warnFloor(f)){const a=.35+.35*(Math.sin(G.t*9)*.5+.5);ctx.strokeStyle=`rgba(207,54,38,${a})`;ctx.lineWidth=14;ctx.strokeRect(7,7,VW-14,VH-14);}
  /* I'm stunned or held: the screen edge blinks amber, like the red edge when I'm hit */
  if(me.alive&&me.f===f&&(me.stunT>0||me.lockT>0)){const a=Math.sin(G.t*22)>0?.55:.18;ctx.strokeStyle=`rgba(224,181,42,${a})`;ctx.lineWidth=18;ctx.strokeRect(9,9,VW-18,VH-18);}
  if(me.intelT>0&&me.alive){
    for(const o of G.actors){if(o===me||!o.alive||o.f!==f)continue;const p=scr(o.x,o.y,.6);if(!p)continue;
      if(p[0]>16&&p[0]<VW-16&&p[1]>110&&p[1]<VH-150){ctx.strokeStyle='rgba(229,72,58,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p[0],p[1],26,0,7);ctx.stroke();continue;}
      const cx=Math.max(22,Math.min(VW-22,p[0])),cy2=Math.max(120,Math.min(VH-160,p[1])),a=Math.atan2(p[1]-VH/2,p[0]-VW/2);
      ctx.fillStyle='#e5483a';ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*12,cy2+Math.sin(a)*12);ctx.lineTo(cx+Math.cos(a+2.4)*10,cy2+Math.sin(a+2.4)*10);ctx.lineTo(cx+Math.cos(a-2.4)*10,cy2+Math.sin(a-2.4)*10);ctx.fill();}
  }
  /* floating numbers pop in big and settle */
  for(const p of G.pops){if(p.f!==f||p.say)continue;const s=scr(p.x,p.y,1.9+p.t*1.2);if(!s)continue;ctx.globalAlpha=Math.max(0,1-p.t/1.1);
    outlined(p.text,s[0],s[1],F(800,Math.round(15*(p.t<.12?1.6-p.t/.12*.6:1))),p.color);ctx.globalAlpha=1;}
  /* tutorial: a bouncing arrow over whatever the current step is about */
  if(typeof TUT!=='undefined'&&TUT.on&&TUT.target&&(TUT.target.f??f)===f){const t=TUT.target,p=scr(t.x,t.y,2.6+Math.sin(G.t*5)*.18);
    if(p){ctx.fillStyle='#f3d77a';ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-16,p[1]-22);ctx.lineTo(p[0]+16,p[1]-22);ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.stroke();}}
  /* a favour in progress: a blue arrow over where to go next */
  if(me.errand&&me.errand.f===f){const e=me.errand,p=scr(e.step?e.bx:e.tx,e.step?e.by:e.ty,2.4+Math.sin(G.t*5)*.18);
    if(p){ctx.fillStyle='#5b8fd6';ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-14,p[1]-20);ctx.lineTo(p[0]+14,p[1]-20);ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.stroke();
      outlined(e.step?'전달하기':e.go,p[0],p[1]-28,F(800,12),'#2b5a99');}}
  /* leaving now (my floor closing, closed, or lunch): bouncing markers over both pads, edge arrows if they're off screen */
  if(me.alive&&me.f===f&&f!==ROOF&&!me.transit&&running&&!G.tutorial&&(f<G.closed||warnFloor(f))){ // (lunch needs no pad: 상호작용 goes up from anywhere)
    const col='#cf3626';
    for(const k in PADS){if(k==='elev'&&G.fire>0)continue;const pd=PADS[k],p=scr(pd.x,pd.y,2.2+Math.sin(G.t*6)*.2);if(!p)continue;
      const name=k==='stair'?'▲ 계단':'▲ 엘리베이터';
      if(p[0]>20&&p[0]<VW-20&&p[1]>60&&p[1]<VH-60){ctx.fillStyle=col;ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-18,p[1]-24);ctx.lineTo(p[0]+18,p[1]-24);ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.stroke();
        tag(p[0],p[1]-38,name,col,'#fbfaf6',12);continue;}
      const a=Math.atan2(p[1]-VH/2,p[0]-VW/2),ex=Math.max(30,Math.min(VW-30,p[0])),ey=Math.max(90,Math.min(VH-110,p[1]));
      ctx.save();ctx.translate(ex,ey);ctx.rotate(a);ctx.fillStyle=col;ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-10,-14);ctx.lineTo(-10,14);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      tag(ex-Math.cos(a)*44,ey-Math.sin(a)*26,k==='stair'?'계단':'엘리베이터',col,'#fbfaf6',11);}
  }
  /* speech bubbles follow whoever is talking; hidden while the speaker is out of sight */
  for(const p of G.pops){if(!p.say||p.f!==f)continue;
    let x=p.x,y=p.y;
    if(p.by!=null){const sp=typeof p.by==='string'?G.npcs.find(n=>n.id===p.by):G.actors.find(a=>a.id===p.by);
      if(sp){const m=(typeof p.by==='string'?npcM:actorM).get(sp);if(m&&!m.visible)continue;if(sp.f!==f)continue;x=sp.x;y=sp.y;}}
    const s=scr(x,y,1.75);if(!s)continue;
    const L=p.life||2.4,a=p.t<.12?p.t/.12:p.t>L-.4?Math.max(0,(L-p.t)/.4):1;bubble(p.text,s[0],s[1]-40,p.color,a);}
  /* lunch: my team's ashtrays are marked; carrying lighters, an arrow points to the nearest one */
  if(f===ROOF&&G.lunch&&me.alive&&me.f===ROOF&&me.side){const col=me.side==='L'?'#2b7fc4':'#c0452a',ash=ashOf(me.side);
    for(const a of ash){const p=scr(a.x,a.y,2.2);if(p)tag(p[0],p[1],'🔥 우리 재떨이',col,'#fbfaf6',11);}
    if(me.lighter>0){const a=ash.sort((p,q)=>Math.hypot(p.x-me.x,p.y-me.y)-Math.hypot(q.x-me.x,q.y-me.y))[0],p=a&&scr(a.x,a.y,2.9+Math.sin(G.t*6)*.2);
      if(p&&p[0]>20&&p[0]<VW-20&&p[1]>60&&p[1]<VH-60){ctx.fillStyle=col;ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-16,p[1]-22);ctx.lineTo(p[0]+16,p[1]-22);ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.stroke();}
      else if(p){const an=Math.atan2(p[1]-VH/2,p[0]-VW/2),ex=Math.max(30,Math.min(VW-30,p[0])),ey=Math.max(90,Math.min(VH-110,p[1]));
        ctx.save();ctx.translate(ex,ey);ctx.rotate(an);ctx.fillStyle=col;ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-10,-14);ctx.lineTo(-10,14);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
        tag(ex-Math.cos(an)*50,ey-Math.sin(an)*26,'우리 재떨이',col,'#fbfaf6',11);}}}
  /* special-meal lunch: the serving counter's ring on the floor, an arrow at the screen edge when it's out of view */
  if(f===ROOF&&G.lunch&&G.lunch.kind==='meal'&&G.lunch.zone){const z=G.lunch.zone,r=LUNCH.meal.r,mine=me.f===ROOF&&Math.hypot(me.x-z.x,me.y-z.y)<r;
    ctx.beginPath();for(let i=0;i<=32;i++){const an=i/32*Math.PI*2,q=scr(z.x+Math.cos(an)*r,z.y+Math.sin(an)*r,.04);if(!q)continue;i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);}
    ctx.fillStyle=`rgba(243,215,122,${.22+.08*Math.sin(G.t*5)})`;ctx.fill();ctx.strokeStyle=mine?'#2f7d4f':'#c08a1e';ctx.lineWidth=4;ctx.setLineDash([10,7]);ctx.stroke();ctx.setLineDash([]);
    const p=scr(z.x,z.y,1.2);
    if(p&&p[0]>20&&p[0]<VW-20&&p[1]>60&&p[1]<VH-60)tag(p[0],p[1],`🍱 오늘의 특식${G.lunch.crowd>1?` · ${G.lunch.crowd}명`:''}`,'#c08a1e','#1d2328',13);
    else if(p&&me.f===ROOF){const an=Math.atan2(p[1]-VH/2,p[0]-VW/2),ex=Math.max(30,Math.min(VW-30,p[0])),ey=Math.max(90,Math.min(VH-110,p[1]));
      ctx.save();ctx.translate(ex,ey);ctx.rotate(an);ctx.fillStyle='#f3d77a';ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-10,-14);ctx.lineTo(-10,14);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      tag(ex-Math.cos(an)*50,ey-Math.sin(an)*26,'배식대','#c08a1e','#1d2328',11);}}
  /* the roof during lunch is a haze of smoke */
  if(f===ROOF&&G.lunch){ctx.fillStyle='rgba(225,228,232,.13)';ctx.fillRect(0,0,VW,VH);
    for(let i=0;i<6;i++){const cx=VW*(.15+.14*i)+Math.sin(G.t*.2+i)*60,cy=VH*(.3+.4*((i*37)%10)/10)+Math.cos(G.t*.15+i*2)*40,r=Math.max(VW,VH)*.22;
      const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,r);gr.addColorStop(0,'rgba(235,238,241,.16)');gr.addColorStop(1,'rgba(235,238,241,0)');ctx.fillStyle=gr;ctx.fillRect(cx-r,cy-r,r*2,r*2);}}
  juiceOverlay(f);
}
