// Weekly solo leaderboard: 어려움 games only, one board per week (weeks start Monday 00:00 KST).
// Shared by the local dev server (tools/dev-server.mjs, kept in memory) and the Durable Object (index.js, kept in storage).
// Solo games run in the browser, so a score can't be proven: the server recomputes it from the reported numbers and
// turns away impossible ones. Each device (uid) keeps only its best score of the week.
export const DIFFS = ['easy', 'normal', 'hard'], RANKED = 'hard';
const KEEP = 100, SHOW = 50, GAP = 20e3, TOTAL = 20;
const RANKS = ['인턴', '사원', '대리', '팀장', '임원', 'CEO'], RANK_PT = [0, 50, 100, 200, 300, 500];

/* same formula as soloScore() in public/js/client/48-rank.js */
export const scoreOf = e => (TOTAL + 1 - e.place) * 50 + RANK_PT[RANKS.indexOf(e.rank)] + e.kills * 40 + e.tasks * 10 + Math.floor(e.time / 2);

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
  return { uid: m.uid, name, diff: m.diff, place: m.place, rank: m.rank, kills: m.kills, tasks: m.tasks, time: Math.round(m.time) };
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
    e.score = scoreOf(e); e.at = now;
    const i = b.findIndex(x => x.uid === e.uid);
    let best = true;
    if (i >= 0) { if (b[i].score >= e.score) { best = false; b[i].name = e.name; } else b.splice(i, 1); }
    if (best) { b.push(e); b.sort((p, q) => q.score - p.score || p.at - q.at); if (b.length > KEEP) b.length = KEEP; }
    await this.store.put(`${week}:${e.diff}`, b);
    return { ...this.view(week, e.diff, b, e.uid), score: e.score, best };
  }
}

/* The game's HTTP API, the same for the dev server and the Durable Object:
   GET  /api/rank?uid=…  → this week's board
   POST /api/game {uid,name,diff,place,rank,kills,tasks,time,lunch} → a finished solo game: play stats, plus the board if 어려움
   The host itself records online games (stats.record) and serves the admin page. */
export async function apiHTTP({ rank, stats }, method, url, body) {
  if (url.pathname === '/api/rank' && method === 'GET') return { status: 200, json: await rank.top(url.searchParams.get('uid') || '') };
  if (url.pathname !== '/api/game' || method !== 'POST') return { status: 404, json: { err: 'not found' } };
  let m; try { m = JSON.parse(body); } catch { return { status: 400, json: { err: '잘못된 요청' } }; }
  const e = clean(m);
  if (!e) return { status: 400, json: { err: '기록을 확인할 수 없어요' } };
  const now = Date.now();
  if (now - (rank.last.get(e.uid) || 0) < GAP) return { status: 429, json: { err: '잠시 뒤에 다시 올려 주세요' } };
  await stats.record({ ...e, mode: 'solo', lunch: typeof m.lunch === 'string' ? m.lunch.slice(0, 10) : '' });
  const r = e.diff === RANKED ? await rank.submit(e) : null;
  rank.last.set(e.uid, now);
  return { status: 200, json: { rank: r && !r.err ? r : null } };
}
