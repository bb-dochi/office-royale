/* ================= weekly solo ranking + play stats =================
   Every finished solo game goes to /api/game (server/src/rank.js): it counts toward the play stats on the admin page,
   and an 어려움 game also goes on the weekly board (reset every Monday KST, best score per device). The score is shown
   right away from the same formula; the server's answer adds my place. Plain static hosting has no /api: the score
   still shows, the board just says it can't connect. */
const RANKED='hard';
const RANK_PT={인턴:0,사원:50,대리:100,팀장:200,임원:300,CEO:500};
/* same formula as scoreOf() in server/src/rank.js: a win is a +300 bonus on the rank actually reached (real) */
const CEO_BONUS=300;
const soloScore=e=>(TOTAL+1-e.place)*50+RANK_PT[e.real||e.rank]+(e.place===1?CEO_BONUS:0)+e.kills*40+e.tasks*10+Math.floor(e.time/2);
const SCORE_HOW=`<table>${[['순위','1위 1,000점, 한 계단마다 −50'],['마지막 직급','사원 50 · 대리 100 · 팀장 200 · 임원 300'],['CEO 보너스','+300'],['해고','1명당 40'],['업무','1건당 10'],['버틴 시간','2초에 1점']].map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><p>기기마다 이번 주 최고 기록만 남아요.</p>`;
function rankUid(){let u=store.get('or-uid');if(!u||!/^[a-z0-9]{8,32}$/.test(u)){u=Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>(b%36).toString(36)).join('');store.set('or-uid',u);}return u;}
function rankURL(q,what='rank'){const s=new URLSearchParams(location.search).get('server');
  const base=s?`${/^(localhost|127\.|192\.168\.|10\.)/.test(s)?'http':'https'}://${s}`:'';return `${base}/api/${what}${q||''}`;}
/* "10/19(월) ~ 10/25(일) · 2일 5시간 뒤 초기화" from the board's week (its Monday, KST) */
function weekLabel(w){const mon=Date.parse(w+'T00:00:00+09:00'),end=mon+7*864e5,d=t=>{const x=new Date(t+9*3600e3);return `${x.getUTCMonth()+1}/${x.getUTCDate()}`;};
  const left=Math.max(0,end-Date.now()),dd=Math.floor(left/864e5),hh=Math.floor(left%864e5/36e5);
  return `${d(mon)}(월) ~ ${d(end-1)}(일) · ${dd?dd+'일 ':''}${hh}시간 뒤 초기화`;}
/* called from showResult in solo games */
function rankSubmit(win){
  const g=G,me=G.me,e={uid:rankUid(),name:store.get('or-name')||'신입',diff:G.diff||'normal',place:win?1:me.place,rank:win?'CEO':me.rank,real:me.rank,kills:me.kills||0,tasks:me.tasksDone||0,time:Math.round(me.alive?G.t:me.outT??G.t),lunch:G.lunchKind||'',branch:me.branch||'',lunchWin:!!me.lunchWin,wcGo:me.wcGo||0};
  const ranked=e.diff===RANKED,sc=soloScore(e);
  if(ranked){$('rScore').textContent=`${sc.toLocaleString()}점`;for(const el of document.querySelectorAll('#result .rsc'))el.hidden=false;} // only 어려움 is ranked
  fetch(rankURL('','game'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)}).then(r=>r.json()).then(r=>{
    const here=G===g&&!$('result').hidden;if(here)careerNews(r.career);else if(r.career&&r.career.code)store.set('or-code',r.career.code);
    careerLoad();   // what the game just unlocked, even if they've already left this screen (the lobby's own load may have come too soon)
    if(!here)return; // already on to the next game
    const k=r.rank;if(!k||!k.week)return;
    $('rScore').textContent=`${sc.toLocaleString()}점${k.me?` · 이번 주 ${k.me.pos}위`:''}${k.best?'':' (최고 기록 아님)'}`;}).catch(()=>{});
}
/* a solo game left from the pause menu ('restart' or 'lobby'): play stats only, no ranking or 성과 */
function rankQuit(quit){if(G.net||NETC.room||G.tutorial)return;
  const me=G.me,lunch=G.events.find(ev=>ev.kind==='lunch');
  fetch(rankURL('','game'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:rankUid(),name:store.get('or-name')||'신입',diff:G.diff||'normal',quit,rank:me.rank,kills:me.kills||0,tasks:me.tasksDone||0,time:Math.round(G.t),lunch:lunch&&lunch.stage===2?G.lunchKind||'':'',branch:me.branch||''})}).catch(()=>{});}
/* 같이 하기: the server records my game the moment I'm out, a little ahead of my result screen */
let newsLate=null;
function careerOnline(c){if(!c)return;if(!$('result').hidden){careerNews(c);careerLoad();return;}
  newsLate=c;setTimeout(()=>{if(newsLate!==c)return;newsLate=null;if(c.code)store.set('or-code',c.code);newsAdd(c.news);newsCheck();careerLoad();},3000);}
function careerLate(){const c=newsLate;if(!c)return;newsLate=null;careerNews(c);careerLoad();}
/* the server answers with this device's 사원코드 (it is made by the first finished game) */
function careerNews(c){if(c&&c.code)store.set('or-code',c.code);if(c&&c.news&&c.news.length)resultNews(c.news);}
function rankOpen(){$('rankSheet').hidden=false;rankLoad();}
const RK_COL={CEO:'#c08a1e',임원:'#1f52c8',팀장:'#3d6cc4',대리:'#5f80b4',사원:'#7a8ea6',인턴:'#8a929a'};
const rkChip=e=>`<i class="rkchip" style="background:${RK_COL[e.rank]||'#8a929a'}">${e.rank==='CEO'?'CEO 입성':e.rank}</i>`;
const rkSub=e=>`${e.rank==='CEO'?'':e.place+'위 · '}업무 ${e.tasks} · 해고 ${e.kills}`;
function rankLoad(){
  $('rankPod').innerHTML='';$('rankMe').innerHTML='';$('rankList').innerHTML='<p class="rkmsg">불러오는 중…</p>';$('rankWeek').textContent='';$('rankHow').innerHTML=SCORE_HOW;
  fetch(rankURL(`?uid=${rankUid()}`)).then(r=>r.json()).then(r=>{
    $('rankWeek').textContent=`${weekLabel(r.week)} · ${r.n}명 참가`;
    const top=r.top,nm=e=>`${esc(e.name)}${e.mine?' <span class="me">(나)</span>':''}`;
    /* top three: the 우수 사원 section of an HR report — ruled rows, bigger type, a red stamp on first place */
    $('rankPod').innerHTML=top.length?`<p class="rkcap">이번 주 우수 사원</p><ol>${top.slice(0,3).map((e,i)=>
      `<li class="${e.mine?'mine':''}"><b>${i+1}<small>위</small></b><span class="nm"><span class="hl">${nm(e)}</span><small>${rkSub(e)}</small></span>${i===0?'<i class="rkstamp">우수</i>':'<i></i>'}${rkChip(e)}<em>${e.score.toLocaleString()}</em></li>`).join('')}</ol>`:'';
    const row=(e,pos)=>`<li class="${e.mine?'mine':''}"><b>${pos}</b><span class="nm">${nm(e)}<small>${rkSub(e)}</small></span>${rkChip(e)}<em>${e.score.toLocaleString()}</em></li>`;
    $('rankList').innerHTML=!top.length?'<p class="rkmsg">아직 이번 주 기록이 없어요.<br>어려움 한 판이면 1등이에요.</p>':top.length>3?`<ol>${top.slice(3).map((e,i)=>row(e,i+4)).join('')}</ol>`:'';
    $('rankList').hidden=top.length>0&&top.length<=3;
    /* my line, always at the bottom */
    $('rankMe').innerHTML=r.me?`<span>내 기록</span><b>${r.me.pos}위</b><span class="nm">${rkSub(r.me)}</span><em>${r.me.score.toLocaleString()}점</em>`
      :`<span>이번 주 내 기록이 아직 없어요</span><button class="btn small" id="rankPlay">어려움 시작</button>`;
    const pb=$('rankPlay');if(pb)pb.addEventListener('click',()=>{$('rankSheet').hidden=true;start('hard');});
  }).catch(()=>{$('rankList').hidden=false;$('rankList').innerHTML='<p class="rkmsg">랭킹 서버에 연결하지 못했어요.</p>';});
}
$('rankX').addEventListener('click',()=>{$('rankSheet').hidden=true;});
$('rankBtn').addEventListener('click',()=>rankOpen());
$('hRank').addEventListener('click',()=>rankOpen());
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('rankSheet').hidden){e.stopImmediatePropagation();$('rankSheet').hidden=true;}},true);
