// Weekly solo leaderboard: 어려움 games only, one board per week (weeks start Monday 00:00 KST).
// Shared by the local dev server (tools/dev-server.mjs, kept in memory) and the Durable Object (index.js, kept in storage).
// Solo games run in the browser, so a score can't be proven: the server recomputes it from the reported numbers and
// turns away impossible ones. Each device (uid) keeps only its best score of the week.
export const DIFFS = ['easy', 'normal', 'hard'], RANKED = 'hard';
const KEEP = 100, SHOW = 50, GAP = 20e3, TOTAL = 20, WEEK = 7 * 864e5;
const HALL_FROM = '2026-10-26'; // the first week the board ran: 명예 사원 starts here
export const RANKS = ['인턴', '사원', '대리', '팀장', '임원', 'CEO'];
const RANK_PT = [0, 50, 100, 200, 300, 500];

/* same formula as soloScore() in public/js/client/48-rank.js. Until the week of NEW_SCORE a win counted as CEO (500)
   whatever rank you had; from then on a win is a CEO_BONUS on top of the rank you actually reached (e.real), so
   climbing higher before winning is worth something */
export const NEW_SCORE = '2026-11-02', CEO_BONUS = 300;
const rankPt = r => RANK_PT[RANKS.indexOf(r)];
export const scoreOf = (e, week = weekOf()) => (TOTAL + 1 - e.place) * 50
  + (week >= NEW_SCORE ? rankPt(e.real || e.rank) + (e.place === 1 ? CEO_BONUS : 0) : rankPt(e.rank))
  + e.kills * 40 + e.tasks * 10 + Math.floor(e.time / 2);

export function weekOf(ms = Date.now()) {
  const d = new Date(ms + 9 * 3600e3), day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export function clean(m) {
  if (!m || typeof m !== 'object') return null;
  const name = String(m.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '신입';
  if (typeof m.uid !== 'string' || !/^[a-z0-9]{8,32}$/.test(m.uid) || !DIFFS.includes(m.diff)) return null;
  if (!int(m.place, 1, TOTAL) || !RANKS.includes(m.rank) || (m.rank === 'CEO') !== (m.place === 1)) return null;
  if (!int(m.kills, 0, TOTAL - 1) || !int(m.tasks, 0, 80) || typeof m.time !== 'number' || !(m.time >= 0 && m.time <= 900)) return null;
  /* the rank a winner had actually reached (older pages don't send it: counted as 대리) */
  const real = m.place === 1 ? (RANKS.slice(0, -1).includes(m.real) ? m.real : '대리') : m.rank;
  return { uid: m.uid, name, diff: m.diff, place: m.place, rank: m.rank, real, kills: m.kills, tasks: m.tasks, time: Math.round(m.time) };
}
const pub = (e, uid) => ({ name: e.name, score: e.score, place: e.place, rank: e.rank, kills: e.kills, tasks: e.tasks, time: e.time, mine: e.uid === uid || undefined });

export class RankCore {
  /* store: {get(key) → value | undefined, put(key, value)} (may be async) */
  constructor(store) { this.store = store; this.cache = new Map(); this.last = new Map(); }
  async board(week, diff) {
    const k = `${week}:${diff}`;
    if (!this.cache.has(k)) this.cache.set(k, (await this.store.get(k)) || []);
    return this.cache.get(k);
  }
  view(week, diff, b, uid) {
    const i = b.findIndex(x => x.uid === uid);
    return { week, diff, n: b.length, top: b.slice(0, SHOW).map(e => pub(e, uid)), me: i >= 0 ? { pos: i + 1, ...pub(b[i], uid) } : null };
  }
  async top(uid) {
    const week = weekOf(), diff = RANKED;
    return this.view(week, diff, await this.board(week, diff), uid);
  }
  submit(e) { return (this.q = (this.q || Promise.resolve()).catch(() => {}).then(() => this.write(e))); } // one at a time, like stats
  async write(e) {
    if (e.diff !== RANKED) return { err: '랭킹은 어려움만 기록돼요' };
    const now = Date.now(), week = weekOf(now), b = await this.board(week, e.diff);
    e.score = scoreOf(e, week); e.at = now;
    const i = b.findIndex(x => x.uid === e.uid);
    let best = true;
    if (i >= 0) { if (b[i].score >= e.score) { best = false; b[i].name = e.name; } else b.splice(i, 1); }
    if (best) { b.push(e); b.sort((p, q) => q.score - p.score || p.at - q.at); if (b.length > KEEP) b.length = KEEP; }
    await this.store.put(`${week}:${e.diff}`, b);
    return { ...this.view(week, e.diff, b, e.uid), score: e.score, best };
  }
  /* /admin: this week's records with what `pub` keeps back, and taking one off. A record is named by uid and time, so a reload can't take a newer one */
  async records() { const week = weekOf(), list = await this.board(week, RANKED); return { week, list }; }
  remove(uid, at) {
    return (this.q = (this.q || Promise.resolve()).catch(() => {}).then(async () => {
      const week = weekOf(), b = await this.board(week, RANKED), i = b.findIndex(e => e.uid === uid && e.at === at);
      if (i < 0) return false;
      b.splice(i, 1); await this.store.put(`${week}:${RANKED}`, b); return true;
    }));
  }
  /* 명예 사원: the first look after a week ends freezes its top 3 with the outfit each career wears at that moment, so
     nothing that happens later changes them. Keys: hall:w → the first week not frozen yet, hall:weeks → [{week, first}]
     (weeks anyone played, oldest first; first: the 1위's name), hall:<week> → the three */
  settleHall(career) {
    const now = weekOf(); if (this.hallW === now) return;
    return (this.q = (this.q || Promise.resolve()).catch(() => {}).then(async () => {
      const weeks = (await this.store.get('hall:weeks')) || [];
      for (let w = (await this.store.get('hall:w')) || HALL_FROM; w < now; w = weekOf(Date.parse(w) + WEEK)) {
        const top = (await this.board(w, RANKED)).slice(0, 3), list = []; if (!top.length) continue;
        for (const e of top) list.push({ uid: e.uid, name: e.name, score: e.score, place: e.place, rank: e.rank, kills: e.kills, tasks: e.tasks, time: e.time, fit: await career.lookOf(e.uid) });
        await this.store.put('hall:' + w, list); weeks.push({ week: w, first: top[0].name });
      }
      await this.store.put('hall:weeks', weeks); await this.store.put('hall:w', now); this.hallW = now;
    }));
  }
  /* one frozen week (the latest if `week` isn't one) and the list of them all */
  async hall(career, uid, week) {
    await this.settleHall(career);
    const weeks = (await this.store.get('hall:weeks')) || [], w = weeks.some(x => x.week === week) ? week : weeks.length ? weeks[weeks.length - 1].week : null;
    return { weeks, week: w, top: w ? (await this.store.get('hall:' + w)).map(e => ({ ...pub(e, uid), fit: e.fit })) : [] };
  }
}

/* The game's HTTP API, the same for the dev server and the Durable Object:
   GET  /api/rank?uid=…  → this week's board
   GET  /api/hall?uid=…&week=…  → 명예 사원: one finished week's top 3 and the list of weeks
   POST /api/game {uid,name,diff,place,rank,kills,tasks,time,lunch,branch} → a finished solo game: play stats, plus the board if 어려움
   The host itself records online games (stats.record) and serves the admin page. */
const okUid = u => typeof u === 'string' && /^[a-z0-9]{8,32}$/.test(u);
export async function apiHTTP({ rank, stats, career, feedback }, method, url, body) {
  if (url.pathname === '/api/feedback' && method === 'GET') return { status: 200, json: await feedback.view(url.searchParams.get('uid') || '') }; // 사내 게시판 댓글 (feedback.js)
  if ((url.pathname === '/api/feedback' || url.pathname === '/api/feedback/del') && method === 'POST') {
    let m; try { m = JSON.parse(body); } catch { m = null; }
    if (!m || !okUid(m.uid)) return { status: 400, json: { err: '잘못된 요청' } };
    return { status: 200, json: url.pathname.endsWith('/del') ? await feedback.remove(m.uid, m.id) : await feedback.add(m.uid, m.name, m.post, m.text) };
  }
  if (url.pathname === '/api/rank' && method === 'GET') return { status: 200, json: await rank.top(url.searchParams.get('uid') || '') };
  if (url.pathname === '/api/hall' && method === 'GET') return { status: 200, json: await rank.hall(career, url.searchParams.get('uid') || '', url.searchParams.get('week')) };
  if (url.pathname === '/api/career' && method === 'GET') { // the 사원증 (server/src/career.js)
    const uid = url.searchParams.get('uid');
    return okUid(uid) ? { status: 200, json: await career.view(uid) } : { status: 400, json: { err: '잘못된 요청' } };
  }
  if (['/api/career/pin', '/api/career/join', '/api/career/profile'].includes(url.pathname) && method === 'POST') { // 다른 기기에서 이어하기, 옷장·사원명 연동
    let m; try { m = JSON.parse(body); } catch { m = null; }
    if (!m || !okUid(m.uid)) return { status: 400, json: { err: '잘못된 요청' } };
    const what = url.pathname.slice('/api/career/'.length);
    return { status: 200, json: what === 'pin' ? await career.pin(m.uid) : what === 'join' ? await career.join(m.uid, m.code, m.pin) : await career.profile(m.uid, m) };
  }
  if (url.pathname !== '/api/game' || method !== 'POST') return { status: 404, json: { err: 'not found' } };
  let m; try { m = JSON.parse(body); } catch { return { status: 400, json: { err: '잘못된 요청' } }; }
  const e = clean(m);
  if (!e) return { status: 400, json: { err: '기록을 확인할 수 없어요' } };
  const now = Date.now();
  if (now - (rank.last.get(e.uid) || 0) < GAP) return { status: 429, json: { err: '잠시 뒤에 다시 올려 주세요' } };
  await stats.record({ ...e, mode: 'solo', lunch: typeof m.lunch === 'string' ? m.lunch.slice(0, 10) : '', branch: m.branch });
  const r = e.diff === RANKED ? await rank.submit(e) : null;
  rank.last.set(e.uid, now);
  const c = await career.record(e.uid, { ...e, branch: typeof m.branch === 'string' ? m.branch : '', lunchWin: m.lunchWin === true, wcGo: m.wcGo }).catch(err => { console.error('career', err); return null; });
  return { status: 200, json: { rank: r && !r.err ? r : null, career: c } };
}

/* an online match is over: play stats and careers for everyone who started it (the room's own rules wrote the results) */
export async function recordMatch({ stats, career }, rs) {
  const out = [];
  for (const g of rs) {
    let c = null;
    try { await stats.record({ ...g, mode: 'multi' }); if (okUid(g.uid)) c = await career.record(g.uid, g); } catch (err) { console.error('career', err); } // one bad entry doesn't drop the others
    out.push(c);
  }
  return out;
}
