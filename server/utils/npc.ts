import type { H3Event } from "h3";
import type { Prisma } from "~~/prisma/generated/client";
import type { Actor } from "./auth";

// The quests an NPC gives and reviews: their own, the ones shared with them,
// and every quest of the other NPCs of their group (prisma/quest.prisma).
export function npcQuestsWhere(npc: {
  id: string;
  groupId: string | null;
}): Prisma.QuestWhereInput {
  return {
    npcs: { some: npc.groupId ? { groupId: npc.groupId } : { id: npc.id } },
  };
}

// To include in a quest, for `questGivers`.
export const QUEST_GIVERS = {
  npcs: {
    select: {
      id: true,
      name: true,
      group: { select: { npcs: { select: { id: true, name: true } } } },
    },
  },
} as const satisfies Prisma.QuestInclude;

type GiverRow = {
  id: string;
  name: string;
  group: { npcs: { id: string; name: string }[] } | null;
};

// Every NPC who can give and review a quest: its NPCs and the members of their
// groups, by name.
export function questGivers(npcs: GiverRow[]) {
  const givers = new Map<string, { id: string; name: string }>();

  for (const npc of npcs) {
    for (const giver of npc.group?.npcs ?? [npc]) {
      givers.set(giver.id, { id: giver.id, name: giver.name });
    }
  }

  return [...givers.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// The NPC profile a user plays: their own, or the one an admin acts as.
export async function findActorNpc(user: Actor) {
  return user.npcId
    ? await prisma.npc.findUnique({ where: { id: user.npcId } })
    : null;
}

// Also refuses while the game is paused.
export async function requireNpc(event: H3Event) {
  const user = await requireRole(event, ["NPC"]);
  await requireGameRunning(user);
  const npc = await findActorNpc(user);

  if (!npc) {
    throw createError({ statusCode: 403, statusMessage: "No NPC profile" });
  }

  return npc;
}

export async function findTeamByQrToken(token: unknown) {
  if (!isUuid(token)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid QR code" });
  }

  const team = await prisma.team.findUnique({
    where: { qrToken: token },
    include: { members: { select: { intraLogin: true } } },
  });

  if (!team) {
    throw createError({ statusCode: 404, statusMessage: "Unknown QR code" });
  }

  return team;
}
