/* ================= 사내 게시판: update notes =================
   Opened from the board in the lobby (E), the 사내 게시판 tab or the link on the guide card.
   A post is new until the board has been opened once after it went up (or-board keeps the highest id seen);
   while one is new the tab, the link and the board itself say NEW!.
   Add a post at the TOP with the next id. Keep it short: what changed, in the players' words.
   A post with `at` (a KST time) stays hidden until then, so a change that starts later can be posted ahead. */
const BOARD_ALL=[
  {id:5,d:'11.02',at:'2026-11-02T00:00:00+09:00',t:'랭킹 점수 계산식이 바뀌었어요',b:['이제 1위도 마지막 직급대로 점수를 받아요(기존엔 모두 CEO 점수). 대신 1위 보너스가 생겼어요.']},
  {id:4,d:'10.29',t:'화캉스 코인이 바뀌었어요',b:['차트가 오르락내리락해요. 꼭대기에서 팔면 대박, 바닥이면 손절!']},
  {id:3,d:'10.29',t:'봇들이 달라졌어요',b:['서류가 전보다 잘 맞는 대신, 봇도 움직이는 사람을 노려서 던져요.']},
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
function boardOpen(){
  const seen=boardSeen();
  const days=[];for(const p of BOARD){const d=days[days.length-1];if(d&&d.d===p.d)d.ps.push(p);else days.push({d:p.d,ps:[p]});} // one date heading per day
  $('boardList').innerHTML=days.map(d=>`<section><time>${d.d}</time>${d.ps.map(p=>`<article class="${p.id>seen?'fresh':''}"><header><h2>${esc(p.t)}</h2>${p.id>seen?'<i class="newchip">NEW</i>':''}</header>
    <ul>${p.b.map(l=>`<li>${esc(l)}</li>`).join('')}</ul></article>`).join('')}</section>`).join('');
  $('boardSheet').hidden=false;$('boardList').scrollTop=0;
  store.set('or-board',String(boardTop));boardMark();
}
const boardClose=()=>{$('boardSheet').hidden=true;};
$('boardX').addEventListener('click',boardClose);
$('boardSheet').addEventListener('click',e=>{if(e.target===$('boardSheet'))boardClose();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('boardSheet').hidden){e.stopImmediatePropagation();boardClose();}},true);
$('hBoard').addEventListener('click',boardOpen);
$('dock').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.go==='board')boardOpen();});
boardMark();
