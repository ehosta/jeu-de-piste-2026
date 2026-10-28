import type { H3Event } from "h3";
import type { Actor } from "./auth";

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
