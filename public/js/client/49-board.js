/* ================= 사내 게시판: update notes =================
   Opened from the board in the lobby (E), the 사내 게시판 tab or the link on the guide card.
   A post is new until the board has been opened once after it went up (or-board keeps the highest id seen);
   while one is new the tab, the link and the board itself say NEW!.
   Add a post at the TOP with the next id. Keep it short: what changed, in the players' words.
   A line can be {t, s:[...]} for a heading with smaller lines under it; __words__ are underlined.
   A post with `at` (a KST time) stays hidden until then, so a change that starts later can be posted ahead. */
const BOARD_ALL=[
  {id:5,d:'11.02',at:'2026-11-02T00:00:00+09:00',t:'랭킹 점수 계산식이 바뀌었어요',b:['이제 1위도 마지막 직급대로 점수를 받아요(기존엔 모두 CEO 점수). 대신 1위 보너스가 생겼어요.']},
  {id:6,d:'10.30',t:'부서별 업무와 사원증이 생겼어요!',b:[
    '내 자리에서 __부서별 업무__를 하게 돼요.',
    '__사원증__에서 옷 갈아입기, 기기별 연동, __성과__를 확인할 수 있어요.',
    {t:'작은 업데이트',s:['옆팀 팀장님이 벽 너머로 말을 걸지 못하게 했어요.',
      '방금 끝낸 업무가 같은 자리에 바로 다시 뜨던 문제를 고쳤어요.','심부름 보상이 __거리에 따라__ 늘어나요.','마케팅팀 전단지가 더 강력해졌어요!']}]},
  {id:4,d:'10.29',t:'봇과 화캉스 코인이 바뀌었어요',b:['봇이 움직이는 사람을 노려서 던져요. 화캉스 차트는 오르락내리락, 꼭대기에서 팔면 대박!']},
  {id:2,d:'10.29',t:'사내 게시판이 생겼어요',b:['로비 사내 카페, 커피 머신 옆 벽에 게시판을 걸었어요. 새 소식은 여기 붙여요.','새 글이 있으면 메뉴와 게시판에 NEW!가 떠요.']},
  {id:1,d:'10.28',t:'(주)오피스로얄이 문을 열었어요!',b:['신입 사원 여러분, 입사를 환영합니다. 업무로 고과를 쌓고 서류로 동료의 고과를 깎아, 최후의 1인만 CEO층에 올라가요.',
    '튜토리얼부터 차근차근 시작해서, 어려움(랭킹전)까지 도전해 보세요!']},
];
const BOARD=BOARD_ALL.filter(p=>!p.at||Date.now()>=Date.parse(p.at));
const boardTop=BOARD.reduce((m,p)=>Math.max(m,p.id),0);
const boardSeen=()=>+(store.get('or-board')||0);
function boardMark(){
  const on=boardTop>boardSeen();PZ.boardNew=on;
  for(const el of document.querySelectorAll('.newmark'))el.hidden=!on;
}
const boardText=l=>esc(l).replace(/__(.+?)__/g,'<u>$1</u>');
const boardLine=l=>typeof l==='string'?`<li>${boardText(l)}</li>`:`<li>${boardText(l.t)}<ul>${l.s.map(boardLine).join('')}</ul></li>`;
function boardOpen(){
  const seen=boardSeen();
  const days=[];for(const p of BOARD){const d=days[days.length-1];if(d&&d.d===p.d)d.ps.push(p);else days.push({d:p.d,ps:[p]});} // one date heading per day
  $('boardList').innerHTML=days.map(d=>`<section><time>${d.d}</time>${d.ps.map(p=>`<article class="${p.id>seen&&p.id===boardTop?'fresh':''}"><header><h2>${esc(p.t)}</h2>${p.id>seen&&p.id===boardTop?'<i class="newchip">NEW</i>':''}</header>
    <ul>${p.b.map(boardLine).join('')}</ul></article>`).join('')}</section>`).join('');
  $('boardSheet').hidden=false;$('boardList').scrollTop=0;fbLoad();
  store.set('or-board',String(boardTop));boardMark();
}
/* ---------- 자유게시판: reviews, bug reports and wishes, next to the update notes (server/src/feedback.js) ----------
   Same sheet as the notes: a second column on wide screens, a second tab on phones, loaded when the board opens.
   Newest first; name = 사원명; one line up to 200 characters; my own can be deleted */
const FB={items:[]};
const fbURL=(what='')=>rankURL('',what?'feedback/'+what:'feedback');
const fbWhen=ms=>{const d=new Date(ms+9*3600e3);return`${d.getUTCMonth()+1}.${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;};
function fbRender(){
  $('fbCount').textContent=FB.items.length||'';
  $('fbList').innerHTML=FB.items.length?FB.items.slice().reverse().map(c=>`<li><div><b>${esc(c.name)}</b><time>${fbWhen(c.at)}</time>${c.mine?`<button class="fbdel" data-id="${c.id}">삭제</button>`:''}</div><p>${esc(c.text)}</p></li>`).join('')
    :'<li class="fbnone">아직 의견이 없어요. 첫 의견을 남겨 주세요!</li>';
}
function fbLoad(){
  $('fbMsg').textContent='';fbRender();
  fetch(fbURL()+`?uid=${rankUid()}`).then(r=>r.json()).then(v=>{if(v&&v.items){FB.items=v.items;fbRender();}}).catch(()=>{$('fbMsg').textContent='의견 서버에 연결하지 못했어요.';});
}
const fbPost=(what,body)=>fetch(fbURL(what),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:rankUid(),...body})}).then(r=>r.json());
$('fbForm').addEventListener('submit',e=>{
  e.preventDefault();const inp=$('fbIn'),btn=$('fbForm').querySelector('button'),text=inp.value.trim(),msg=$('fbMsg');
  if(text.length<2){msg.textContent='두 글자 이상 적어 주세요';return;}
  btn.disabled=true;msg.textContent='';
  fbPost('',{name:store.get('or-name')||'신입',post:0,text}).then(r=>{btn.disabled=false;if(!r.ok){msg.textContent=r.err||'남기지 못했어요';return;}
    FB.items.push(r.item);inp.value='';fbRender();msg.textContent='고마워요! 잘 읽을게요.';}).catch(()=>{btn.disabled=false;msg.textContent='의견 서버에 연결하지 못했어요';});
});
$('fbList').addEventListener('click',e=>{const d=e.target.closest('.fbdel');if(!d||!confirm('이 의견을 지울까요?'))return;const id=+d.dataset.id;
  fbPost('del',{id}).then(r=>{if(r.ok){FB.items=FB.items.filter(c=>c.id!==id);fbRender();}});});
/* phones: the two tabs flip which column shows (wide screens show both and hide the tabs) */
$('bdTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$('bdCols').dataset.p=b.dataset.p;
  for(const x of $('bdTabs').children)x.classList.toggle('on',x===b);});
const boardClose=()=>{$('boardSheet').hidden=true;};
$('boardX').addEventListener('click',boardClose);
$('boardSheet').addEventListener('click',e=>{if(e.target===$('boardSheet'))boardClose();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('boardSheet').hidden){e.stopImmediatePropagation();boardClose();}},true);
$('hBoard').addEventListener('click',boardOpen);
$('dock').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.go==='board')boardOpen();});
boardMark();
