/* ================= 사원증: 옷장 / 성과 / 인사관리 =================
   The 사원증 is the old dressing room card with three tabs. 옷장 is the dressing room (45-plaza.js). 성과 lists the six
   basic achievements the server judges from the career totals (server/src/career.js AWARDS), with the step reached and
   how far the next one is.
   인사관리 reads the career the server keeps per 사원코드 (server/src/career.js, GET /api/career) and links devices:
   다른 기기에서 이어하기 shows a 10-minute 연동 번호, 사원증 불러오기 takes 사원코드 + 연동 번호 from another device. */
const CR={tab:'wear',view:null,pinT:null,note:'',open:new Set(),doneOpen:false};   // open: the 성과 cards showing their rewards
const careerURL=(what='')=>rankURL('',what?'career/'+what:'career'); // same server rule as the ranking
function idTab(t){
  CR.tab=t;$('home').dataset.idtab=t;for(const b of $('idTabs').children)b.classList.toggle('on',b.dataset.t===t);
  $('paneWear').hidden=t!=='wear';$('paneAward').hidden=t!=='award';$('paneCareer').hidden=t!=='career';$('dressReset').hidden=t!=='wear';
  if(t==='award'||t==='career')careerLoad();
}
$('idTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)idTab(b.dataset.t);});
/* phones: the on-screen keyboard covers the 기기 연동 inputs. The card follows the visible height (iOS doesn't shrink the
   page for the keyboard, visualViewport does) and the input being typed in is brought into view */
if(window.visualViewport){const vv=()=>document.documentElement.style.setProperty('--vvh',visualViewport.height+'px');visualViewport.addEventListener('resize',vv);vv();}
$('paneCareer').addEventListener('focusin',e=>{if(e.target.matches('input'))setTimeout(()=>e.target.scrollIntoView({block:'center'}),300);});
function careerLoad(){
  if(!CR.view)$('crBox').innerHTML='<p class="awmsg">불러오는 중…</p>';
  if(!CR.view)awardRender();
  fetch(careerURL()+`?uid=${rankUid()}`).then(r=>r.json()).then(v=>{if(!v||!v.career)throw 0;CR.view=v;rwPrune();rwLentCheck();newsAdd(v.news);newsCheck();if(v.code)store.set('or-code',v.code);profApply(v.prof);if(v.code&&!v.prof&&store.get('or-profAt'))profPush();careerRender();awardRender();if(typeof PZ!=='undefined'&&PZ.dress&&CR.tab==='wear')dressRender();})
    .catch(()=>{if(!CR.view){$('crBox').innerHTML='<p class="awmsg">사원증 서버에 연결하지 못했어요.</p>';$('awList').innerHTML='<li class="awmsg">사원증 서버에 연결하지 못했어요.</li>';}});
}
/* 성과: one row each — name, what it counts, the 5 step chips (reached ones filled) and a bar to the next goal */
/* what one 성과 step gives (public/js/shared/rewards.js): its 칭호 and the 옷장 pieces, each with how to picture it */
const AW_PIC={shades:['eyes','face'],eyebags:['faceK','face'],goldBadge:['badgeK','badge'],dragon:['gear','dragon'],cig:['gear','face'],coffee:['gear','cup'],crown:['gear','crown'],sash:['gear','sash'],trophy:['gear','trophy'],halo:['gear','halo'],watch:['gear','wrist'],tissue:['gear','tail'],pillow:['gear','neck'],postit:['gear','note']},AW_FX={gold:'✨',paper:'📄',wind:'💨',smoke:'🚬',escort:'🕴️'},AW_THR={plane:'✈️',sticky:'🟨',trophy:'🏆',keyboard:'⌨️',mug:'☕'};
const AW_KIND={top:['top','chest'],hair:['hair','head'],eye:['eye','face'],face:['faceK','face'],shoe:['shoe','feet'],bottom:['bottom','legs']},AW_COL={topC:'chest',bottomC:'legs',shoeC:'feet',hairC:'head',tie:'chest'};
function awRewards(aw,st){const R=REWARDS,out=[],at=r=>r.aw===aw&&r.st===st;
  for(const[kind,[k,view]]of Object.entries(AW_KIND))for(const[id,r]of Object.entries(R[kind]))if(at(r))out.push({n:r.n,fit:[k,id],view});
  for(const[id,r]of Object.entries(R.gear))if(at(r)){const[k,view]=AW_PIC[id]||['gear','chest'];out.push({n:r.n,fit:[k,id],view});}
  for(const[id,r]of Object.entries(R.color))if(at(r))out.push({n:r.n,fit:[r.key,id],view:AW_COL[r.key]||'chest'});
  for(const[id,r]of Object.entries(R.fx))if(at(r))out.push({n:`이펙트: ${r.n}`,icon:AW_FX[id]});
  for(const[id,r]of Object.entries(R.thr))if(at(r))out.push({n:r.n,icon:AW_THR[id]});
  return{title:(R.titles[aw]||[])[st-1]||null,items:out};}
/* until the server opens them (career.js AWARDS_ON) the tab just says they're coming */
function awardRender(){if(!CR.view||!CR.view.awards){$('awList').innerHTML='<li class="awsoon"><b>🏅 성과 준비 중</b><small>보상과 함께 곧 열려요!</small></li>';return;}
  const v=CR.view;if(!v||!v.awards)return;const jobs=[],doneN=v.awards.filter(a=>a.step>=a.at.length).length;let doneSeen=false;
  const fmt=(a,x)=>a.names?a.names[a.at.indexOf(x)]:`${x.toLocaleString()}${a.unit}`;
  /* a step's reward as a tile: a picture of the default outfit wearing it (as in the 옷장), or an icon for a trail */
  const tile=r=>{if(r.icon)return`<figure><b>${r.icon}</b><figcaption>${esc(r.n)}</figcaption></figure>`;
    const f=rwShotFit(r.fit[0],r.fit[1]),url=shotKnown(f,r.view);if(!url)jobs.push([f,r.view]);
    return`<figure><img alt="" ${url?`src="${url}"`:`data-j="${jobs.length-1}"`}><figcaption>${esc(r.n)}</figcaption></figure>`;};
  /* opened card: every step with its goal and what it gives */
  const detail=a=>`<div class="awdet">${a.at.map((x,i)=>{const r=awRewards(a.id,i+1),on=i<a.step;
    return`<div class="awr${on?' on':''}"><span class="awg">${fmt(a,x)}</span><div class="awi">${r.title?`<em class="tstamp">${esc(r.title)}</em>`:''}${r.items.length?`<div class="awt">${r.items.map(tile).join('')}</div>`:''}</div><i aria-label="${on?'받음':'아직'}">${on?'✓':'🔒'}</i></div>`;}).join('')}</div>`;
  const nextTxt=a=>{const r=awRewards(a.id,a.step+1);return[r.title&&`<i class="tstamp">${esc(r.title)}</i>`,...r.items.map(x=>esc(x.n))].filter(Boolean).join(' · ');};
  $('awList').innerHTML=`<li class="awsum"><small>쉬움 난이도는 집계되지 않아요<br>자세한 보상은 각 성과를 눌러보세요!</small><span>달성한 성과 <b>${doneN}</b> / ${v.awards.length}</span></li>`+[...v.awards].sort((x,y)=>(x.step>=x.at.length)-(y.step>=y.at.length)).map(a=>{
    const done=a.step>=a.at.length,next=a.at[a.step],prev=a.step?a.at[a.step-1]:0,pct=done?100:Math.max(4,Math.min(100,(a.val-prev)/(next-prev)*100)),now=a.names?(a.names[a.val-1]||'인턴'):a.val.toLocaleString(),open=CR.open.has(a.id);   // 지금 값 / 다음 목표
    const last=awRewards(a.id,a.at.length),lastPic=last.items[0],lastT=REWARDS.titles[a.id].filter(Boolean).pop();   // the top reward shows without opening the card
    const first=done&&!doneSeen;if(done)doneSeen=true;   // finished ones go last, folded under one line
    return`${first?`<li class="awdonebar" id="awDone">달성한 성과 ${doneN}개 <span>${CR.doneOpen?'접기 ▴':'펼치기 ▾'}</span></li>`:''}<li class="aw${a.step?' got':''}${open?' open':''}${done?' done':''}"${done&&!CR.doneOpen?' hidden':''} data-aw="${a.id}"><div class="awtop"><div class="awm"><div class="awh"><b>${esc(a.n)}</b><span class="awrk">${now} / ${done?fmt(a,a.at[a.at.length-1]):fmt(a,next)}</span></div>
      <small>${esc(a.d)}</small>
      <div class="awsteps">${a.at.map((x,i)=>`<i class="${i<a.step?'on':''}">${fmt(a,x)}</i>`).join('')}</div>
      ${done?'':`<div class="awbar"><span style="width:${pct}%"></span><em>${nextTxt(a)?`다음 보상: ${nextTxt(a)}`:`다음 목표: ${fmt(a,next)}`}</em></div>`}</div><div class="awfin${done?' on':''}">${lastPic?tile(lastPic):`<figure><b class="tt"><span class="tstamp">${esc(lastT)}</span></b><figcaption>칭호</figcaption></figure>`}</div></div>${open?detail(a):''}</li>`;}).join('');
  shotQ=[...$('awList').querySelectorAll('img[data-j]')].map(img=>[img,...jobs[+img.dataset.j]]);if(shotQ.length)setTimeout(shotPump,0);
}
$('awList').addEventListener('click',e=>{if(e.target.closest('#awDone')){CR.doneOpen=!CR.doneOpen;awardRender();return;}const li=e.target.closest('.aw');if(!li)return;const id=li.dataset.aw;if(!CR.open.delete(id))CR.open.add(id);awardRender();});
/* 근무 N일째: KST calendar days from 입사 to today, counting both (a game is an 출근, counted separately) */
const workDays=ms=>{const k=t=>Math.floor((t+9*3600e3)/864e5);return k(Date.now())-k(ms)+1;};
const ymd=ms=>{const d=new Date(ms+9*3600e3);return`${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}`;};
const playTime=s=>s>=3600?`${Math.floor(s/3600)}시간 ${Math.floor(s%3600/60)}분`:`${Math.floor(s/60)}분`;
/* 인사관리: an 인사기록카드 (name, 사원코드 with a copy button, 입사일, 최고 직급), a grid of numbers, then 기기 연동 as two
   clear choices — share this one (연동 번호) or bring one in (folded until opened) */
function careerRender(){
  const v=CR.view,c=v.career,RK=['인턴','사원','대리','팀장','임원','CEO'],best=RK[c.bestRank]||'인턴',name=esc(store.get('or-name')||v.name||'신입'); // the name in use now (the server keeps the one of the last game)
  const card=v.code?`<div class="hrcard"><div class="hrh"><span>인사기록카드</span><span class="hrrk">최고 직급 · <b>${best}</b></span></div>
      <div class="hrb"><div class="hrph" id="crPhoto">${name.slice(0,1)}</div><div><div class="hrn">${name}</div><div class="hrcode">사원코드 <b>${v.code}</b><button class="hrcp" id="crCopy">복사</button></div><div class="hrm">입사 ${ymd(v.joined)} · 근무 ${workDays(v.joined)}일째</div></div></div></div>
    <div class="hrgrid"><div><b>${c.games}번</b><span>출근 횟수</span></div><div><b>${c.ceo}</b><span>CEO 입성</span></div><div><b>${playTime(c.sec)}</b><span>버틴 시간</span></div>
      <div><b>${c.tasks}</b><span>누적 업무</span></div><div><b>${c.kills}</b><span>누적 해고</span></div><div><b>${best}</b><span>최고 직급</span></div></div>`
    :`<div class="hrcard empty"><div class="hrh"><span>인사기록카드</span></div><p>아직 사원코드가 없어요.<br><b>첫 판을 마치면</b> 사원코드가 발급되고 기록이 쌓여요.</p></div>`;
  $('crBox').innerHTML=card+`<section class="hrsec"><h4 class="hrt">🔗 기기 연동</h4><p class="hrsub">휴대폰과 PC에서 같은 사원증을 써요.</p>
    ${v.code?`<div class="hrbox"><b>이 사원증을 다른 기기에서 쓰기</b><p>연동 번호를 받아, 다른 기기의 <b>사원증 불러오기</b>에 사원코드와 함께 넣어요.</p>
      <button class="btn small" id="crPin">연동 번호 받기</button><p class="crpin" id="crPinOut"></p></div>`:''}
    <details class="hrbox"${v.code?'':' open'}><summary><b>다른 기기의 사원증 불러오기</b></summary><p>다른 기기에서 받은 사원코드와 연동 번호를 넣으면 그 사원증을 이 기기에서 같이 써요.</p>
      <div class="crjoin"><input id="crCode" placeholder="사원코드 (예: 261028-4821)" maxlength="11" autocomplete="off"><input id="crPinIn" placeholder="연동 번호 6자리" inputmode="numeric" maxlength="6" autocomplete="off"><button class="btn small" id="crJoin">불러오기</button></div><p class="crmsg" id="crMsg"></p></details></section>`;
  const ph=$('crPhoto');if(ph)try{ph.style.backgroundImage=`url(${charPhoto(myFit())})`;ph.textContent='';}catch{} // the first letter stays if it can't be drawn
  if($('crPin'))$('crPin').addEventListener('click',careerPin);$('crJoin').addEventListener('click',careerJoin);
  if($('crCopy'))$('crCopy').addEventListener('click',()=>{const b=$('crCopy');(navigator.clipboard?navigator.clipboard.writeText(v.code):Promise.reject()).then(()=>{b.textContent='복사됨';},()=>{b.textContent=v.code;});setTimeout(()=>{if(b.isConnected)b.textContent='복사';},1500);});
  if(CR.note){$('crMsg').textContent=CR.note;$('crMsg').classList.add('ok');$('crMsg').closest('details').open=true;CR.note='';}
}
/* 옷장·사원명 연동: the outfit and 사원명 are kept on the 사원코드 too. A change here is sent (a moment later, once);
   reading the career (page load, 사원증 tabs, after 불러오기) takes the server's if it is newer than this device's */
let profT=0;
function profSave(){store.set('or-profAt',String(Date.now()));clearTimeout(profT);profT=setTimeout(profPush,800);}
function profPush(){if(!store.get('or-code'))return;post('profile',{fit:myFit(),name:store.get('or-name')||'',at:+(store.get('or-profAt')||0)}).catch(()=>{});}
function profApply(p){
  if(!p||!p.fit)return;const mine=+(store.get('or-profAt')||0);
  if(mine>p.at){profPush();return;} // this device changed since: send it
  if(mine===p.at)return;
  store.set('or-profAt',String(p.at));try{localStorage.setItem('or-fit',JSON.stringify(p.fit));}catch{}
  if(p.name)store.set('or-name',p.name);
  if(typeof G!=='undefined'&&G&&G.plaza&&G.me){G.me.fit=cleanFit(p.fit);if(p.name)G.me.name=p.name;dropMesh(G.me);if(PZ.dress)dressRender();
    if(PZ.ws&&PZ.ws.readyState===1){PZ.ws.send(JSON.stringify({t:'pz-fit',fit:G.me.fit}));if(p.name)PZ.ws.send(JSON.stringify({t:'pz-name',name:p.name}));}}
  if(p.name){$('myName').textContent=p.name;$('nameIn').value=p.name;if(typeof lobbyNameShow==='function')lobbyNameShow(false);}
}
const post=(what,body)=>fetch(careerURL(what),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:rankUid(),...body})}).then(r=>r.json());
function careerPin(){
  post('pin',{}).then(r=>{if(!r.pin){$('crPinOut').textContent=r.err||'연동 번호를 받지 못했어요.';return;}clearInterval(CR.pinT);
    const tick=()=>{const left=Math.max(0,Math.round((r.exp-Date.now())/1000)),el=$('crPinOut');if(!el){clearInterval(CR.pinT);return;}
      el.innerHTML=left?`연동 번호 <strong>${r.pin}</strong> · ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')} 동안 한 번 쓸 수 있어요`:'시간이 지났어요. 다시 받아 주세요.';if(!left)clearInterval(CR.pinT);};
    tick();CR.pinT=setInterval(tick,1000);}).catch(()=>{$('crPinOut').textContent='연동 번호를 받지 못했어요.';});
}
function careerJoin(){
  const code=$('crCode').value.trim(),pin=$('crPinIn').value.trim(),m=$('crMsg');
  if(!/^\d{6}-\d{4}$/.test(code)||!/^\d{6}$/.test(pin)){m.textContent='사원코드(예: 261028-4821)와 연동 번호 6자리를 넣어 주세요.';return;}
  if(CR.view&&CR.view.career.games&&!confirm(`이 기기의 지금 사원증(${CR.view.code}, 근무 ${CR.view.career.games}일)은 더 이상 쓰지 않게 돼요. 불러올까요?`))return;
  post('join',{code,pin}).then(r=>{if(!r.ok){m.textContent=r.err||'불러오지 못했어요.';return;}
    CR.note=`사원증 ${r.code}을 불러왔어요! 이제 두 기기에서 같이 쌓여요.`;CR.view=null;store.set('or-profAt','0');careerLoad();}).catch(()=>{m.textContent='사원증 서버에 연결하지 못했어요.';});
}
/* a device with a 사원코드 picks up outfit / name changes made on its other devices when the page opens */
if(store.get('or-code'))fetch(careerURL()+`?uid=${rankUid()}`).then(r=>r.json()).then(v=>{if(v&&v.code)profApply(v.prof);}).catch(()=>{});
/* 성과 달성: after a solo game a big 도장 comes down on the result (the server answered there), then the list stays. A match, or a result left too soon: a note back in the lobby */
const NEWS={shown:new Set(),wait:[]},newsKey=x=>`${x.aw}:${x.st}`;
function newsRows(list){const row=x=>{const r=awRewards(x.aw,x.st),f=r.items[0],pic=f?(f.icon?`<b>${f.icon}</b>`:`<img alt="" src="${charShot(rwShotFit(f.fit[0],f.fit[1]),f.view)}">`):'<b>🏅</b>';
    return`<div class="nwr">${pic}<p>${esc(REWARDS.awards[x.aw])} ${esc(x.goal)}<small>${[r.title&&`<i class="tstamp">${esc(r.title)}</i>`,...r.items.map(i=>esc(i.n))].filter(Boolean).join(' · ')}</small></p></div>`;};
  return`<h5>새로 달성한 성과 ${list.length}개</h5>${list.slice(0,3).map(row).join('')}${list.length>3?`<p class="nwm">외 ${list.length-3}개</p>`:''}`;}
function resultNews(list){const b=$('rBang');b.innerHTML=`성과 달성<small>${esc(REWARDS.awards[list[0].aw])} ${esc(list[0].goal)}${list.length>1?` 외 ${list.length-1}개`:''}</small>`;b.hidden=false;if(typeof SFX!=='undefined')SFX.promote();
  setTimeout(()=>{b.hidden=true;if($('result').hidden)return;for(const x of list)NEWS.shown.add(newsKey(x));$('rNews').innerHTML=newsRows(list);$('rNews').hidden=false;},1300);}
function newsAdd(l){for(const x of l||[])if(!NEWS.shown.has(newsKey(x))&&!NEWS.wait.some(y=>newsKey(y)===newsKey(x)))NEWS.wait.push(x);}
function newsCheck(){if(!NEWS.wait.length||!PZ.on||!$('rankWin').hidden)return;const list=NEWS.wait.splice(0);for(const x of list)NEWS.shown.add(newsKey(x));
  $('rankWinH').textContent='성과 달성!';$('rankWinS').textContent='';$('rankWinList').innerHTML=newsRows(list);$('rankWinList').hidden=false;$('rankWin').hidden=false;if($('nameStep').hidden&&!PZ.dress)homeClose(true);}
if(PZ.on)careerLoad();   // 후광 and 소지품 from the moment the lobby opens
