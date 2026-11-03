// Browsers only ever send "ping" on /_ws (server/routes/_ws.ts), but the
// WebSocket server accepts messages of up to 100 MB by default, held in
// memory: anything bigger than a ping now closes the socket.
const MAX_WEBSOCKET_MESSAGE_BYTES = 1024;

export default defineNitroPlugin((nitroApp) => {
  Object.assign(nitroApp.h3App.websocket, {
    serverOptions: { maxPayload: MAX_WEBSOCKET_MESSAGE_BYTES },
  });
});
