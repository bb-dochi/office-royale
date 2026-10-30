// The career behind the 사원증's 인사관리 tab: a 사원코드 per person and running totals of their finished games.
// Shared by the local dev server and the Durable Object, like rank.js and stats.js. The plan is in docs/CAREER.md.
// 성과 v2 (2026-10-30): six basic ones, judged from their own totals (`a`) that start at zero when 성과 opened — the
// 인사 관리 totals (`c`) carry the play stats over, the 성과 don't. The rest of the plan (docs/CAREER.md) needs new counts.
// AWARDS_ON: off until the 성과 open together with their rewards — nothing is counted for them before then.
export const AWARDS_ON = false;

import { RANKS } from './rank.js';
import { dayOf } from './stats.js';
import { cleanFit } from './outfit.js'; // also loads globalThis.REWARDS (public/js/shared/rewards.js)

export const newCareer = () => ({ games: 0, sec: 0, ceo: 0, tasks: 0, kills: 0, bestRank: 0 });

/* 성과: each looks at one number and goes up a step (인턴 → 사원 → 대리 → 팀장 → 임원) at each goal */
export const STEPS = ['인턴', '사원', '대리', '팀장', '임원'];
export const AWARDS = [
  { id: 'days', n: '근속일수', d: '출근한 날 (한 판 = 하루)', unit: '일', key: 'games', val: c => c.games, at: [1, 10, 30, 100, 300] },
  { id: 'night', n: '야근 수당', d: '살아남은 시간', unit: '분', key: 'sec', per: 60, val: c => Math.floor(c.sec / 60), at: [10, 60, 180, 600, 1800] },
  { id: 'promo', n: '승진의 길', d: '가장 높이 올라간 직급', unit: '', key: 'bestRank', val: c => c.bestRank, at: [1, 2, 3, 4, 5], names: ['사원', '대리', '팀장', '임원', 'CEO'] },
  { id: 'ceo', n: 'CEO 입성', d: '1위로 끝난 판', unit: '번', key: 'ceo', val: c => c.ceo, at: [1, 3, 10, 30, 100] },
  { id: 'tasks', n: '회사의 기둥', d: '끝낸 업무', unit: '개', key: 'tasks', val: c => c.tasks, at: [20, 100, 300, 1000, 3000] },
  { id: 'kills', n: '인사권자', d: '해고시킨 동료', unit: '명', key: 'kills', val: c => c.kills, at: [1, 20, 80, 250, 800] },
];
/* what one 성과 step gives (the shared list, public/js/shared/rewards.js): its 칭호 and any 옷장 pieces */
export function rewardsOf(aw, st) {
  const R = globalThis.REWARDS, items = [];
  for (const [kind, label] of [['hair', '머리'], ['gear', '소품'], ['fx', '이펙트'], ['color', '색']])
    for (const [id, r] of Object.entries(R[kind])) if (r.aw === aw && r.st === st) items.push({ kind, label, id, n: r.n });
  return { title: (R.titles[aw] || [])[st - 1] || null, items };
}
export const judge = c => AWARDS.map(a => { const v = a.val(c) || 0; return { id: a.id, n: a.n, d: a.d, unit: a.unit, at: a.at, names: a.names || null, val: v, step: a.at.filter(x => v >= x).length }; });

/* one finished game (the same report the play stats get) into the totals */
export function addGame(c, g) {
  c.games++; c.sec += g.time || 0; c.tasks += g.tasks || 0; c.kills += g.kills || 0;
  if (g.place === 1) c.ceo++;
  c.bestRank = Math.max(c.bestRank, RANKS.indexOf(g.rank));
  return c;
}

/* the totals a device already has in the play stats (stats.js keeps every finished game since launch), so a career
   starts from everything played before the 사원증 existed (2026-10-30: long-time players started from zero) */
const fromStats = p => ({ games: p.games || 0, sec: p.sec || 0, ceo: p.wins || 0, tasks: p.tasks || 0, kills: p.kills || 0,
  bestRank: Math.max(0, ...[p.best, ...(p.recent || [])].filter(Boolean).map(g => g.place === 1 ? RANKS.length - 1 : RANKS.indexOf(g.rank))) });

/* 사원코드: 입사일 (the device's first game, KST) and four random digits, like a real 사번: 261028-4821. A new career
   starts from the device's play stats.
   다른 기기에서 이어하기: a device of the career asks for a 6-digit 연동 번호 (10 minutes, one use); the other device
   enters 사원코드 + 연동 번호 and from then on points at that career (its own, if it had one, is left behind).
   옷장·사원명 연동: `prof` {fit, name, at} — the newest change from any linked device wins (2026-10-30).
   Keys: e:u:<uid> → code, e:<code> → {code, joined, name, uids, c (career totals), a (성과 totals), prof, pin, tries}. */
const yymmdd = ms => dayOf(ms).slice(2).replace(/-/g, '');
const PIN_LIFE = 10 * 60e3, TRIES = 5, DEVICES = 5;

export class CareerCore {
  /* store: {get(key), put(key, value)}; stats: the StatsCore (read only: a device's first game is its 입사일) */
  constructor(store, stats) { this.store = store; this.stats = stats; }
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

  /* a finished game: add it to the totals */
  record(uid, g) {
    return this.run(async () => {
      const e = await this.load(uid);
      if (e.seeded) delete e.seeded; else addGame(e.c, g); // a career made just now from the stats already has this game in it
      if (AWARDS_ON) addGame(e.a ||= newCareer(), g); // 성과 count from the first game after they opened
      if (g.name) e.name = g.name;
      await this.store.put('e:' + e.code, e);
      return { code: e.code };
    });
  }

  /* the 사원증's 인사관리: code, 입사일 and totals. A device that has not finished a game yet gets an empty one with no code */
  async view(uid) {
    const e = (await this.find(uid)) || (await this.stats.person(uid) ? await this.run(async () => { const n = await this.load(uid); delete n.seeded; await this.store.put('e:' + n.code, n); return n; })
      : { code: null, joined: null, name: '', uids: [], c: newCareer() });
    return { code: e.code, joined: e.joined, name: e.name, devices: e.uids.length, prof: e.prof || null, career: { ...newCareer(), ...e.c }, awards: AWARDS_ON || e.test ? judge({ ...newCareer(), ...e.a }) : null };
  }
  /* admin: a person's 성과 as it is now (null with no career and no games; one with games gets its career now, as on opening the 사원증) */
  async awardsOf(uid) { const e = (await this.find(uid)) || (await this.stats.person(uid) && await this.view(uid) && await this.find(uid)); return e &&{ test: !!e.test, prof: e.prof || null, list: judge({ ...newCareer(), ...e.a }) }; }
  /* admin: put one 성과 exactly at a step (its number set to that step's goal, 0 for none). Marks the career as a test one,
     whose 사원증 shows the 성과 even before they open (AWARDS_ON), so its rewards can be tried on a real device */
  setAward(uid, id, step) {
    return this.run(async () => {
      const e = await this.find(uid), a = AWARDS.find(x => x.id === id); if (!e || !a) return false;
      const st = Math.max(0, Math.min(a.at.length, step | 0));
      e.a = { ...newCareer(), ...e.a }; e.a[a.key] = st ? a.at[st - 1] * (a.per || 1) : 0; e.test = true;
      await this.store.put('e:' + e.code, e); return true;
    });
  }
  /* admin: back to the real 성과 (zero until they open) and no longer a test career */
  resetAwards(uid) {
    return this.run(async () => { const e = await this.find(uid); if (!e) return false; e.a = newCareer(); delete e.test; await this.store.put('e:' + e.code, e); return true; });
  }
  async codeOf(uid) { return this.store.get('e:u:' + uid); }

  /* 옷장·사원명 연동: a device saves its outfit and name to its career (only if it has one); newer than what's kept wins */
  profile(uid, m) {
    return this.run(async () => {
      const e = await this.find(uid); if (!e) return { err: '사원코드가 없어요' };
      const at = Math.min(Number(m.at) || 0, Date.now()), fit = cleanFit(m.fit),
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
      const old = await this.store.get('e:u:' + uid), left = old && await this.store.get('e:' + old);
      if (left) { left.uids = left.uids.filter(u => u !== uid); await this.store.put('e:' + old, left); }
      e.uids.push(uid); e.pin = null; e.tries = null;
      await this.store.put('e:' + e.code, e); await this.store.put('e:u:' + uid, e.code);
      return { ok: true, code: e.code };
    });
  }
}
