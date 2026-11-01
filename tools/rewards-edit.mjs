// The local /admin?tab=rw page's saves: one change to which 성과 step opens what, written back to public/js/shared/rewards.js,
// so it goes out with the code like any other edit. Only the dev server has this: a deployed server can't rewrite the game's files.
import { readFileSync, writeFileSync } from 'node:fs';
import { AWARDS, REWARD_KINDS } from '../server/src/career.js';

const FILE = new URL('../public/js/shared/rewards.js', import.meta.url);
const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const key = id => (/^[a-z]\w*$/i.test(id) ? id : q(id));
const piece = r => `{ n: ${q(r.n)}${r.key ? `, key: ${q(r.key)}` : ''}${r.aw ? `, aw: ${q(r.aw)}, st: ${r.st}` : ''}${r.temp ? ', temp: true' : ''} }`;
/* the file again, keeping its header comment */
function source(R) {
  const head = readFileSync(FILE, 'utf8').split('globalThis.REWARDS')[0];
  const lines = [`  awards: { ${Object.entries(R.awards).map(([k, v]) => `${k}: ${q(v)}`).join(', ')} },`, `  steps: [${R.steps.map(q).join(', ')}],`];
  for (const [kind] of REWARD_KINDS) lines.push(`  ${kind}: {`, ...Object.entries(R[kind]).map(([id, r]) => `    ${key(id)}: ${piece(r)},`), '  },');
  lines.push('  /* only the good ones: a step without one (null) gives no 칭호 */', '  titles: {', ...Object.entries(R.titles).map(([aw, t]) => `    ${aw}: [${t.map(x => (x ? q(x) : 'null')).join(', ')}],`), '  },');
  return `${head}globalThis.REWARDS = {\n${lines.join('\n')}\n};\n`;
}
/* {kind,id,aw,st}: a piece goes to that step (aw null: free for everyone). {title,aw,st}: that step's 칭호 ('' for none). False if it makes no sense */
export function rewardEdit(body) {
  let m; try { m = JSON.parse(body); } catch { return false; }
  const R = globalThis.REWARDS, a = AWARDS.find(x => x.id === m.aw), okStep = a && Number.isInteger(m.st) && m.st >= 1 && m.st <= a.at.length;
  if (typeof m.title === 'string') {
    if (!okStep) return false;
    const t = (R.titles[a.id] ||= a.at.map(() => null)), v = m.title.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
    while (t.length < a.at.length) t.push(null);
    t[m.st - 1] = v || null;
  } else {
    const r = REWARD_KINDS.some(([k]) => k === m.kind) && Object.hasOwn(R[m.kind], m.id) && R[m.kind][m.id];
    if (!r || (m.aw !== null && !okStep)) return false;
    if (m.aw === null) { delete r.aw; delete r.st; } else { r.aw = m.aw; r.st = m.st; }
  }
  writeFileSync(FILE, source(R)); return true;
}
