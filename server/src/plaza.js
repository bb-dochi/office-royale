// The shared lobby on the start screen: everyone online walks around the same 1F lobby.
// Presence only (position, facing, preset greetings, the match room someone is waiting in) — no game rules run here.
// Shared by tools/dev-server.mjs and the Durable Object (index.js), like room.js.
import { cleanName } from './room.js';
import { cleanFit } from './outfit.js';

export const PLAZA_MAX = 60;
const SEND_HZ = 10, EMOTES = 10; // must match EMOTES in public/js/client/45-plaza.js
/* a Durable Object is billed for as long as any socket is open, so someone who hasn't moved for this long is sent away. Their client comes back on the next key or tap */
export const PLAZA_IDLE = 5 * 60 * 1000;

export class PlazaCore {
  constructor({ send, drop, idle = PLAZA_IDLE }) {
    this.send = send; this.drop = drop; this.idle = idle; this.peers = []; this.seq = 0; this.timer = null;
  }
  join(peer, name, fit, uid, resume, own) {
    if (this.peers.length >= PLAZA_MAX) return '로비가 꽉 찼어요';
    peer.pid = ++this.seq; peer.name = cleanName(name, this.peers); peer.seed = (Math.random() * 1e6) | 0;
    peer.own = own; peer.fit = cleanFit(fit, own);
    peer.x = 770 + Math.random() * 120 - 60; peer.y = 760 + Math.random() * 80; peer.face = -Math.PI / 2; peer.mv = 0; peer.seen = Date.now();
    this.peers.push(peer);
    this.send(peer, { t: 'pz-hi', you: peer.pid, name: peer.name, seed: peer.seed, x: peer.x, y: peer.y });
    /* outfits travel separately from the 6/s position stream: everyone's to the newcomer, the newcomer's to everyone */
    for (const p of this.peers) if (p !== peer && p.fit) this.send(peer, { t: 'pz-fit', id: p.pid, fit: p.fit });
    if (peer.fit) for (const p of this.peers) if (p !== peer) this.send(p, { t: 'pz-fit', id: peer.pid, fit: peer.fit });
    if (!this.timer) this.timer = setInterval(() => this.broadcast(), 1000 / SEND_HZ);
    return null;
  }
  leave(peer) {
    const i = this.peers.indexOf(peer); if (i < 0) return;
    this.peers.splice(i, 1);
    if (!this.peers.length) { clearInterval(this.timer); this.timer = null; }
  }
  message(peer, m) {
    if (!m || typeof m !== 'object' || !this.peers.includes(peer)) return;
    if (m.t !== 'pz-pos') peer.seen = Date.now();
    if (m.t === 'pz-pos') {
      const n = v => (typeof v === 'number' && isFinite(v) ? v : 0), x = Math.max(0, Math.min(2000, n(m.x))), y = Math.max(0, Math.min(2000, n(m.y)));
      if (Math.abs(x - peer.x) > 1 || Math.abs(y - peer.y) > 1) peer.seen = Date.now(); // the client repeats its position every 2 s even standing still
      peer.x = x; peer.y = y;
      peer.face = n(m.face); peer.mv = m.mv ? 1 : 0; peer.placed = true;
    } else if (m.t === 'pz-fit') {
      const now = Date.now(); if (now - (peer.fitT || 0) < 500) return; peer.fitT = now;
      peer.fit = cleanFit(m.fit, peer.own); if (peer.fit) for (const p of this.peers) if (p !== peer) this.send(p, { t: 'pz-fit', id: peer.pid, fit: peer.fit });
    } else if (m.t === 'pz-room') {
      /* the match room this person is waiting in, shown to the plaza so others can walk up and join */
      const c = typeof m.code === 'string' && /^[A-Z0-9]{4,8}$/.test(m.code) ? m.code : null;
      const n = Math.max(1, Math.min(20, m.n | 0));
      peer.room = c ? [c, n] : null;
      if (c && typeof m.name === 'string') peer.name = cleanName(m.name, this.peers.filter(p => p !== peer)); // the name picked for the room
    } else if (m.t === 'pz-name') {
      const now = Date.now(); if (now - (peer.nameT || 0) < 1000) return; peer.nameT = now;
      peer.name = cleanName(m.name, this.peers.filter(p => p !== peer));
    } else if (m.t === 'pz-say') {
      const i = m.i | 0; if (i < 0 || i >= EMOTES) return;
      const now = Date.now(); if (now - (peer.sayT || 0) < 1200) return; peer.sayT = now;   // no spamming bubbles
      for (const p of this.peers) this.send(p, { t: 'pz-say', id: peer.pid, i });
    }
  }
  broadcast() {
    const now = Date.now();
    for (const p of [...this.peers]) if (now - p.seen > this.idle) { this.send(p, { t: 'pz-bye' }); this.leave(p); this.drop(p); }
    /* nobody shows until their first position: a tab with no animation frames (hidden, in the background) never sends one and would stand at the join spot, on the 안내데스크 */
    const list = this.peers.filter(p => p.placed).map(p => [p.pid, p.name, p.seed, Math.round(p.x), Math.round(p.y), Math.round(p.face * 100) / 100, p.mv, p.room || 0]);
    const msg = { t: 'pz', n: this.peers.length, p: list };
    for (const p of this.peers) this.send(p, msg);
  }
}
