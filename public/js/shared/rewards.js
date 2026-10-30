/* 성과 rewards (docs/CAREER.md 2장): what each 성과 step unlocks. One list for both sides: the game loads it as a classic
   script, the server imports it for this side effect (server/src/outfit.js) — so the 옷장 locks, the server's checks
   and the admin page's reward table never disagree. Data only: no DOM, no three.js.
   `aw` is the 성과 id (server/src/career.js AWARDS), `st` the step (1 인턴 … 5 임원).
   Each kind is what it opens in the 옷장: top, hair, eye, face (얼굴 표시), shoe, bottom, gear (worn pieces), fx (a trail while running), thr (what the 서류 looks like when thrown), color (swatches, `key` is the fit field).
   No `aw`: free for everyone, except a colour, which stays locked until it is given to a step. `temp`: never owned, only lent for a week to last week's top 3 (career.js tempOf). titles = for some steps (null: none).
   Assigned on the local /admin?rw=1 page, which rewrites this file (tools/rewards-edit.mjs). */
globalThis.REWARDS = {
  awards: { days: '출근 일수', night: '근무 시간', promo: '승진의 길', ceo: 'CEO 입성', top3: '우수 사원', tasks: '결재 도장', kills: '해고 통지서', dev: '개발팀 근무', mkt: '마케팅팀 근무', hr: '인사팀 근무', wc: '존버는 승리한다' },
  steps: ['인턴', '사원', '대리', '팀장', '임원'],
  top: {
    pj: { n: '줄무늬 파자마 상의', aw: 'days', st: 4 },
    hoodie: { n: '후드티', aw: 'dev', st: 3 },
    check: { n: '체크셔츠', aw: 'dev', st: 2 },
    tee: { n: '거래소 티셔츠', aw: 'wc', st: 4 },
  },
  hair: {
    twin: { n: '양갈래', aw: 'night', st: 2 },
    slick: { n: '2대8 가르마', aw: 'mkt', st: 1 },
    messy: { n: '부스스', aw: 'dev', st: 1 },
    pony: { n: '포니테일', aw: 'night', st: 1 },
    allback: { n: '올백', aw: 'hr', st: 1 },
    perm: { n: '뽀글 파마', aw: 'night', st: 3 },
    buzz: { n: '반삭', aw: 'night', st: 4 },
  },
  eye: {
    dead: { n: '기절 표정', aw: 'kills', st: 4 },
    sparkle: { n: '초롱초롱 눈', aw: 'days', st: 1 },
    sleepy: { n: '게슴츠레 눈', aw: 'days', st: 3 },
    smile: { n: '실눈', aw: 'days', st: 2 },
  },
  face: {
    freckles: { n: '주근깨', aw: 'mkt', st: 2 },
    stamp: { n: '이마의 반려 도장', aw: 'tasks', st: 2 },
  },
  shoe: {
    sneaker: { n: '운동화', aw: 'kills', st: 1 },
    slipper: { n: '슬리퍼', aw: 'tasks', st: 1 },
  },
  bottom: {
    pj: { n: '줄무늬 파자마 바지', aw: 'days', st: 5 },
    shorts: { n: '반바지', aw: 'tasks', st: 1 },
  },
  gear: {
    dragon: { n: '용문신 토시', aw: 'kills', st: 2 },
    crown: { n: '왕관', aw: 'ceo', st: 2 },
    watch: { n: '금시계', aw: 'ceo', st: 1 },
    tissue: { n: '바지에 낀 휴지', aw: 'wc', st: 3 },
    sash: { n: '어깨띠', aw: 'top3', st: 1 },
    trophy: { n: '트로피', aw: 'top3', st: 1 },
    halo: { n: '후광', temp: true },
    goldBadge: { n: '금장 사원증', aw: 'top3', st: 1 },
    eyebags: { n: '다크서클', aw: 'hr', st: 2 },
    pillow: { n: '목베개', aw: 'wc', st: 2 },
    shades: { n: '선글라스', aw: 'kills', st: 1 },
    postit: { n: '포스트잇', aw: 'wc', st: 1 },
    cig: { n: '담배', aw: 'mkt', st: 3 },
    coffee: { n: '커피', aw: 'hr', st: 3 },
  },
  fx: {
    gold: { n: '금가루', aw: 'top3', st: 3 },
    paper: { n: '서류 날림', aw: 'tasks', st: 5 },
    wind: { n: '칼바람', aw: 'kills', st: 5 },
    smoke: { n: '담배연기', aw: 'night', st: 5 },
    escort: { n: '수행원', aw: 'ceo', st: 4 },
  },
  thr: {
    plane: { n: '종이비행기', aw: 'tasks', st: 4 },
    sticky: { n: '포스트잇 날리기', aw: 'tasks', st: 3 },
    trophy: { n: '작은 트로피', aw: 'top3', st: 2 },
    keyboard: { n: '키보드', aw: 'ceo', st: 3 },
    mug: { n: '머그컵', aw: 'kills', st: 3 },
  },
  color: {
    '#6e1f33': { n: '와인 상의', key: 'topC', aw: 'promo', st: 1 },
    '#e8a5b8': { n: '핑크 하의', key: 'bottomC', aw: 'promo', st: 2 },
    '#f2a6bf': { n: '핑크 상의', key: 'topC', aw: 'promo', st: 1 },
    '#f0eee8': { n: '아이보리 하의', key: 'bottomC', aw: 'promo', st: 2 },
    '#ff00fe': { n: '무지개 머리', key: 'hairC', aw: 'promo', st: 5 },
    '#7a55b8': { n: '보라 머리', key: 'hairC', aw: 'promo', st: 3 },
    '#6fd0c0': { n: '민트 머리', key: 'hairC', aw: 'promo', st: 3 },
    '#f5e6a3': { n: '버터 상의', key: 'topC', aw: 'promo', st: 1 },
    '#5a3b28': { n: '갈색 신발', key: 'shoeC', aw: 'promo', st: 4 },
    '#f4f6f8': { n: '흰색 신발', key: 'shoeC', aw: 'promo', st: 4 },
    '#8b9097': { n: '회색 신발', key: 'shoeC', aw: 'promo', st: 4 },
    '#1f2228': { n: '검정 넥타이', key: 'tie', aw: 'promo', st: 5 },
  },
  /* only the good ones: a step without one (null) gives no 칭호 */
  titles: {
    top3: ['이달의 노예', '전설의 노예', '이번생은 SSS급 노예'],
    days: ['어쩌다 출근', '출근이 일상', '월급 루팡', '퇴사 타이밍 놓침', '회사가 집'],
    night: ['칼퇴 실패', null, '야근 중독', null, '퇴근은 죽어서 해'],
    promo: [null, null, null, null, '나 혼자만 CEO'],
    ceo: [null, '전문 경영인', null, '회장님 또 오셨네'],
    tasks: [null, null, '일단 반려', null, '최종 결재권자'],
    kills: [null, null, '내일부터 안 나오셔도', null, '저승사자'],
    dev: [null, null, 'Hello World'],
    mkt: [null, null, '클릭해주세요'],
    hr: [null, null, '너 합격'],
    wc: [null, null, null, '존버는 승리한다'],
  },
};
