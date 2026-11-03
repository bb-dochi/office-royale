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
  fl.spots.toilet={x:128,y:44}; // the one stall in the restroom (화캉스)
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
  f.spots.board={x:818,y:62}; // 사내 게시판 on the cafe's back wall, left of the counter: the lobby reads update notes from it
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
  f.ob.push(O(50,190,26,26,'ashtray',0),O(50,560,26,26,'ashtray',0),O(1024,190,26,26,'ashtray',0),O(1024,560,26,26,'ashtray',0));
  f.ob.push(O(460,90,180,24,'bench',0),O(460,646,180,24,'bench',0));
  /* lunch tables for groups: the table blocks, the bench seats on both long sides are real seats anyone can take */
  const lunchTable=(x,y)=>{f.ob.push(O(x,y,120,50,'picnic',0));let n=f.seats.filter(s=>s.bench).length;
    for(const sx of[x+22,x+60,x+98])for(const[sy,fa]of[[y-17,Math.PI/2],[y+67,-Math.PI/2]])f.seats.push({f:ROOF,x:sx,y:sy,face:fa,dept:'옥상 식탁',name:`옥상 식탁 ${++n}번`,owner:null,occ:null,bench:true});};
  lunchTable(200,340);lunchTable(340,340);lunchTable(640,340);lunchTable(780,340);
  f.labels.push(['전담파 흡연구역',90,50],['연초파 흡연구역',850,50],['물탱크',520,318]);
  FLOORS.push(f);
}
/* _obs: what blocks walking and shots now; shut: the path-grid cells a shut door covers (NPC paths avoid them) */
const refreshObs=fl=>{fl._obs=fl.ob.concat(fl.doors.filter(d=>!d.open));fl.shut=[];
  for(const d of fl.doors)if(!d.open)for(let gy=Math.max(0,Math.floor((d.y-R-1)/CS));gy<=Math.min(GH-1,Math.floor((d.y+d.h+R+1)/CS));gy++)
    for(let gx=Math.max(0,Math.floor((d.x-R-1)/CS));gx<=Math.min(GW-1,Math.floor((d.x+d.w+R+1)/CS));gx++){const px=gx*CS+CS/2,py=gy*CS+CS/2;
      if(px>d.x-R-1&&px<d.x+d.w+R+1&&py>d.y-R-1&&py<d.y+d.h+R+1)fl.shut.push(gy*GW+gx);}};
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
/* d: full description · s: the short one shown when you pick it up */
const ITEMS={
  coffee:{n:'아이스 아메리카노',d:'즉시 회복 +7',s:'회복 +7',cat:'heal',g:'커',w:2},
  stapler:{n:'스테이플러',d:'15발 연사',s:'15발 연사',cat:'atk',g:'철',w:2},
  bundle:{n:'서류 뭉치',d:'던지면 터져서 주변 -8',s:'맞은 자리 폭발',cat:'atk',g:'뭉',w:1.5},
  spill:{n:'식은 커피',d:'바닥에 쏟기: 밟으면 미끄러지고 -5',s:'바닥 함정',cat:'ctl',g:'쏟',w:1.5},
  card:{n:'법카',d:'회식 소집: 주변 3초 기절',s:'주변 3초 기절',cat:'ctl',g:'₩',w:1},
  stamp:{n:'결재 도장',d:'공격 3번 막기',s:'3번 막기',cat:'def',g:'印',w:2},
  vip:{n:'노캔 이어폰',d:'10초간 상사 감지 면제',s:'10초 상사 무시',cat:'def',g:'🎧',w:1},
  ticket:{n:'야근 식권',d:'8초간 속도 +45%',s:'8초 빨라짐',cat:'move',g:'식',w:2},
  lighter:{n:'라이터',d:'점심: 우리 재떨이로 가져가면 1점',s:'우리 재떨이로!',cat:'move',g:'🔥',w:0},
  food:{n:'배달 음식',d:'즉시 고과 +15',s:'고과 +15',cat:'heal',g:'밥',w:0},
};
for(const k in ITEMS)ITEMS[k].c=CAT[ITEMS[k].cat].c;
const ITEM_KEYS=Object.keys(ITEMS).filter(k=>ITEMS[k].w>0);
function randItem(){let t=0;for(const k of ITEM_KEYS)t+=ITEMS[k].w;let r=Math.random()*t;for(const k of ITEM_KEYS){r-=ITEMS[k].w;if(r<=0)return k;}return 'coffee';}
/* every 팀장 gets a Q skill; 임원 makes it stronger and quicker (see useSkill) */
/* pas: always on · sk/skd: the Q skill and what it does (shown on the team choice memo) */
/* teams: decided at the 사원 promotion by what you did most as an intern (see assignTeam).
   디자인 is kept here but out of TEAMS for now. pt / kt: the passive and the skill in a few words; pw: the weak
   passive a 대리 already gets. Nothing below 대리, weak passive at 대리, full passive + Q skill at 팀장, stronger at 임원 */
const BRANCH={hr:{n:'인사팀장',pw:'받는 피해 -5%',pt:'받는 피해 -10%',kt:'1명 묶기',pas:'받는 서류 피해 감소',sk:'면담',skd:'근처 1명을 1.5초 묶어 둠',cd:14,c:'#2f9e57'},
  dev:{n:'개발팀장',pw:'업무 1.5배',pt:'업무 2배',kt:'업무·이동 가속',pas:'업무 속도 2배 · 사원증 태그 0.3초',sk:'크런치',skd:'5초간 업무 2배 더 · 이동 빨라짐',cd:18,c:'#2f74c4'},
  mkt:{n:'마케팅팀장',pw:'사거리 +12%',pt:'사거리 +25%',kt:'부채꼴 공격',pas:'서류 사거리 +25%',sk:'전단지',skd:'조준한 쪽으로 전단지 7장 (가까울수록 많이 맞음)',cd:12,c:'#c08a1e'},
  design:{n:'디자인팀장',pw:'부장님 시야 -15%',pt:'부장님 시야 ↓',kt:'4초 투명',pas:'부장님 시야 30% 좁게',sk:'위장',skd:'4초간 투명 (던지면 풀림)',cd:20,c:'#8d4bbf'}};
const TEAMS=['dev','mkt','hr'];
const BRANCH_PICK=12; // seconds a new 팀장 has to pick a team before one is picked for them
const EXEC_CD=.6; // 임원: skill cooldown ×0.6 and a bigger effect
const RANKS=[[0,'인턴'],[55,'사원'],[65,'대리'],[80,'팀장'],[95,'임원']];
const TAG={인턴:2,사원:1.75,대리:1.5,팀장:1,'임원':.5};
const RANK_ORDER=['인턴','사원','대리','팀장','임원'];
const rankAt=(a,r)=>RANK_ORDER.indexOf(a.rank)>=RANK_ORDER.indexOf(r);
/* how much of the team's passive is on: 0 below 대리, half at 대리, all from 팀장 */
const teamK=a=>!a.branch?0:rankAt(a,'팀장')?1:rankAt(a,'대리')?.5:0;
const teamShort=k=>BRANCH[k]?BRANCH[k].n.replace('팀장',''):'';
const rankName=a=>!a.branch?a.rank:a.rank==='팀장'?BRANCH[a.branch].n:`${teamShort(a.branch)}팀 ${a.rank}`;
const tagOf=a=>(TAG[a.rank]||2)*(a.branch==='dev'?[1,.7,.3][teamK(a)*2]:1); // 개발: tag faster (대리 ×0.7, 팀장 ×0.3)
const rankOf=p=>{let n='인턴';for(const[t,r]of RANKS)if(p>=t)n=r;return n;};
const gradeOf=g=>g>=85?'S':g>=70?'A':g>=50?'B':g>=30?'C':'D';
const GREET_P={아부꾼:.95,성실파:.75,정치꾼:.7,폭주:.3,루팡:.6};
