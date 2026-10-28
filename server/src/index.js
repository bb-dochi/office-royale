// Online play on Cloudflare Workers + Durable Objects.
// One Durable Object = one room (code in the URL). It runs the rules from public/js/sim (bundled into sim.gen.js)
// and streams snapshots; clients only send input. The Worker also serves public/ as static assets.
// The start-screen lobby (/plaza) is one more instance of the same class, named '__plaza-<hash of its code>' (see tools/build-server.mjs), so it needs no new binding.
// So is '__rank': the weekly solo ranking and the play stats (/api/rank, /api/game, /admin), kept in the object's storage.
// Rooms report finished matches to it on an internal path the Worker never forwards. /admin asks for a password:
// set it with `npx wrangler secret put ADMIN_KEY` (no secret, no admin page).
import { DurableObject } from 'cloudflare:workers';
import { RoomCore } from './room.js';
import { PlazaCore } from './plaza.js';
import { RankCore, apiHTTP } from './rank.js';
import { StatsCore, adminHTML } from './stats.js';
import { createSim, PLAZA_VER } from './sim.gen.js';

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/admin' || url.pathname === '/internal/games') {
      const store = { get: k => this.ctx.storage.get(k), put: (k, v) => this.ctx.storage.put(k, v) };
      this.api ||= { rank: new RankCore(store), stats: new StatsCore(store) };
      if (url.pathname === '/admin') return new Response(await adminHTML(this.api.stats, url.searchParams), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      if (url.pathname === '/internal/games') { for (const g of await request.json()) await this.api.stats.record({ ...g, mode: 'multi' }); return new Response('ok'); }
      const r = await apiHTTP(this.api, request.method, url, request.method === 'POST' ? (await request.text()).slice(0, 4096) : '');
      return Response.json(r.json, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
    }
    const path = url.pathname, send = (p, o) => { try { p.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch {} };
    const stats = () => this.env.ROOM.get(this.env.ROOM.idFromName('__rank'));
    const onGame = rs => this.ctx.waitUntil(stats().fetch('https://stats/internal/games', { method: 'POST', body: JSON.stringify(rs) }).catch(e => console.error('stats', e)));
    this.core ||= path === '/plaza' ? new PlazaCore({ send }) : new RoomCore(path.split('/').pop(), { createSim, send, onGame });
    const [client, server] = Object.values(new WebSocketPair());
    // Plain accept (not the Hibernation API): the room keeps its lobby and match in memory while anyone is connected.
    server.accept();
    const peer = { ws: server };
    let joined = false;
    server.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      if (!joined) {
        if (msg.t !== 'hello') return;
        const err = this.core.join(peer, msg.name, msg.fit, msg.uid, msg.resume);
        if (err) { server.send(JSON.stringify({ t: 'err', m: err })); server.close(1000, 'full'); return; }
        joined = true; return;
      }
      this.core.message(peer, msg);
    });
    const gone = () => { if (joined) this.core.leave(peer); joined = false; };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{4,8})$/);
    if (m || url.pathname === '/plaza') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(m ? m[1] : '__plaza-' + PLAZA_VER)).fetch(request);
    }
    if (url.pathname === '/admin' && !adminOK(request, env)) return new Response('관리자 비밀번호가 필요해요', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="office-royale admin", charset="UTF-8"' } });
    if (url.pathname === '/api/rank' || url.pathname === '/api/game' || url.pathname === '/admin') return env.ROOM.get(env.ROOM.idFromName('__rank')).fetch(request);
    return env.ASSETS.fetch(request);
  },
};

/* Basic auth: any user name, the password is the ADMIN_KEY secret */
function adminOK(request, env) {
  if (!env.ADMIN_KEY) return false;
  const h = request.headers.get('Authorization') || '';
  let pass = '';
  try { pass = new TextDecoder().decode(Uint8Array.from(atob(h.replace(/^Basic\s+/i, '')), c => c.charCodeAt(0))).split(':').slice(1).join(':'); } catch { return false; }
  if (pass.length !== env.ADMIN_KEY.length) return false;
  let d = 0; for (let i = 0; i < pass.length; i++) d |= pass.charCodeAt(i) ^ env.ADMIN_KEY.charCodeAt(i);
  return d === 0;
}
