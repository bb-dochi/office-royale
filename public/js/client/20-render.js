/* ================= render ================= */
/* ================= 3D quarter-view renderer ================= */
/* Game logic stays in 2D pixel space (x right, y down). The scene maps px -> world units: X=x*U, Z=y*U, Y is up. */
const F=(w,s)=>`${w>=800?700:w} ${s+1}px 'Noto Sans KR','Apple SD Gothic Neo',sans-serif`;
const DF=s=>`900 ${s}px 'Noto Sans KR','Apple SD Gothic Neo',sans-serif`;
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function txt(t,x,y,font,color,align='left'){ctx.font=font;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(t,x,y);ctx.textAlign='left';}
const U=1/36,W3=FW*U,D3=FH*U,WALL_H=2.4;
const gl=new THREE.WebGLRenderer({antialias:true,stencil:true});
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
/* decorative coworkers typing at seats nobody in the match owns (visual only: no collision, can't be hit) */
let extras=[];
const EXTRA_COLORS=['#4f7c99','#8e6c8a','#6f8f3a','#b0803a','#5b6fa8','#a35d7a','#3f8f8f','#c46b6b'];
function buildExtras(f,fl){
  extras=[];
  if(f===ROOF||f===0)return;
  /* free seats first, then seats whose owner may drop out later */
  const order=fl.seats.map((s,i)=>[s,i]).sort((p,q)=>(!!p[0].owner-!!q[0].owner)||((p[1]*7)%5-(q[1]*7)%5));
  order.forEach(([s,i])=>{if(extras.length>=6)return;
    const m=makeChar(EXTRA_COLORS[(i+f)%EXTRA_COLORS.length],null,1000+f*100+i);m.position.set(s.x*U,0,s.y*U);m.rotation.y=toYaw(s.face);m.visible=false;
    m.userData.walk=i*1.3;extras.push({s,m});});
}
/* Building a floor takes ~90 ms (big canvas texture + mesh merging), which showed up as a hitch on every floor change.
   Built floors are cached (most recent FLOOR_KEEP) and the floors you are likely to visit next are built in idle time. */
const FLOOR_KEEP=4,FC=new Map();
const floorState=()=>({g:floorGroup,f:builtF,wallMs,doorMs,seatMs,staticTags,floorAnim,extras,bg:scene.background});
function applyFloor(c){
  if(floorGroup&&floorGroup!==c.g){floorGroup.visible=false;for(const e of extras)e.m.visible=false;}
  ({g:floorGroup,f:builtF,wallMs,doorMs,seatMs,staticTags,floorAnim,extras}=c);scene.background=c.bg;floorGroup.visible=true;c.used=performance.now();
}
function dropFloor(c){scene.remove(c.g);disposeGroup(c.g);for(const e of c.extras)scene.remove(e.m);}
function getFloor(f){
  let c=FC.get(f);
  if(!c){const prev=floorGroup?floorState():null;makeFloor(f);c=floorState();FC.set(f,c);if(prev&&prev.g!==c.g){c.g.visible=false;for(const e of c.extras)e.m.visible=false;applyFloor(prev);}
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
  scene.background=new THREE.Color(f===ROOF?'#9fc6e0':'#2a3036');extras=[];
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
  for(const s of fl.seats){
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
  buildExtras(f,fl);
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
    case 'pillar':{const m=bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#e9e6df',transparent:true,opacity:1})));wallMs.push(m);break;}
    case 'sofa':{bx(g,x,y,w,h,0,.42,lam('#7d5b4a'));bx(g,x,y,w,10,.42,.45,lam('#6d4e3f'));break;}
    case 'gate':{bx(g,x,y,w,h,0,1.0,lam('#9aa3ab'));bx(g,mx-4,y+3,8,8,1.0,.04,lam('#2f7d4f',{emissive:'#2f7d4f',emissiveIntensity:.6}),false);break;}
    case 'table':{bx(g,x,y,w,h,.7,.05,lam('#a8865f'));bx(g,x+2,y+2,w-4,h-4,.66,.04,lam('#8c6d4a'),false);for(const[lx,ly]of[[x+6,y+6],[x+w-10,y+6],[x+6,y+h-10],[x+w-10,y+h-10]])bx(g,lx,ly,4,4,0,.66,lam('#5d666e'));break;}
    case 'exec':{bx(g,x,y,w,h,0,.8,lam('#5a3b28'));bx(g,mx-20,y+6,40,4,.8,.4,lam('#2a3036'));break;}
    case 'cabinet':{bx(g,x,y,w,h,0,1.9,lam('#8d949b'));for(let i=0;i<5;i++){bx(g,x+3,y+h,w-6,1,.12+i*.36,.3,lam('#a7aeb5'),false);bx(g,x+w/2-6,y+h+1,12,1,.3+i*.36,.04,lam('#5d666e'),false);}break;}
    case 'rack':{bx(g,x,y,w,h,0,2.1,lam('#22303c'));for(let xx=x+8;xx<x+w-6;xx+=14)bx(g,xx,y+h,5,1,1.6,.06,lam('#5fd38a',{emissive:'#5fd38a',emissiveIntensity:.9}),false);break;}
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
  const p=textPlane(title+'\n'+sub,84,56,col,'#fbfaf6',F(800,11));onBackWall(g,p,x,1.575);p.position.z=.05;
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
    const tv=bx(g,z.x+z.w/2-50,z.y-2,100,4,1.15,.62,lam('#1d2328'),false);
    const scr=textPlane('3분기 실적\n▲ 12%',92,40,'#2b4a6b','#e8f1fb',F(800,12));scr.position.set((z.x+z.w/2)*U,1.46,(z.y+3)*U);g.add(scr);
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
}
function pantryProps(g){
  bx(g,K(880),0,K(220),14,1.55,.65,lam('#e8e2d3'));
  for(let i=0;i<4;i++)mug(g,K(1045)+i*10,K(28),['#fbfaf6','#cf3626','#2b6cb0','#e0c23d'][i]);
  for(let i=0;i<4;i++){const s=new THREE.Mesh(GEO.sph,lam(['#e5483a','#e0c23d','#3fbf6a','#e5483a'][i]));s.scale.setScalar(.06);s.position.set(K(910)*U+i*.09,1.02,K(30)*U+(i%2)*.06);g.add(s);}
}
function lobbyProps(g){
  const sign=textPlane('OFFICE ROYALE',420,70,null,'#2a3036',DF(54));onBackWall(g,sign,FW/2,1.75);
  const sub=textPlane('살아남는 자가 대표가 된다',300,26,null,'#5d666e',F(800,18));onBackWall(g,sub,FW/2,1.18);
  /* revolving door at the front entrance */
  const rv=new THREE.Group();rv.position.set(DOOR.x*U,0,(FH+20)*U);
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2,24,1,true,0,Math.PI*2),ownMat(new THREE.MeshLambertMaterial({color:'#c8d7e1',transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide})));glass.position.y=1.1;rv.add(glass);
  const wings=new THREE.Group();wings.userData.dyn=true;for(let i=0;i<4;i++){const w=new THREE.Mesh(GEO.box,lam('#9fcbe3',{transparent:true,opacity:.6}));w.scale.set(1.05,2.1,.04);w.position.set(Math.cos(i*Math.PI/2)*.52,1.05,Math.sin(i*Math.PI/2)*.52);w.rotation.y=-i*Math.PI/2;wings.add(w);}
  rv.add(wings);g.add(rv);floorAnim.push(dt=>{wings.rotation.y+=dt*.6;});
  /* info screen at the reception */
  const scr=textPlane('방문 등록\n1F 안내데스크',90,46,'#2b4a6b','#e8f1fb',F(800,11));scr.position.set(K(550)*U,1.5,K(560)*U+.02);g.add(scr);
}
function execProps(g){
  shelf(g,K(200),K(180),true);
  for(const[x,col]of[[K(320),'#8e5c8a'],[K(780),'#2f7d4f']]){const p=textPlane('★',70,50,col,'#e0c23d',DF(30));onBackWall(g,p,x,1.6);}
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
  /* spinning fans on the AC units */
  for(const o of FLOORS[ROOF].ob){if(o.k!=='ac')continue;
    for(const c of[o.x+o.w*.3,o.x+o.w*.7]){const fan=new THREE.Group();fan.userData.dyn=true;fan.position.set(c*U,1.06,(o.y+o.h/2)*U);
      for(let i=0;i<3;i++){const b=new THREE.Mesh(GEO.box,lam('#3d4a54'));b.scale.set(.06,.02,o.h*.28*U);b.position.z=o.h*.14*U;const p=new THREE.Group();p.rotation.y=i*Math.PI*2/3;p.add(b);fan.add(p);}
      g.add(fan);floorAnim.push(dt=>{fan.rotation.y+=dt*9;});}}
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
  const tryPlant=(x,y,s)=>{if(clearSpot(fl,x,y,22)){plantAt(g,x,y,s);return true;}return false;};
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
const CG={head:SG(new THREE.SphereGeometry(.3,22,16)),torso:SG(new THREE.CapsuleGeometry(.24,.2,6,16)),shell:SG(new THREE.CapsuleGeometry(.255,.2,6,16)),
  hips:SG(new THREE.CylinderGeometry(.215,.235,.16,16)),skirt:SG(new THREE.CylinderGeometry(.2,.29,.26,16)),leg:SG(new THREE.CapsuleGeometry(.092,.13,4,10)),
  shoe:SG(new THREE.SphereGeometry(.1,12,8)),arm:SG(new THREE.CapsuleGeometry(.072,.18,4,10)),hand:SG(new THREE.SphereGeometry(.07,10,8)),
  cap:SG(new THREE.SphereGeometry(.315,22,12,0,Math.PI*2,0,Math.PI*.5)),eye:SG(new THREE.SphereGeometry(.04,8,6)),bun:SG(new THREE.SphereGeometry(.12,12,10)),
  back:SG(new THREE.CapsuleGeometry(.2,.18,4,14))};
const bodyGeo=CG.torso,headGeo=CG.head,eyeGeo=CG.eye;
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
    case 'cleaner':return{skin:'#f3c7a4',hair:{style:'scarf',color:'#cf6f8a'},top:{shirt:'#4f8f8f',apron:'#e9e6df'},bottom:{pants:'#4b555d',shoes:'#f2efe9'}};
    case 'busy':return{skin,hair:{style:'side',color:'#3a2d28'},face:{glasses:1},top:{shirt:'#dfe7ee',vest:'#5d666e',tie:'#2b5c9e'},bottom:{pants:'#2f3540',shoes:'#1d2024'}};
    case 'newbie':return{skin,hair:{style:'short',color:'#2e2a28'},top:{shirt:'#fbfaf6',cardigan:'#9fcf9f',badge:1},bottom:{pants:'#c8b89a',shoes:'#5a4632'}};
    case 'courier':return{skin,hair:{style:'cap',color:'#3d4a54'},top:{shirt:'#b5651d'},bottom:{pants:'#5a4632',shoes:'#2c3036'}};
    case 'cart':return{skin,hair:{style:'bun',color:'#6b3e2e'},top:{shirt:'#fbfaf6',apron:'#7a4b2a'},bottom:{pants:'#2f3540',shoes:'#1d2024'}};
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
      _v.fromBufferAttribute(N,i).applyMatrix3(_m3).normalize();nor.set([_v.x,_v.y,_v.z],(vo+i)*3);col.set([c.r,c.g,c.b],(vo+i)*3);}
    if(gm.index){const I=gm.index.array;for(let i=0;i<I.length;i++)idx[io++]=I[i]+vo;}else for(let i=0;i<P.count;i++)idx[io++]=vo+i;
    vo+=P.count;group.remove(m);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setIndex(new THREE.BufferAttribute(idx,1));geo.computeBoundingSphere();
  const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;group.add(mesh);
}
/* ---------- dressing room choices (also sent to the server, which cleans them the same way: server/src/outfit.js) ---------- */
const FIT={hair:['short','side','long','bun','bald'],top:['shirt','jacket','cardigan','vest'],bottom:['pants','skirt'],
  hairC:['#1f1b1a','#3a2d28','#6b3e2e','#8a5a3a','#c9a25a','#9a9aa0','#cf6f8a','#2b6cb0'],skin:['#ffe4cc','#fbd8bb','#f3c7a4','#e6b48f','#c98d6a'],
  topC:['#2b6cb0','#4a4f57','#1f2228','#8e6c8a','#c46b6b','#3f8f8f','#9fcf9f','#e0c23d','#f4f6f8'],shirtC:['#f4f6f8','#dfe8f2','#f7e8d6','#e6efe1','#f3e3ea','#2f3540'],
  tie:[null,'#b8322a','#2b5c9e','#d9a441','#2f7d4f','#5a3b6e'],bottomC:['#2f3540','#3d4a54','#2b3a55','#5a4632','#6b5a48','#c8b89a','#4b555d']};
const DEFAULT_FIT={hair:'short',hairC:'#3a2d28',skin:'#fbd8bb',top:'jacket',topC:'#2b6cb0',shirtC:'#f4f6f8',tie:'#b8322a',badge:true,glasses:false,bottom:'pants',bottomC:'#2f3540'};
function cleanFit(f){
  if(!f||typeof f!=='object')return null;const col=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v.toLowerCase():null,pk=(v,l)=>l.includes(v)?v:l[0];
  return{hair:pk(f.hair,FIT.hair),hairC:col(f.hairC)||'#3a2d28',skin:col(f.skin)||'#fbd8bb',top:pk(f.top,FIT.top),topC:col(f.topC)||'#2b6cb0',shirtC:col(f.shirtC)||'#f4f6f8',
    tie:col(f.tie),badge:!!f.badge,glasses:!!f.glasses,bottom:pk(f.bottom,FIT.bottom),bottomC:col(f.bottomC)||'#2f3540'};
}
function myFit(){try{return cleanFit(JSON.parse(localStorage.getItem('or-fit')))||{...DEFAULT_FIT};}catch{return{...DEFAULT_FIT};}}
function fitToOutfit(c){
  const top={shirt:c.top==='shirt'?c.topC:c.shirtC,badge:c.badge};if(c.top!=='shirt')top[c.top]=c.topC;if(c.tie)top.tie=c.tie;
  return{skin:c.skin,hair:{style:c.hair,color:c.hairC},face:{glasses:c.glasses?1:0},top,bottom:{pants:c.bottomC,skirt:c.bottom==='skirt',shoes:'#1d2024'}};
}
function makeChar(color,kind,seed,outfit){
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  const o=outfit||outfitFor(kind,seed|0,color),mats=[],M={};
  const mt=c=>{if(!M[c]){M[c]=new THREE.MeshLambertMaterial({color:c});mats.push(M[c]);}return M[c];};
  const add=(par,geo,c,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mt(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;par.add(m);return m;};
  const piv=(par,x,y,z)=>{const p=new THREE.Group();p.position.set(x,y,z);par.add(p);return p;};
  const T=o.top,B=o.bottom,main=T.jacket||T.cardigan||T.vest||T.shirt;
  /* bottom slot: hips + legs + shoes (skirt variant) */
  const bottom=piv(inner,0,0,0);
  add(bottom,CG.hips,B.pants,0,.5,0);
  const legL=piv(bottom,-.105,.46,0),legR=piv(bottom,.105,.46,0);
  for(const l of[legL,legR]){add(l,CG.leg,B.pants,0,-.17,0);add(l,CG.shoe,B.shoes||'#1d2024',0,-.35,.05,1,.55,1.45);}
  if(B.skirt)add(bottom,CG.skirt,B.pants,0,.44,0,1,1,.9);
  /* top slot: torso, outer layer, arms */
  const top=piv(inner,0,0,0);
  add(top,CG.torso,T.shirt,0,.76,0,1,1,.92);
  if(T.jacket||T.cardigan){add(top,CG.shell,T.jacket||T.cardigan,0,.76,-.012,1,1,.9);add(top,GEO.box,T.shirt,0,.82,.215,.13,.3,.04);}
  if(T.vest){add(top,CG.shell,T.vest,0,.74,-.01,1,.86,.9);add(top,GEO.box,T.shirt,0,.86,.218,.1,.18,.03);}
  if(T.apron)add(top,GEO.box,T.apron,0,.62,.2,.34,.46,.05);
  add(top,GEO.box,'#ffffff',-.055,.99,.17,.09,.05,.06).rotation.z=.5;add(top,GEO.box,'#ffffff',.055,.99,.17,.09,.05,.06).rotation.z=-.5;   // collar
  if(T.tie){add(top,GEO.box,T.tie,0,.8,.235,.065,.26,.025);add(top,GEO.box,T.tie,0,.95,.225,.085,.06,.04);}
  if(T.badge){add(top,GEO.box,'#2b6cb0',-.07,.85,.215,.012,.22,.012).rotation.z=.35;add(top,GEO.box,'#fbfaf6',-.1,.72,.235,.08,.1,.015);}
  if(T.pin)add(top,GEO.box,'#d9a441',.12,.9,.235,.04,.04,.02);
  const sleeve=T.jacket||T.cardigan||T.shirt;
  const armL=piv(top,-.3,.93,0),armR=piv(top,.3,.93,0);
  for(const a of[armL,armR]){add(a,CG.arm,sleeve,0,-.15,0);add(a,CG.hand,o.skin,0,-.32,0);}
  /* head slot: face + hair */
  const head=piv(inner,0,1.17,0);
  add(head,CG.head,o.skin,0,0,0);
  for(const sx of[-1,1]){add(head,eyeGeo,'#2b2b2b',sx*.1,.0,.27);add(head,eyeGeo,'#f5a3a3',sx*.18,-.07,.245,1.3,.7,.5);}
  const F=o.face||{},H=o.hair;
  if(F.glasses)for(const sx of[-.1,.1])add(head,GEO.box,'#2a2d31',sx,.0,.285,.11,.075,.02);
  if(F.mustache)add(head,GEO.box,H.color,0,-.09,.27,.16,.035,.04);
  const hc=H.color;
  if(H.style==='bald'){add(head,CG.bun,hc,-.25,.02,-.08,.6,.9,1.3);add(head,CG.bun,hc,.25,.02,-.08,.6,.9,1.3);add(head,CG.bun,hc,0,0,-.24,1.6,.8,.5);}
  else if(H.style==='scarf'){const c=add(head,CG.cap,hc,0,.02,-.02,1.02,1.05,1.02);c.rotation.x=-.2;add(head,CG.bun,hc,0,.06,-.3,.6,.5,.5);}
  else if(H.style==='cap'){add(head,CG.cap,hc,0,.03,0,1.03,.9,1.03);add(head,GEO.box,hc,0,.05,.26,.36,.03,.18);}
  else{const c=add(head,CG.cap,hc,0,.02,-.03,1,1,1);c.rotation.x=-.28;
    if(H.style==='side')add(head,CG.bun,hc,-.12,.2,.12,1.5,.6,.9);
    if(H.style==='long')add(head,CG.back,hc,0,-.16,-.12,1.25,1.2,.75);
    if(H.style==='bun')add(head,CG.bun,hc,0,.22,-.2,1,1,1);
    if(H.style==='short')add(head,CG.bun,hc,.08,.24,.1,1.4,.5,.9);}
  /* role props */
  if(kind==='ceo'){const cr=new THREE.Mesh(new THREE.TorusGeometry(.33,.04,8,24),new THREE.MeshLambertMaterial({color:'#c08a1e',emissive:'#c08a1e',emissiveIntensity:.4}));cr.rotation.x=Math.PI/2;cr.position.y=.6;inner.add(cr);mats.push(cr.material);}
  if(kind==='courier'){const bxm=new THREE.Mesh(GEO.box,lam('#c8955a'));bxm.scale.set(.42,.32,.32);bxm.position.set(0,.72,.36);bxm.castShadow=true;inner.add(bxm);}
  if(kind==='cart'){const ct=new THREE.Group();const b=new THREE.Mesh(GEO.box,lam('#7a4b2a'));b.scale.set(.75,.55,.5);b.position.y=.42;b.castShadow=true;ct.add(b);
    const tp=new THREE.Mesh(GEO.box,lam('#e8e2d3'));tp.scale.set(.78,.04,.53);tp.position.y=.72;ct.add(tp);
    for(let i=0;i<3;i++){const c=new THREE.Mesh(GEO.cyl,lam('#fbfaf6'));c.scale.set(.05,.1,.05);c.position.set(-.2+i*.2,.8,0);ct.add(c);}
    const um=new THREE.Mesh(new THREE.ConeGeometry(.55,.28,10),lam('#cf3626'));um.position.y=1.85;ct.add(um);const pole=new THREE.Mesh(GEO.cyl,lam('#d8d8dc'));pole.scale.set(.02,1.1,.02);pole.position.y=1.25;ct.add(pole);
    ct.position.z=.6;inner.add(ct);
    const zone=new THREE.Mesh(GEO.disc,basic('#3fbf6a',{transparent:true,opacity:.14,depthWrite:false}));zone.rotation.x=-Math.PI/2;zone.position.y=.018;zone.scale.setScalar(75*U);g.add(zone);
    const ring=new THREE.Mesh(GEO.ring,basic('#3fbf6a',{transparent:true,opacity:.5,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;ring.scale.setScalar(75*U);g.add(ring);}
  if(kind==='cleaner'){const st=new THREE.Mesh(GEO.cyl,lam('#7d6a52'));st.scale.set(.025,1.1,.025);st.position.set(.36,.6,.15);st.rotation.z=-.2;inner.add(st);
    const mh=new THREE.Mesh(GEO.box,lam('#e9e6df'));mh.scale.set(.3,.08,.16);mh.position.set(.45,.06,.18);inner.add(mh);}
  const carry=new THREE.Mesh(GEO.box,lam('#fbfaf6'));carry.scale.set(.32,.04,.4);carry.position.set(0,.8,.42);carry.visible=false;inner.add(carry);
  const sh=new THREE.Mesh(shGeo,basic('#1d2328',{transparent:true,opacity:.18,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.012;g.add(sh);
  const ring=new THREE.Mesh(ringGeo,basic('#2b6cb0',{transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.016;ring.visible=false;g.add(ring);
  const aura=new THREE.Mesh(GEO.disc,basic('#e5483a',{transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending}));aura.rotation.x=-Math.PI/2;aura.position.y=.02;aura.scale.setScalar(.85);aura.visible=false;g.add(aura);
  /* ~30 little parts would cost ~30 draw calls per character (twice with shadows); bake each rigid piece into one mesh */
  const cm=new THREE.MeshLambertMaterial({vertexColors:true});
  for(const p of[bottom,legL,legR,top,armL,armR,head])bakeParts(p,cm);
  for(const m of Object.values(M))m.dispose();
  const keep=mats.filter(m=>!Object.values(M).includes(m));
  g.userData={inner,bm:cm,mats:[cm,...keep],ring,aura,carry,cloak:false,rig:{legL,legR,armL,armR,head},slots:{head,top,bottom},outfit:o,walk:0};
  scene.add(g);return g;
}
const tmpC=new THREE.Color(),WHITE=new THREE.Color('#ffffff');
const toYaw=face=>Math.atan2(Math.cos(face),Math.sin(face));
function setCloak(u,alpha){
  const want=alpha<1;if(u.cloak===want&&(!want||u.alpha===alpha))return;u.cloak=want;u.alpha=alpha;
  for(const m of u.mats){m.transparent=want;m.opacity=alpha;m.depthWrite=!want;m.needsUpdate=true;}
}
function poseChar(m,o,dt,isNpc){
  const u=m.userData;m.position.set(o.x*U,0,o.y*U);
  const want=toYaw(o.face);let cur=m.rotation.y,d=want-cur;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;m.rotation.y=cur+d*Math.min(1,dt*14);
  const px=u.px===undefined?o.x:u.px,py=u.py===undefined?o.y:u.py,mv=Math.hypot(o.x-px,o.y-py)>.4;u.px=o.x;u.py=o.y;
  const sit=!isNpc&&!!o.sit;
  u.inner.rotation.z=!isNpc&&o.stunT>0?Math.sin(G.t*12)*.25:0;
  poseRig(u,sit?'sit':mv?(o.sprint?'run':'walk'):'idle',dt,!isNpc&&o.carry);
}
/* arms and legs: walk / run swing, seated typing, a little idle sway */
function poseRig(u,mode,dt,carry){
  const R=u.rig;if(!R)return;
  u.walk+=dt*(mode==='run'?17:mode==='walk'?11:2);
  const sw=mode==='walk'?Math.sin(u.walk)*.6:mode==='run'?Math.sin(u.walk)*.95:0;
  u.inner.position.y=mode==='sit'?-.2:mode==='idle'?0:Math.abs(Math.cos(u.walk))*.05;
  R.legL.rotation.x=mode==='sit'?-1.4:sw;R.legR.rotation.x=mode==='sit'?-1.4:-sw;
  if(mode==='sit'){R.armL.rotation.x=-1.0+Math.sin(u.walk*9)*.06;R.armR.rotation.x=-1.0+Math.sin(u.walk*9+1.7)*.06;}
  else if(carry){R.armL.rotation.x=R.armR.rotation.x=-1.15;}
  else{R.armL.rotation.x=-sw*.8;R.armR.rotation.x=sw*.8;}
  R.armL.rotation.z=-.08;R.armR.rotation.z=.08;
  R.head.rotation.y=mode==='idle'?Math.sin(u.walk*.6)*.18:0;
}

/* ---------- dynamic pools ---------- */
const actorM=new Map(),npcM=new Map(),coneM=new Map(),OTHER_HUMAN='#7b4fd6'; /* other people in an online room */
function syncSet(map,list,make,upd){
  const seen=new Set();
  for(const o of list){let m=map.get(o);if(!m){m=make(o);if(!m)continue;map.set(o,m);scene.add(m);}seen.add(o);upd(o,m);}
  for(const[o,m]of map)if(!seen.has(o)){scene.remove(m);map.delete(o);}
}
const itemM=new Map(),trapM=new Map(),wetM=new Map(),taskM=new Map(),dropM=new Map(),projM=new Map(),burstM=new Map(),airM=new Map();
const cubeGeo=new THREE.BoxGeometry(.42,.42,.42),haloGeo=new THREE.SphereGeometry(.5,16,12);
function makeItem(it){
  const c=ITEMS[it.k].c,g=new THREE.Group();
  g.add(new THREE.Mesh(cubeGeo,lam(c,{emissive:c,emissiveIntensity:.45})));
  g.add(new THREE.Mesh(haloGeo,basic(c,{transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending})));
  g.children[0].castShadow=true;return g;
}
function flatDisc(color,op){const m=new THREE.Mesh(GEO.disc,basic(color,{transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
function makeTask(t){
  const g=new THREE.Group();
  if(t.zone){const m=new THREE.Mesh(GEO.box,basic('#f3d77a',{transparent:true,opacity:.18,depthWrite:false}));m.scale.set((t.zone.w-8)*U,.02,(t.zone.h-8)*U);m.position.set((t.zone.x+t.zone.w/2)*U,.02,(t.zone.y+t.zone.h/2)*U);g.add(m);}
  else{const r=(t.kind==='copy'||t.kind==='print'?K(46):t.r)*U,m=new THREE.Mesh(GEO.ring,basic('#f3d77a',{transparent:true,opacity:.85}));m.rotation.x=-Math.PI/2;m.scale.setScalar(r);m.position.set(t.x*U,.02,t.y*U);g.add(m);
    const d=flatDisc('#f3d77a',.16);d.scale.setScalar(r);d.position.set(t.x*U,.015,t.y*U);g.add(d);}
  return g;
}
const paperGeo=new THREE.BoxGeometry(.3,.03,.4);
function makeProj(p){
  const g=new THREE.Group(),mine=p.o===G.me;
  if(p.bundle){for(let i=0;i<3;i++){const m=new THREE.Mesh(paperGeo,lam('#fbfaf6',{emissive:'#e5483a',emissiveIntensity:.25}));m.position.y=i*.05;m.rotation.y=i*.3;g.add(m);}}
  else if(p.staple){const m=new THREE.Mesh(GEO.box,lam(mine?'#2b6cb0':'#5d666e'));m.scale.set(.22,.05,.08);g.add(m);}
  else{const m=new THREE.Mesh(paperGeo,lam(p.flyer?'#f3d77a':'#ffffff',{emissive:mine?'#2b6cb0':'#ffffff',emissiveIntensity:mine?.35:.2}));if(mine)m.scale.setScalar(1.25);g.add(m);}
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
const VIS_N=isTouch?110:160,VR=600;
const visGeo=new THREE.BufferGeometry();visGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array((VIS_N+2)*3),3));
{const idx=[];for(let i=1;i<=VIS_N;i++)idx.push(0,i,i+1);visGeo.setIndex(idx);}
const visMesh=new THREE.Mesh(visGeo,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,stencilWrite:true,stencilRef:1,
  stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilFail:THREE.ReplaceStencilOp,side:THREE.DoubleSide}));
visMesh.renderOrder=999;visMesh.frustumCulled=false;scene.add(visMesh);
const fogScene=new THREE.Scene(),fogCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
fogScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:'#221c33',transparent:true,opacity:.48,depthTest:false,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:THREE.NotEqualStencilFunc})));
let fogOn=false;
function updFog(me){
  const p=visGeo.attributes.position.array;p[0]=me.x*U;p[1]=.02;p[2]=me.y*U;
  for(let i=0;i<=VIS_N;i++){const a=i/VIS_N*Math.PI*2,d=Math.min(VR,rayLen(me.f,me.x,me.y,a,VR)+8);
    p[(i+1)*3]=(me.x+Math.cos(a)*d)*U;p[(i+1)*3+1]=.02;p[(i+1)*3+2]=(me.y+Math.sin(a)*d)*U;}
  visGeo.attributes.position.needsUpdate=true;
}
const seenBy=(me,o)=>!fogOn||me.intelT>0||ally(me,o)||(Math.hypot(o.x-me.x,o.y-me.y)<VR&&sightLos(me.f,me.x,me.y,o.x,o.y));

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
function tag(x,y,text,bg,fg,size=12){
  ctx.font=F(800,size);const w=ctx.measureText(text).width+12;ctx.fillStyle=bg;rr(x-w/2,y-10,w,19,6);ctx.fill();
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.fillText(text,x,y+4);ctx.textAlign='left';
}
function outlined(t,x,y,font,color){ctx.font=font;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(251,250,246,.95)';ctx.strokeText(t,x,y);ctx.fillStyle=color;ctx.fillText(t,x,y);ctx.textAlign='left';}
function bubble(text,x,y,color,alpha){
  ctx.font=F(800,13);const w=Math.min(240,ctx.measureText(text).width+20),h=26,c=color&&color!=='#1d2328'?color:'#3d4a54';
  ctx.globalAlpha=alpha;ctx.fillStyle='rgba(255,255,255,.97)';rr(x-w/2,y-h,w,h,12);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-7,y-1);ctx.lineTo(x,y+8);ctx.lineTo(x+7,y-1);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x,y+8);ctx.lineTo(x+7,y);ctx.stroke();
  ctx.fillStyle='#1d2328';ctx.textAlign='center';ctx.fillText(text,x,y-h/2+5,w-12);ctx.textAlign='left';ctx.globalAlpha=1;
}
function glyph(k,x,y,s){
  const it=ITEMS[k];ctx.fillStyle=it.c;rr(x-s/2,y-s/2,s,s,s*.24);ctx.fill();ctx.strokeStyle='#fbfaf6';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fbfaf6';ctx.font=F(800,it.g.length>1?s*.36:s*.52);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(it.g,x,y+1);ctx.textBaseline='alphabetic';ctx.textAlign='left';
}

/* ---------- main render ---------- */
const tmpV=new THREE.Vector3(),dirV=new THREE.Vector3();
function render(dt){
  if(!G||!G.me)return; // online: nothing to draw until the first snapshot
  const me=G.me;
  const focus=me.alive?me:(specTarget()||leader()||me);if(focus.f>=0)viewF=focus.f;
  const f=viewF;
  if(builtF!==f)buildFloor(f);
  prewarmFloors();
  for(const fn of floorAnim)fn(dt);
  const k=Math.min(1,dt*7);cam.x+=(focus.x-cam.x)*k;cam.y+=(focus.y-cam.y)*k;
  const zoom=VW<VH?1.4:VW<700?1.15:1,sx=shake>0?(Math.random()-.5)*.35:0,sz=shake>0?(Math.random()-.5)*.35:0;
  cam3.position.set(cam.x*U+sx,16.5*zoom,cam.y*U+10.5*zoom+sz);cam3.lookAt(cam.x*U,0,cam.y*U-.4);
  /* dressing room: a close look at me, framed above the menu card */
  /* (the view offset slides the picture so I stand in the free space above the card) */
  if(G.plaza&&typeof PZ!=='undefined'&&PZ.dress){const n=VW<700;cam3.position.set(me.x*U,n?2.6:2.1,me.y*U+(n?6.2:4.0));cam3.lookAt(me.x*U,.75,me.y*U);cam3.setViewOffset(VW,VH,0,VH*(VW<700?.3:.2),VW,VH);}
  else if(cam3.view&&cam3.view.enabled)cam3.clearViewOffset();
  const onFloor=me.alive&&me.f===f&&!me.transit;
  fogOn=onFloor&&!(G.blackout&&G.blackout.f===f);

  /* fade walls that stand between the camera and me */
  let hits=null;
  if(onFloor){tmpV.set(me.x*U,1,me.y*U);rc.set(cam3.position,dirV.copy(tmpV).sub(cam3.position).normalize());const lim=cam3.position.distanceTo(tmpV);
    hits=new Set(rc.intersectObjects(wallMs,false).filter(h=>h.distance<lim).map(h=>h.object));}
  for(const w of wallMs){const tg=hits&&hits.has(w)?.2:1;w.material.opacity+=(tg-w.material.opacity)*Math.min(1,dt*10);w.material.depthWrite=w.material.opacity>.9;}
  for(const dm of doorMs){dm.closed.visible=!dm.d.open;dm.ow.visible=dm.d.open;}
  for(const sm of seatMs)sm.m.color.set(sm.s.owner===me?'#2b6cb0':'#30353c');

  /* drop meshes left over from a previous game */
  for(const[a,m]of actorM)if(!G.actors.includes(a)){scene.remove(m);actorM.delete(a);}
  for(const[n,m]of npcM)if(!G.npcs.includes(n)){scene.remove(m);npcM.delete(n);}
  /* actors */
  for(const a of G.actors){
    let m=actorM.get(a);if(!m){m=makeChar(a.color,null,a.id,a.fit?fitToOutfit(a.fit):null);actorM.set(a,m);}
    const vis=a.alive&&a.f===f&&!a.transit&&(a===me||seenBy(me,a))&&!(a.cloakT>0&&a!==me&&!ally(me,a));
    m.visible=vis;if(!vis)continue;
    poseChar(m,a,dt,false);const u=m.userData;
    setCloak(u,a.cloakT>0?.4:1);
    u.ring.visible=a.isPlayer||ally(me,a);if(u.ring.visible)u.ring.material.color.set(a===me?'#2b6cb0':ally(me,a)?'#3fbf6a':OTHER_HUMAN);
    const aura=a.ammo>0?CAT.atk.c:a.speedT>0?CAT.move.c:a.shieldN>0||a.vipT>0?CAT.def.c:null;
    u.aura.visible=!!aura;if(aura){u.aura.material.color.set(aura);u.aura.scale.setScalar(.8+Math.sin(G.t*6)*.06);}
    u.carry.visible=!!a.carry;
    u.bm.emissive.setScalar(a.flash>0?Math.min(.55,a.flash*2):0);
  }
  for(const e of extras){const s=e.s;e.m.visible=!s.occ&&!(s.owner&&s.owner.alive);if(e.m.visible)poseRig(e.m.userData,'sit',dt);}
  /* npcs + cones */
  const npcs=G.npcs.filter(n=>n.f===f&&npcActive(n));
  for(const n of G.npcs){let m=npcM.get(n);if(!m){const col={boss:'#55617a',ceo:'#2a2a2e',cleaner:'#9fb7ad',busy:'#7d8790',newbie:'#bfe3c8',courier:'#b5651d',cart:'#fbfaf6'}[n.kind]||'#7d8790';m=makeChar(col,n.kind,7);if(n.kind==='ceo')m.scale.setScalar(1.12);npcM.set(n,m);}
    m.visible=npcs.includes(n);if(m.visible)poseChar(m,n,dt,true);}
  const coneList=G.blackout&&G.blackout.f===f?[]:npcs.filter(n=>VIS[n.kind]);
  syncSet(coneM,coneList,makeCone,updCone);
  /* items, traps, wet, tasks, drops */
  syncSet(itemM,G.items.filter(i=>i.f===f),makeItem,(it,m)=>{m.position.set(it.x*U,.5+Math.sin(G.t*4+it.x)*.07,it.y*U);m.children[0].rotation.y+=dt*1.4;m.children[1].scale.setScalar(1+Math.sin(G.t*4+it.x)*.14);});
  syncSet(trapM,G.traps.filter(t=>t.f===f),()=>flatDisc('#6b4a2e',.6),(t,m)=>{m.scale.set(26*U,17*U,1);m.position.set(t.x*U,.025,t.y*U);});
  syncSet(wetM,G.wet.filter(w=>w.f===f),()=>flatDisc('#78b9e6',.5),(w,m)=>{m.scale.set(34*U,22*U,1);m.position.set(w.x*U,.022,w.y*U);m.material.opacity=Math.min(1,(18-w.t)/3)*.5;});
  syncSet(taskM,G.tasks.filter(t=>t.f===f),makeTask,(t,m)=>{const c=t.ready?'#2f9e57':'#f3d77a';for(const ch of m.children)ch.material.color.set(c);});
  syncSet(dropM,G.drops.filter(d=>d.f===f),()=>{const m=new THREE.Mesh(GEO.box,lam('#fbfaf6'));m.scale.set(.32,.05,.42);m.castShadow=true;return m;},(d,m)=>{m.position.set(d.x*U,.04,d.y*U);m.rotation.y=.3;});
  if(G.cake&&G.cake.f===f){if(!cakeM){cakeM=new THREE.Group();const b=new THREE.Mesh(GEO.cyl,lam('#f6d3dc'));b.scale.set(.38,.32,.38);b.position.y=.16;b.castShadow=true;cakeM.add(b);
      const c=new THREE.Mesh(GEO.cyl,lam('#cf3626',{emissive:'#cf3626',emissiveIntensity:.5}));c.scale.set(.04,.22,.04);c.position.y=.43;cakeM.add(c);scene.add(cakeM);}
    cakeM.visible=true;cakeM.position.set(G.cake.x*U,0,G.cake.y*U);}else if(cakeM)cakeM.visible=false;
  /* projectiles, bursts, airdrops */
  syncSet(projM,G.proj.filter(p=>p.f===f),makeProj,(p,m)=>{m.position.set(p.x*U,1.0,p.y*U);m.rotation.y=p.bundle?p.d/40:p.staple?toYaw(Math.atan2(p.dy,p.dx)):p.spin;});
  syncSet(burstM,G.bursts.filter(b=>b.f===f),makeBurst,(b,m)=>{const kk=b.t/.5;m.scale.setScalar((20+kk*80)*U);m.position.set(b.x*U,.05,b.y*U);m.material.opacity=Math.max(0,1-kk);});
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
  for(const st of staticTags){const s=scr(st.x,st.y,st.h);if(s)outlined(st.t,s[0],s[1],F(800,st.small?11:13),'rgba(29,35,40,.75)');}
  if(f!==ROOF){const p=PADS.elev;const s=scr(p.x,p.y-34,2.6);if(s)outlined(G.fire>0?'운행 정지':'▲▼',s[0],s[1],F(800,13),G.fire>0?'#cf3626':'#1d2328');
    for(const d of G.dings)if(d.f===f){const s2=scr(p.x,p.y,2.8+d.t);if(s2)outlined('띵!',s2[0],s2[1],DF(22),'#c08a1e');}
    if(dv){const s=scr(DOOR.x,FH,2.2);if(s){if(Math.sin(G.t*6+dv.ph)>0)outlined(dv.type==='sales'?'똑똑똑!':'똑똑',s[0]+44,s[1],DF(18),'#1d2328');
      ctx.fillStyle='#cf3626';ctx.fillRect(s[0]-30,s[1]+8,60*(1-dv.t/20),4);}}}
  for(const sm of seatMs){const s=sm.s;if(s.owner===me&&s.occ!==me){const p=scr(s.x,s.y,1.25);if(p)tag(p[0],p[1],'내 자리','#2b6cb0','#fbfaf6',11);}}
  for(const t of G.tasks){if(t.f!==f)continue;
    const ix=t.kind==='copy'||t.kind==='print'?t.x+K(52):t.x,iy=t.zone?t.y:t.y-30;const p=scr(ix,iy,1.7+Math.sin(G.t*4+t.id)*.08);if(!p)continue;
    ctx.beginPath();ctx.arc(p[0],p[1],13,0,7);ctx.fillStyle=t.ready?'#2f7d4f':'#f3d77a';ctx.fill();ctx.strokeStyle='#1d2328';ctx.lineWidth=2;ctx.stroke();
    if(t.prog>0&&!t.ready){ctx.beginPath();ctx.arc(p[0],p[1],18,-Math.PI/2,-Math.PI/2+t.prog*Math.PI*2);ctx.strokeStyle='#2f7d4f';ctx.lineWidth=4;ctx.stroke();}
    txt(t.ready?'✓':'!',p[0],p[1]+6,DF(17),t.ready?'#fbfaf6':'#1d2328','center');
    const dbl=warnFloor(f);outlined(t.ready?'제출!':`${t.name} +${t.reward*(dbl?2:1)}`,p[0],p[1]-22,F(800,11),dbl?'#cf3626':'rgba(29,35,40,.85)');}
  for(const d of G.drops){if(d.f!==f)continue;const p=scr(d.x,d.y,.3);if(p)outlined('출력물',p[0],p[1]+18,F(800,10),'rgba(29,35,40,.8)');}
  if(G.cake&&G.cake.f===f){const p=scr(G.cake.x,G.cake.y,.2);if(p)outlined('생일 케이크 +8',p[0],p[1]+22,F(800,11),'#cf3626');}
  for(const it of G.items){if(it.f!==f)continue;const p=scr(it.x,it.y,.5+Math.sin(G.t*4+it.x)*.07);if(!p)continue;glyph(it.k,p[0],p[1],20);
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
    const p=scr(a.x,a.y,1.75);if(!p)continue;const x=p[0],y=p[1];
    const label=G.plaza?(a===me?`나 · ${a.name}`:a.name):a===me?`나 · ${rankName(a)}`:`${a.name} ${rankName(a)}`;
    tag(x,y-12,label,a===me?'#2b6cb0':a.isPlayer?OTHER_HUMAN:'rgba(251,250,246,.94)',a===me||a.isPlayer?'#fbfaf6':'#1d2328');
    if(!G.plaza){ctx.fillStyle='#1d2328';ctx.fillRect(x-18,y+1,36,5);ctx.fillStyle=a.g<30?'#cf3626':'#2f7d4f';ctx.fillRect(x-17,y+2,34*Math.max(0,a.g)/100,3);}
    if(a.items.length&&a!==me)glyph(a.items[0],x+28,y-12,14);
    if(ally(me,a)&&a!==me)outlined('동맹',x,y+20,F(800,11),'#2f9e57');
    if(a.ammo>0&&a===me){const q=scr(a.x,a.y,0);if(q)outlined(`스테이플 ${a.ammo}`,q[0],q[1]+26,F(800,10),'#3f6f99');}
    const st=a.stunT>0?'회식 중':a.lockT>0?a.lockWhy:a.call?'호출당함':a.sit?(a.sit.owner===a?'휴식 중':''):'';
    if(st)outlined(st,x,y-30,F(800,12),'#c08a1e');
    if(G.star&&G.star.a===a)outlined('★ 우수사원',x,y-(st?48:30),DF(16),'#c08a1e');
    if(a.chan){const q=scr(a.x,a.y,.05);if(q){const kk=1-a.chan.t/a.chan.max;ctx.beginPath();ctx.arc(q[0],q[1],28,-Math.PI/2,-Math.PI/2+kk*Math.PI*2);ctx.strokeStyle='#f3d77a';ctx.lineWidth=5;ctx.stroke();
      outlined(a.chan.max-a.chan.t<a.chan.tag?'사원증 태그':'이동 중',q[0],q[1]+44,F(800,10),'#1d2328');}}
  }
  /* npc labels */
  for(const n of npcs){const p=scr(n.x,n.y,n.kind==='ceo'?2.0:1.8);if(!p)continue;
    const lbl={boss:'부장님',ceo:'대표님',cleaner:'청소 아주머니',busy:'옆팀 팀장',newbie:'신입 인턴',courier:'택배 기사',cart:'커피 카트 · 회복'}[n.kind];
    tag(p[0],p[1]-6,lbl,{boss:'#cf3626',ceo:'#c08a1e',newbie:'#3f8f5f',courier:'#b5651d',cart:'#7a4b2a'}[n.kind]||'#5d666e','#fbfaf6');
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
  if(me.intelT>0&&me.alive){
    for(const o of G.actors){if(o===me||!o.alive||o.f!==f)continue;const p=scr(o.x,o.y,.6);if(!p)continue;
      if(p[0]>16&&p[0]<VW-16&&p[1]>110&&p[1]<VH-150){ctx.strokeStyle='rgba(229,72,58,.9)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p[0],p[1],26,0,7);ctx.stroke();continue;}
      const cx=Math.max(22,Math.min(VW-22,p[0])),cy2=Math.max(120,Math.min(VH-160,p[1])),a=Math.atan2(p[1]-VH/2,p[0]-VW/2);
      ctx.fillStyle='#e5483a';ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*12,cy2+Math.sin(a)*12);ctx.lineTo(cx+Math.cos(a+2.4)*10,cy2+Math.sin(a+2.4)*10);ctx.lineTo(cx+Math.cos(a-2.4)*10,cy2+Math.sin(a-2.4)*10);ctx.fill();}
  }
  for(const p of G.pops){if(p.f!==f||p.say)continue;const s=scr(p.x,p.y,1.9+p.t*1.2);if(!s)continue;ctx.globalAlpha=Math.max(0,1-p.t/1.1);outlined(p.text,s[0],s[1],F(800,15),p.color);ctx.globalAlpha=1;}
  /* tutorial: a bouncing arrow over whatever the current step is about */
  if(typeof TUT!=='undefined'&&TUT.on&&TUT.target&&(TUT.target.f??f)===f){const t=TUT.target,p=scr(t.x,t.y,2.6+Math.sin(G.t*5)*.18);
    if(p){ctx.fillStyle='#f3d77a';ctx.strokeStyle='#1d2328';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-16,p[1]-22);ctx.lineTo(p[0]+16,p[1]-22);ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fill();ctx.stroke();}}
  /* speech bubbles follow whoever is talking; hidden while the speaker is out of sight */
  for(const p of G.pops){if(!p.say||p.f!==f)continue;
    let x=p.x,y=p.y;
    if(p.by!=null){const sp=typeof p.by==='string'?G.npcs.find(n=>n.id===p.by):G.actors.find(a=>a.id===p.by);
      if(sp){const m=(typeof p.by==='string'?npcM:actorM).get(sp);if(m&&!m.visible)continue;if(sp.f!==f)continue;x=sp.x;y=sp.y;}}
    const s=scr(x,y,1.75);if(!s)continue;
    const a=p.t<.12?p.t/.12:p.t>2.0?Math.max(0,(2.4-p.t)/.4):1;bubble(p.text,s[0],s[1]-40,p.color,a);}
}
