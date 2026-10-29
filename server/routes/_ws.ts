import { REALTIME_PING, REALTIME_PONG } from "#shared/utils/realtime";

// The WebSocket every logged-in browser keeps open for live updates (see
// server/utils/realtime.ts and app/plugins/realtime.client.ts). Only the
// session cookie sent with the upgrade request identifies the account: after
// logging in again or switching views, the browser opens a new socket.
export default defineWebSocketHandler({
  async upgrade(request) {
    // Another site (or subdomain) opening a socket with the visitor's cookie.
    if (
      isCrossOriginRequest(
        (name) => request.headers.get(name),
        request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? undefined,
      )
    ) {
      throw new Response("Forbidden", { status: 403 });
    }

    // Without a session cookie, h3 can't create one here: it throws.
    const session = await getUserSession(request).catch(() => null);

    if (!session?.user) {
      throw new Response("Unauthorized", { status: 401 });
    }
  },

  async open(peer) {
    await addRealtimeClient(peer, await getUserSession(peer));
  },

  message(peer, message) {
    if (message.text() === REALTIME_PING) {
      peer.send(REALTIME_PONG);
    }
  },

  close(peer) {
    removeRealtimeClient(peer);
  },

  error(peer) {
    removeRealtimeClient(peer);
  },
});
