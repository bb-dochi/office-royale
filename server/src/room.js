// One match room: lobby, host, start, the tick loop and snapshot fan-out.
// Shared by the local dev server (tools/dev-server.mjs) and the Cloudflare Durable Object (index.js).
// Transport-agnostic: the host hands in createSim() (a fresh copy of public/js/sim) and send(peer, obj or ready JSON string).
import { cleanFit } from './outfit.js';
export const MAX_PLAYERS = 10;
const TICK = 1 / 30, SEND_EVERY = 2, AFTER_OVER = 8; // 30 steps/s, 15 snapshots/s, back to lobby 8s after the end

export class RoomCore {
  /* onGame(results): one person's game for the records (play stats, 성과), when they are out or the match is decided. May answer with
     their career ({code, news}), which goes to that player, as /api/game does for a solo game */
  constructor(code, { createSim, send, onEmpty, onGame }) {
    this.code = code; this.createSim = createSim; this.send = send; this.onEmpty = onEmpty || (() => {}); this.onGame = onGame || (() => {});
    this.peers = []; // {key, name, inGame}
    this.state = 'lobby'; this.sim = null; this.timer = null; this.tick = 0; this.overT = 0; this.seq = 0;
  }
  /* away: dropped out of a running match. They keep their seat (a bot plays for them) until the match ends, so the same
     browser can come back into it with its resume token */
  live() { return this.peers.filter(p => !p.away); }
  host() { return this.live()[0] || null; }
  roster() {
    const host = this.host();
    return { t: 'room', code: this.code, state: this.state, max: MAX_PLAYERS,
      players: this.peers.map(p => ({ key: p.key, name: p.name, host: p === host, inGame: !!p.inGame, away: !!p.away })) };
  }
  broadcastRoster() { const r = this.roster(); for (const p of this.live()) this.send(p, { ...r, you: p.key, token: p.token }); }

  /* returns an error string, or null when the peer joined. resume: the token a peer got in its roster; a match takes
     the new socket in place of the old one (which may not even have noticed it's dead yet) */
  join(peer, name, fit, uid, resume, own) {
    const old = typeof resume === 'string' && resume && this.peers.find(p => p.token === resume);
    if (old) {
      Object.assign(peer, { key: old.key, name: old.name, inGame: old.inGame, fit: old.fit, uid: old.uid, token: old.token, away: false });
      this.peers[this.peers.indexOf(old)] = peer; // the old socket's messages and close are ignored from now on
      if (old.away && this.sim && peer.inGame) this.sim.NET.rejoin(peer.key);
      this.broadcastRoster();
      if (this.state === 'playing' && peer.inGame) this.send(peer, { t: 'start', you: peer.key, resume: true });
      return null;
    }
    if (this.peers.length >= MAX_PLAYERS) return '방이 꽉 찼어요 (최대 10명)';
    peer.key = 'p' + (++this.seq); peer.name = cleanName(name, this.peers); peer.inGame = false; peer.fit = cleanFit(fit, own); peer.uid = typeof uid === 'string' && /^[a-z0-9]{8,32}$/.test(uid) ? uid : null;
    peer.token = crypto.randomUUID(); peer.away = false;
    this.peers.push(peer); this.broadcastRoster(); return null;
  }
  leave(peer) {
    const i = this.peers.indexOf(peer); if (i < 0 || peer.away) return;
    if (this.sim && peer.inGame) { this.sim.NET.leave(peer.key); peer.away = true; }
    else this.peers.splice(i, 1);
    if (!this.live().length) { this.stop(); this.peers = []; this.onEmpty(); return; }
    if (this.state === 'playing' && !this.live().some(p => p.inGame)) this.stop(); // nobody left playing
    this.broadcastRoster();
  }
  message(peer, m) {
    if (!m || typeof m !== 'object' || !this.peers.includes(peer)) return;
    if (m.t === 'ping') return typeof m.ct === 'number' && this.send(peer, { t: 'pong', ct: m.ct }); // client measures round trip
    if (m.t === 'start') {
      if (peer !== this.host()) return this.send(peer, { t: 'err', m: '방장만 시작할 수 있어요' });
      if (this.state !== 'lobby') return;
      return this.begin();
    }
    if (m.t === 'name' && this.state === 'lobby') { peer.name = cleanName(m.name, this.peers.filter(p => p !== peer)); return this.broadcastRoster(); }
    if (this.state !== 'playing' || !peer.inGame) return;
    if (m.t === 'in') this.sim.NET.input(peer.key, m);
    else if (m.t === 'cmd') this.sim.NET.cmd(peer.key, m);
    else if (m.t === 'quit') { const s = this.started.find(x => x.key === peer.key); if (this.sim.NET.quit(peer.key) && s) s.saved = true; } // a game not played to the end isn't recorded, as in solo
  }
  begin() {
    this.sim = this.createSim(); this.state = 'playing'; this.tick = 0; this.overT = 0;
    for (const p of this.peers) p.inGame = true;
    this.started = this.peers.map(p => ({ key: p.key, uid: p.uid, name: p.name }));
    /* lunch events are dealt from a shuffled deck per room, so a group sees all four before any repeats */
    if (!this.lunchBag || !this.lunchBag.length) this.lunchBag = [...this.sim.NET.lunchKinds].sort(() => Math.random() - .5);
    this.sim.NET.start(this.peers.map(p => ({ key: p.key, name: p.name, fit: p.fit })), { lunch: this.lunchBag.shift() });
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
    /* the shared part (pub) is the same object for everyone: turn it into JSON once, not once per player */
    if (++this.tick % SEND_EVERY === 0) {
      let pub = null, pubJSON = '';
      for (const p of this.peers) if (p.inGame && !p.away) {
        const { pub: pb, ...mine } = NET.snap(p.key);
        if (pb !== pub) { pub = pb; pubJSON = JSON.stringify(pb); }
        this.send(p, '{"t":"s","pub":' + pubJSON + ',' + JSON.stringify(mine).slice(1));
      }
    }
    /* decided: someone won, or every person is out and only bots are left (no point making the room watch them) */
    const done = this.sim.over() || NET.humansOut();
    this.settle(done);
    if (done) { this.overT += TICK; if (this.overT > AFTER_OVER) { this.stop(); this.broadcastRoster(); } }
  }
  /* someone a bot is playing for has nothing recorded: if they come back in time it counts as theirs, if not the game is dropped */
  settle(done) {
    for (const s of this.started) if (!s.saved && this.peers.some(p => p.key === s.key && !p.away) && (done || this.sim.NET.isOut(s.key))) this.save(s);
  }
  save(s) {
    s.saved = true;
    try {
      Promise.resolve(this.onGame([{ uid: s.uid, name: s.name, room: this.code, ...this.sim.NET.result(s.key) }])).then(rs => {
        const p = this.peers.find(x => x.key === s.key && !x.away); if (p && rs && rs[0]) this.send(p, { t: 'news', career: rs[0] });
      }).catch(e => console.error('stats', e));
    } catch (e) { console.error('stats', e); }
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.sim = null; this.state = 'lobby';
    this.peers = this.live(); // the match they could come back to is over
    for (const p of this.peers) p.inGame = false;
  }
}

export function cleanName(name, others) {
  let n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10) || '신입';
  const taken = new Set(others.map(p => p.name));
  for (let i = 2; taken.has(n); i++) n = n.slice(0, 8) + i;
  return n;
}
