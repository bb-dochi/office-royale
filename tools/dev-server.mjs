// Local server for solo + online play without Cloudflare: serves public/ and runs match rooms over WebSocket.
// Usage: node tools/dev-server.mjs [port=8787] [--demo]   → http://localhost:8787 (friends on the same Wi-Fi use this PC's IP)
// --demo fills the play stats with a month of made-up games so /admin has something to show.
// No dependencies: the WebSocket handshake and framing below cover what the game needs (text frames, ping, close).
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { RoomCore } from '../server/src/room.js';
import { PlazaCore } from '../server/src/plaza.js';
import { RankCore, apiHTTP, recordMatch } from '../server/src/rank.js';
import { CareerCore } from '../server/src/career.js';
import { FeedbackCore } from '../server/src/feedback.js';
import { StatsCore, adminHTML } from '../server/src/stats.js';

const PORT = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) || process.env.PORT || 8787);
const PUB = fileURLToPath(new URL('../public/', import.meta.url));
const SIM = join(PUB, 'js', 'sim');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

/* each room gets its own copy of the rules (they keep state in globals) */
function createSim() {
  const ctx = vm.createContext({ console });
  for (const f of readdirSync(SIM).filter(f => f.endsWith('.js')).sort())
    vm.runInContext(readFileSync(join(SIM, f), 'utf8'), ctx, { filename: f });
  return { NET: vm.runInContext('NET', ctx), over: () => vm.runInContext('!!(G&&G.over)', ctx) };
}

const rooms = new Map();
const plaza = new PlazaCore({ send: (p, o) => p.sock.sendText(JSON.stringify(o)) });
function roomFor(code) {
  let r = rooms.get(code);
  if (!r) { r = new RoomCore(code, { createSim, send: (p, o) => p.sock.sendText(typeof o === 'string' ? o : JSON.stringify(o)), onEmpty: () => rooms.delete(code), onGame: recordGame }); rooms.set(code, r); }
  return r;
}

/* weekly ranking and play stats, kept in memory (gone when the dev server stops); /admin needs no key here */
const mem = new Map(), memStore = { get: k => mem.get(k), put: (k, v) => mem.set(k, v) };
const statsCore = new StatsCore(memStore), api = { rank: new RankCore(memStore), stats: statsCore, career: new CareerCore(memStore, statsCore), feedback: new FeedbackCore(memStore) };
const recordGame = rs => recordMatch(api, rs).catch(e => console.error('stats', e));
if (process.argv.includes('--demo')) await seedDemo(statsCore);
async function seedDemo(stats) {
  const names = ['김대리', '박과장', '이사원', '최부장', '정인턴', '한팀장', '오주임', '윤차장'], ranks = ['인턴', '사원', '주임', '대리', '과장', '차장', '부장', 'CEO'];
  const realNow = Date.now, end = realNow(); let at = end - 29.5 * 864e5;
  try {
    Date.now = () => at; // write() stamps games with Date.now
    for (let i = 0; at < end - 6e4; i++, at += Math.random() * 864e5 / 10) {
      const u = Math.floor(Math.random() ** 1.6 * names.length), place = 1 + Math.floor(Math.random() * 12);
      await stats.write({ uid: 'demo-' + u, name: names[u], mode: Math.random() < .7 ? 'solo' : 'multi', diff: ['easy', 'normal', 'hard'][i % 3], place, rank: ranks[Math.max(0, 7 - Math.floor(place / 1.6))],
        kills: Math.floor(Math.random() * 6), tasks: Math.floor(Math.random() * 12), time: 180 + Math.floor(Math.random() * 150), lunch: ['lighter', 'bill', 'meal', 'ladder', ''][i % 5], room: i % 6 ? undefined : 'DEMO', branch: place > 9 ? '' : ['dev', 'mkt', 'hr'][u % 3] });
    }
  } finally { Date.now = realNow; }
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/admin') { adminHTML(api.stats, url.searchParams, api.career, api.feedback).then(h => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(h)); return; }
  if (url.pathname.startsWith('/api/')) {
    let body = ''; req.on('data', d => { if (body.length < 4096) body += d; });
    req.on('end', async () => { const r = await apiHTTP(api, req.method, url, body);
      res.writeHead(r.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(r.json)); });
    return;
  }
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(PUB, path));
  if (!file.startsWith(PUB.endsWith(sep) ? PUB : PUB + sep)) { res.writeHead(403).end(); return; }
  try {
    if (!statSync(file).isFile()) throw 0;
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(readFileSync(file));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found'); }
});

server.on('upgrade', (req, sock) => {
  const path = new URL(req.url, 'http://x').pathname, m = path.match(/^\/room\/([A-Z0-9]{4,8})$/), isPlaza = path === '/plaza';
  const key = req.headers['sec-websocket-key'];
  if ((!m && !isPlaza) || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  const room = isPlaza ? plaza : roomFor(m[1]), peer = { sock: wrap(sock) };
  let joined = false;
  peer.sock.onText = txt => {
    let msg; try { msg = JSON.parse(txt); } catch { return; }
    if (!joined) {
      if (msg.t !== 'hello') return;
      const err = room.join(peer, msg.name, msg.fit, msg.uid, msg.resume);
      if (err) { peer.sock.sendText(JSON.stringify({ t: 'err', m: err })); peer.sock.close(); return; }
      joined = true; return;
    }
    room.message(peer, msg);
  };
  peer.sock.onClose = () => { if (joined) room.leave(peer); joined = false; };
});

/* minimal RFC 6455 server side */
function wrap(sock) {
  const w = { onText: null, onClose: null, open: true };
  let buf = Buffer.alloc(0), frag = [];
  const frame = (op, payload) => {
    const n = payload.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.alloc(10);
    if (n >= 65536) { head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    return Buffer.concat([head, payload]);
  };
  w.sendText = s => { if (w.open && !sock.destroyed) sock.write(frame(1, Buffer.from(s))); };
  w.close = () => { if (!w.open) return; w.open = false; try { sock.end(frame(8, Buffer.alloc(0))); } catch {} w.onClose && w.onClose(); };
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80;
      let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) { w.close(); return; }
      const need = off + (masked ? 4 : 0) + len; if (buf.length < need) return;
      let data = buf.subarray(off + (masked ? 4 : 0), need);
      if (masked) { const k = buf.subarray(off, off + 4); data = Buffer.from(data); for (let i = 0; i < data.length; i++) data[i] ^= k[i & 3]; }
      buf = buf.subarray(need);
      if (op === 8) { w.close(); return; }
      if (op === 9) { sock.write(frame(10, data)); continue; }
      if (op === 1 || op === 0) { frag.push(data); if (fin) { const t = Buffer.concat(frag).toString('utf8'); frag = []; w.onText && w.onText(t); } }
    }
  });
  const gone = () => { if (w.open) { w.open = false; w.onClose && w.onClose(); } };
  sock.on('close', gone); sock.on('error', gone);
  return w;
}

server.listen(PORT, () => console.log(`office-royale dev server: http://localhost:${PORT}  (rooms over ws://…/room/CODE)`));
