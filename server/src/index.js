// Online play skeleton (Cloudflare Workers + Durable Objects).
// One Durable Object = one match room. Today it only relays messages between players in the room;
// the plan is to load the rule files from public/js/sim here and run the match authoritatively.
import { DurableObject } from 'cloudflare:workers';

export class Room extends DurableObject {
  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernation API: idle rooms are not billed for duration.
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, message) {
    for (const peer of this.ctx.getWebSockets()) if (peer !== ws) peer.send(message);
  }
  webSocketClose(ws, code, reason) {
    ws.close(code, reason);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([\w-]{1,32})$/);
    if (m && request.headers.get('Upgrade') === 'websocket') {
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(request);
    }
    return new Response('office-royale server', { status: 200 });
  },
};
