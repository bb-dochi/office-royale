/* 성과 rewards (docs/CAREER.md 2장): what each 성과 step unlocks. One list for both sides: the game loads it as a classic
   script, the server imports it for this side effect (server/src/outfit.js) — so the 옷장 locks, the server's checks
   and the admin page's reward table never disagree. Data only: no DOM, no three.js.
   `aw` is the 성과 id (server/src/career.js AWARDS), `st` the step (1 인턴 … 5 임원).
   hair = locked hair styles, gear = worn pieces, fx = a trail while running, color = locked swatches, titles = one per step */
globalThis.REWARDS = {
  awards: { days: '근속일수', night: '야근 수당', promo: '승진의 길', ceo: 'CEO 입성', tasks: '회사의 기둥', kills: '인사권자' },
  steps: ['인턴', '사원', '대리', '팀장', '임원'],
  hair: { slick: { n: '2대8 가르마', aw: 'days', st: 3 }, messy: { n: '부스스', aw: 'night', st: 3 }, pony: { n: '포니테일', aw: 'promo', st: 3 },
    allback: { n: '올백', aw: 'ceo', st: 3 }, perm: { n: '뽀글 파마', aw: 'tasks', st: 3 }, buzz: { n: '반삭', aw: 'kills', st: 3 } },
  gear: { sleeves: { n: '팔토시', aw: 'days', st: 4 }, goldBadge: { n: '금장 사원증', aw: 'days', st: 5 }, eyebags: { n: '다크서클', aw: 'night', st: 4 },
    pillow: { n: '목베개', aw: 'night', st: 5 }, shades: { n: '선글라스', aw: 'ceo', st: 4 }, postit: { n: '포스트잇', aw: 'tasks', st: 4 },
    gloves: { n: '검은 장갑', aw: 'kills', st: 4 } },
  fx: { gold: { n: '금가루', aw: 'ceo', st: 5 }, paper: { n: '서류 날림', aw: 'tasks', st: 5 }, wind: { n: '칼바람', aw: 'kills', st: 5 } },
  color: { '#6e1f33': { n: '와인 정장', key: 'topC', aw: 'promo', st: 5 } },
  titles: { days: ['수습 딱지', '개근상', '출근 도장', '터줏대감', '회사가 집'], night: ['칼퇴 실패', '야근 요정', '막차 단골', '형광등 지킴이', '퇴근이 뭐죠'],
    promo: ['될성부른 떡잎', '고속 승진', '낙하산 의혹', '사내 정치 9단', '임원 전용 주차'], ceo: ['대표 대행', '연임 성공', '오너 일가', '회장님', '명예회장'],
    tasks: ['일잘러', '엑셀 장인', '결재 머신', '회사의 기둥', '인간 ERP'], kills: ['첫 결재', '칼바람', '구조조정 담당', '인사 태풍', '저승사자'] },
};
