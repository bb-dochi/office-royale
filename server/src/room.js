// One match room: lobby, host, start, the tick loop and snapshot fan-out.
// Shared by the local dev server (tools/dev-server.mjs) and the Cloudflare Durable Object (index.js).
// Transport-agnostic: the host hands in createSim() (a fresh copy of public/js/sim) and send(peer, obj).
export const MAX_PLAYERS = 8;
const TICK = 1 / 30, SEND_EVERY = 3, AFTER_OVER = 8; // 30 steps/s, 10 snapshots/s, back to lobby 8s after the end

export class RoomCore {
  constructor(code, { createSim, send, onEmpty }) {
    this.code = code; this.createSim = createSim; this.send = send; this.onEmpty = onEmpty || (() => {});
    this.peers = []; // {key, name, inGame}
    this.state = 'lobby'; this.sim = null; this.timer = null; this.tick = 0; this.overT = 0; this.seq = 0;
  }
  host() { return this.peers[0] || null; }
  roster() {
    return { t: 'room', code: this.code, state: this.state, max: MAX_PLAYERS,
      players: this.peers.map((p, i) => ({ key: p.key, name: p.name, host: i === 0, inGame: !!p.inGame })) };
  }
  broadcastRoster() { const r = this.roster(); for (const p of this.peers) this.send(p, { ...r, you: p.key }); }

  /* returns an error string, or null when the peer joined */
  join(peer, name) {
    if (this.peers.length >= MAX_PLAYERS) return '방이 꽉 찼어요 (최대 8명)';
    peer.key = 'p' + (++this.seq); peer.name = cleanName(name, this.peers); peer.inGame = false;
    this.peers.push(peer); this.broadcastRoster(); return null;
  }
  leave(peer) {
    const i = this.peers.indexOf(peer); if (i < 0) return;
    this.peers.splice(i, 1);
    if (this.sim && peer.inGame) this.sim.NET.leave(peer.key);
    if (!this.peers.length) { this.stop(); this.onEmpty(); return; }
    if (this.state === 'playing' && !this.peers.some(p => p.inGame)) this.stop(); // nobody left playing
    this.broadcastRoster();
  }
  message(peer, m) {
    if (!m || typeof m !== 'object' || !this.peers.includes(peer)) return;
    if (m.t === 'start') {
      if (peer !== this.host()) return this.send(peer, { t: 'err', m: '방장만 시작할 수 있어요' });
      if (this.state !== 'lobby') return;
      return this.begin();
    }
    if (m.t === 'name' && this.state === 'lobby') { peer.name = cleanName(m.name, this.peers.filter(p => p !== peer)); return this.broadcastRoster(); }
    if (this.state !== 'playing' || !peer.inGame) return;
    if (m.t === 'in') this.sim.NET.input(peer.key, m);
    else if (m.t === 'cmd') this.sim.NET.cmd(peer.key, m);
  }
  begin() {
    this.sim = this.createSim(); this.state = 'playing'; this.tick = 0; this.overT = 0;
    for (const p of this.peers) p.inGame = true;
    this.sim.NET.start(this.peers.map(p => ({ key: p.key, name: p.name })));
    this.broadcastRoster();
    for (const p of this.peers) this.send(p, { t: 'start', you: p.key });
    this.last = Date.now(); this.acc = 0;
    this.timer = setInterval(() => this.pump(), TICK * 1000);
  }
  /* timers fire late (Workers especially), so run as many fixed steps as real time says, capped at 0.25 s of catch-up */
  pump() {
    const now = Date.now(); this.acc += Math.min(.25, (now - this.last) / 1000); this.last = now;
    while (this.acc >= TICK && this.sim) { this.acc -= TICK; this.step(); }
  }
  step() {
    const { NET } = this.sim;
    try { NET.step(TICK); } catch (e) { console.error('room', this.code, e); this.stop(); this.broadcastRoster(); return; }
    if (++this.tick % SEND_EVERY === 0)
      for (const p of this.peers) if (p.inGame) this.send(p, { t: 's', ...NET.snap(p.key) });
    if (this.sim.over()) { this.overT += TICK; if (this.overT > AFTER_OVER) { this.stop(); this.broadcastRoster(); } }
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.sim = null; this.state = 'lobby';
    for (const p of this.peers) p.inGame = false;
  }
}

function cleanName(name, others) {
  let n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '신입';
  const taken = new Set(others.map(p => p.name));
  for (let i = 2; taken.has(n); i++) n = n.slice(0, 8) + i;
  return n;
}
