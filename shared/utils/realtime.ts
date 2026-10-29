// What the server tells connected browsers over the WebSocket (/_ws, see
// server/utils/realtime.ts): which data changed, never the data itself. Each
// page refetches what it shows when one of its events comes in (useRealtime).
export const REALTIME_EVENTS = [
  // Phase and pause (GET /api/game).
  "game",
  // Leaderboard and log: a validation, a team or NPC renamed…
  "scores",
  // The receiving player's team and its quests (GET /api/teams/me).
  "team",
  // The receiving NPC's profile and quests (GET /api/npc/me).
  "npc",
  // A team the receiving NPC may have just scanned changed (photo sent…).
  "scan",
  // What the admin pages show (GET /api/admin/state).
  "admin",
  // The receiving account's role, team or NPC changed: refetch the session.
  "session",
  // Messages from the admins (GET /api/notifications).
  "notifications",
  // Browsers connected or gone, for the count on /admin/notifications.
  "presence",
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

// Sent every REALTIME_PING_MS by the browser, answered right away: a phone
// switching networks can keep a dead socket open without noticing.
export const REALTIME_PING = "ping";
export const REALTIME_PONG = "pong";
export const REALTIME_PING_MS = 25_000;
