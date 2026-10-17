// Runs whole games with only the rule files (public/js/sim) — no browser, no DOM, no three.js.
// Proves the rules can run on a server, and doubles as a balance check.
// Usage: node tools/headless.mjs [games=3]
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../public/js/sim/', import.meta.url);
for (const f of readdirSync(dir).filter(f => f.endsWith('.js')).sort())
  vm.runInThisContext(readFileSync(new URL(f, dir), 'utf8'), { filename: f });
const games = +(process.argv[2] || 3), dt = 0.05;
for (let r = 0; r < games; r++) {
  newGame();
  const t0 = performance.now();
  let sawLunch = false;
  while (!G.over && G.t < 900) { step(dt); if (G.lunch) sawLunch = true; }
  const ranks = {}; for (const a of G.actors) ranks[a.rank] = (ranks[a.rank] || 0) + 1;
  console.log(`game ${r + 1}: ${G.over ? 'ended' : 'TIMEOUT'} at ${G.t.toFixed(0)}s · winner ${G.winner ? G.winner.name : '-'} · kills ${G.actors.reduce((s, a) => s + (a.kills || 0), 0)} · lunch ${sawLunch} · ranks ${JSON.stringify(ranks)} · ${(performance.now() - t0).toFixed(0)}ms`);
}
