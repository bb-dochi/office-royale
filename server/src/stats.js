// Play stats for the admin page: who played, how much, and how it went.
// A person is a device (the `or-uid` the browser keeps), shown with the latest 사원명 they used; one person on two
// devices counts twice. Solo games are reported by the browser when the result screen shows (quitting mid-game is not
// counted); online games are reported by the room when the match ends, for everyone who started it.
// A game's branch is the team the player was posted to (sim BRANCH; '' = still an intern). Days and games from before
// it was recorded (and games from pages cached since then) have no branch field at all and aren't counted.
// Storage keys (all small values): s:day:<date> per KST day, s:p:<uid> per person, s:idx (one line per person), s:recent.
const BRANCHES = ['dev', 'mkt', 'hr', 'design'];
const RECENT = 100, PERSON_RECENT = 20, IDX_MAX = 3000, DAY_PEOPLE_MAX = 5000;
export const dayOf = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export class StatsCore {
  /* store: {get(key), put(key, value)} (may be async) */
  constructor(store) { this.store = store; this.cache = new Map(); this.last = new Map(); }
  async get(k, dflt) { if (!this.cache.has(k)) this.cache.set(k, (await this.store.get(k)) ?? dflt); return this.cache.get(k); }
  put(k, v) { this.cache.set(k, v); return this.store.put(k, v); }

  /* g: {uid, name, mode:'solo'|'multi', diff, place, rank, kills, tasks, time, lunch, room?} (already checked).
     One at a time: a match ends for several people at once, and each write reads what the last one left */
  record(g) { return (this.q = (this.q || Promise.resolve()).then(() => this.write(g)).catch(e => console.error('stats', e))); }
  async write(g) {
    const now = Date.now(), day = dayOf(now), uid = g.uid || 'anon';
    const game = { at: now, uid, name: g.name, mode: g.mode, diff: g.diff, place: g.place, rank: g.rank, kills: g.kills, tasks: g.tasks, time: g.time, lunch: g.lunch || '', branch: g.branch === undefined ? undefined : BRANCHES.includes(g.branch) ? g.branch : '', room: g.room || undefined };

    const d = await this.get('s:day:' + day, null) || { games: 0, solo: 0, multi: 0, sec: 0, diff: {}, people: [] };
    d.games++; d[g.mode]++; d.sec += g.time; d.diff[g.diff] = (d.diff[g.diff] || 0) + 1;
    if (game.branch !== undefined) { const br = game.branch || 'none'; d.branch ||= {}; d.branch[br] = (d.branch[br] || 0) + 1; } // pages cached from before don't say
    if (!d.people.includes(uid) && d.people.length < DAY_PEOPLE_MAX) d.people.push(uid);
    await this.put('s:day:' + day, d);

    const p = await this.get('s:p:' + uid, null) || { uid, name: g.name, names: [], first: now, games: 0, solo: 0, multi: 0, wins: 0, sec: 0, kills: 0, tasks: 0, best: null, recent: [] };
    if (p.name !== g.name && !p.names.includes(p.name)) p.names = [p.name, ...p.names].slice(0, 5);
    p.name = g.name; p.last = now; p.games++; p[g.mode]++; p.sec += g.time; p.kills += g.kills; p.tasks += g.tasks;
    if (g.place === 1) p.wins++;
    if (!p.best || g.place < p.best.place) p.best = { place: g.place, rank: g.rank, diff: g.diff, mode: g.mode, at: now };
    p.recent = [game, ...p.recent].slice(0, PERSON_RECENT);
    await this.put('s:p:' + uid, p);

    const idx = await this.get('s:idx', {});
    idx[uid] = [p.name, p.games, p.last, p.sec, p.wins, p.first];
    const ids = Object.keys(idx);
    if (ids.length > IDX_MAX) for (const id of ids.sort((a, b) => idx[a][2] - idx[b][2]).slice(0, ids.length - IDX_MAX)) delete idx[id];
    await this.put('s:idx', idx);

    const rec = await this.get('s:recent', []);
    rec.unshift(game); if (rec.length > RECENT) rec.length = RECENT;
    await this.put('s:recent', rec);
  }

  async days(n = 14) {
    const out = [];
    for (let i = 0; i < n; i++) { const day = dayOf(Date.now() - i * 864e5), d = await this.get('s:day:' + day, null); out.push({ day, ...(d || { games: 0, solo: 0, multi: 0, sec: 0, diff: {}, people: [] }) }); }
    return out;
  }
  async people() { const idx = await this.get('s:idx', {}); return Object.entries(idx).map(([uid, [name, games, last, sec, wins, first]]) => ({ uid, name, games, last, sec, wins, first })); }
  async person(uid) { return this.get('s:p:' + uid, null); }
  async recent() { return this.get('s:recent', []); }
}

/* ---------- the admin page (server-rendered, no scripts) ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dur = s => s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
const when = ms => ms ? new Date(ms + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '-';
const ago = ms => { if (!ms) return '-'; const s = (Date.now() - ms) / 1000; return s < 60 ? '방금' : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : s < 86400 * 30 ? `${Math.floor(s / 86400)}일 전` : when(ms).slice(0, 5); };
const DIFF_N = { easy: '쉬움', normal: '보통', hard: '어려움' }, MODE_N = { solo: '혼자', multi: '같이' };
const LUNCH_N = { lighter: '라이터', bill: '계산서', meal: '특식', ladder: '사다리' };
const BRANCH_N = { dev: '개발', mkt: '마케팅', hr: '인사', design: '디자인', none: '미발령' }, BR_KEYS = [...BRANCHES, 'none'];
const pill = (cls, txt) => txt ? `<span class="pill ${cls}">${txt}</span>` : '';
const place = n => `<span class="place${n === 1 ? ' p1' : n <= 3 ? ' p3' : ''}">${n}위</span>`;
const gameRow = (g, link) => `<tr><td class="mut" title="${ago(g.at)}">${when(g.at)}</td>${link ? `<td>${link(g)}</td>` : ''}<td>${pill(g.mode, MODE_N[g.mode] || esc(g.mode))}${g.room ? ` <span class="mut">${esc(g.room)}</span>` : ''}</td><td>${pill(g.diff, DIFF_N[g.diff])}</td><td>${place(g.place)}</td><td>${esc(g.rank)}</td><td${g.branch ? '' : ' class="mut"'}>${g.branch == null ? '' : BRANCH_N[g.branch || 'none']}</td><td class="n">${g.tasks}</td><td class="n">${g.kills}</td><td class="n">${dur(g.time)}</td><td class="mut">${LUNCH_N[g.lunch] || ''}</td></tr>`;
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
    <td>${esc(c.text)}</td><td class="n"><a href="?${c.hid ? 'fbshow' : 'fbhide'}=${c.id}#fb">${c.hid ? '되살리기' : '숨기기'}</a></td></tr>`).join('');
  return section(`사내 게시판 댓글 <small>${live}개 보이는 중${all.length > 100 ? ' · 최근 100개' : ''}</small>`,
    all.length ? tbl(`<thead><tr><th>시각</th><th>글</th><th>사원</th><th>내용</th><th class="n"></th></tr></thead><tbody>${rows}</tbody>`) : '<p class="empty">아직 댓글이 없어요.</p>', '', 'fb');
}
export async function adminHTML(stats, q, career, feedback) {
  const link = (uid, name) => `<a href="?uid=${encodeURIComponent(uid)}">${esc(name)}</a>`;
  if (feedback && q.get('fbhide')) await feedback.hide(+q.get('fbhide'), true); // 사내 게시판 댓글 숨기기 / 되살리기
  if (feedback && q.get('fbshow')) await feedback.hide(+q.get('fbshow'), false);
  let body;
  if (q.get('uid')) {
    const p = await stats.person(q.get('uid')), code = career && await career.codeOf(q.get('uid'));
    const avgPlace = p && p.recent.length ? (p.recent.reduce((s, g) => s + g.place, 0) / p.recent.length).toFixed(1) : '-';
    body = `<nav class="crumb"><a href="?">← 전체 목록</a></nav>` + (!p ? '<p class="empty">기록이 없어요.</p>' : `
      <header class="who"><div class="ava">${esc([...p.name][0] || '?')}</div><div><h2>${esc(p.name)}</h2>
        <p class="sub">${code ? `사원코드 <b>${esc(code)}</b> · ` : ''}${p.names.length ? '예전 이름 ' + p.names.map(esc).join(', ') + ' · ' : ''}<span class="mono">${esc(p.uid)}</span></p></div></header>
      <div class="cards">
        ${card(`${p.games}<u>판</u>`, '플레이', `혼자 ${p.solo} · 같이 ${p.multi}`)}
        ${card(dur(p.sec), '총 플레이 시간', p.games ? `한 판 평균 ${dur(Math.round(p.sec / p.games))}` : '')}
        ${card(`${p.wins}<u>번</u>`, 'CEO 등극', `승률 ${p.games ? Math.round(p.wins / p.games * 100) : 0}% · 최고 ${p.best ? `${p.best.place}위 ${esc(p.best.rank)}` : '-'}`)}
        ${card(`${p.tasks}<u>업무</u> ${p.kills}<u>해고</u>`, '누적', `최근 ${p.recent.length}판 평균 ${avgPlace}위`)}
        ${card(ago(p.last), '마지막 플레이', `처음 ${when(p.first)}`)}
      </div>
      ${section(`최근 ${p.recent.length}판`, tbl(GAME_HEAD(false) + `<tbody>${p.recent.map(g => gameRow(g)).join('')}</tbody>`) + lunchPop(p.recent))}`);
  } else {
    const days = await stats.days(14), trend = days.slice(0, 7).reverse(), people = await stats.people(), rec = await stats.recent();
    const sort = q.get('sort') || 'last', ppl = people.sort((a, b) => sort === 'games' ? b.games - a.games : sort === 'time' ? b.sec - a.sec : b.last - a.last);
    const nameOf = new Map(people.map(p => [p.uid, p.name])); // games keep the name used then; show who it is now
    const t = days[0], y = days[1], wk = days.slice(0, 7), wkPeople = new Set(wk.flatMap(d => d.people));
    const sum = (a, f) => a.reduce((s, d) => s + f(d), 0);
    const delta = (a, b) => a === b ? '' : `<span class="dl ${a > b ? 'up' : 'dn'}">${a > b ? '▲' : '▼'}${Math.abs(a - b)}</span>`;
    const maxG = Math.max(1, ...days.map(d => d.games)), maxP = Math.max(1, ...days.map(d => d.people.length));
    const tabs = [['last', '최근'], ['games', '판 수'], ['time', '플레이 시간']].map(([k, n]) => `<a href="?sort=${k}#people"${k === sort ? ' class="on"' : ''}>${n}</a>`).join('');
    const maxPG = Math.max(1, ...ppl.map(p => p.games));
    body = `<div class="cards">
        ${card(`${t.games}<u>판</u> ${delta(t.games, y.games)}`, '오늘', `${t.people.length}명 · 혼자 ${t.solo} · 같이 ${t.multi}`)}
        ${card(`${sum(wk, d => d.games)}<u>판</u>`, '최근 7일', `${wkPeople.size}명이 플레이`)}
        ${card(`${people.length}<u>명</u>`, '전체 사원', `${sum(people, p => p.games)}판 · ${dur(sum(people, p => p.sec))}`)}
        ${card(t.games ? dur(Math.round(t.sec / t.games)) : '-', '오늘 한 판 평균', y.games ? `어제 ${dur(Math.round(y.sec / y.games))}` : '')}
      </div>
      ${section('추세 <small>최근 7일 · 마우스를 올리면 그날 숫자</small>', `<div class="charts">
        <div class="chart"><div class="ch"><b>하루 플레이</b><span class="lg"><i class="normal"></i>혼자 판 <i class="easy"></i>같이 판 <i class="lnk"></i>사람</span></div>${playChart(trend)}</div>
        <div class="chart"><div class="ch"><b>한 판 평균 시간</b><span class="lg"><i class="bandk"></i>목표 4–5분</span></div>${timeChart(trend)}</div>
        <div class="chart"><div class="ch"><b>부서 발령</b><span class="lg">최근 7일 합계</span></div>${branchChart(trend)}</div></div>`)}
      ${section('날짜별 <small>최근 14일</small>', tbl(`<thead><tr><th>날짜</th><th class="w">판 <span class="lg"><i class="solo"></i>혼자 <i class="multi"></i>같이</span></th><th class="n">판</th><th class="n">사람</th><th class="w2">난이도 <span class="lg"><i class="easy"></i>쉬움 <i class="normal"></i>보통 <i class="hard"></i>어려움</span></th><th class="n">평균</th></tr></thead><tbody>
      ${days.map((d, i) => { const wd = '일월화수목금토'[new Date(d.day).getUTCDay()]; return `<tr${d.games ? '' : ' class="zero"'}><td>${d.day.slice(5).replace('-', '.')} <span class="mut${wd === '토' || wd === '일' ? ' we' : ''}">${i ? wd : '오늘'}</span></td>
        <td class="w">${bar([[d.solo, 'solo'], [d.multi, 'multi']], maxG)}</td><td class="n"><b>${d.games}</b></td><td class="n" title="${d.people.length}명">${d.people.length}</td>
        <td class="w2">${d.games ? bar([[d.diff.easy || 0, 'easy'], [d.diff.normal || 0, 'normal'], [d.diff.hard || 0, 'hard']], d.games) + `<span class="mut sm">${d.diff.easy || 0} / ${d.diff.normal || 0} / ${d.diff.hard || 0}</span>` : ''}</td>
        <td class="n mut">${d.games ? dur(Math.round(d.sec / d.games)) : '-'}</td></tr>`; }).join('')}</tbody>`))}
      ${section(`사람별 <small>${people.length}명${people.length > 300 ? ' 중 300명' : ''}</small>`, tbl(`<thead><tr><th>사원명</th><th class="w">판</th><th class="n">플레이 시간</th><th class="n">CEO</th><th>처음</th><th>마지막</th></tr></thead><tbody>
      ${ppl.slice(0, 300).map(p => `<tr><td>${link(p.uid, p.name)}</td><td class="w"><div class="bc">${bar([[p.games, 'solo']], maxPG)}<b>${p.games}</b></div></td><td class="n">${dur(p.sec)}</td><td class="n">${p.wins ? `<span class="place p1">${p.wins}</span>` : '<span class="mut">0</span>'}</td><td class="mut">${when(p.first)}</td><td title="${when(p.last)}">${ago(p.last)}</td></tr>`).join('')}</tbody>`, 'tall'), `<div class="seg">${tabs}</div>`, 'people')}
      ${section('최근 판 <small>50판</small>', tbl(GAME_HEAD(true) + `<tbody>${rec.slice(0, 50).map(g => gameRow(g, g => link(g.uid, nameOf.get(g.uid) || g.name))).join('')}</tbody>`, 'tall') + lunchPop(rec))}`;
  }
  if (feedback && !q.get('uid')) body = await feedbackSection(feedback, link) + body;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>오피스 로얄 · 관리</title><link rel="icon" href="/favicon.ico"><style>
:root{color-scheme:light dark;--bg:#f4f4f3;--fg:#1f2225;--mut:#7a7f84;--card:#fff;--line:#e4e4e2;--head:#fafafa;--acc:#1f2225;--hov:#f2f2f1;
  --solo:#3a3e43;--multi:#a3a7ab;--easy:#c9cccf;--normal:#8d9196;--hard:#3a3e43;--gold:#1f2225;--goldbg:#e6e6e4;--up:#555a5f;--dn:#555a5f}
@media (prefers-color-scheme:dark){:root{--bg:#141516;--fg:#e6e7e8;--mut:#8b9095;--card:#1c1d1f;--line:#2c2e31;--head:#212224;--acc:#e6e7e8;--hov:#252729;
  --solo:#d4d6d8;--multi:#6b7075;--easy:#45494d;--normal:#80858a;--hard:#d4d6d8;--gold:#e6e7e8;--goldbg:#33363a;--up:#a9adb1;--dn:#a9adb1}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all}
.top{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line)}
.top div{max-width:1200px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:10px}
.top h1{font-size:16px;margin:0;font-weight:700}.top h1 a{color:inherit;text-decoration:none}.top .mut{margin-left:auto;font-size:12px}
main{max-width:1200px;margin:0 auto;padding:16px 16px 48px}
a{color:var(--fg);text-decoration:none;font-weight:500}a:hover{text-decoration:underline}
.mut{color:var(--mut)}.sm{font-size:12px}.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}.we{color:var(--mut);font-weight:600}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.card .lbl{font-size:12px;color:var(--mut);font-weight:600}.card b{font-size:26px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.card b u{text-decoration:none;font-size:14px;font-weight:500;color:var(--mut);margin:0 6px 0 2px}.card small{color:var(--mut);font-size:12px}
.dl{font-size:12px;font-weight:600;vertical-align:middle}.dl.up{color:var(--up)}.dl.dn{color:var(--dn)}
section{margin-top:28px;scroll-margin-top:64px}.sh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
h3{margin:0;font-size:16px}h3 small{font-weight:400;color:var(--mut);font-size:13px;margin-left:4px}
.seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:2px;margin-left:auto}
.seg a{padding:4px 12px;border-radius:6px;color:var(--mut);font-size:13px}.seg a:hover{text-decoration:none;color:var(--fg)}.seg a.on{background:var(--acc);color:var(--card);font-weight:600}
.tw{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:auto}.tw.tall{max-height:560px}
table{border-collapse:collapse;width:100%}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:var(--hov)}tr.zero td{color:var(--mut)}
th{position:sticky;top:0;background:var(--head);color:var(--mut);font-weight:600;font-size:12px;z-index:1}
.n{text-align:right}td.w{width:40%;min-width:160px}td.w2{min-width:180px}
.lg{font-weight:400;margin-left:6px}.lg i{display:inline-block;width:8px;height:8px;border-radius:2px;margin:0 2px 0 6px}
.bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--hov);min-width:80px}.bar i{display:block;height:100%}
td.w2 .bar{display:inline-flex;width:110px;vertical-align:middle;margin-right:8px}
.chart{container-type:inline-size}@container (max-width:440px){.xa i{display:none}}
.charts{display:grid;grid-template-columns:3fr 2fr 2fr;gap:10px}.chart{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px 10px}
.ch{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px}.ch b{font-size:13px}.ch .lg{color:var(--mut);font-size:12px;margin-left:auto}
.lg i.lnk{height:2px;width:12px;background:var(--fg);vertical-align:middle}.lg i.bandk{background:var(--goldbg)}
.plot{display:flex;gap:6px;height:180px}.ya{position:relative;width:30px;flex:none;margin-bottom:20px}.ya span{position:absolute;right:0;transform:translateY(-50%);font-size:11px;color:var(--mut)}
.pa{position:relative;flex:1;min-width:0}.pa svg{display:block;width:100%;height:calc(100% - 20px);overflow:visible}
.xa{position:relative;height:20px}.xa i{font-style:normal}.xa span{position:absolute;top:4px;transform:translateX(-50%);font-size:11px;color:var(--mut);white-space:nowrap}
svg .gl{stroke:var(--line);stroke-width:1;vector-effect:non-scaling-stroke}svg .b1{fill:var(--normal)}svg .b2{fill:var(--easy)}svg .hit{fill:transparent}svg .col:hover .hit{fill:var(--hov)}
svg .ln{fill:none;stroke:var(--fg);stroke-width:1.5;stroke-linejoin:round;vector-effect:non-scaling-stroke}svg .dot{stroke:var(--fg);stroke-width:5;stroke-linecap:round;vector-effect:non-scaling-stroke}
svg .band{fill:var(--goldbg)}
.bdev{background:var(--solo)}.bmkt{background:var(--normal)}.bhr{background:var(--easy)}.bdesign{background:var(--multi)}.bnone{background:var(--line);opacity:.6}
svg .bdev{fill:var(--solo)}svg .bmkt{fill:var(--normal)}svg .bhr{fill:var(--easy)}svg .bdesign{fill:var(--multi)}svg .bnone{fill:var(--line)}
.pie{display:flex;align-items:center;gap:14px;min-height:150px}.pie svg{width:min(130px,40%);flex:none}@container (max-width:300px){.pie li small{display:none}}
.pie circle{fill:none;stroke-width:6.5}.pie .track{stroke:var(--hov)}.pie text{text-anchor:middle;font-size:7px;font-weight:700;fill:var(--fg)}.pie text.u{font-size:3.4px;font-weight:400;fill:var(--mut)}
.sllighter{stroke:var(--solo)}.slbill{stroke:var(--normal)}.slmeal{stroke:var(--easy)}.slladder{stroke:var(--multi)}.bllighter{background:var(--solo)}.blbill{background:var(--normal)}.blmeal{background:var(--easy)}.blladder{background:var(--multi)}
.thb{all:unset;cursor:pointer;color:var(--fg);font-weight:600}.thb span{color:var(--mut)}.thb:hover{text-decoration:underline}
.pop{width:min(360px,calc(100vw - 32px));padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--card);color:var(--fg);box-shadow:0 12px 40px rgba(0,0,0,.18)}.pop::backdrop{background:rgba(0,0,0,.12)}
.sdev{stroke:var(--solo)}.smkt{stroke:var(--normal)}.shr{stroke:var(--easy)}.sdesign{stroke:var(--multi)}.snone{stroke:var(--line);opacity:.6}
.pie ul{list-style:none;margin:0;padding:0;flex:1;min-width:0;display:grid;gap:6px}.pie li{display:flex;align-items:center;gap:6px;font-size:13px}
.pie li i{width:10px;height:10px;border-radius:3px;flex:none}.pie li b{margin-left:auto;font-variant-numeric:tabular-nums}.pie li small{color:var(--mut);min-width:3.5em;text-align:right}
.pie li.faint{color:var(--mut)}.pie li.faint b{color:var(--mut);font-weight:500}.pnote{margin:10px 0 0}.ch .lg b{font-weight:600;color:var(--fg);margin-right:4px}
.bc{display:flex;align-items:center;gap:8px}.bc .bar{flex:1}.bc b{min-width:2.5em;text-align:right}
.solo{background:var(--solo)}.multi{background:var(--multi)}.easy{background:var(--easy)}.normal{background:var(--normal)}.hard{background:var(--hard)}
.pill{display:inline-block;padding:0 8px;border-radius:999px;font-size:12px;font-weight:500;color:var(--fg);background:none!important;border:1px solid var(--line)}
.pill.hard{border-color:var(--mut);font-weight:700}
.place{display:inline-block;min-width:2.6em;text-align:center;padding:1px 6px;border-radius:6px;font-weight:600;font-size:12px;background:var(--hov)}
.place{color:var(--mut)}.place.p1{background:var(--goldbg);color:var(--gold);font-weight:700}.place.p3{color:var(--fg)}
.crumb{margin-bottom:14px}.who{display:flex;align-items:center;gap:14px;margin-bottom:16px}.who h2{margin:0;font-size:22px}.sub{color:var(--mut);margin:2px 0 0}
.ava{width:52px;height:52px;border-radius:14px;background:var(--acc);color:var(--card);display:grid;place-items:center;font-size:24px;font-weight:700;flex:none}
.empty{color:var(--mut);padding:40px 0;text-align:center}
@media (max-width:1100px){.charts{grid-template-columns:1fr 1fr}.charts .chart:first-child{grid-column:1/-1}}
@media (max-width:800px){.charts{grid-template-columns:1fr}}
@media (max-width:600px){.plot{height:150px}.xa i{display:none}.cards{grid-template-columns:1fr 1fr;gap:8px}.card{padding:12px}.card b{font-size:20px}.seg{margin-left:0}td.w{min-width:120px}}
</style></head><body><header class="top"><div><h1><a href="?">오피스 로얄 · 플레이 기록</a></h1><span class="mut">${when(Date.now())} 기준</span></div></header><main>${body}</main></body></html>`;
}
