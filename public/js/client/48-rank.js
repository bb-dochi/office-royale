/* ================= weekly solo ranking + play stats =================
   Every finished solo game goes to /api/game (server/src/rank.js): it counts toward the play stats on the admin page,
   and an 어려움 game also goes on the weekly board (reset every Monday KST, best score per device). The score is shown
   right away from the same formula; the server's answer adds my place. Plain static hosting has no /api: the score
   still shows, the board just says it can't connect. */
const RANKED='hard';
const RANK_PT={인턴:0,사원:50,대리:100,팀장:200,임원:300,CEO:500};
/* same formula as scoreOf() in server/src/rank.js */
const soloScore=e=>(TOTAL+1-e.place)*50+RANK_PT[e.rank]+e.kills*40+e.tasks*10+Math.floor(e.time/2);
function rankUid(){let u=store.get('or-uid');if(!u||!/^[a-z0-9]{8,32}$/.test(u)){u=Array.from(crypto.getRandomValues(new Uint8Array(10)),b=>(b%36).toString(36)).join('');store.set('or-uid',u);}return u;}
function rankURL(q,what='rank'){const s=new URLSearchParams(location.search).get('server');
  const base=s?`${/^(localhost|127\.|192\.168\.|10\.)/.test(s)?'http':'https'}://${s}`:'';return `${base}/api/${what}${q||''}`;}
const weekLabel=w=>{const[,m,d]=w.split('-');return `${+m}/${+d}(월)부터`;};
/* called from showResult in solo games */
function rankSubmit(win){
  const me=G.me,e={uid:rankUid(),name:store.get('or-name')||'신입',diff:G.diff||'normal',place:win?1:me.place,rank:win?'CEO':me.rank,kills:me.kills||0,tasks:me.tasksDone||0,time:Math.round(me.alive?G.t:me.outT??G.t),lunch:G.lunchKind||''};
  const ranked=e.diff===RANKED,sc=soloScore(e);
  $('rScore').textContent=ranked?`${sc.toLocaleString()}점`:`${sc.toLocaleString()}점 · 랭킹은 어려움만`;$('rScoreRow').hidden=false;
  fetch(rankURL('','game'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)}).then(r=>r.json()).then(r=>{
    const k=r.rank;if(!k||!k.week)return;
    $('rScore').textContent=`${sc.toLocaleString()}점 · ${k.me?k.me.pos+'위':''}${k.best?'':' (이번 주 최고 기록 아님)'}`;}).catch(()=>{});
}
function rankOpen(){$('rankSheet').hidden=false;rankLoad();}
function rankLoad(){
  $('rankList').innerHTML='<p class="rkmsg">불러오는 중…</p>';$('rankWeek').textContent='';
  fetch(rankURL(`?uid=${rankUid()}`)).then(r=>r.json()).then(r=>{
    $('rankWeek').textContent=`이번 주 · ${weekLabel(r.week)} · ${r.n}명`;
    const row=(e,pos)=>`<li class="${e.mine?'mine':''}"><b>${pos}</b><span class="nm">${esc(e.name)}${e.mine?' (나)':''}<small>${e.rank==='CEO'?'CEO 입성':`${e.place}위 · ${e.rank}`} · 업무 ${e.tasks} · 해고 ${e.kills}</small></span><em>${e.score.toLocaleString()}</em></li>`;
    const mineIn=r.top.some(e=>e.mine);
    $('rankList').innerHTML=r.top.length?`<ol>${r.top.map((e,i)=>row(e,i+1)).join('')}${!mineIn&&r.me?`<li class="gap">…</li>${row(r.me,r.me.pos)}`:''}</ol>`:'<p class="rkmsg">아직 이번 주 기록이 없어요. 첫 기록의 주인공이 되어 보세요!</p>';
  }).catch(()=>{$('rankList').innerHTML='<p class="rkmsg">랭킹 서버에 연결하지 못했어요.</p>';});
}
$('rankX').addEventListener('click',()=>{$('rankSheet').hidden=true;});
$('rankBtn').addEventListener('click',()=>rankOpen());
$('hRank').addEventListener('click',()=>rankOpen());
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('rankSheet').hidden){e.stopImmediatePropagation();$('rankSheet').hidden=true;}},true);
