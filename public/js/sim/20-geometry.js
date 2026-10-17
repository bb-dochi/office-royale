/* ================= geometry ================= */
const cellOf=(x,y)=>[Math.max(0,Math.min(GW-1,Math.floor(x/CS))),Math.max(0,Math.min(GH-1,Math.floor(y/CS)))];
function freeCell(bl,gx,gy){
  if(!bl[gy*GW+gx])return[gx,gy];
  for(let r=1;r<10;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=gx+dx,y=gy+dy;if(x>=0&&y>=0&&x<GW&&y<GH&&!bl[y*GW+x])return[x,y];}
  return[gx,gy];
}
const prev=new Int32Array(GW*GH);
function findPath(f,sx,sy,tx,ty){
  const bl=FLOORS[f].blocked;
  const[a0,a1]=freeCell(bl,...cellOf(sx,sy)),[b0,b1]=freeCell(bl,...cellOf(tx,ty));
  const s=a1*GW+a0,t=b1*GW+b0;if(s===t)return[{x:tx,y:ty}];
  prev.fill(-1);prev[s]=s;const q=[s];let h=0;
  while(h<q.length){const c=q[h++];if(c===t)break;const cx=c%GW,cy=(c/GW)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=cx+dx,ny=cy+dy;
      if(nx<0||ny<0||nx>=GW||ny>=GH)continue;const n=ny*GW+nx;if(bl[n]||prev[n]!==-1)continue;
      if(dx&&dy&&(bl[cy*GW+nx]||bl[ny*GW+cx]))continue;prev[n]=c;q.push(n);}}
  if(prev[t]===-1)return[];
  const out=[{x:tx,y:ty}];let c=prev[t];while(c!==s){out.push({x:(c%GW)*CS+CS/2,y:((c/GW)|0)*CS+CS/2});c=prev[c];}
  if(bl[t])out[0]={x:b0*CS+CS/2,y:b1*CS+CS/2};
  return out.reverse();
}
function segHits(x1,y1,x2,y2,o,pad){
  const mnx=o.x-pad,mny=o.y-pad,mxx=o.x+o.w+pad,mxy=o.y+o.h+pad;
  if((x1<mnx&&x2<mnx)||(x1>mxx&&x2>mxx)||(y1<mny&&y2<mny)||(y1>mxy&&y2>mxy))return false;
  const dx=x2-x1,dy=y2-y1;let t0=0,t1=1;
  if(dx===0){if(x1<mnx||x1>mxx)return false;}
  else{let a=(mnx-x1)/dx,b=(mxx-x1)/dx;if(a>b){const t=a;a=b;b=t;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false;}
  if(dy===0){if(y1<mny||y1>mxy)return false;}
  else{let a=(mny-y1)/dy,b=(mxy-y1)/dy;if(a>b){const t=a;a=b;b=t;}if(a>t0)t0=a;if(b<t1)t1=b;if(t0>t1)return false;}
  return true;
}
function shotLos(f,x1,y1,x2,y2,pad=0){for(const o of obsOf(f))if(segHits(x1,y1,x2,y2,o,pad))return false;return true;}
function sightLos(f,x1,y1,x2,y2){for(const o of obsOf(f))if(o.sight&&segHits(x1,y1,x2,y2,o,0))return false;return true;}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d;};
const inRect=(p,z)=>p.x>z.x&&p.x<z.x+z.w&&p.y>z.y&&p.y<z.y+z.h;
function randFree(f,margin=40){
  const bl=FLOORS[f].blocked;
  for(let i=0;i<300;i++){const x=margin+Math.random()*(FW-2*margin),y=margin+Math.random()*(FH-2*margin);const[gx,gy]=cellOf(x,y);
    if(!bl[gy*GW+gx]&&dist({x,y},PADS.stair)>70&&dist({x,y},PADS.elev)>70&&!inRect({x,y},FLOORS[f].rest))return{x,y};}
  return{x:FW/2,y:FH/2+150};
}
