// Play stats for the admin page: who played, how much, and how it went.
// A person is a device (the `or-uid` the browser keeps), shown with the latest 사원명 they used; one person on two
// devices counts twice. Solo games are reported by the browser when the result screen shows (quitting mid-game is not
// counted); online games are reported by the room when the match ends, for everyone who started it.
// Storage keys (all small values): s:day:<date> per KST day, s:p:<uid> per person, s:idx (one line per person), s:recent.
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
    const game = { at: now, uid, name: g.name, mode: g.mode, diff: g.diff, place: g.place, rank: g.rank, kills: g.kills, tasks: g.tasks, time: g.time, lunch: g.lunch || '', room: g.room || undefined };

    const d = await this.get('s:day:' + day, null) || { games: 0, solo: 0, multi: 0, sec: 0, diff: {}, people: [] };
    d.games++; d[g.mode]++; d.sec += g.time; d.diff[g.diff] = (d.diff[g.diff] || 0) + 1;
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
const DIFF_N = { easy: '쉬움', normal: '보통', hard: '어려움' }, MODE_N = { solo: '혼자', multi: '같이' };
const LUNCH_N = { lighter: '라이터', bill: '계산서', meal: '특식', ladder: '사다리' };
const gameRow = (g, link) => `<tr><td>${when(g.at)}</td>${link ? `<td>${link(g)}</td>` : ''}<td>${MODE_N[g.mode] || g.mode}${g.room ? ' ' + esc(g.room) : ''}</td><td>${DIFF_N[g.diff] || ''}</td><td>${g.place}위</td><td>${esc(g.rank)}</td><td>${g.tasks}</td><td>${g.kills}</td><td>${dur(g.time)}</td><td>${LUNCH_N[g.lunch] || ''}</td></tr>`;
const GAME_HEAD = link => `<tr><th>시각</th>${link ? '<th>사원</th>' : ''}<th>모드</th><th>난이도</th><th>등수</th><th>직급</th><th>업무</th><th>해고</th><th>시간</th><th>점심</th></tr>`;

export async function adminHTML(stats, q) {
  const link = (uid, name) => `<a href="?uid=${encodeURIComponent(uid)}">${esc(name)}</a>`;
  let body;
  if (q.get('uid')) {
    const p = await stats.person(q.get('uid'));
    body = !p ? '<p>기록이 없어요.</p>' : `<p><a href="?">← 전체</a></p>
      <h2>${esc(p.name)}</h2><p class="sub">${p.names.length ? '예전 이름: ' + p.names.map(esc).join(', ') + ' · ' : ''}기기 ${esc(p.uid)}</p>
      <div class="cards">
        <div><b>${p.games}</b>판<small>혼자 ${p.solo} · 같이 ${p.multi}</small></div>
        <div><b>${dur(p.sec)}</b><small>총 플레이</small></div>
        <div><b>${p.wins}</b>번 CEO<small>최고 ${p.best ? `${p.best.place}위 · ${esc(p.best.rank)}` : '-'}</small></div>
        <div><b>${p.tasks}</b>업무 · <b>${p.kills}</b>해고<small>누적</small></div>
        <div><b>${when(p.first)}</b><small>처음 · 마지막 ${when(p.last)}</small></div>
      </div>
      <h3>최근 ${p.recent.length}판</h3><table>${GAME_HEAD(false)}${p.recent.map(g => gameRow(g)).join('')}</table>`;
  } else {
    const days = await stats.days(14), people = await stats.people(), rec = await stats.recent();
    const sort = q.get('sort') || 'last', ppl = people.sort((a, b) => sort === 'games' ? b.games - a.games : sort === 'time' ? b.sec - a.sec : b.last - a.last);
    const nameOf = new Map(people.map(p => [p.uid, p.name])); // games keep the name used then; show who it is now
    const t = days[0], wk = days.slice(0, 7), wkPeople = new Set(wk.flatMap(d => d.people));
    const sum = (a, f) => a.reduce((s, d) => s + f(d), 0);
    body = `<div class="cards">
        <div><b>${t.games}</b>판 오늘<small>${t.people.length}명 · 혼자 ${t.solo} · 같이 ${t.multi}</small></div>
        <div><b>${sum(wk, d => d.games)}</b>판 7일<small>${wkPeople.size}명</small></div>
        <div><b>${people.length}</b>명 전체<small>${sum(people, p => p.games)}판 · ${dur(sum(people, p => p.sec))}</small></div>
        <div><b>${t.games ? dur(Math.round(t.sec / t.games)) : '-'}</b><small>오늘 한 판 평균</small></div>
      </div>
      <h3>날짜별</h3><table><tr><th>날짜</th><th>판</th><th>사람</th><th>혼자</th><th>같이</th><th>쉬움/보통/어려움</th><th>평균</th></tr>
      ${days.map(d => `<tr><td>${d.day.slice(5)}</td><td>${d.games}</td><td>${d.people.length}</td><td>${d.solo}</td><td>${d.multi}</td><td>${d.diff.easy || 0}/${d.diff.normal || 0}/${d.diff.hard || 0}</td><td>${d.games ? dur(Math.round(d.sec / d.games)) : '-'}</td></tr>`).join('')}</table>
      <h3>사람별 <small>정렬: <a href="?sort=last">최근</a> · <a href="?sort=games">판 수</a> · <a href="?sort=time">플레이 시간</a></small></h3>
      <table><tr><th>사원명</th><th>판</th><th>플레이 시간</th><th>CEO</th><th>처음</th><th>마지막</th></tr>
      ${ppl.slice(0, 300).map(p => `<tr><td>${link(p.uid, p.name)}</td><td>${p.games}</td><td>${dur(p.sec)}</td><td>${p.wins}</td><td>${when(p.first)}</td><td>${when(p.last)}</td></tr>`).join('')}</table>
      <h3>최근 판</h3><table>${GAME_HEAD(true)}${rec.slice(0, 50).map(g => gameRow(g, g => link(g.uid, nameOf.get(g.uid) || g.name))).join('')}</table>`;
  }
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>오피스 로얄 · 관리</title><style>
:root{color-scheme:light dark;--bg:#f4f2ec;--fg:#1d2328;--mut:#6b747b;--card:#fff;--line:#d9d6cd;--acc:#2b6cb0}
@media (prefers-color-scheme:dark){:root{--bg:#16191c;--fg:#e8eaec;--mut:#9aa3ab;--card:#1f2327;--line:#30363b;--acc:#7fb2ee}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;word-break:keep-all}
h1{font-size:20px;margin:0 0 12px}h2{margin:4px 0}h3{margin:22px 0 8px;font-size:16px}h3 small{font-weight:400;color:var(--mut);font-size:13px}.sub{color:var(--mut);margin:0}
a{color:var(--acc)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px}
.cards div{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}.cards b{font-size:20px;margin-right:2px}.cards small{display:block;color:var(--mut)}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;display:block;overflow-x:auto}tbody{display:table;width:100%}
th,td{padding:6px 10px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}th{color:var(--mut);font-weight:600}
</style></head><body><h1>오피스 로얄 · 플레이 기록</h1>${body}</body></html>`;
}
