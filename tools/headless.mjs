// Runs whole games with only the rule files (public/js/sim) — no browser, no DOM, no three.js.
// Proves the rules can run on a server, and doubles as a balance check.
// Usage: node tools/headless.mjs [games=3] [easy|normal|hard]
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../public/js/sim/', import.meta.url);
for (const f of readdirSync(dir).filter(f => f.endsWith('.js')).sort())
  vm.runInThisContext(readFileSync(new URL(f, dir), 'utf8'), { filename: f });
const games = +(process.argv[2] || 3), level = process.argv[3] || 'normal', dt = 0.05;
for (let r = 0; r < games; r++) {
  newGame({ diff: level, lunch: LUNCH_KINDS[r % LUNCH_KINDS.length] }); // every lunch kind gets a turn
  const t0 = performance.now();
  let sawLunch = false, lunchNote = '';
  while (!G.over && G.t < 900) {
    const L = G.lunch; step(dt); if (G.lunch) sawLunch = true;
    if (L && !G.lunch) lunchNote = L.kind === 'meal' ? `top ${G.actors.filter(a => a.meal >= 1).length} ate` : L.kind === 'ladder' ? `payers ${L.groups.filter(g => g.payer != null).length}/${L.groups.length}` : L.kind === 'lighter' ? `score ${L.score.L}:${L.score.R}` : `dealt ${!!L.dealt}`;
    if (G.lunch && G.lunch.kind === 'bill') lunchNote = `holders ${G.actors.filter(a => a.bill).length}`;
  }
  const ranks = {}; for (const a of G.actors) ranks[a.rank] = (ranks[a.rank] || 0) + 1;
  console.log(`game ${r + 1}: ${G.over ? 'ended' : 'TIMEOUT'} at ${G.t.toFixed(0)}s · winner ${G.winner ? G.winner.name : '-'} · kills ${G.actors.reduce((s, a) => s + (a.kills || 0), 0)} · lunch ${G.lunchKind} ${sawLunch} (${lunchNote}) · ranks ${JSON.stringify(ranks)} · ${(performance.now() - t0).toFixed(0)}ms`);
}
