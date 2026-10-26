import type { H3Event } from "h3";
import type { Actor } from "./auth";

// The NPC profile a user plays: their own, or the one an admin acts as.
export function findActorNpc(user: Actor) {
  return prisma.npc.findUnique({
    where: user.npcId ? { id: user.npcId } : { userId: user.id },
  });
}

export async function requireNpc(event: H3Event) {
  const npc = await findActorNpc(await requireRole(event, ["NPC"]));

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
