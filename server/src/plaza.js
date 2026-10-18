// The shared lobby on the start screen: everyone online walks around the same 1F lobby.
// Presence only (position, facing, preset greetings) — no game rules run here.
// Shared by tools/dev-server.mjs and the Durable Object (index.js), like room.js.
import { cleanName } from './room.js';
import { cleanFit } from './outfit.js';

export const PLAZA_MAX = 60;
const SEND_HZ = 6, EMOTES = 4;

export class PlazaCore {
  constructor({ send }) {
    this.send = send; this.peers = []; this.seq = 0; this.timer = null;
  }
  join(peer, name, fit) {
    if (this.peers.length >= PLAZA_MAX) return '로비가 꽉 찼어요';
    peer.pid = ++this.seq; peer.name = cleanName(name, this.peers); peer.seed = (Math.random() * 1e6) | 0;
    peer.fit = cleanFit(fit);
    peer.x = 770 + Math.random() * 120 - 60; peer.y = 760 + Math.random() * 80; peer.face = -Math.PI / 2; peer.mv = 0;
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
    if (m.t === 'pz-pos') {
      const n = v => (typeof v === 'number' && isFinite(v) ? v : 0);
      peer.x = Math.max(0, Math.min(2000, n(m.x))); peer.y = Math.max(0, Math.min(2000, n(m.y)));
      peer.face = n(m.face); peer.mv = m.mv ? 1 : 0;
    } else if (m.t === 'pz-fit') {
      const now = Date.now(); if (now - (peer.fitT || 0) < 500) return; peer.fitT = now;
      peer.fit = cleanFit(m.fit); if (peer.fit) for (const p of this.peers) if (p !== peer) this.send(p, { t: 'pz-fit', id: peer.pid, fit: peer.fit });
    } else if (m.t === 'pz-say') {
      const i = m.i | 0; if (i < 0 || i >= EMOTES) return;
      const now = Date.now(); if (now - (peer.sayT || 0) < 1200) return; peer.sayT = now;   // no spamming bubbles
      for (const p of this.peers) this.send(p, { t: 'pz-say', id: peer.pid, i });
    }
  }
  broadcast() {
    const list = this.peers.map(p => [p.pid, p.name, p.seed, Math.round(p.x), Math.round(p.y), Math.round(p.face * 100) / 100, p.mv]);
    const msg = { t: 'pz', n: this.peers.length, p: list };
    for (const p of this.peers) this.send(p, msg);
  }
}
