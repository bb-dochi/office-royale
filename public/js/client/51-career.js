/* ================= 사원증: 옷장 / 성과 / 인사관리 =================
   The 사원증 is the old dressing room card with three tabs. 옷장 is the dressing room (45-plaza.js). 성과 lists the six
   basic achievements the server judges from the career totals (server/src/career.js AWARDS), with the step reached and
   how far the next one is.
   인사관리 reads the career the server keeps per 사원코드 (server/src/career.js, GET /api/career) and links devices:
   다른 기기에서 이어하기 shows a 10-minute 연동 번호, 사원증 불러오기 takes 사원코드 + 연동 번호 from another device. */
const CR={tab:'wear',view:null,pinT:null,note:''};
const careerURL=(what='')=>rankURL('',what?'career/'+what:'career'); // same server rule as the ranking
function idTab(t){
  CR.tab=t;$('home').dataset.idtab=t;for(const b of $('idTabs').children)b.classList.toggle('on',b.dataset.t===t);
  $('paneWear').hidden=t!=='wear';$('paneAward').hidden=t!=='award';$('paneCareer').hidden=t!=='career';$('dressReset').hidden=t!=='wear';
  if(t==='award'||t==='career')careerLoad();
}
$('idTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)idTab(b.dataset.t);});
/* phones: the on-screen keyboard covers the 기기 연동 inputs, so bring the one being typed in into view */
$('paneCareer').addEventListener('focusin',e=>{if(e.target.matches('input'))setTimeout(()=>e.target.scrollIntoView({block:'center'}),300);});
function careerLoad(){
  if(!CR.view)$('crBox').innerHTML='<p class="awmsg">불러오는 중…</p>';
  if(!CR.view)awardRender();
  fetch(careerURL()+`?uid=${rankUid()}`).then(r=>r.json()).then(v=>{if(!v||!v.career)throw 0;CR.view=v;if(v.code)store.set('or-code',v.code);profApply(v.prof);if(v.code&&!v.prof&&store.get('or-profAt'))profPush();careerRender();awardRender();})
    .catch(()=>{if(!CR.view){$('crBox').innerHTML='<p class="awmsg">사원증 서버에 연결하지 못했어요.</p>';$('awList').innerHTML='<li class="awmsg">사원증 서버에 연결하지 못했어요.</li>';}});
}
/* 성과: one row each — name, what it counts, the 5 step chips (reached ones filled) and a bar to the next goal */
const AW_STEPS=['인턴','사원','대리','팀장','임원'];
/* until the server opens them (career.js AWARDS_ON) the tab just says they're coming */
function awardRender(){if(!CR.view||!CR.view.awards){$('awList').innerHTML='<li class="awsoon"><b>🏅 성과 준비 중</b><small>보상과 함께 곧 열려요!</small></li>';return;}
  const v=CR.view;if(!v||!v.awards)return;const got=v.awards.reduce((s,a)=>s+a.step,0);
  const fmt=(a,x)=>a.names?a.names[a.at.indexOf(x)]:`${x.toLocaleString()}${a.unit}`;
  $('awList').innerHTML=`<li class="awsum">성과 단계 <b>${got}</b> / ${v.awards.length*5}</li>`+v.awards.map(a=>{
    const done=a.step>=a.at.length,next=a.at[a.step],prev=a.step?a.at[a.step-1]:0,pct=done?100:Math.max(4,Math.min(100,(a.val-prev)/(next-prev)*100));
    return`<li class="aw${a.step?' got':''}"><div class="awh"><b>${esc(a.n)}</b><span class="awrk">${a.step?(a.names||AW_STEPS)[a.step-1]:'—'}</span></div>
      <small>${esc(a.d)} · 지금 ${a.names?(a.names[a.val-1]||'인턴'):a.val.toLocaleString()+a.unit}</small>
      <div class="awsteps">${a.at.map((x,i)=>`<i class="${i<a.step?'on':''}" title="${AW_STEPS[i]}: ${fmt(a,x)}">${a.names?a.names[i]:AW_STEPS[i]}</i>`).join('')}</div>
      <div class="awbar"><span style="width:${pct}%"></span><em>${done?'모든 단계 달성!':a.names?`다음: ${fmt(a,next)} 달성`:`다음 ${AW_STEPS[a.step]}: ${fmt(a,next)}`}</em></div></li>`;}).join('');
}
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
