// Online play on Cloudflare Workers + Durable Objects.
// One Durable Object = one room (code in the URL). It runs the rules from public/js/sim (bundled into sim.gen.js)
// and streams snapshots; clients only send input. The Worker also serves public/ as static assets.
import { DurableObject } from 'cloudflare:workers';
import { RoomCore } from './room.js';
import { createSim } from './sim.gen.js';

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = null;
  }
  async fetch(request) {
    const code = new URL(request.url).pathname.split('/').pop();
    this.core ||= new RoomCore(code, { createSim, send: (p, o) => { try { p.ws.send(JSON.stringify(o)); } catch {} } });
    const [client, server] = Object.values(new WebSocketPair());
    // Plain accept (not the Hibernation API): the room keeps its lobby and match in memory while anyone is connected.
    server.accept();
    const peer = { ws: server };
    let joined = false;
    server.addEventListener('message', ev => {
      let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ''); } catch { return; }
      if (!joined) {
        if (msg.t !== 'hello') return;
        const err = this.core.join(peer, msg.name);
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
    if (m) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
