// The career behind the 사원증's 인사관리 tab: a 사원코드 per person and running totals of their finished games.
// Shared by the local dev server and the Durable Object, like rank.js and stats.js. The plan is in docs/CAREER.md.
// 성과 v2 (2026-10-30): the basic ones (six, then 부서별 3), judged from their own totals (`a`) that start at zero when 성과 opened — the
// 인사 관리 totals (`c`) carry the play stats over, the 성과 don't. The rest of the plan (docs/CAREER.md) needs new counts.
// AWARDS_ON: off until the 성과 open together with their rewards — nothing is counted for them before then.
export let AWARDS_ON = false;
export const awardsOn = v => { AWARDS_ON = v; };   // the test Worker turns them on with its AWARDS variable (`--var AWARDS:1`); the live Worker never sets it

import { RANKS, RANKED, weekOf } from './rank.js';
import { dayOf } from './stats.js';
import { cleanFit } from './outfit.js'; // also loads globalThis.REWARDS (public/js/shared/rewards.js)

export const newCareer = () => ({ games: 0, sec: 0, ceo: 0, tasks: 0, kills: 0, bestRank: 0, dev: 0, mkt: 0, hr: 0, lunchWin: 0, wcGo: 0, top3: 0 });
/* 쉬움 games don't count for the 성과; one under a minute counts for everything but 출근 일수, so start-and-quit doesn't pile that up (2026-10-30) */
export const AWARD_MIN_SEC = 60;
const TEAMS = ['dev', 'mkt', 'hr']; // the teams people are posted to (sim TEAMS)

/* 성과: each looks at one number and goes up a step (인턴 → 사원 → 대리 → 팀장 → 임원) at each goal */
export const STEPS = ['인턴', '사원', '대리', '팀장', '임원'];
export const AWARDS = [
  { id: 'days', n: '출근 일수', d: '판 수 (1분 이상)', unit: '일', key: 'games', val: c => c.games, at: [1, 5, 20, 60, 150] },
  { id: 'night', n: '근무 시간', d: '살아남은 시간', unit: '분', key: 'sec', per: 60, val: c => Math.floor(c.sec / 60), at: [10, 30, 90, 300, 500] },
  { id: 'promo', n: '승진의 길', d: '가장 높이 올라간 직급', unit: '', key: 'bestRank', val: c => c.bestRank, at: [1, 2, 3, 4, 5], names: ['사원', '대리', '팀장', '임원', 'CEO'] },
  { id: 'ceo', n: 'CEO 입성', d: '1위로 끝난 판', unit: '번', key: 'ceo', val: c => c.ceo, at: [1, 5, 10, 30] },
  { id: 'top3', n: '우수 사원', d: '주간 랭킹 3위 안에 든 주', unit: '번', key: 'top3', val: c => c.top3, at: [1, 3, 10] },
  { id: 'tasks', n: '결재 도장', d: '끝낸 업무', unit: '개', key: 'tasks', val: c => c.tasks, at: [20, 60, 200, 500, 1200] },
  { id: 'kills', n: '해고 통지서', d: '해고시킨 동료', unit: '명', key: 'kills', val: c => c.kills, at: [1, 10, 50, 150, 500] },
  /* 부서별: games ending posted to that team (the team the result reports) */
  { id: 'wc', n: '존버는 승리한다', d: '화캉스 즐기기 횟수', unit: '번', key: 'wcGo', val: c => c.wcGo, at: [3, 10, 30, 50] },
  { id: 'dev', n: '개발팀 근무', d: '개발팀으로 발령받은 판', unit: '번', key: 'dev', val: c => c.dev, at: [3, 10, 20] },
  { id: 'mkt', n: '마케팅팀 근무', d: '마케팅팀으로 발령받은 판', unit: '번', key: 'mkt', val: c => c.mkt, at: [3, 10, 20] },
  { id: 'hr', n: '인사팀 근무', d: '인사팀으로 발령받은 판', unit: '번', key: 'hr', val: c => c.hr, at: [3, 10, 20] },
];
/* the kinds of 옷장 piece a 성과 step can open, in the shared list public/js/shared/rewards.js */
export const REWARD_KINDS = [['top', '상의'], ['hair', '머리'], ['eye', '눈'], ['face', '얼굴'], ['shoe', '신발'], ['bottom', '하의'], ['gear', '소품'], ['fx', '이펙트'], ['thr', '던지기'], ['color', '색']];
/* what one 성과 step gives: its 칭호 and any 옷장 pieces */
export function rewardsOf(aw, st) {
  const R = globalThis.REWARDS, items = [];
  for (const [kind, label] of REWARD_KINDS)
    for (const [id, r] of Object.entries(R[kind])) if (r.aw === aw && r.st === st) items.push({ kind, label, id, n: r.n });
  return { title: (R.titles[aw] || [])[st - 1] || null, items };
}
/* every reward the 성과 reached so far open: into the career's `own`. True if it gained any */
export function grant(e) {
  const own = new Set(e.own || []), taken = new Set(e.taken || []), add = k => { if (!taken.has(k)) own.add(k); };
  for (const a of judge({ ...newCareer(), ...e.a })) for (let st = 1; st <= a.step; st++) {
    const r = rewardsOf(a.id, st); for (const i of r.items) add(`${i.kind}:${i.id}`); if (r.title) add(`title:${a.id}:${st}`);
  }
  const more = own.size !== (e.own || []).length; e.own = [...own]; return more;
}
/* the rarest first in the 성과 달성 note: a step's weight is about how many days it takes to reach, at what an active player earns in a day
   (4 games a day, from the live records of 2026-10-31; 승진의 길 counts its step number) */
const PER_DAY = { days: 3.4, night: 15, promo: 2.5, ceo: 1, top3: 1 / 7, tasks: 38, kills: 16, wc: 4, dev: 1.6, mkt: 1.4, hr: .4 };
const stepDays = x => { const a = AWARDS.find(y => y.id === x.aw); return a ? a.at[x.st - 1] / (PER_DAY[x.aw] || 1) : 0; };
const rarest = list => [...list].sort((p, q) => stepDays(q) - stepDays(p));
/* the steps with a reward reached since `was` (a judge() list): what the 성과 달성 note shows */
function gained(e, was) {
  const out = [];
  for (const a of judge({ ...newCareer(), ...e.a })) { const from = (was.find(x => x.id === a.id) || {}).step || 0;
    for (let st = from + 1; st <= a.step; st++) { const r = rewardsOf(a.id, st); if (r.title || r.items.length) out.push({ aw: a.id, st, goal: a.names ? a.names[st - 1] : `${a.at[st - 1].toLocaleString()}${a.unit}` }); } }
  return rarest(out);
}
export const judge = c => AWARDS.map(a => { const v = a.val(c) || 0; return { id: a.id, n: a.n, d: a.d, unit: a.unit, at: a.at, names: a.names || null, val: v, step: a.at.filter(x => v >= x).length }; });

/* one finished game (the same report the play stats get) into the totals */
export function addGame(c, g) {
  c.games++; c.sec += g.time || 0; c.tasks += g.tasks || 0; c.kills += g.kills || 0;
  if (g.place === 1) c.ceo++;
  c.bestRank = Math.max(c.bestRank, RANKS.indexOf(g.rank));
  if (TEAMS.includes(g.branch)) c[g.branch] = (c[g.branch] || 0) + 1;
  if (g.lunchWin === true) c.lunchWin = (c.lunchWin || 0) + 1;
  c.wcGo = (c.wcGo || 0) + Math.max(0, Math.min(40, g.wcGo | 0));   // the browser reports it for solo games: a cap per game
  return c;
}
/* one game into the 성과 totals (see AWARD_MIN_SEC) */
export function addAward(c, g) { addGame(c, g); if ((g.time || 0) < AWARD_MIN_SEC) c.games--; return c; }

/* the totals a device already has in the play stats (stats.js keeps every finished game since launch), so a career
   starts from everything played before the 사원증 existed (2026-10-30: long-time players started from zero) */
const fromStats = p => ({ games: p.games || 0, sec: p.sec || 0, ceo: p.wins || 0, tasks: p.tasks || 0, kills: p.kills || 0,
  bestRank: Math.max(0, ...[p.best, ...(p.recent || [])].filter(Boolean).map(g => g.place === 1 ? RANKS.length - 1 : RANKS.indexOf(g.rank))) });

/* 사원코드: 입사일 (the device's first game, KST) and four random digits, like a real 사번: 261028-4821. A new career
   starts from the device's play stats.
   다른 기기에서 이어하기: a device of the career asks for a 6-digit 연동 번호 (10 minutes, one use); the other device
   enters 사원코드 + 연동 번호 and from then on points at that career (its own, if it had one, is left behind).
   옷장·사원명 연동: `prof` {fit, name, at} — the newest change from any linked device wins (2026-10-30).
   소지품: `own`, what the career has for keeps (`kind:id`, `title:aw:step`): a step's rewards are added when the step is reached, so moving a reward later doesn't take it back. `taken`: what the admin took away.
   `news`: 성과 steps reached that the player hasn't been told about yet (the next 사원증 load takes them).
   Keys: e:u:<uid> → code, e:<code> → {code, joined, name, uids, c (career totals), a (성과 totals), own, taken, news, prof, pin, tries}. */
const yymmdd = ms => dayOf(ms).slice(2).replace(/-/g, '');
const PIN_LIFE = 10 * 60e3, TRIES = 5, DEVICES = 5, WEEK = 7 * 864e5;

export class CareerCore {
  /* store: {get(key), put(key, value)}; stats: the StatsCore (read only: a device's first game is its 입사일) */
  constructor(store, stats) { this.store = store; this.stats = stats; this.openAll = false; }   // openAll: the local dev server's 전체 해금
  /* one change at a time, like stats: a match ends for several people at once */
  run(fn) { return (this.q = (this.q || Promise.resolve()).catch(() => {}).then(fn)); }

  /* the career this device points at, or none (looking creates one only for a device with games in the play stats) */
  async find(uid) { const code = await this.store.get('e:u:' + uid); return code ? (await this.store.get('e:' + code)) || null : null; }
  async load(uid) {
    const found = await this.find(uid); if (found) return found;
    const p = await this.stats.person(uid), joined = (p && p.first) || Date.now();
    let code2; do code2 = `${yymmdd(joined)}-${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}`; while (await this.store.get('e:' + code2));
    const e = { code: code2, joined, name: (p && p.name) || '', uids: [uid], c: p ? fromStats(p) : newCareer(), a: newCareer(), seeded: !!p };
    await this.store.put('e:' + code2, e); await this.store.put('e:u:' + uid, code2);
    return e;
  }

  /* 우수 사원: a week counts once it is over, so each career walks the finished weeks it hasn't looked at (`topW`) against that
     week's board, from the week 성과 opened (`aw:from`, kept on first use). Any of the career's devices in the top 3 counts, once */
  async settleTop3(e) {
    const now = weekOf(); if (e.topW === now) return false;
    let from = await this.store.get('aw:from'); if (!from) await this.store.put('aw:from', from = now);
    e.a = { ...newCareer(), ...e.a };
    for (let w = e.topW || from; w < now; w = weekOf(Date.parse(w) + WEEK)) {
      const b = (await this.store.get(`${w}:${RANKED}`)) || [];
      if (b.slice(0, 3).some(x => e.uids.includes(x.uid))) e.a.top3++;
    }
    e.topW = now; return true;
  }

  /* a finished game: add it to the totals */
  record(uid, g) {
    return this.run(async () => {
      const e = await this.load(uid);
      if (e.seeded) delete e.seeded; else addGame(e.c, g); // a career made just now from the stats already has this game in it
      let news = [];
      if ((AWARDS_ON || e.test) && g.diff !== 'easy') { const was = judge({ ...newCareer(), ...e.a }); addAward(e.a ||= newCareer(), g); grant(e); news = gained(e, was); if (news.length) e.news = [...(e.news || []), ...news].slice(-12); } // 성과 count from the first game after they opened, a minute or longer
      if (g.name) e.name = g.name;
      await this.store.put('e:' + e.code, e);
      return { code: e.code, news };
    });
  }

  /* the 사원증's 인사관리: code, 입사일 and totals. A device that has not finished a game yet gets an empty one with no code */
  async view(uid) {
    let e = (await this.find(uid)) || (await this.stats.person(uid) ? await this.run(async () => { const n = await this.load(uid); delete n.seeded; await this.store.put('e:' + n.code, n); return n; })
      : { code: null, joined: null, name: '', uids: [], c: newCareer() });
    let news = [];
    if ((AWARDS_ON || e.test) && e.code) e = await this.run(async () => { const n = await this.find(uid), was = judge({ ...newCareer(), ...n.a }), week = AWARDS_ON && n.topW !== weekOf() && await this.settleTop3(n), more = grant(n);
      news = rarest([...(n.news || []), ...gained(n, was)]); if (n.news) delete n.news; if (more || week || news.length) await this.store.put('e:' + n.code, n); return n; });   // also picks up a reward moved to a step already reached
    const temp = e.code ? await this.tempOf(e) : [], lent = temp.find(k => k.startsWith('halo:'));
    return { code: e.code, joined: e.joined, name: e.name, devices: e.uids.length, prof: e.prof || null, own: [...(e.own || []), ...temp], news, lent: lent ? { place: +lent.slice(5), week: weekOf(Date.now() - WEEK) } : null, career: { ...newCareer(), ...e.c }, awards: AWARDS_ON || e.test ? judge({ ...newCareer(), ...e.a }) : null };
  }
  /* admin: a person's 성과 as it is now (null with no career and no games; one with games gets its career now, as on opening the 사원증) */
  async awardsOf(uid) { const e = (await this.find(uid)) || (await this.stats.person(uid) && await this.view(uid) && await this.find(uid)); return e &&{ test: !!e.test, fakeTop: e.fakeTop || 0, prof: e.prof || null, own: e.own || [], taken: e.taken || [], list: judge({ ...newCareer(), ...e.a }) }; }
  /* admin: put one 성과 exactly at a step (its number set to that step's goal, 0 for none). Marks the career as a test one,
     whose 사원증 shows the 성과 even before they open (AWARDS_ON), so its rewards can be tried on a real device */
  setAward(uid, id, step) {
    return this.run(async () => {
      const e = await this.find(uid), a = AWARDS.find(x => x.id === id); if (!e || !a) return false;
      const st = Math.max(0, Math.min(a.at.length, step | 0));
      e.a = { ...newCareer(), ...e.a }; e.a[a.key] = st ? a.at[st - 1] * (a.per || 1) : 0; e.test = true; grant(e);
      await this.store.put('e:' + e.code, e); return true;
    });
  }
  /* admin: back to the real 성과 (zero until they open) and no longer a test career */
  resetAwards(uid) {
    return this.run(async () => { const e = await this.find(uid); if (!e) return false; e.a = newCareer(); e.own = []; delete e.taken; delete e.test; await this.store.put('e:' + e.code, e); return true; });
  }
  async codeOf(uid) { return this.store.get('e:u:' + uid); }
  /* what a device's career owns: the list rooms and the lobby hold outfits to */
  async ownOf(uid) { const e = await this.find(uid); return e ? [...(e.own || []), ...await this.tempOf(e)] : []; }
  /* 명예 사원: the outfit a device's career wears now, held to what it owns (null: it never left the default) */
  async lookOf(uid) { const e = await this.find(uid); return e && e.prof ? cleanFit(e.prof.fit, this.openAll ? undefined : new Set(await this.ownOf(uid))) : null; }
  /* 주간 1~3위: lent for the week after, never owned: the 후광 in the colour of the place (금 은 동), and 금가루 for 1위 */
  async tempOf(e) {
    if (!AWARDS_ON && !e.test) return [];
    const last = weekOf(Date.now() - WEEK), from = await this.store.get('aw:from');   // nothing for the weeks before 성과 opened
    const b = e.fakeTop || !from || last < from ? [] : (await this.store.get(`${last}:${RANKED}`)) || [], i = e.fakeTop ? e.fakeTop - 1 : b.slice(0, 3).findIndex(x => e.uids.includes(x.uid));
    return i < 0 ? [] : ['gear:halo', `halo:${i + 1}`, ...(i ? [] : ['fx:gold'])];
  }
  /* admin on the test server: act as if this career came 1~3위 last week (0: back to the real board). The board itself isn't touched */
  setFakeTop(uid, place) {
    return this.run(async () => {
      const e = await this.find(uid); if (!e) return false;
      if ([1, 2, 3].includes(place)) e.fakeTop = place; else delete e.fakeTop;
      await this.store.put('e:' + e.code, e); return true;
    });
  }
  /* admin: give one reward or take it away (kept away even if its step is reached) */
  setOwn(uid, key, on) {
    return this.run(async () => {
      const e = await this.find(uid); if (!e || typeof key !== 'string' || !/^[a-z0-9]+:[#:\w]+$/i.test(key)) return false;
      const own = new Set(e.own || []), taken = new Set(e.taken || []);
      if (on) { own.add(key); taken.delete(key); } else { own.delete(key); taken.add(key); }
      e.own = [...own]; if (taken.size) e.taken = [...taken]; else delete e.taken;
      await this.store.put('e:' + e.code, e); return true;
    });
  }

  /* 옷장·사원명 연동: a device saves its outfit and name to its career (only if it has one); newer than what's kept wins */
  profile(uid, m) {
    return this.run(async () => {
      const e = await this.find(uid); if (!e) return { err: '사원코드가 없어요' };
      const at = Math.min(Number(m.at) || 0, Date.now()), fit = cleanFit(m.fit, this.openAll ? undefined : new Set([...(e.own || []), ...await this.tempOf(e)])),
        name = typeof m.name === 'string' ? m.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) : '';
      if (!fit || at <= ((e.prof && e.prof.at) || 0)) return { ok: true, prof: e.prof || null };
      e.prof = { fit, name: name || (e.prof && e.prof.name) || e.name, at };
      await this.store.put('e:' + e.code, e);
      return { ok: true, prof: e.prof };
    });
  }

  /* 다른 기기에서 이어하기, on the device that has the career: a fresh 연동 번호 */
  pin(uid) {
    return this.run(async () => {
      const e = await this.find(uid);
      if (!e) return { err: '첫 판을 마치면 사원코드가 생겨요' };
      e.pin = { n: String(Math.floor(Math.random() * 1e6)).padStart(6, '0'), exp: Date.now() + PIN_LIFE }; e.tries = null;
      await this.store.put('e:' + e.code, e);
      return { code: e.code, pin: e.pin.n, exp: e.pin.exp };
    });
  }
  /* 사원증 불러오기, on the other device: 사원코드 + 연동 번호 → this device joins that career */
  join(uid, code, pin) {
    return this.run(async () => {
      const e = typeof code === 'string' && /^\d{6}-\d{4}$/.test(code) ? await this.store.get('e:' + code) : null, now = Date.now();
      if (!e) return { err: '없는 사원코드예요' };
      if (e.uids.includes(uid)) return { err: '이미 이 기기의 사원증이에요' };
      if (e.uids.length >= DEVICES) return { err: `기기는 ${DEVICES}대까지 연동할 수 있어요` };
      if (e.tries && e.tries.until > now && e.tries.n >= TRIES) return { err: '잠시 뒤에 다시 해 주세요' };
      if (!e.pin || e.pin.exp < now || String(pin) !== e.pin.n) {
        e.tries = e.tries && e.tries.until > now ? { n: e.tries.n + 1, until: e.tries.until } : { n: 1, until: now + PIN_LIFE };
        await this.store.put('e:' + e.code, e);
        return { err: '연동 번호가 맞지 않거나 시간이 지났어요' };
      }
      e.pin = null; e.tries = null;
      return this.attach(e, uid);
    });
  }
  /* admin: this device joins the career with that 사원코드, no 연동 번호 needed (its own career is left behind, as with 사원증 불러오기) */
  adminJoin(uid, code) {
    return this.run(async () => {
      const e = typeof code === 'string' && /^\d{6}-\d{4}$/.test(code) ? await this.store.get('e:' + code) : null;
      if (!e) return { err: '없는 사원코드예요' };
      if (e.uids.includes(uid)) return { err: '이미 이 사원코드에 연동된 기기예요' };
      if (e.uids.length >= DEVICES) return { err: `기기는 ${DEVICES}대까지 연동할 수 있어요` };
      return this.attach(e, uid);
    });
  }
  /* the device leaves the career it pointed at and points at `e` (inside run) */
  async attach(e, uid) {
    const old = await this.store.get('e:u:' + uid), left = old && await this.store.get('e:' + old);
    if (left) { left.uids = left.uids.filter(u => u !== uid); await this.store.put('e:' + old, left); }
    e.uids.push(uid);
    await this.store.put('e:' + e.code, e); await this.store.put('e:u:' + uid, e.code);
    return { ok: true, code: e.code };
  }
}
