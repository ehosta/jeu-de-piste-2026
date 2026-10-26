import type { ActingAs } from "#shared/types/auth";

// Lets an admin play as a player of a team or as an NPC, in this session only
// (e.g. NPC on their phone, admin on their computer). `ADMIN` switches back.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody<
    { role?: unknown; teamId?: unknown; npcId?: unknown } | undefined
  >(event);

  let actingAs: ActingAs | undefined;

  if (body?.role === "PLAYER") {
    const team = isUuid(body.teamId)
      ? await prisma.team.findUnique({ where: { id: body.teamId } })
      : null;

    if (!team) {
      throw createError({ statusCode: 404, statusMessage: "Team not found" });
    }

    actingAs = { role: "PLAYER", teamId: team.id };
  } else if (body?.role === "NPC") {
    const npc = isUuid(body.npcId)
      ? await prisma.npc.findUnique({ where: { id: body.npcId } })
      : null;

    if (!npc) {
      throw createError({ statusCode: 404, statusMessage: "NPC not found" });
    }

    actingAs = { role: "NPC", npcId: npc.id };
  } else if (body?.role !== "ADMIN") {
    throw createError({ statusCode: 400, statusMessage: "Invalid role" });
  }

  // setUserSession deep-merges, which can't remove `actingAs`.
  const { id: _id, ...session } = await getUserSession(event);
  await replaceUserSession(event, {
    ...session,
    secure: { ...session.secure, actingAs },
  });

  return { actingAs: actingAs ?? null };
});
