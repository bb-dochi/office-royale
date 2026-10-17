// Local server for solo + online play without Cloudflare: serves public/ and runs match rooms over WebSocket.
// Usage: node tools/dev-server.mjs [port=8787]   → http://localhost:8787 (friends on the same Wi-Fi use this PC's IP)
// No dependencies: the WebSocket handshake and framing below cover what the game needs (text frames, ping, close).
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { RoomCore } from '../server/src/room.js';

const PORT = +(process.argv[2] || process.env.PORT || 8787);
const PUB = fileURLToPath(new URL('../public/', import.meta.url));
const SIM = join(PUB, 'js', 'sim');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };

/* each room gets its own copy of the rules (they keep state in globals) */
function createSim() {
  const ctx = vm.createContext({ console });
  for (const f of readdirSync(SIM).filter(f => f.endsWith('.js')).sort())
    vm.runInContext(readFileSync(join(SIM, f), 'utf8'), ctx, { filename: f });
  return { NET: vm.runInContext('NET', ctx), over: () => vm.runInContext('!!(G&&G.over)', ctx) };
}

const rooms = new Map();
function roomFor(code) {
  let r = rooms.get(code);
  if (!r) { r = new RoomCore(code, { createSim, send: (p, o) => p.sock.sendText(JSON.stringify(o)), onEmpty: () => rooms.delete(code) }); rooms.set(code, r); }
  return r;
}

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
  const m = new URL(req.url, 'http://x').pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
  const key = req.headers['sec-websocket-key'];
  if (!m || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') { sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
  const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  sock.setNoDelay(true);
  const room = roomFor(m[1]), peer = { sock: wrap(sock) };
  let joined = false;
  peer.sock.onText = txt => {
    let msg; try { msg = JSON.parse(txt); } catch { return; }
    if (!joined) {
      if (msg.t !== 'hello') return;
      const err = room.join(peer, msg.name);
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
