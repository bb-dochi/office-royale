// Play stats for the admin page: who played, how much, and how it went.
// A person is a device (the `or-uid` the browser keeps), shown with the latest 사원명 they used; one person on two
// devices counts twice. Solo games are reported by the browser when the result screen shows, or when left from the pause
// menu (g.quit: no place, on lists of their own so they can't push a finished game off); online games are reported by the
// room when the match ends, for everyone who started it. Closing the tab mid-game is not counted.
// A game's branch is the team the player was posted to (sim BRANCH; '' = still an intern). Days and games from before
// it was recorded (and games from pages cached since then) have no branch field at all and aren't counted.
// Storage keys (all small values): s:day:<date> per KST day, s:p:<uid> per person, s:idx (one line per person), s:recent, s:quits.
import { AWARDS, AWARDS_ON, STEPS, rewardsOf, REWARD_KINDS } from './career.js'; // the admin's 성과 views (career.js uses dayOf from here: only at run time)
const BRANCHES = ['dev', 'mkt', 'hr', 'design'];
const RECENT = 100, PERSON_RECENT = 50, IDX_MAX = 3000, DAY_PEOPLE_MAX = 5000;
const QUIT_MIN = 10; // seconds: a game left sooner keeps its row and count, but isn't a game or play time
export const dayOf = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export class StatsCore {
  /* store: {get(key), put(key, value)} (may be async) */
  constructor(store) { this.store = store; this.cache = new Map(); this.last = new Map(); }
  async get(k, dflt) { if (!this.cache.has(k)) this.cache.set(k, (await this.store.get(k)) ?? dflt); return this.cache.get(k); }
  put(k, v) { this.cache.set(k, v); return this.store.put(k, v); }

  /* g: {uid, name, mode:'solo'|'multi', diff, place, rank, kills, tasks, time, lunch, room?, quit?:'restart'|'lobby'} (already checked).
     One at a time: a match ends for several people at once, and each write reads what the last one left */
  record(g) { return (this.q = (this.q || Promise.resolve()).then(() => this.write(g)).catch(e => console.error('stats', e))); }
  async write(g) {
    const now = Date.now(), day = dayOf(now), uid = g.uid || 'anon', played = !g.quit || g.time >= QUIT_MIN;
    const game = { at: now, uid, name: g.name, mode: g.mode, diff: g.diff, place: g.place, rank: g.rank, kills: g.kills, tasks: g.tasks, time: g.time, lunch: g.lunch || '', branch: g.branch === undefined ? undefined : BRANCHES.includes(g.branch) ? g.branch : '', room: g.room || undefined, quit: g.quit || undefined };

    const d = await this.get('s:day:' + day, null) || { games: 0, solo: 0, multi: 0, sec: 0, diff: {}, people: [] };
    if (played) {
      d.games++; d[g.mode]++; d.sec += g.time; d.diff[g.diff] = (d.diff[g.diff] || 0) + 1;
      if (game.branch !== undefined) { const br = game.branch || 'none'; d.branch ||= {}; d.branch[br] = (d.branch[br] || 0) + 1; } // pages cached from before don't say
    }
    if (g.quit) d.quit = (d.quit || 0) + 1;
    if (!d.people.includes(uid) && d.people.length < DAY_PEOPLE_MAX) d.people.push(uid);
    await this.put('s:day:' + day, d);

    const p = await this.get('s:p:' + uid, null) || { uid, name: g.name, names: [], first: now, games: 0, solo: 0, multi: 0, wins: 0, sec: 0, kills: 0, tasks: 0, best: null, recent: [] };
    if (p.name !== g.name && !p.names.includes(p.name)) p.names = [p.name, ...p.names].slice(0, 5);
    p.name = g.name; p.last = now;
    if (played) { p.games++; p[g.mode]++; p.sec += g.time; p.kills += g.kills; p.tasks += g.tasks; }
    if (g.quit) { p.quit = (p.quit || 0) + 1; p.quits = [game, ...(p.quits || [])].slice(0, PERSON_RECENT); }
    else {
      if (g.place === 1) p.wins++;
      if (!p.best || g.place < p.best.place) p.best = { place: g.place, rank: g.rank, diff: g.diff, mode: g.mode, at: now };
      p.recent = [game, ...p.recent].slice(0, PERSON_RECENT);
    }
    await this.put('s:p:' + uid, p);

    const idx = await this.get('s:idx', {});
    idx[uid] = [p.name, p.games, p.last, p.sec, p.wins, p.first];
    const ids = Object.keys(idx);
    if (ids.length > IDX_MAX) for (const id of ids.sort((a, b) => idx[a][2] - idx[b][2]).slice(0, ids.length - IDX_MAX)) delete idx[id];
    await this.put('s:idx', idx);

    const listKey = g.quit ? 's:quits' : 's:recent', rec = await this.get(listKey, []);
    rec.unshift(game); if (rec.length > RECENT) rec.length = RECENT;
    await this.put(listKey, rec);
  }

  async days(n = 14) {
    const out = [];
    for (let i = 0; i < n; i++) { const day = dayOf(Date.now() - i * 864e5), d = await this.get('s:day:' + day, null); out.push({ day, ...(d || { games: 0, solo: 0, multi: 0, sec: 0, diff: {}, people: [] }) }); }
    return out;
  }
  async people() { const idx = await this.get('s:idx', {}); return Object.entries(idx).map(([uid, [name, games, last, sec, wins, first]]) => ({ uid, name, games, last, sec, wins, first })); }
  async person(uid) { return this.get('s:p:' + uid, null); }
  async recent() { return this.get('s:recent', []); }
  async quits() { return this.get('s:quits', []); }
}

/* ---------- the admin page (server-rendered; only the ranking delete and the local reward editor use a script) ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dur = s => s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
const when = ms => ms ? new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '-';
const ago = ms => { if (!ms) return '-'; const s = (Date.now() - ms) / 1000; return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : s < 86400 * 30 ? `${Math.floor(s / 86400)}일 전` : when(ms).slice(0, 5); };
const DIFF_N = { easy: '쉬움', normal: '보통', hard: '어려움' }, MODE_N = { solo: '혼자', multi: '같이' };
const LUNCH_N = { lighter: '라이터', bill: '계산서', meal: '특식', ladder: '사다리' }, QUIT_N = { restart: '재시작', lobby: '나감' };
const byTime = (...lists) => lists.flat().sort((a, b) => b.at - a.at);
const BRANCH_N = { dev: '개발', mkt: '마케팅', hr: '인사', design: '디자인', none: '미발령' }, BR_KEYS = [...BRANCHES, 'none'];
const pill = (cls, txt) => txt ? `<span class="pill ${cls}">${txt}</span>` : '';
const place = n => `<span class="place${n === 1 ? ' p1' : n <= 3 ? ' p3' : ''}">${n}위</span>`;
const gameRow = (g, link) => `<tr><td class="mut" title="${ago(g.at)}">${when(g.at)}</td>${link ? `<td>${link(g)}</td>` : ''}<td>${pill(g.mode, MODE_N[g.mode] || esc(g.mode))}${g.room ? ` <span class="mut">${esc(g.room)}</span>` : ''}</td><td>${pill(g.diff, DIFF_N[g.diff])}</td><td>${g.quit ? pill('quit', QUIT_N[g.quit]) : place(g.place)}</td><td>${esc(g.rank)}</td><td${g.branch ? '' : ' class="mut"'}>${g.branch == null ? '' : BRANCH_N[g.branch || 'none']}</td><td class="n">${g.tasks}</td><td class="n">${g.kills}</td><td class="n">${dur(g.time)}</td><td class="mut">${LUNCH_N[g.lunch] || ''}</td></tr>`;
const GAME_HEAD = link => `<thead><tr><th>시각</th>${link ? '<th>사원</th>' : ''}<th>모드</th><th>난이도</th><th>등수</th><th>직급</th><th>부서</th><th class="n">업무</th><th class="n">해고</th><th class="n">시간</th><th><button class="thb" popovertarget="pieLunch" title="점심 비율 보기">점심 <span>◔</span></button></th></tr></thead>`;
const card = (big, label, small) => `<div class="card"><span class="lbl">${label}</span><b>${big}</b>${small ? `<small>${small}</small>` : ''}</div>`;
const section = (title, inner, extra = '', id = '') => `<section${id ? ` id="${id}"` : ''}><div class="sh"><h3>${title}</h3>${extra}</div>${inner}</section>`;
const tbl = (inner, cls = '') => `<div class="tw ${cls}"><table>${inner}</table></div>`;
/* a bar split into parts [[value, class], ...], scaled so `max` fills the cell */
const bar = (parts, max) => `<div class="bar">${parts.map(([v, c]) => v ? `<i class="${c}" style="width:${(v / max * 100).toFixed(1)}%"></i>` : '').join('')}</div>`;

/* trend charts: inline SVG stretched to the box (lines keep their width), labels in HTML so they stay readable on phones.
   days run oldest → newest; each column has a <title> so hovering a day shows its numbers */
const niceMax = v => { const m = Math.max(1, v), e = 10 ** Math.floor(Math.log10(m)), f = m / e; return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(n => f <= n) * e; };
const xLabels = days => days.map((d, i) => `<span style="left:${((i + .5) / days.length * 100).toFixed(2)}%">${i === days.length - 1 ? '오늘' : d.day.slice(5).replace('-', '.') + `<i> ${'일월화수목금토'[new Date(d.day).getUTCDay()]}</i>`}</span>`).join('');
const plot = (days, yTicks, inner) => `<div class="plot"><div class="ya">${yTicks.map(([v, t]) => `<span style="top:${(100 - v * 100).toFixed(2)}%">${t}</span>`).join('')}</div>
  <div class="pa"><svg viewBox="0 0 ${days.length * 10} 100" preserveAspectRatio="none">${yTicks.map(([v]) => `<line class="gl" x1="0" x2="${days.length * 10}" y1="${100 - v * 100}" y2="${100 - v * 100}"/>`).join('')}${inner}</svg><div class="xa">${xLabels(days)}</div></div></div>`;
const linePath = pts => pts.reduce((s, p, i) => p ? s + `${!pts[i - 1] ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}` : s, '');
function playChart(days) {
  const max = niceMax(Math.max(...days.map(d => d.games))), y = v => 100 - v / max * 100;
  const cols = days.map((d, i) => `<g class="col"><rect class="hit" x="${i * 10}" y="0" width="10" height="100"/><rect class="b1" x="${i * 10 + 2.5}" y="${y(d.solo)}" width="5" height="${100 - y(d.solo)}"/><rect class="b2" x="${i * 10 + 2.5}" y="${y(d.games)}" width="5" height="${y(d.solo) - y(d.games)}"/><title>${d.day.slice(5).replace('-', '.')} · ${d.games}판 (혼자 ${d.solo} · 같이 ${d.multi}) · ${d.people.length}명</title></g>`).join('');
  const pts = days.map((d, i) => [i * 10 + 5, y(d.people.length)]);
  return plot(days, [[0, 0], [.5, max / 2], [1, max]], cols + `<path class="ln" d="${linePath(pts)}"/>` + pts.map(p => `<path class="dot" d="M${p[0]} ${p[1].toFixed(1)}h0"/>`).join(''));
}
function timeChart(days) {
  const avg = days.map(d => d.games ? d.sec / d.games : null), max = Math.max(420, Math.ceil(Math.max(...avg.filter(Boolean)) / 60) * 60), y = v => 100 - v / max * 100;
  const pts = avg.map((v, i) => v == null ? null : [i * 10 + 5, y(v)]);
  const cols = days.map((d, i) => `<g class="col"><rect class="hit" x="${i * 10}" y="0" width="10" height="100"/><title>${d.day.slice(5).replace('-', '.')} · ${avg[i] == null ? '판 없음' : '한 판 평균 ' + dur(Math.round(avg[i]))}</title></g>`).join('');
  return plot(days, [[0, '0'], [240 / max, '4분'], [300 / max, '5분'], [1, `${max / 60}분`]],
    `<rect class="band" x="0" width="${days.length * 10}" y="${y(300)}" height="${y(240) - y(300)}"/>` + cols + `<path class="ln" d="${linePath(pts)}"/>` + pts.map(p => p ? `<path class="dot" d="M${p[0]} ${p[1].toFixed(1)}h0"/>` : '').join(''));
}

/* a donut of counts t {key: n} drawn in the order of keys (one circle per key, dashed to its share: circumference 100
   so dash = %) with a list beside it. faint: a key that means "none of these", drawn pale */
function donut(t, keys, names, cls, faint) {
  const n = keys.reduce((s, k) => s + (t[k] || 0), 0), ks = keys.filter(k => t[k]);
  if (!n) return '';
  const gap = ks.length > 1 ? .8 : 0; let at = 0;
  const arcs = ks.map(k => { const p = t[k] / n * 100, a = `<circle class="s${cls}${k}" r="15.9155" cx="21" cy="21" stroke-dasharray="${Math.max(.1, p - gap).toFixed(2)} ${(100 - p + gap).toFixed(2)}" stroke-dashoffset="${(25 - at).toFixed(2)}"><title>${names[k]} ${t[k]}판 (${Math.round(p)}%)</title></circle>`; at += p; return a; }).join('');
  return `<div class="pie"><svg viewBox="0 0 42 42"><circle class="track" r="15.9155" cx="21" cy="21"/>${arcs}<text x="21" y="20.5">${n}</text><text class="u" x="21" y="26">판</text></svg>
    <ul>${ks.map(k => `<li${k === faint ? ' class="faint"' : ''}><i class="b${cls}${k}"></i>${names[k]}<b>${Math.round(t[k] / n * 100)}%</b><small>${t[k]}판</small></li>`).join('')}</ul></div>`;
}
/* 부서 발령 over the days shown. 미발령 (knocked out as an intern) is faint: it is the absence of a team */
function branchChart(days) {
  const t = {}; for (const d of days) for (const [k, v] of Object.entries(d.branch || {})) t[k] = (t[k] || 0) + v;
  const n = Object.values(t).reduce((s, v) => s + v, 0), assigned = n - (t.none || 0);
  if (!n) return '<p class="empty sm">아직 기록이 없어요. 오늘부터 쌓여요.</p>';
  return donut(t, BR_KEYS, BRANCH_N, '', 'none') + (assigned && t.none ? `<p class="mut sm pnote">발령받은 ${assigned}판만 보면 ${BRANCHES.filter(k => t[k]).map(k => `${BRANCH_N[k]} ${Math.round(t[k] / assigned * 100)}%`).join(' · ')}</p>` : '');
}
/* 점심 이벤트 share of the games in a table, opened from its 점심 header (a popover: no script needed) */
function lunchPop(games) {
  const t = {}; for (const g of games) if (LUNCH_N[g.lunch]) t[g.lunch] = (t[g.lunch] || 0) + 1;
  const n = Object.values(t).reduce((s, v) => s + v, 0);
  return `<div popover id="pieLunch" class="pop"><div class="ch"><b>점심 이벤트</b><span class="lg">최근 ${n}판</span></div>${donut(t, Object.keys(LUNCH_N), LUNCH_N, 'l', null) || '<p class="empty sm">점심 기록이 없어요.</p>'}</div>`;
}

/* 사내 게시판 댓글, newest first: post 0 is the 자유 의견 card, others are update posts by id (client/49-board.js) */
async function feedbackSection(feedback, link) {
  const all = await feedback.all(), live = all.filter(c => !c.hid).length;
  const rows = all.slice(0, 100).map(c => `<tr${c.hid ? ' class="zero"' : ''}><td class="mut">${when(c.at)}</td><td>${c.post ? `#${c.post}` : '자유 의견'}</td><td>${link(c.uid, c.name)}</td>
    <td>${esc(c.text)}</td><td class="n"><a href="?tab=manage&${c.hid ? 'fbshow' : 'fbhide'}=${c.id}#fb" class="hide">${c.hid ? '되살리기' : '숨기기'}</a></td></tr>`).join('');
  return section(`사내 게시판 댓글 <small>${live}개 보이는 중${all.length > 100 ? ' · 최근 100개' : ''}</small>`,
    all.length ? tbl(`<thead><tr><th>시각</th><th>글</th><th>사원</th><th>내용</th><th class="n"></th></tr></thead><tbody>${rows}</tbody>`) : '<p class="empty">아직 댓글이 없어요.</p>', '', 'fb');
}
/* this week's 어려움 ranking, with a link to take a record off (the person's play stats and 성과 stay) */
async function rankSection(rank, link) {
  const { week, list } = await rank.records();
  const rows = list.map((e, i) => `<tr><td class="n">${i + 1}</td><td>${link(e.uid, e.name)}</td><td class="n"><b>${e.score.toLocaleString()}</b></td><td>${e.place}위 ${esc(e.real || e.rank)}</td><td class="n">${e.tasks}</td><td class="n">${e.kills}</td><td class="n">${dur(e.time)}</td><td class="mut">${when(e.at)}</td><td class="mono mut">${esc(e.uid)}</td>
    <td class="n stick"><a href="?tab=manage&rankdel=${encodeURIComponent(e.uid)}&at=${e.at}#rk" class="del" data-n="${esc(e.name)}" data-s="${e.score.toLocaleString()}">삭제</a></td></tr>`).join('');
  return section(`이번 주 랭킹 <small>${week} 주 · 어려움 ${list.length}명 · 삭제는 되돌릴 수 없어요</small>`,
    list.length ? tbl(`<thead><tr><th class="n">순위</th><th>사원</th><th class="n">점수</th><th>결과</th><th class="n">업무</th><th class="n">해고</th><th class="n">시간</th><th>기록 시각</th><th>기기</th><th class="n stick"></th></tr></thead><tbody>${rows}</tbody>`, 'tall') : '<p class="empty">이번 주 기록이 없어요.</p>', '', 'rk');
}
/* 성과 of one person: each 성과's number and step, links to put it at any step (test), what it has opened, what they wear */
const stepName = i => i ? STEPS[i - 1] : '없음';
function gotOf(aw, step) { const out = []; for (let s = 1; s <= step; s++) { const r = rewardsOf(aw, s); if (r.title) out.push(`「${r.title}」`); out.push(...r.items.map(x => x.n)); } return out; }
async function awardSection(career, uid, testTools) {
  const v = career && await career.awardsOf(uid);
  if (!v) return section('성과', '<p class="empty sm">사원코드가 없어요. 첫 판을 마치면 생겨요.</p>', '', 'aw');
  const u = `?uid=${encodeURIComponent(uid)}`, R = globalThis.REWARDS;
  const rows = v.list.map(a => {
    const fmt = x => a.names ? a.names[a.at.indexOf(x)] : `${x.toLocaleString()}${a.unit}`;
    const steps = [...Array(a.at.length + 1).keys()].map(i => i === a.step ? `<b class="stp on">${stepName(i)}</b>` : `<a class="stp" href="${u}&aw=${a.id}&st=${i}#aw">${stepName(i)}</a>`).join('');
    const got = gotOf(a.id, a.step);
    return `<tr><td><b>${esc(a.n)}</b><div class="mut sm">${esc(a.d)}</div></td><td class="n">${a.names ? (a.step ? a.names[a.step - 1] : '-') : a.val.toLocaleString() + a.unit}</td>
      <td class="mut">${a.step >= a.at.length ? '모두 달성' : '다음 ' + fmt(a.at[a.step])}</td><td><div class="stps">${steps}</div></td><td class="wrap sm">${got.map(esc).join(', ') || '<span class="mut">-</span>'}</td></tr>`;
  }).join('');
  const f = v.prof && v.prof.fit, worn = f ? [f.title && `칭호 「${(R.titles[f.title.split(':')[0]] || [])[f.title.split(':')[1] - 1]}」`, R.hair[f.hair] && `머리 ${R.hair[f.hair].n}`,
    ...(f.gear || []).map(g => R.gear[g] && R.gear[g].n), f.fx && R.fx[f.fx] && `이펙트 ${R.fx[f.fx].n}`, R.color[f.topC] && R.color[f.topC].n].filter(Boolean) : [];
  const has = new Set(v.own), own = REWARD_KINDS.flatMap(([kind, label]) => Object.entries(R[kind]).filter(([id, r]) => r.aw || kind === 'color').map(([id, r]) => ({ key: `${kind}:${id}`, n: `${label} · ${r.n}` })));
  const piece = p => `<a class="stp${has.has(p.key) ? ' on' : ''}" href="${u}&own=${encodeURIComponent(p.key)}&on=${has.has(p.key) ? 0 : 1}#aw">${esc(p.n)}</a>`;
  const total = v.list.reduce((s, a) => s + a.step, 0);
  const fake = !testTools ? '' : `<p class="sm note"><b>지난주 순위 테스트</b> <span class="mut">(이 서버 전용, 랭킹은 그대로)</span> <span class="stps">${[0, 1, 2, 3].map(p => p === v.fakeTop ? `<b class="stp on">${p ? p + '위' : '실제 순위'}</b>` : `<a class="stp" href="${u}&faketop=${p}#aw">${p ? p + '위' : '실제 순위'}</a>`).join('')}</span></p>`;
  const note = (AWARDS_ON ? '' : `<p class="mut sm note">성과는 아직 꺼져 있어요(<span class="mono">AWARDS_ON</span>). 여기서 단계를 바꾸면 <b>이 사람만 테스트로</b> 사원증에 성과가 보이고 보상이 열려요.</p>`)
    + `<p class="sm note">지금 입은 성과 보상: ${worn.length ? worn.map(esc).join(', ') : '<span class="mut">없음</span>'}${v.prof ? '' : ' <span class="mut">(옷장 연동 기록 없음)</span>'}</p>`;
  return section(`성과 <small>단계 ${total} / ${v.list.reduce((s, a) => s + a.at.length, 0)}${v.test ? ' · 테스트 조정됨' : ''}</small>`,
    note + fake + tbl(`<thead><tr><th>성과</th><th class="n">값</th><th>다음 목표</th><th>단계 <span class="mut">(눌러서 바꾸기)</span></th><th>열린 보상</th></tr></thead><tbody>${rows}</tbody>`) + `<p class="sm note">소지품 ${v.own.length}개 <span class="mut">(파란 것이 가진 것, 눌러서 지급·회수. 회수한 건 단계에 도달해도 다시 안 들어와요)</span></p><div class="stps" style="flex-wrap:wrap">${own.map(piece).join('')}</div>`,
    v.test ? `<a class="btnl" href="${u}&awreset=1#aw">성과 초기화 · 테스트 해제</a>` : '', 'aw');
}
/* every 성과 step and what it gives (public/js/shared/rewards.js), and every reward piece. `edit` (the local dev server only:
   a deployed server can't rewrite the game's files) adds the controls; the page's script posts to /admin/rewards, see tools/rewards-edit.mjs */
function rewardPage(edit) {
  const R = globalThis.REWARDS, goal = (a, i) => (a.names ? a.names[i] : `${a.at[i].toLocaleString()}${a.unit}`);
  const pieces = REWARD_KINDS.flatMap(([kind, label]) => Object.entries(R[kind]).map(([id, r]) => ({ kind, label, id, ...r })));
  const where = p => { const a = AWARDS.find(x => x.id === p.aw); return a ? `${a.n} ${goal(a, p.st - 1)}` : ''; };
  const addSel = (a, st) => `<select class="rwadd" data-aw="${a.id}" data-st="${st}"><option value="">+ 보상 추가</option>${REWARD_KINDS.map(([kind, label]) => `<optgroup label="${label}">${pieces.filter(p => p.kind === kind && !(p.aw === a.id && p.st === st)).map(p => `<option value="${esc(`${p.kind}:${p.id}`)}">${esc(p.n)}${p.aw ? ` (${esc(where(p))})` : ''}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const cell = (a, i) => { const st = i + 1, r = rewardsOf(a.id, st);
    if (!edit) return `<td class="wrap sm"><div class="mut">${esc(goal(a, i))}</div>${r.title ? `<div>「${esc(r.title)}」</div>` : ''}${r.items.map(x => `<div>${x.label} · ${esc(x.n)}</div>`).join('')}</td>`;
    return `<td class="wrap sm"><div class="mut">${esc(goal(a, i))}</div><input class="rwtitle" data-aw="${a.id}" data-st="${st}" placeholder="칭호 없음" maxlength="12" value="${esc(r.title || '')}">${r.items.map(x => `<button class="rwchip" data-p="${esc(`${x.kind}:${x.id}`)}" title="빼기">${x.label} · ${esc(x.n)} ✕</button>`).join('')}${addSel(a, st)}</td>`; };
  const grid = AWARDS.map(a => `<tr><td><b>${esc(a.n)}</b><div class="mut sm">${esc(a.d)}</div></td>${STEPS.map((s, i) => (i < a.at.length ? cell(a, i) : '<td class="mut">-</td>')).join('')}</tr>`).join('');
  const none = p => (p.temp ? '주간 1~3위 일주일 한정' : p.kind === 'color' ? '잠금 (아직 안 붙임)' : '모두에게 무료');
  const stepOpts = p => `<option value="">${none(p)}</option>${AWARDS.map(a => `<optgroup label="${esc(a.n)}">${a.at.map((x, i) => `<option value="${a.id}:${i + 1}"${p.aw === a.id && p.st === i + 1 ? ' selected' : ''}>${esc(a.n)} ${esc(goal(a, i))}</option>`).join('')}</optgroup>`).join('')}`;
  const list = pieces.map(p => `<tr><td>${p.label}</td><td><b>${esc(p.n)}</b> <span class="mono mut">${esc(p.id)}</span></td>
    <td>${edit ? `<select class="rwset" data-p="${esc(`${p.kind}:${p.id}`)}">${stepOpts(p)}</select>` : p.aw ? esc(where(p)) : `<span class="mut">${none(p)}</span>`}</td></tr>`).join('');
  const page = section(`성과 단계별 보상 <small>${edit ? '바꾸면 바로 저장돼요 · 게임은 새로고침하면 반영' : '바꾸는 곳은 로컬 관리자 페이지'}</small>`, tbl(`<thead><tr><th>성과</th>${STEPS.map((s, i) => `<th>${i + 1}단계</th>`).join('')}</tr></thead><tbody>${grid}</tbody>`))
    + section(`보상 아이템 <small>${pieces.length}개 · 성과에 붙음 ${pieces.filter(p => p.aw).length}개 · 무료 ${pieces.filter(p => !p.aw && !p.temp && p.kind !== 'color').length}개 · 잠긴 색 ${pieces.filter(p => !p.aw && p.kind === 'color').length}개</small>`, tbl(`<thead><tr><th>종류</th><th>이름</th><th>열리는 단계</th></tr></thead><tbody>${list}</tbody>`));
  if (!edit) return page;
  return `<div id="rwEdit">${page}</div><style>#rwEdit table{table-layout:fixed;width:100%}.rwtitle{display:block;width:100%;min-width:88px;box-sizing:border-box;margin:4px 0;padding:3px 5px;font:inherit;border:1px solid #d5d9e0;border-radius:4px}.rwchip{display:block;width:100%;margin:2px 0;padding:3px 5px;font:inherit;text-align:left;background:#e8f0fb;color:#1f4f8f;border:0;border-radius:4px;cursor:pointer}.rwadd,.rwset{width:100%;font:inherit;margin-top:2px}</style>
<script>
const rwPost=m=>fetch('/admin/rewards',{method:'POST',body:JSON.stringify(m)}).then(r=>{if(!r.ok)throw 0;return fetch(location.href);}).then(r=>r.text()).then(h=>{document.getElementById('rwEdit').innerHTML=new DOMParser().parseFromString(h,'text/html').getElementById('rwEdit').innerHTML;}).catch(()=>alert('저장하지 못했어요'));
const rwPiece=v=>{const i=v.indexOf(':');return{kind:v.slice(0,i),id:v.slice(i+1)};};
document.addEventListener('change',e=>{const t=e.target,d=t.dataset;
  if(t.matches('.rwadd')&&t.value)rwPost({...rwPiece(t.value),aw:d.aw,st:+d.st});
  if(t.matches('.rwset')){const[aw,st]=t.value.split(':');rwPost({...rwPiece(d.p),aw:aw||null,st:+st||null});}
  if(t.matches('.rwtitle'))rwPost({title:t.value,aw:d.aw,st:+d.st});});
document.addEventListener('click',e=>{const b=e.target.closest('.rwchip');if(b)rwPost({...rwPiece(b.dataset.p),aw:null,st:null});});
</script>`;
}

/* asks before a ranking record goes: the link itself does the delete */
const ASK = `<dialog class="ask" id="ask"><h4 id="askT"></h4><p id="askS"></p><div><button type="button" id="askNo">취소</button><a id="askGo">삭제하기</a></div></dialog>
<script>addEventListener('click',e=>{const a=e.target.closest('a.del'),d=document.getElementById('ask');if(e.target.id==='askNo'||e.target===d)return d.close();if(!a)return;e.preventDefault();
document.getElementById('askT').textContent=a.dataset.n+' 기록을 지울까요?';document.getElementById('askS').textContent=a.dataset.s+'점 · 지우면 되돌릴 수 없어요';document.getElementById('askGo').href=a.href;d.showModal();});</script>`;
/* the admin's tabs: ?tab=<key>, 플레이 기록 without one; a person's page (?uid=) belongs to 사람 관리 */
const TABS = [['play', '플레이 기록'], ['people', '사람 관리'], ['manage', '랭킹·게시판 관리'], ['rw', '성과 보상 관리']];
export async function adminHTML(stats, q, career, feedback, rewardEdit = false, testTools = false, rank = null) {
  const link = (uid, name) => `<a href="?uid=${encodeURIComponent(uid)}">${esc(name)}</a>`;
  if (rank && q.get('rankdel')) await rank.remove(q.get('rankdel'), +q.get('at')); // 이번 주 랭킹 기록 삭제
  if (feedback && q.get('fbhide')) await feedback.hide(+q.get('fbhide'), true); // 사내 게시판 댓글 숨기기 / 되살리기
  if (feedback && q.get('fbshow')) await feedback.hide(+q.get('fbshow'), false);
  if (career && q.get('uid') && q.get('aw') && await career.awardsOf(q.get('uid'))) await career.setAward(q.get('uid'), q.get('aw'), +q.get('st')); // 성과 단계 조정 (테스트; makes the career first if needed)
  if (career && q.get('uid') && q.get('awreset')) await career.resetAwards(q.get('uid'));
  if (testTools && career && q.get('uid') && q.has('faketop')) await career.setFakeTop(q.get('uid'), +q.get('faketop')); // 지난주 순위 테스트 (test server only)
  if (career && q.get('uid') && q.get('own')) await career.setOwn(q.get('uid'), q.get('own'), q.get('on') === '1');
  const tab = q.get('uid') ? 'people' : TABS.some(([k]) => k === q.get('tab')) ? q.get('tab') : 'play';
  let body;
  if (tab === 'rw') body = rewardPage(rewardEdit);
  else if (tab === 'manage') body = (rank ? await rankSection(rank, link) : '') + (feedback ? await feedbackSection(feedback, link) : '');
  else if (q.get('uid')) {
    const p = await stats.person(q.get('uid')), code = career && await career.codeOf(q.get('uid'));
    const avgPlace = p && p.recent.length ? (p.recent.reduce((s, g) => s + g.place, 0) / p.recent.length).toFixed(1) : '-';
    body = `<nav class="crumb"><a href="?tab=people">← 사람 목록</a></nav>` + (!p ? '<p class="empty">기록이 없어요.</p>' : `
      <header class="who"><div class="ava">${esc([...p.name][0] || '?')}</div><div><h2>${esc(p.name)}</h2>
        <p class="sub">${code ? `사원코드 <b>${esc(code)}</b> · ` : ''}${p.names.length ? '예전 이름 ' + p.names.map(esc).join(', ') + ' · ' : ''}<span class="mono">${esc(p.uid)}</span></p></div></header>
      <div class="cards">
        ${card(`${p.games}<u>판</u>`, '플레이', `혼자 ${p.solo} · 같이 ${p.multi}${p.quit ? ` · 재시작·나감 ${p.quit}` : ''}`)}
        ${card(dur(p.sec), '총 플레이 시간', p.games ? `한 판 평균 ${dur(Math.round(p.sec / p.games))}` : '')}
        ${card(`${p.wins}<u>번</u>`, 'CEO 등극', `승률 ${p.games ? Math.round(p.wins / p.games * 100) : 0}% · 최고 ${p.best ? `${p.best.place}위 ${esc(p.best.rank)}` : '-'}`)}
        ${card(`${p.tasks}<u>업무</u> ${p.kills}<u>해고</u>`, '누적', `최근 ${p.recent.length}판 평균 ${avgPlace}위`)}
        ${card(ago(p.last), '마지막 플레이', `처음 ${when(p.first)}`)}
      </div>
      ${await awardSection(career, q.get('uid'), testTools)}
      ${section(`최근 ${p.recent.length}판${p.quits ? ` <small>재시작·나감 ${p.quits.length}번 함께 표시</small>` : ''}`, tbl(GAME_HEAD(false) + `<tbody>${byTime(p.recent, p.quits || []).map(g => gameRow(g)).join('')}</tbody>`) + lunchPop(p.recent))}`);
  } else if (tab === 'people') {
    const people = await stats.people(), sort = q.get('sort') || 'last', ppl = people.sort((a, b) => sort === 'games' ? b.games - a.games : sort === 'time' ? b.sec - a.sec : b.last - a.last);
    const sorts = [['last', '최근'], ['games', '판 수'], ['time', '플레이 시간']].map(([k, n]) => `<a href="?tab=people&sort=${k}#people"${k === sort ? ' class="on"' : ''}>${n}</a>`).join('');
    const maxPG = Math.max(1, ...ppl.map(p => p.games));
    body = section(`사람별 <small>${people.length}명${people.length > 300 ? ' 중 300명' : ''}</small>`, tbl(`<thead><tr><th>사원명</th><th class="w">판</th><th class="n">플레이 시간</th><th class="n">CEO</th><th>처음</th><th>마지막</th></tr></thead><tbody>
      ${ppl.slice(0, 300).map(p => `<tr><td>${link(p.uid, p.name)}</td><td class="w"><div class="bc">${bar([[p.games, 'solo']], maxPG)}<b>${p.games}</b></div></td><td class="n">${dur(p.sec)}</td><td class="n">${p.wins ? `<span class="place p1">${p.wins}</span>` : '<span class="mut">0</span>'}</td><td class="mut">${when(p.first)}</td><td title="${when(p.last)}">${ago(p.last)}</td></tr>`).join('')}</tbody>`), `<div class="seg">${sorts}</div>`, 'people');
  } else {
    const days = await stats.days(14), trend = days.slice(0, 7).reverse(), people = await stats.people(), rec = await stats.recent(), quits = await stats.quits();
    const nameOf = new Map(people.map(p => [p.uid, p.name])); // games keep the name used then; show who it is now
    const t = days[0], y = days[1], wk = days.slice(0, 7), wkPeople = new Set(wk.flatMap(d => d.people));
    const sum = (a, f) => a.reduce((s, d) => s + f(d), 0);
    const delta = (a, b) => a === b ? '' : `<span class="dl ${a > b ? 'up' : 'dn'}">${a > b ? '▲' : '▼'}${Math.abs(a - b)}</span>`;
    const maxG = Math.max(1, ...days.map(d => d.games));
    body = `<div class="cards">
        ${card(`${t.games}<u>판</u> ${delta(t.games, y.games)}`, '오늘', `${t.people.length}명 · 혼자 ${t.solo} · 같이 ${t.multi}${t.quit ? ` · 재시작·나감 ${t.quit}` : ''}`)}
        ${card(`${sum(wk, d => d.games)}<u>판</u>`, '최근 7일', `${wkPeople.size}명이 플레이`)}
        ${card(`${people.length}<u>명</u>`, '전체 사원', `${sum(people, p => p.games)}판 · ${dur(sum(people, p => p.sec))}`)}
        ${card(t.games ? dur(Math.round(t.sec / t.games)) : '-', '오늘 한 판 평균', y.games ? `어제 ${dur(Math.round(y.sec / y.games))}` : '')}
      </div>
      ${section('추세 <small>최근 7일 · 마우스를 올리면 그날 숫자</small>', `<div class="charts">
        <div class="chart"><div class="ch"><b>하루 플레이</b><span class="lg"><i class="solo"></i>혼자 판 <i class="multi"></i>같이 판 <i class="lnk"></i>사람</span></div>${playChart(trend)}</div>
        <div class="chart"><div class="ch"><b>한 판 평균 시간</b><span class="lg"><i class="bandk"></i>목표 4–5분</span></div>${timeChart(trend)}</div>
        <div class="chart"><div class="ch"><b>부서 발령</b><span class="lg">최근 7일 합계</span></div>${branchChart(trend)}</div></div>`)}
      ${section('날짜별 <small>최근 14일</small>', tbl(`<thead><tr><th>날짜</th><th class="w">판 <span class="lg"><i class="solo"></i>혼자 <i class="multi"></i>같이</span></th><th class="n">판</th><th class="n">사람</th><th class="w2">난이도 <span class="lg"><i class="easy"></i>쉬움 <i class="normal"></i>보통 <i class="hard"></i>어려움</span></th><th class="n">평균</th></tr></thead><tbody>
      ${days.map((d, i) => { const wd = '일월화수목금토'[new Date(d.day).getUTCDay()]; return `<tr${d.games ? '' : ' class="zero"'}><td>${d.day.slice(5).replace('-', '.')} <span class="mut${wd === '토' || wd === '일' ? ' we' : ''}">${i ? wd : '오늘'}</span></td>
        <td class="w">${bar([[d.solo, 'solo'], [d.multi, 'multi']], maxG)}</td><td class="n"><b>${d.games}</b></td><td class="n" title="${d.people.length}명">${d.people.length}</td>
        <td class="w2">${d.games ? bar([[d.diff.easy || 0, 'easy'], [d.diff.normal || 0, 'normal'], [d.diff.hard || 0, 'hard']], d.games) + `<span class="mut sm">${d.diff.easy || 0} / ${d.diff.normal || 0} / ${d.diff.hard || 0}</span>` : ''}</td>
        <td class="n mut">${d.games ? dur(Math.round(d.sec / d.games)) : '-'}</td></tr>`; }).join('')}</tbody>`))}
      ${section('최근 판 <small>50판</small>', tbl(GAME_HEAD(true) + `<tbody>${byTime(rec, quits).slice(0, 50).map(g => gameRow(g, g => link(g.uid, nameOf.get(g.uid) || g.name))).join('')}</tbody>`, 'tall') + lunchPop(rec))}`;
  }
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>오피스 로얄 · 관리</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"><style>
:root{color-scheme:light dark;--bg:#f2f4f6;--fg:#191f28;--sub:#4e5968;--mut:#8b95a1;--card:#fff;--line:#e5e8eb;--head:#fff;--acc:#3182f6;--acct:#fff;--tint:#e8f3ff;--hov:#f2f4f6;--red:#f04452;--redt:#ffeeee;
  --solo:#3182f6;--multi:#90c2ff;--easy:#d1d6db;--normal:#8b95a1;--hard:#191f28;--gold:#1b64da;--goldbg:#e8f3ff;--up:#f04452;--dn:#3182f6;--sh:0 1px 2px rgba(0,27,55,.04)}
@media (prefers-color-scheme:dark){:root{--bg:#101013;--fg:#ececf0;--sub:#b0b8c1;--mut:#7e7e87;--card:#1c1c21;--line:#2c2c34;--head:#1c1c21;--acc:#3182f6;--acct:#fff;--tint:#1c2c47;--hov:#26262c;--red:#f66570;--redt:#3c2023;
  --solo:#4b96f8;--multi:#2a5a9c;--easy:#3c3c47;--normal:#7e7e87;--hard:#ececf0;--gold:#90c2ff;--goldbg:#1c2c47;--up:#f66570;--dn:#64a8ff;--sh:none}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;word-break:keep-all;letter-spacing:-.01em;-webkit-font-smoothing:antialiased}
.top{position:sticky;top:0;z-index:5;background:var(--card);box-shadow:inset 0 -1px 0 var(--line)}
.top>div{max-width:1120px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:28px;min-height:60px}
.top h1{font-size:17px;margin:0;font-weight:700;letter-spacing:-.02em;white-space:nowrap}.top h1 a{color:inherit;text-decoration:none}.top>div>.mut{margin-left:auto;font-size:13px;white-space:nowrap}
main{max-width:1120px;margin:0 auto;padding:28px 20px 72px}
a{color:var(--fg);text-decoration:none;font-weight:500}a:hover{color:var(--acc)}
.mut{color:var(--mut)}.sm{font-size:13px}.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:0}.we{color:var(--mut);font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.card{background:var(--card);border-radius:20px;padding:22px 24px;display:flex;flex-direction:column;gap:6px;box-shadow:var(--sh)}
.card .lbl{font-size:14px;color:var(--sub);font-weight:500}.card b{font-size:30px;line-height:1.25;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.card b u{text-decoration:none;font-size:17px;font-weight:600;letter-spacing:-.01em;margin:0 6px 0 2px}.card small{color:var(--mut);font-size:13px}
.dl{font-size:13px;font-weight:600;letter-spacing:0;vertical-align:middle}.dl.up{color:var(--up)}.dl.dn{color:var(--dn)}
section{margin-top:40px;scroll-margin-top:84px}section:first-child{margin-top:0}.sh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}
h3{margin:0;font-size:20px;font-weight:700;letter-spacing:-.02em}h3 small{font-weight:400;color:var(--mut);font-size:14px;letter-spacing:-.01em;margin-left:6px}
.seg{display:inline-flex;background:#e5e8eb;border-radius:10px;padding:3px;margin-left:auto}
.seg a{padding:5px 13px;border-radius:8px;color:var(--sub);font-size:14px;font-weight:500}.seg a:hover{color:var(--fg)}.seg a.on{background:var(--card);color:var(--fg);font-weight:600;box-shadow:0 1px 3px rgba(0,27,55,.12)}
.tw{background:var(--card);border-radius:20px;overflow:auto;padding:8px;box-shadow:var(--sh)}.tw.tall{max-height:600px}
table{border-collapse:separate;border-spacing:0;width:100%}
th,td{padding:12px 14px;text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums}
tbody td{transition:background .12s}tbody td:first-child{border-radius:12px 0 0 12px}tbody td:last-child{border-radius:0 12px 12px 0}tbody tr:hover td{background:var(--hov)}tr.zero td{color:var(--mut)}
th{position:sticky;top:-8px;background:var(--head);color:var(--mut);font-weight:500;font-size:13px;z-index:1}
.n{text-align:right}td.w{width:40%;min-width:160px}td.w2{min-width:180px}
.lg{font-weight:400;margin-left:6px}.lg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin:0 3px 0 8px}
.bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--hov);min-width:80px}.bar i{display:block;height:100%}
td.w2 .bar{display:inline-flex;width:110px;vertical-align:middle;margin-right:8px}
.chart{container-type:inline-size}@container (max-width:440px){.xa i{display:none}}
.charts{display:grid;grid-template-columns:3fr 2fr 2fr;gap:12px}.chart{background:var(--card);border-radius:20px;padding:20px 22px 14px;box-shadow:var(--sh)}
.ch{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:14px}.ch b{font-size:15px;font-weight:600}.ch .lg{color:var(--mut);font-size:12px;margin-left:auto}
.lg i.lnk{height:2px;width:12px;border-radius:1px;background:var(--fg);vertical-align:middle}.lg i.bandk{background:var(--goldbg)}
.plot{display:flex;gap:6px;height:180px}.ya{position:relative;width:30px;flex:none;margin-bottom:20px}.ya span{position:absolute;right:0;transform:translateY(-50%);font-size:11px;color:var(--mut)}
.pa{position:relative;flex:1;min-width:0}.pa svg{display:block;width:100%;height:calc(100% - 20px);overflow:visible}
.xa{position:relative;height:20px}.xa i{font-style:normal}.xa span{position:absolute;top:4px;transform:translateX(-50%);font-size:11px;color:var(--mut);white-space:nowrap}
svg .gl{stroke:var(--line);stroke-width:1;vector-effect:non-scaling-stroke}svg .b1{fill:var(--solo)}svg .b2{fill:var(--multi)}svg .hit{fill:transparent}svg .col:hover .hit{fill:var(--hov)}
svg .ln{fill:none;stroke:var(--fg);stroke-width:1.5;stroke-linejoin:round;vector-effect:non-scaling-stroke}svg .dot{stroke:var(--fg);stroke-width:5;stroke-linecap:round;vector-effect:non-scaling-stroke}
svg .band{fill:var(--goldbg)}
.bdev{background:var(--solo)}.bmkt{background:var(--multi)}.bhr{background:var(--normal)}.bdesign{background:var(--hard)}.bnone{background:var(--easy);opacity:.6}
svg .bdev{fill:var(--solo)}svg .bmkt{fill:var(--multi)}svg .bhr{fill:var(--normal)}svg .bdesign{fill:var(--hard)}svg .bnone{fill:var(--easy)}
.pie{display:flex;align-items:center;gap:14px;min-height:150px}.pie svg{width:min(130px,40%);flex:none}@container (max-width:300px){.pie li small{display:none}}
.pie circle{fill:none;stroke-width:6.5}.pie .track{stroke:var(--hov)}.pie text{text-anchor:middle;font-size:7px;font-weight:700;fill:var(--fg)}.pie text.u{font-size:3.4px;font-weight:400;fill:var(--mut)}
.sllighter{stroke:var(--solo)}.slbill{stroke:var(--multi)}.slmeal{stroke:var(--normal)}.slladder{stroke:var(--hard)}.bllighter{background:var(--solo)}.blbill{background:var(--multi)}.blmeal{background:var(--normal)}.blladder{background:var(--hard)}
.thb{all:unset;cursor:pointer;color:inherit;font-weight:500}.thb span{color:var(--mut)}.thb:hover{color:var(--acc)}
.pop{width:min(360px,calc(100vw - 32px));padding:20px;border:0;border-radius:20px;background:var(--card);color:var(--fg);box-shadow:0 12px 40px rgba(0,27,55,.16)}.pop::backdrop{background:rgba(0,0,0,.2)}
.sdev{stroke:var(--solo)}.smkt{stroke:var(--multi)}.shr{stroke:var(--normal)}.sdesign{stroke:var(--hard)}.snone{stroke:var(--easy);opacity:.6}
.pie ul{list-style:none;margin:0;padding:0;flex:1;min-width:0;display:grid;gap:6px}.pie li{display:flex;align-items:center;gap:6px;font-size:13px}
.pie li i{width:10px;height:10px;border-radius:50%;flex:none}.pie li b{margin-left:auto;font-variant-numeric:tabular-nums}.pie li small{color:var(--mut);min-width:3.5em;text-align:right}
.pie li.faint{color:var(--mut)}.pie li.faint b{color:var(--mut);font-weight:500}.pnote{margin:10px 0 0}.ch .lg b{font-weight:600;color:var(--fg);margin-right:4px}
.bc{display:flex;align-items:center;gap:10px}.bc .bar{flex:1}.bc b{min-width:2.5em;text-align:right;font-weight:600}
.solo{background:var(--solo)}.multi{background:var(--multi)}.easy{background:var(--easy)}.normal{background:var(--normal)}.hard{background:var(--hard)}
.pill{display:inline-block;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:600;color:var(--sub);background:var(--hov)!important}
.pill.hard{background:var(--redt)!important;color:var(--red)}
.place{display:inline-block;min-width:2.6em;text-align:center;padding:1px 7px;border-radius:6px;font-weight:600;font-size:12px;background:var(--hov);color:var(--sub)}
.place.p1{background:var(--tint);color:var(--gold)}.place.p3{color:var(--fg)}
.crumb{margin-bottom:18px}.crumb a{color:var(--sub);font-size:14px}.who{display:flex;align-items:center;gap:16px;margin-bottom:20px}.who h2{margin:0;font-size:24px;letter-spacing:-.02em}.sub{color:var(--mut);margin:2px 0 0;font-size:14px}
.ava{width:56px;height:56px;border-radius:50%;background:var(--tint);color:var(--acc);display:grid;place-items:center;font-size:24px;font-weight:700;flex:none}
.empty{color:var(--mut);padding:44px 0;text-align:center;background:var(--card);border-radius:20px}.empty.sm{padding:18px 0;background:none}
td.wrap{white-space:normal;min-width:120px}.note{margin:0 0 10px}
.stps{display:inline-flex;gap:4px}.stp{padding:3px 9px;font-size:12px;border-radius:6px;background:var(--hov);color:var(--sub)}
.stp.on{background:var(--tint);color:var(--gold);font-weight:600}a.stp:hover{background:var(--line);color:var(--fg)}
.btnl{margin-left:auto;font-size:13px;font-weight:600;padding:7px 12px;border-radius:9px;background:var(--hov);color:var(--sub)}
.stick{position:sticky;right:-8px;background:var(--card)}th.stick{z-index:2;background:var(--head)}.del{display:inline-block;padding:5px 10px;border-radius:8px;font-size:13px;font-weight:600;background:var(--redt);color:var(--red)}.del:hover{color:var(--red);filter:brightness(.96)}
.hide{display:inline-block;padding:5px 10px;border-radius:8px;font-size:13px;font-weight:600;background:var(--hov);color:var(--sub)}
.top nav{align-self:stretch;display:flex;gap:22px;font-size:15px;overflow-x:auto;scrollbar-width:none}.top nav a{position:relative;display:flex;align-items:center;color:var(--mut);font-weight:500;white-space:nowrap}.top nav a:hover{color:var(--fg)}
.top nav a.on{color:var(--fg);font-weight:700}.top nav a.on::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--fg)}
dialog.ask{width:min(360px,calc(100vw - 40px));padding:26px 24px 20px;border:0;border-radius:22px;background:var(--card);color:var(--fg);box-shadow:0 16px 48px rgba(0,27,55,.2)}dialog.ask::backdrop{background:rgba(0,0,0,.4)}
.ask h4{margin:0;font-size:19px;line-height:1.4;font-weight:700;letter-spacing:-.02em}.ask p{margin:6px 0 22px;color:var(--sub);font-size:15px}.ask div{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ask button,.ask a{display:block;padding:13px 0;border:0;border-radius:12px;font-family:inherit;font-size:16px;font-weight:600;line-height:1.3;text-align:center;cursor:pointer}.ask button{background:var(--hov);color:var(--sub)}.ask a{background:var(--red);color:#fff}.ask a:hover{color:#fff;filter:brightness(.96)}
@media (prefers-color-scheme:dark){.seg{background:#26262c}}
@media (max-width:1100px){.charts{grid-template-columns:1fr 1fr}.charts .chart:first-child{grid-column:1/-1}}
@media (max-width:860px){.top>div{flex-wrap:wrap;gap:0 16px;padding-top:12px}.top nav{order:3;width:100%;height:44px}}
@media (max-width:800px){.charts{grid-template-columns:1fr}}
@media (max-width:600px){.plot{height:150px}.xa i{display:none}.cards{grid-template-columns:1fr 1fr;gap:8px}.card{padding:16px 18px;border-radius:16px}.card b{font-size:22px}.seg{margin-left:0}td.w{min-width:120px}main{padding:20px 16px 56px}.top>div{padding-left:16px;padding-right:16px}}
</style></head><body><header class="top"><div><h1><a href="?">오피스 로얄 · 관리</a></h1><nav>${TABS.map(([k, n]) => `<a href="?tab=${k}"${k === tab ? ' class="on"' : ''}>${n}</a>`).join('')}</nav><span class="mut">${when(Date.now())} 기준</span></div></header><main>${body}</main>${tab === 'manage' ? ASK : ''}</body></html>`;
}
