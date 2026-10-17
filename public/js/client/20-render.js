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
gl.domElement.id='gl';cv.parentNode.insertBefore(gl.domElement,cv);
const scene=new THREE.Scene();scene.background=new THREE.Color('#2a3036');
const cam3=new THREE.PerspectiveCamera(45,1,.1,300);
scene.add(new THREE.HemisphereLight(0xffffff,0xd9cbb8,1.15));
const sun=new THREE.DirectionalLight(0xfff4e6,1.65);
sun.position.set(W3/2+12,34,D3/2+18);sun.target.position.set(W3/2,0,D3/2);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
Object.assign(sun.shadow.camera,{left:-30,right:30,top:26,bottom:-26,near:1,far:100});sun.shadow.bias=-.0006;scene.add(sun);
function glResize(){gl.setSize(VW,VH,false);cam3.aspect=VW/VH;cam3.updateProjectionMatrix();}
addEventListener('resize',glResize);glResize();

const MC={};
const lam=(c,opt)=>{const k=c+(opt?JSON.stringify(opt):'');return MC[k]||(MC[k]=new THREE.MeshLambertMaterial(Object.assign({color:c},opt||{})));};
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
function floorTex(f){
  const fl=FLOORS[f],c=document.createElement('canvas');c.width=FW;c.height=FH;const x=c.getContext('2d');
  x.fillStyle=fl.carpet;x.fillRect(0,0,FW,FH);
  const g=fl.grid;
  for(let yy=0;yy<FH;yy+=g)for(let xx=0;xx<FW;xx+=g)if(((xx/g)+(yy/g))%2===0){x.fillStyle='rgba(29,35,40,.04)';x.fillRect(xx,yy,g,g);}
  x.strokeStyle=f===0?'rgba(255,255,255,.45)':'rgba(255,255,255,.22)';x.lineWidth=2;x.beginPath();
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
function buildFloor(f){
  if(floorGroup){scene.remove(floorGroup);disposeGroup(floorGroup);}
  floorAnim=[];const fl=FLOORS[f],g=new THREE.Group();floorGroup=g;builtF=f;wallMs=[];doorMs=[];seatMs=[];staticTags=[];
  scene.background=new THREE.Color(f===ROOF?'#9fc6e0':'#2a3036');
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(W3,D3),ownMat(new THREE.MeshLambertMaterial({map:floorTex(f)})));
  pl.rotation.x=-Math.PI/2;pl.position.set(W3/2,0,D3/2);pl.receiveShadow=true;g.add(pl);
  /* perimeter: back and side walls full height, the camera-facing front wall kept low */
  const per=f===ROOF?.35:WALL_H,pc=f===ROOF?'#b9bec2':'#e9e1d4';
  const pw=(x,y,w,h,ht)=>{const m=bx(g,x,y,w,h,0,ht,ownMat(new THREE.MeshLambertMaterial({color:pc,transparent:true,opacity:1})));if(ht>1)wallMs.push(m);};
  pw(-10,-10,FW+20,10,per);pw(-10,0,10,FH,per);pw(FW,0,10,FH,per);pw(-10,FH,FW+20,10,f===ROOF?.35:.45);
  if(f!==ROOF&&f!==0)for(const wx of[K(250),K(450),K(650),K(850)])bx(g,wx-60,-2,120,2,1,1.1,lam('#a9dbf5'),false);
  for(const o of fl.ob)obMesh(g,o,f);
  for(const d of fl.doors){
    const hz=d.w>d.h,m=d.glass?ownMat(new THREE.MeshLambertMaterial({color:'#9fcbe3',transparent:true,opacity:.55,depthWrite:false})):lam('#8a6a4a');
    const closed=bx(g,d.x,d.y,d.w,d.h,0,2.2,m);
    const ow=hz?bx(g,d.x,d.y+d.h,6,d.w*.85,0,2.2,m):bx(g,d.x+d.w,d.y,d.h*.85,6,0,2.2,m);
    closed.userData.dyn=ow.userData.dyn=true;doorMs.push({d,closed,ow});
  }
  for(const s of fl.seats){
    const c=new THREE.Group(),m=ownMat(new THREE.MeshLambertMaterial({color:'#4b555d'}));
    const seat=new THREE.Mesh(GEO.cyl,m);seat.scale.set(.27,.1,.27);seat.position.y=.45;seat.castShadow=true;c.add(seat);
    const back=new THREE.Mesh(GEO.box,m);back.scale.set(.5,.45,.08);back.position.set(0,.72,-.25);back.castShadow=true;c.add(back);
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
function obMesh(g,o,f){
  const k=o.k,x=o.x,y=o.y,w=o.w,h=o.h,mx=x+w/2,my=y+h/2;
  switch(k){
    case 'wall':{const m=bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#efe7db',transparent:true,opacity:1})));wallMs.push(m);
      bx(g,x-1,y-1,w+2,h+2,0,.14,lam('#c9a58d'),false);break;}
    case 'glass':{bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#bfe3f5',transparent:true,opacity:.3,depthWrite:false})),false);
      bx(g,x,y,w,h,WALL_H-.07,.07,lam('#e9e1d4'));bx(g,x,y,w,h,0,.1,lam('#d8cfc2'),false);break;}
    case 'cluster':{
      bx(g,x,y,w,h,0,.72,lam('#d7c9ad'));bx(g,x-2,y-2,w+4,h+4,.72,.05,lam('#f3eee2'));
      bx(g,x-2,my-3,w+4,6,.77,.5,lam('#8796a2'));bx(g,mx-3,y,6,h,.77,.5,lam('#8796a2'));
      for(const mxx of[x+28,mx+28])for(const[row,sgn]of[[my-15,-1],[my+9,1]]){
        bx(g,mxx,row,34,4,.77,.42,lam('#3a4250'));bx(g,mxx+2,row+(sgn<0?-.5:3.6),30,1,.82,.32,lam('#9edceb',{emissive:'#4fa8bd',emissiveIntensity:.25}),false);}
      bx(g,x+8,y+6,12,15,.77,.08,lam('#fbfaf6'),false);bx(g,x+w-22,y+h-21,12,15,.77,.08,lam('#fbfaf6'),false);
      cy(g,x+w-14,y+14,5,.77,.14,lam('#b5653a'));const lf=new THREE.Mesh(GEO.sph,lam('#5a8a45'));lf.scale.setScalar(.17);lf.position.set((x+w-14)*U,1.02,(y+14)*U);lf.castShadow=true;g.add(lf);
      if(o.dept)staticTags.push({t:o.dept,x:mx,y:my,h:1.35,small:true});
      break;}
    case 'counter':{bx(g,x,y,w,h,0,.95,lam('#e8e2d3'));bx(g,x-2,y-2,w+4,h+4,.95,.05,lam('#fbf8f0'));
      bx(g,K(935),K(10),K(30),K(30),1,.5,lam('#2a3036'));bx(g,K(990),K(12),K(44),K(28),1,.38,lam('#d0d4d6'));break;}
    case 'cooler':{bx(g,x,y,w,h,0,1.1,lam('#dfe8ee'));cy(g,mx,my,10,1.1,.45,lam('#7fb3d6',{transparent:true,opacity:.85}));break;}
    case 'printer':{bx(g,x,y,w,h,0,1.0,lam('#d6d9db'));bx(g,x+10,y+8,w-20,6,1.0,.04,lam('#2a3036'),false);bx(g,x+14,y+20,w-28,14,1.0,.06,lam('#fbfaf6'),false);break;}
    case 'copier':{bx(g,x,y,w,h,0,1.15,lam('#b8bec2'));bx(g,x+6,y+6,w-12,h-24,1.15,.05,lam('#e4e8ea'),false);break;}
    case 'box':{bx(g,x,y,w,h,0,.55,lam('#8c6d3a'));bx(g,x+3,y+3,w-6,6,.55,.03,lam('#e3c27a'),false);staticTags.push({t:'결재함',x:mx,y:my,h:1.0,small:true});break;}
    case 'reception':{bx(g,x,y,w,h,0,1.05,lam('#3d4a54'));bx(g,x+6,y+6,w-12,14,1.05,.04,lam('#e8e2d3'),false);break;}
    case 'plant':{cy(g,mx,my,w/2,0,.5,lam('#b5653a'));const lf=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),lam('#5fa86a'));lf.scale.setScalar(w/2*U*1.5);lf.position.set(mx*U,.95,my*U);lf.castShadow=true;g.add(lf);break;}
    case 'rtable':{cy(g,mx,my,w/2,0,.74,lam('#b89a72'));break;}
    case 'stairhouse':{bx(g,x,y,w,h,0,2.9,lam('#7d868e'));const dx=x<FW/2?x+w-6:x;bx(g,dx,my-40,6,80,0,2.2,lam('#8a6a4a'));staticTags.push({t:x<FW/2?'왼쪽 문':'오른쪽 문',x:mx,y:my,h:3.2});break;}
    case 'ac':{bx(g,x,y,w,h,0,1.0,lam('#c3c9cd'));for(const c of[x+w*.3,x+w*.7])cy(g,c,my,h*.32,1.0,.04,lam('#5d666e'),false);break;}
    case 'tank':{cy(g,mx,my,w/2,0,2.4,lam('#6f8fa6'));cy(g,mx,my,w/2-8,2.4,.06,lam('#4f6f86'),false);break;}
    case 'ashtray':{cy(g,mx,my,w/2,0,.7,lam('#4b555d'));break;}
    case 'bench':{bx(g,x,y,w,h,0,.45,lam('#8a6a4a'));break;}
    case 'pillar':{const m=bx(g,x,y,w,h,0,WALL_H,ownMat(new THREE.MeshLambertMaterial({color:'#e9e6df',transparent:true,opacity:1})));wallMs.push(m);break;}
    case 'sofa':{bx(g,x,y,w,h,0,.42,lam('#7d5b4a'));bx(g,x,y,w,10,.42,.45,lam('#6d4e3f'));break;}
    case 'gate':{bx(g,x,y,w,h,0,1.0,lam('#9aa3ab'));bx(g,mx-4,y+3,8,8,1.0,.04,lam('#2f7d4f',{emissive:'#2f7d4f',emissiveIntensity:.6}),false);break;}
    case 'table':{bx(g,x,y,w,h,0,.74,lam('#b89a72'));break;}
    case 'exec':{bx(g,x,y,w,h,0,.8,lam('#5a3b28'));bx(g,mx-20,y+6,40,4,.8,.4,lam('#2a3036'));break;}
    case 'cabinet':{bx(g,x,y,w,h,0,1.9,lam('#9aa3ab'));break;}
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
  String(text).split('\n').forEach((ln,i,arr)=>x.fillText(ln,c.width/2,c.height/2+(i-(arr.length-1)/2)*c.height/arr.length*.9));
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
function deskProps(g,o){
  const x=o.x,y=o.y,w=o.w,h=o.h,MUG=['#fbfaf6','#cf3626','#2b6cb0','#e0c23d','#3fbf6a'];
  const seatsX=[x+63-15,x+189-15];
  for(const sxx of seatsX){
    bx(g,sxx,y+14,30,8,.77,.03,lam('#2a3036'),false);
    bx(g,sxx,y+h-22,30,8,.77,.03,lam('#2a3036'),false);
    mug(g,sxx+38,y+18,MUG[(Math.round(x+sxx))%5]);mug(g,sxx-8,y+h-18,MUG[(Math.round(y+sxx))%5]);
  }
  /* desk lamp */
  const lx=x+w-30,ly=y+h-30;cy(g,lx,ly,4,.77,.03,lam('#3d4a54'),false);
  const arm=new THREE.Mesh(GEO.box,lam('#3d4a54'));arm.scale.set(.03,.32,.03);arm.position.set(lx*U,.93,ly*U);arm.rotation.z=.4;g.add(arm);
  const sh=new THREE.Mesh(new THREE.ConeGeometry(.09,.1,12,1,true),lam('#e0c23d',{emissive:'#e0c23d',emissiveIntensity:.5,side:THREE.DoubleSide}));sh.position.set(lx*U+.07,1.08,ly*U);g.add(sh);
  /* paper stacks */
  for(let i=0;i<3;i++)bx(g,x+w/2+18,y+8+i*.01,14,18,.77+i*.03,.03,lam(i%2?'#f6f3ea':'#fbfaf6'),false);
}
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
        const c=new THREE.Group(),m=lam('#3d4a54');const s=new THREE.Mesh(GEO.cyl,m);s.scale.set(.22,.08,.22);s.position.y=.42;c.add(s);
        const b=new THREE.Mesh(GEO.box,m);b.scale.set(.42,.38,.06);b.position.set(0,.66,-.2);c.add(b);
        c.position.set(cx*U,0,cyy*U);c.rotation.y=toYaw(face);c.children.forEach(k=>k.castShadow=true);g.add(c);}}
    /* laptop + water bottles */
    bx(g,o.x+o.w/2-14,o.y+o.h/2-10,28,20,.74,.02,lam('#c3c9cd'),false);
    for(let i=0;i<3;i++)cy(g,o.x+20+i*30,o.y+o.h/2,3,.74,.2,lam('#9fd3f0',{transparent:true,opacity:.75}),false);
  }
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
  for(const o of fl.ob)if(o.k==='cluster')deskProps(g,o);
  meetingProps(g,fl);
  if(f>0)for(let y=K(390);y<K(420);y+=8)bx(g,0,y,12,7,.0+((y/8)%3)*.12,.11,lam('#fbfaf6'),false);
  /* screens and server lights flicker a little */
  const scrM=lam('#9edceb',{emissive:'#4fa8bd',emissiveIntensity:.25}),led=lam('#5fd38a',{emissive:'#5fd38a',emissiveIntensity:.9});
  floorAnim.push(()=>{scrM.emissiveIntensity=.22+Math.sin(G.t*3)*.05;led.emissiveIntensity=Math.sin(G.t*7)>0?1.1:.2;});
}

/* ---------- characters ---------- */
const bodyGeo=new THREE.CapsuleGeometry(.29,.4,6,14),headGeo=new THREE.SphereGeometry(.28,20,16),eyeGeo=new THREE.SphereGeometry(.042,8,6);
const hairGeo=new THREE.SphereGeometry(.295,20,12,0,Math.PI*2,0,Math.PI*.48);
const ringGeo=new THREE.RingGeometry(.46,.56,36),shGeo=new THREE.CircleGeometry(.34,20);
const eyeMat=basic('#2b2b2b'),blushMat=basic('#f5a3a3');
const HAIRS=['#3a2d28','#6b3e2e','#2e2a28','#8a5a3a','#4a3a35','#1f1b1a','#7a5a40'];
function makeChar(color,kind,seed){
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  const bm=new THREE.MeshLambertMaterial({color}),sm=new THREE.MeshLambertMaterial({color:'#f6d3b3'});
  const hm=new THREE.MeshLambertMaterial({color:kind==='boss'?'#9a9aa0':kind==='ceo'?'#d8d8dc':kind==='cleaner'?'#f2a65a':HAIRS[seed%HAIRS.length]});
  const mats=[bm,sm,hm];
  const body=new THREE.Mesh(bodyGeo,bm);body.position.y=.5;body.castShadow=true;inner.add(body);
  const head=new THREE.Mesh(headGeo,sm);head.position.y=1.1;head.castShadow=true;inner.add(head);
  const hair=new THREE.Mesh(hairGeo,hm);hair.position.set(0,1.12,-.03);hair.rotation.x=-.25;inner.add(hair);
  for(const sx of[-1,1]){const e=new THREE.Mesh(eyeGeo,eyeMat);e.position.set(sx*.095,1.1,.255);inner.add(e);
    const b=new THREE.Mesh(eyeGeo,blushMat);b.scale.set(1.3,.7,.5);b.position.set(sx*.17,1.03,.23);inner.add(b);}
  if(kind==='boss'||kind==='ceo'){const tm=new THREE.MeshLambertMaterial({color:kind==='ceo'?'#e0b43d':'#e35d5d'});mats.push(tm);
    const tie=new THREE.Mesh(GEO.box,tm);tie.scale.set(.09,.3,.05);tie.position.set(0,.66,.28);inner.add(tie);
    const mu=new THREE.Mesh(GEO.box,hm);mu.scale.set(.17,.04,.05);mu.position.set(0,1.02,.27);inner.add(mu);}
  if(kind==='ceo'){const cr=new THREE.Mesh(new THREE.TorusGeometry(.33,.04,8,24),new THREE.MeshLambertMaterial({color:'#c08a1e',emissive:'#c08a1e',emissiveIntensity:.4}));cr.rotation.x=Math.PI/2;cr.position.y=.78;inner.add(cr);}
  if(kind==='courier'){const bxm=new THREE.Mesh(GEO.box,lam('#c8955a'));bxm.scale.set(.42,.32,.32);bxm.position.set(0,.72,.36);bxm.castShadow=true;inner.add(bxm);
    const cap=new THREE.Mesh(GEO.cyl,lam('#3d4a54'));cap.scale.set(.3,.06,.3);cap.position.y=1.36;inner.add(cap);}
  if(kind==='newbie'){const card=new THREE.Mesh(GEO.box,lam('#2b6cb0'));card.scale.set(.1,.13,.02);card.position.set(0,.62,.3);inner.add(card);}
  if(kind==='cart'){const ct=new THREE.Group();const b=new THREE.Mesh(GEO.box,lam('#7a4b2a'));b.scale.set(.75,.55,.5);b.position.y=.42;b.castShadow=true;ct.add(b);
    const top=new THREE.Mesh(GEO.box,lam('#e8e2d3'));top.scale.set(.78,.04,.53);top.position.y=.72;ct.add(top);
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
  g.userData={inner,bm,base:new THREE.Color(color),mats,ring,aura,carry,cloak:false};
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
  u.inner.position.y=sit?-.18:mv?Math.abs(Math.sin(G.t*(o.sprint?17:11)))*.07:0;
  u.inner.rotation.z=!isNpc&&o.stunT>0?Math.sin(G.t*12)*.25:0;
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
function glyph(k,x,y,s){
  const it=ITEMS[k];ctx.fillStyle=it.c;rr(x-s/2,y-s/2,s,s,s*.24);ctx.fill();ctx.strokeStyle='#fbfaf6';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fbfaf6';ctx.font=F(800,it.g.length>1?s*.36:s*.52);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(it.g,x,y+1);ctx.textBaseline='alphabetic';ctx.textAlign='left';
}

/* ---------- main render ---------- */
const tmpV=new THREE.Vector3(),dirV=new THREE.Vector3();
function render(dt){
  if(!G||!G.me)return; // online: nothing to draw until the first snapshot
  const me=G.me;
  const focus=me.alive?me:(leader()||me);if(focus.f>=0)viewF=focus.f;
  const f=viewF;
  if(builtF!==f)buildFloor(f);
  for(const fn of floorAnim)fn(dt);
  const k=Math.min(1,dt*7);cam.x+=(focus.x-cam.x)*k;cam.y+=(focus.y-cam.y)*k;
  const zoom=VW<VH?1.4:VW<700?1.15:1,sx=shake>0?(Math.random()-.5)*.35:0,sz=shake>0?(Math.random()-.5)*.35:0;
  cam3.position.set(cam.x*U+sx,16.5*zoom,cam.y*U+10.5*zoom+sz);cam3.lookAt(cam.x*U,0,cam.y*U-.4);
  const onFloor=me.alive&&me.f===f&&!me.transit;
  fogOn=onFloor&&!(G.blackout&&G.blackout.f===f);

  /* fade walls that stand between the camera and me */
  let hits=null;
  if(onFloor){tmpV.set(me.x*U,1,me.y*U);rc.set(cam3.position,dirV.copy(tmpV).sub(cam3.position).normalize());const lim=cam3.position.distanceTo(tmpV);
    hits=new Set(rc.intersectObjects(wallMs,false).filter(h=>h.distance<lim).map(h=>h.object));}
  for(const w of wallMs){const tg=hits&&hits.has(w)?.2:1;w.material.opacity+=(tg-w.material.opacity)*Math.min(1,dt*10);w.material.depthWrite=w.material.opacity>.9;}
  for(const dm of doorMs){dm.closed.visible=!dm.d.open;dm.ow.visible=dm.d.open;}
  for(const sm of seatMs)sm.m.color.set(sm.s.owner===me?'#2b6cb0':'#4b555d');

  /* drop meshes left over from a previous game */
  for(const[a,m]of actorM)if(!G.actors.includes(a)){scene.remove(m);actorM.delete(a);}
  for(const[n,m]of npcM)if(!G.npcs.includes(n)){scene.remove(m);npcM.delete(n);}
  /* actors */
  for(const a of G.actors){
    let m=actorM.get(a);if(!m){m=makeChar(a.color,null,a.id);actorM.set(a,m);}
    const vis=a.alive&&a.f===f&&!a.transit&&(a===me||seenBy(me,a))&&!(a.cloakT>0&&a!==me&&!ally(me,a));
    m.visible=vis;if(!vis)continue;
    poseChar(m,a,dt,false);const u=m.userData;
    setCloak(u,a.cloakT>0?.4:1);
    u.ring.visible=a.isPlayer||ally(me,a);if(u.ring.visible)u.ring.material.color.set(a===me?'#2b6cb0':ally(me,a)?'#3fbf6a':OTHER_HUMAN);
    const aura=a.ammo>0?CAT.atk.c:a.speedT>0?CAT.move.c:a.shieldN>0||a.vipT>0?CAT.def.c:null;
    u.aura.visible=!!aura;if(aura){u.aura.material.color.set(aura);u.aura.scale.setScalar(.8+Math.sin(G.t*6)*.06);}
    u.carry.visible=!!a.carry;
    u.bm.color.copy(u.base);if(a.flash>0)u.bm.color.lerp(WHITE,Math.min(.8,a.flash*2.5));
  }
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
  sun.intensity=G.blackout&&G.blackout.f===f?.25:1.65;
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
    const label=a===me?`나 · ${rankName(a)}`:`${a.name} ${rankName(a)}`;
    tag(x,y-12,label,a===me?'#2b6cb0':a.isPlayer?OTHER_HUMAN:'rgba(251,250,246,.94)',a===me||a.isPlayer?'#fbfaf6':'#1d2328');
    ctx.fillStyle='#1d2328';ctx.fillRect(x-18,y+1,36,5);ctx.fillStyle=a.g<30?'#cf3626':'#2f7d4f';ctx.fillRect(x-17,y+2,34*Math.max(0,a.g)/100,3);
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
  for(const p of G.pops){if(p.f!==f)continue;const s=scr(p.x,p.y,1.9+p.t*1.2);if(!s)continue;ctx.globalAlpha=Math.max(0,1-p.t/1.1);outlined(p.text,s[0],s[1],F(800,15),p.color);ctx.globalAlpha=1;}
}
