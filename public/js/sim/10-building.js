/* ================= building ================= */
const SC=1.4,K=v=>v*SC,FW=Math.round(1100*SC),FH=Math.round(760*SC),R=14,CS=20,GW=Math.ceil(FW/CS),GH=Math.ceil(FH/CS),TOTAL=20,NF=6,WIN=3,INTERVAL=40,WARN=10;
const PADS={stair:{x:K(70),y:K(690),n:'계단'},elev:{x:K(1030),y:K(690),n:'엘리베이터'}};
const DOOR={x:K(550),y:FH-26};
const O=(x,y,w,h,k,sight=1)=>({x:K(x),y:K(y),w:K(w),h:K(h),k,sight});
function room(x1,y1,x2,y2,side,at,len,k){
  const t=8,s=k==='glass'?0:1,out=[];
  const H=(y,a,b)=>{if(b-a>1)out.push(O(a,y,b-a,t,k,s));},V=(x,a,b)=>{if(b-a>1)out.push(O(x,a,t,b-a,k,s));};
  if(side==='t'){H(y1,x1,at);H(y1,at+len,x2+t);}else H(y1,x1,x2+t);
  if(side==='b'){H(y2,x1,at);H(y2,at+len,x2+t);}else H(y2,x1,x2+t);
  if(side==='l'){V(x1,y1,at);V(x1,at+len,y2);}else V(x1,y1,y2);
  if(side==='r'){V(x2,y1,at);V(x2,at+len,y2);}else V(x2,y1,y2);
  return out;
}
function mkFloor(i,name,short,carpet,grid){
  const fl={i,name,short,carpet,grid,ob:[],seats:[],labels:[],meet:[],recep:[],spots:{},wp:[],depts:[]};
  fl.ob.push(O(166,0,8,154,'wall'),O(0,146,110,8,'wall'));
  fl.doors=[Object.assign(O(110,146,56,8,'door'),{open:false,t:0,name:'화장실 문'})];
  fl.rest={x:0,y:0,w:166,h:146};
  fl.ob.push(O(880,0,220,54,'counter',0));fl.spots.coffee={x:950,y:80};
  fl.ob.push(O(1058,100,36,34,'cooler',0));fl.spots.cooler={x:1076,y:117};
  fl.ob.push(O(0,330,60,44,'printer',0));fl.spots.printer={x:30,y:352};
  fl.ob.push(O(0,430,60,54,'copier',0));fl.spots.copier={x:30,y:457};
  fl.labels.push(['화장실',40,80],['탕비실',890,140],['복사실',8,318]);
  return fl;
}
function cluster(fl,x,y,dept){
  fl.ob.push(Object.assign(O(x,y,180,70,'cluster',1),{dept}));
  let n=fl.seats.filter(s=>s.dept===dept).length;
  [[x+45,y-17,Math.PI/2],[x+135,y-17,Math.PI/2],[x+45,y+87,-Math.PI/2],[x+135,y+87,-Math.PI/2]].forEach(([sx,sy,fa])=>fl.seats.push({f:fl.i,x:sx,y:sy,face:fa,dept,name:`${dept} ${++n}번`,owner:null,occ:null}));
}
function sofa(fl,x,y,dept){
  fl.ob.push(O(x,y,160,36,'sofa',0));
  let n=fl.seats.filter(s=>s.dept===dept).length;
  [x+30,x+80,x+130].forEach(sx=>fl.seats.push({f:fl.i,x:sx,y:y+52,face:-Math.PI/2,dept,name:`${dept} ${++n}번`,owner:null,occ:null}));
}
function meetRoom(fl,x1,y1,x2,y2,side,at,name){
  fl.ob.push(...room(x1,y1,x2,y2,side,at,70,'glass'));
  const d=side==='l'?O(x1,at,8,70,'door'):side==='r'?O(x2,at,8,70,'door'):side==='t'?O(at,y1,70,8,'door'):O(at,y2,70,8,'door');
  fl.doors.push(Object.assign(d,{sight:0,glass:true,open:false,t:0,name:name+' 문'}));
  const z={x:x1+8,y:y1+8,w:x2-x1-8,h:y2-y1-8,name};fl.meet.push(z);
  fl.labels.push([name,x1+14,y1+28]);
  return z;
}
const FLOORS=[];
{ // 1F lobby
  const f=mkFloor(0,'로비','1F','#e6e1d7',100);
  f.ob=f.ob.filter(o=>o.k!=='printer'&&o.k!=='copier');delete f.spots.printer;delete f.spots.copier;
  f.labels=f.labels.filter(l=>l[0]!=='탕비실'&&l[0]!=='복사실');
  f.ob.push(O(300,430,80,14,'gate',0),O(430,430,80,14,'gate',0),O(560,430,80,14,'gate',0),O(690,430,80,14,'gate',0));
  f.ob.push(O(120,470,110,40,'reception',0));f.spots.badge={x:175,y:530};
  f.ob.push(O(430,560,240,46,'reception',0));f.recep.push({x:550,y:532},{x:550,y:636});
  f.ob.push(O(300,180,40,40,'pillar'),O(700,180,40,40,'pillar'));
  const cafeTable=(x,y)=>{f.ob.push(O(x,y,44,44,'rtable',0));let n=f.seats.filter(s=>s.dept==='카페').length;
    f.seats.push({f:0,x:x-18,y:y+22,face:0,dept:'카페',name:`카페 ${++n}번`,owner:null,occ:null},{f:0,x:x+62,y:y+22,face:Math.PI,dept:'카페',name:`카페 ${++n}번`,owner:null,occ:null});};
  cafeTable(820,190);cafeTable(950,190);cafeTable(820,290);cafeTable(950,290);
  sofa(f,130,560,'라운지 소파');sofa(f,250,650,'라운지 소파');
  f.ob.push(O(440,700,30,30,'plant'),O(630,700,30,30,'plant'),O(20,200,30,30,'plant'));
  f.ob.push(O(1040,480,26,26,'box',0));f.spots.box={x:1053,y:493};
  f.labels.push(['보안 게이트',490,420],['보안 데스크',120,462],['안내데스크',505,552],['라운지',140,548],['사내 카페',820,170],['엘리베이터 홀',930,640]);
  f.wp=[[200,370],[950,370],[950,520],[280,520]];
  FLOORS.push(f);
}
{ // 2F
  const f=mkFloor(1,'2층 총무·복사실','2F','#c7ccd1',50);
  cluster(f,220,200,'총무팀');cluster(f,460,200,'총무팀');cluster(f,220,380,'구매팀');cluster(f,460,380,'구매팀');cluster(f,220,550,'법무팀');cluster(f,460,550,'법무팀');
  meetRoom(f,760,200,1040,420,'l',290,'소회의실');f.ob.push(O(850,280,110,60,'table',0));
  f.ob.push(O(760,520,130,40,'cabinet'),O(905,520,130,40,'cabinet'));f.labels.push(['비품 창고',840,508]);
  f.ob.push(O(712,450,26,26,'box',0));f.spots.box={x:725,y:463};
  f.wp=[[190,325],[680,325],[680,505],[190,505]];
  FLOORS.push(f);
}
{ // 3F
  const f=mkFloor(2,'3층 영업·인사','3F','#cfc9c0',50);
  cluster(f,220,200,'영업1팀');cluster(f,460,200,'영업1팀');cluster(f,220,380,'영업2팀');cluster(f,460,380,'영업2팀');cluster(f,220,550,'인사팀');cluster(f,460,550,'인사팀');cluster(f,800,520,'인사팀');
  meetRoom(f,760,190,1040,380,'l',250,'영업 회의실');f.ob.push(O(850,260,110,50,'table',0));
  f.ob.push(O(712,430,26,26,'box',0));f.spots.box={x:725,y:443};
  f.wp=[[190,325],[680,325],[680,505],[190,505]];
  FLOORS.push(f);
}
{ // 4F
  const f=mkFloor(3,'4층 개발·마케팅','4F','#c2cac3',50);
  cluster(f,220,200,'개발팀');cluster(f,460,200,'개발팀');cluster(f,220,380,'개발팀');cluster(f,460,380,'마케팅팀');cluster(f,220,550,'마케팅팀');cluster(f,460,550,'마케팅팀');
  meetRoom(f,760,180,1040,350,'l',230,'대회의실');f.ob.push(O(850,240,110,50,'table',0));
  f.ob.push(...room(780,480,1040,640,'t',800,70,'wall'));f.doors.push(Object.assign(O(800,480,70,8,'door'),{open:false,t:0,name:'서버실 문'}));f.ob.push(O(880,520,140,26,'rack'),O(880,580,140,26,'rack'));
  f.spots.server={x:835,y:458};f.labels.push(['서버실',890,505]);
  f.ob.push(O(712,420,26,26,'box',0));f.spots.box={x:725,y:433};
  f.wp=[[190,325],[680,325],[680,505],[190,505]];
  FLOORS.push(f);
}
{ // 5F
  const f=mkFloor(4,'5층 기획·재무','5F','#c9c4d0',50);
  cluster(f,220,200,'기획팀');cluster(f,460,200,'기획팀');cluster(f,220,560,'재무팀');cluster(f,460,560,'재무팀');
  meetRoom(f,240,345,620,475,'t',400,'전략 회의실');f.ob.push(O(360,395,140,44,'table',0));
  meetRoom(f,760,200,1040,420,'l',290,'재무 회의실');f.ob.push(O(850,280,110,60,'table',0));
  f.ob.push(O(712,470,26,26,'box',0));f.spots.box={x:725,y:483};
  f.wp=[[190,316],[690,316],[690,513],[190,513]];
  FLOORS.push(f);
}
{ // 6F
  const f=mkFloor(5,'6층 임원층','6F','#c7b8a6',60);
  meetRoom(f,180,180,470,400,'b',290,'전무실');f.ob.push(O(270,240,120,50,'exec',0));f.seats.push({f:5,x:330,y:310,face:-Math.PI/2,dept:'전무실',name:'전무실 의자',owner:null,occ:null});
  meetRoom(f,630,180,920,400,'b',740,'상무실');f.ob.push(O(720,240,120,50,'exec',0));f.seats.push({f:5,x:780,y:310,face:-Math.PI/2,dept:'상무실',name:'상무실 의자',owner:null,occ:null});
  cluster(f,220,520,'비서실');cluster(f,460,520,'비서실');sofa(f,740,560,'임원 라운지');
  f.ob.push(O(900,500,26,26,'box',0));f.spots.box={x:913,y:513};
  f.labels.push(['임원 라운지',760,548]);
  f.wp=[[150,450],[980,450],[980,650],[150,650]];
  FLOORS.push(f);
}
const ROOF=6;
{ // rooftop (lunch event only)
  const f={i:ROOF,name:'옥상',short:'RF',carpet:'#a3a8ab',grid:60,ob:[],seats:[],labels:[],meet:[],recep:[],spots:{coffee:{x:-9999,y:-9999},cooler:{x:-9999,y:-9999},box:{x:-9999,y:-9999}},wp:[],depts:[],doors:[],rest:{x:-999,y:-999,w:1,h:1}};
  f.ob.push(O(0,290,90,180,'stairhouse'),O(1010,290,90,180,'stairhouse'));
  f.ob.push(O(300,140,90,60,'ac'),O(710,140,90,60,'ac'),O(300,560,90,60,'ac'),O(710,560,90,60,'ac'));
  f.ob.push(O(500,330,100,100,'tank'));
  f.ob.push(O(170,90,26,26,'ashtray',0),O(900,640,26,26,'ashtray',0),O(170,640,26,26,'ashtray',0),O(900,90,26,26,'ashtray',0));
  f.ob.push(O(460,90,180,24,'bench',0),O(460,646,180,24,'bench',0));
  f.labels.push(['왼쪽 흡연구역',110,50],['오른쪽 흡연구역',850,50],['물탱크',520,318]);
  FLOORS.push(f);
}
const refreshObs=fl=>{fl._obs=fl.ob.concat(fl.doors.filter(d=>!d.open));};
const obsOf=f=>FLOORS[f]._obs;
for(const fl of FLOORS){
  refreshObs(fl);
  const P=p=>{p.x=K(p.x);p.y=K(p.y);};
  fl.rest={x:K(fl.rest.x),y:K(fl.rest.y),w:K(fl.rest.w),h:K(fl.rest.h)};
  fl.meet.forEach(z=>{z.x=K(z.x);z.y=K(z.y);z.w=K(z.w);z.h=K(z.h);});
  fl.seats.forEach(P);fl.recep.forEach(P);Object.values(fl.spots).forEach(P);
  fl.labels=fl.labels.map(([t,x,y])=>[t,K(x),K(y)]);fl.wp=fl.wp.map(([x,y])=>[K(x),K(y)]);
}
for(const fl of FLOORS){
  fl.blocked=new Uint8Array(GW*GH);
  for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++){
    const px=gx*CS+CS/2,py=gy*CS+CS/2;let b=px<R||py<R||px>FW-R||py>FH-R;
    if(!b)for(const o of fl.ob){if(px>o.x-R-1&&px<o.x+o.w+R+1&&py>o.y-R-1&&py<o.y+o.h+R+1){b=true;break;}}
    fl.blocked[gy*GW+gx]=b?1:0;
  }
}

const CAT={heal:{n:'회복',c:'#3fbf6a'},atk:{n:'공격',c:'#e5483a'},def:{n:'방어',c:'#3d8be0'},move:{n:'이동',c:'#e0c23d'},ctl:{n:'방해',c:'#a35dd6'}};
const ITEMS={
  coffee:{n:'아이스 아메리카노',d:'즉시 고과 +12',cat:'heal',g:'커',w:2},
  stapler:{n:'스테이플러',d:'15발 연사',cat:'atk',g:'철',w:2},
  bundle:{n:'서류 뭉치',d:'던지면 터져서 주변 -8',cat:'atk',g:'뭉',w:1.5},
  spill:{n:'식은 커피',d:'바닥에 쏟기: 밟으면 미끄러지고 -5',cat:'ctl',g:'쏟',w:1.5},
  card:{n:'법카',d:'회식 소집: 주변 3초 기절',cat:'ctl',g:'₩',w:1},
  stamp:{n:'결재 도장',d:'공격 3번 막기',cat:'def',g:'印',w:2},
  vip:{n:'임원 인맥',d:'10초간 상사 감지 면제',cat:'def',g:'VIP',w:1},
  ticket:{n:'야근 식권',d:'8초간 속도 +45%',cat:'move',g:'식',w:2},
  food:{n:'배달 음식',d:'즉시 고과 +15',cat:'heal',g:'밥',w:0},
};
for(const k in ITEMS)ITEMS[k].c=CAT[ITEMS[k].cat].c;
const ITEM_KEYS=Object.keys(ITEMS).filter(k=>ITEMS[k].w>0);
function randItem(){let t=0;for(const k of ITEM_KEYS)t+=ITEMS[k].w;let r=Math.random()*t;for(const k of ITEM_KEYS){r-=ITEMS[k].w;if(r<=0)return k;}return 'coffee';}
const BRANCH={hr:{n:'인사팀장',d:'고과 0이 돼도 한 번은 인턴으로 재입사 (고과 20)'},dev:{n:'개발팀장',d:'업무 속도 2배 · 사원증 태그 0.3초'},
  mkt:{n:'마케팅팀장',d:'스킬: 전단지 살포, 사방 광역 공격 (쿨 12초)',cd:12,sk:'전단지'},design:{n:'디자인팀장',d:'스킬: 위장, 4초 투명 · 부장님도 못 봄 (쿨 20초)',cd:20,sk:'위장'}};
const RANKS=[[0,'인턴'],[60,'대리'],[75,'팀장'],[90,'임원']];
const TAG={인턴:2,대리:1.5,팀장:1,'임원':.5};
const rankName=a=>!a.branch?a.rank:a.rank==='팀장'?BRANCH[a.branch].n:a.rank==='임원'?`임원(${BRANCH[a.branch].n.replace('팀장','')})`:a.rank;
const tagOf=a=>a.branch==='dev'?.3:(TAG[a.rank]||2);
const rankOf=p=>{let n='인턴';for(const[t,r]of RANKS)if(p>=t)n=r;return n;};
const gradeOf=g=>g>=85?'S':g>=70?'A':g>=50?'B':g>=30?'C':'D';
const GREET_P={아부꾼:.95,성실파:.75,정치꾼:.7,폭주:.3,루팡:.6};
