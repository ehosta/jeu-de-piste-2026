import type { UserSession } from "#auth-utils";
import type { RealtimeEvent } from "#shared/utils/realtime";

// Live updates: every logged-in browser keeps a WebSocket open on /_ws
// (server/routes/_ws.ts), and routes that change the game call `publish` to
// tell the browsers concerned which data to refetch. Each socket is
// subscribed to topics derived from its account, like `requireRole`:
//
// - `all`: everyone logged in, waiting accounts included;
// - `login:<login>`: one account;
// - `role:<role>`: by effective role (an admin acting as a player is in
//   `role:PLAYER`), see `ROLE_TOPICS`;
// - `team:<id>` / `npc:<id>`: the team played, the NPC profile played;
// - `staff`: admins and bocal (the admin pages).
//
// Everything lives in this process: run a single instance of the app (see
// docs/DEPLOY.md).

// What we need from a crossws peer.
interface RealtimePeer {
  id: string;
  send(data: string): unknown;
}

interface RealtimeClient {
  peer: RealtimePeer;
  session: UserSession;
  topics: Set<string>;
}

export const ALL_TOPIC = "all";
export const STAFF_TOPIC = "staff";
export const ROLE_TOPICS = {
  players: "role:PLAYER",
  npcs: "role:NPC",
} as const;

export function teamTopic(teamId: string) {
  return `team:${teamId}`;
}

export function npcTopic(npcId: string) {
  return `npc:${npcId}`;
}

// Kept on globalThis so a hot reload in development doesn't forget the open
// sockets.
const globalForRealtime = globalThis as unknown as {
  realtimeClients?: Map<string, RealtimeClient>;
};

const clients = (globalForRealtime.realtimeClients ??= new Map());

async function resolveTopics(session: UserSession) {
  const topics = new Set([ALL_TOPIC]);

  if (!session.user) {
    return topics;
  }

  topics.add(`login:${session.user.intraLogin}`);
  const actor = await getActor(session);

  if (actor) {
    topics.add(`role:${actor.role}`);

    if (actor.teamId) {
      topics.add(teamTopic(actor.teamId));
    }

    if (actor.npcId) {
      topics.add(npcTopic(actor.npcId));
    }

    if (actor.isStaff) {
      topics.add(STAFF_TOPIC);
    }
  }

  return topics;
}

// Sockets whose topics are being resolved: one closed meanwhile isn't added.
const opening = new Set<string>();

// A whole room of phones (re)connects at once: the admins get one update.
const PRESENCE_DEBOUNCE_MS = 2000;
let presenceTimer: ReturnType<typeof setTimeout> | undefined;

function publishPresence() {
  clearTimeout(presenceTimer);
  presenceTimer = setTimeout(
    () => publish({ to: STAFF_TOPIC, events: ["presence"] }),
    PRESENCE_DEBOUNCE_MS,
  );
}

export async function addRealtimeClient(peer: RealtimePeer, session: UserSession) {
  opening.add(peer.id);
  const topics = await resolveTopics(session);

  if (opening.delete(peer.id)) {
    clients.set(peer.id, { peer, session, topics });
    publishPresence();
  }
}

export function removeRealtimeClient(peer: RealtimePeer) {
  opening.delete(peer.id);

  if (clients.delete(peer.id)) {
    publishPresence();
  }
}

function send(client: RealtimeClient, events: Iterable<RealtimeEvent>) {
  try {
    client.peer.send(JSON.stringify({ events: [...events] }));
  } catch {
    // Closed in the meantime: `close` will remove it.
  }
}

export interface RealtimeMessage {
  to: string;
  events: RealtimeEvent[];
}

// Tells the browsers subscribed to each topic which data changed. A browser in
// several of the topics gets a single message.
export function publish(...messages: RealtimeMessage[]) {
  for (const client of clients.values()) {
    const events = new Set(
      messages
        .filter((message) => client.topics.has(message.to))
        .flatMap((message) => message.events),
    );

    if (events.size) {
      send(client, events);
    }
  }
}

// A team's progress on a quest changed (given, photo sent or withdrawn,
// reviewed): the team, the admin pages, and the quest's NPCs, who may have
// that team on their scanner. A validation also moves the leaderboard.
export async function publishTeamQuestChange(
  teamId: string,
  questId: string,
  { scores = false } = {},
) {
  const npcs = await prisma.npc.findMany({
    where: { quests: { some: { id: questId } } },
    select: { id: true },
  });

  publish(
    { to: teamTopic(teamId), events: ["team"] },
    { to: STAFF_TOPIC, events: ["admin"] },
    ...npcs.map((npc): RealtimeMessage => ({ to: npcTopic(npc.id), events: ["scan"] })),
    ...(scores ? [{ to: ALL_TOPIC, events: ["scores"] } satisfies RealtimeMessage] : []),
  );
}

// After an admin edit, an account may have changed role, team or NPC (or been
// added to the game, for one waiting on /attente): its topics are resolved
// again, and if they changed, its browser refetches its session.
export async function refreshRealtimeSubscriptions() {
  await Promise.all(
    [...clients.values()].map(async (client) => {
      const topics = await resolveTopics(client.session);
      const changed =
        topics.size !== client.topics.size ||
        [...topics].some((topic) => !client.topics.has(topic));

      client.topics = topics;

      if (changed) {
        send(client, ["session"]);
      }
    }),
  );
}

// Anything may have changed (admin patch, prefill): every browser refetches
// what it shows.
export async function publishEverything() {
  await refreshRealtimeSubscriptions();
  publish(
    { to: ALL_TOPIC, events: ["game", "scores", "team", "npc", "scan", "notifications"] },
    { to: STAFF_TOPIC, events: ["admin"] },
  );
}

export function countRealtimeClients() {
  return clients.size;
}
