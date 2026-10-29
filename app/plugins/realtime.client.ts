import {
  REALTIME_EVENTS,
  REALTIME_PING,
  REALTIME_PING_MS,
  REALTIME_PONG,
  type RealtimeEvent,
} from "#shared/utils/realtime";

type Listener = (events: Set<RealtimeEvent>) => void;

// A socket that answered nothing (not even a pong) for this long is dead.
const SILENCE_MS = REALTIME_PING_MS * 2 + 5_000;
const MAX_RETRY_MS = 30_000;
// Disconnected for this long: the "reconnecting" banner shows.
const OFFLINE_AFTER_MS = 5_000;
// While disconnected (server down, proxy dropping WebSockets…), pages still
// refetch what they show this often.
const FALLBACK_POLL_MS = 20_000;

// Live updates (server/utils/realtime.ts): while someone is logged in, keeps a
// WebSocket open on /_ws and hands the events it receives to the pages
// (useRealtime). Phones lose their connection all the time (sleep, wifi to
// 4G…), so it reconnects on its own, and since events sent meanwhile are
// lost, every page refetches everything once reconnected.
export default defineNuxtPlugin(() => {
  const { user, fetch: fetchSession } = useUserSession();
  const offline = useState("realtime-offline", () => false);
  const listeners = new Set<Listener>();

  let socket: WebSocket | null = null;
  let connectedOnce = false;
  let retries = 0;
  let lastMessageAt = 0;
  let lastFallbackAt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let offlineTimer: ReturnType<typeof setTimeout> | undefined;

  function emit(events: Set<RealtimeEvent>) {
    for (const listener of listeners) {
      listener(events);
    }
  }

  function emitEverything() {
    emit(new Set(REALTIME_EVENTS.filter((event) => event !== "session")));
  }

  function setOnline() {
    clearTimeout(offlineTimer);
    offlineTimer = undefined;
    offline.value = false;
  }

  function setDisconnected() {
    offlineTimer ??= setTimeout(() => (offline.value = true), OFFLINE_AFTER_MS);
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    const current = socket;
    socket = null;
    current?.close();
  }

  function connect() {
    disconnect();

    if (!user.value) {
      setOnline();
      return;
    }

    const url = new URL("/_ws", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    socket = ws;

    ws.addEventListener("open", () => {
      lastMessageAt = Date.now();
      retries = 0;
      setOnline();

      if (connectedOnce) {
        emitEverything();
      }

      connectedOnce = true;
    });

    ws.addEventListener("message", async (message) => {
      lastMessageAt = Date.now();

      if (message.data === REALTIME_PONG) {
        return;
      }

      const events = new Set((JSON.parse(message.data).events ?? []) as RealtimeEvent[]);

      // Role, team or NPC changed: the session first, so pages see the new
      // one (e.g. /attente leaves as soon as the account is in the game).
      if (events.has("session")) {
        await fetchSession();
      }

      emit(events);
    });

    ws.addEventListener("close", () => {
      // Replaced or closed on purpose.
      if (socket !== ws) {
        return;
      }

      socket = null;
      setDisconnected();
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** retries) * (0.75 + Math.random() / 2);
    retries++;
    reconnectTimer = setTimeout(connect, delay);
  }

  // Reconnects right away, e.g. when the phone wakes up.
  function reconnectNow() {
    if (user.value && (!socket || socket.readyState > WebSocket.OPEN)) {
      retries = 0;
      connect();
    }
  }

  setInterval(() => {
    if (!user.value) {
      return;
    }

    if (socket?.readyState === WebSocket.OPEN) {
      if (Date.now() - lastMessageAt > SILENCE_MS) {
        // Dead without having noticed: start over.
        socket.close();
        socket = null;
        setDisconnected();
        reconnectNow();
      } else {
        socket.send(REALTIME_PING);
      }

      return;
    }

    if (
      document.visibilityState === "visible" &&
      Date.now() - lastFallbackAt > FALLBACK_POLL_MS
    ) {
      lastFallbackAt = Date.now();
      emitEverything();
    }
  }, REALTIME_PING_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      reconnectNow();
    }
  });

  window.addEventListener("online", reconnectNow);

  // The socket is tied to the session cookie it was opened with: logging in
  // or out, or an admin switching views, opens a new one.
  watch(
    () =>
      user.value
        ? `${user.value.intraLogin}|${user.value.role}|${JSON.stringify(user.value.actingAs ?? null)}`
        : null,
    () => connect(),
    { immediate: true },
  );

  return {
    provide: {
      realtime: {
        // Returns a function that stops listening.
        on(listener: Listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    },
  };
});
