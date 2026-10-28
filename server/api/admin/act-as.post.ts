import type { ActingAs } from "#shared/types/auth";

// Lets an admin play as a player of a team, as an NPC or as any account, in
// this session only (e.g. NPC on their phone, admin on their computer).
// Bocal only switch to their own player and NPC versions. `ADMIN` switches
// back.
export default defineEventHandler(async (event) => {
  const admin = await requireStaff(event);
  const body = await readBody<
    | { role?: unknown; teamId?: unknown; npcId?: unknown; userId?: unknown }
    | undefined
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
  } else if (body?.role === "USER") {
    const user = isUuid(body.userId)
      ? await prisma.user.findUnique({ where: { id: body.userId } })
      : null;

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: "User not found" });
    }

    // Acting as oneself is just being oneself.
    actingAs = user.id === admin.id ? undefined : { role: "USER", userId: user.id };
  } else if (body?.role !== "ADMIN") {
    throw createError({ statusCode: 400, statusMessage: "Invalid role" });
  }

  if (!admin.isAdmin && actingAs) {
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      include: { npc: { select: { id: true } } },
    });

    if (!isOwnVersion(me, actingAs)) {
      throw createError({ statusCode: 403, statusMessage: "Forbidden" });
    }
  }

  // setUserSession deep-merges, which can't remove `actingAs`.
  const { id: _id, ...session } = await getUserSession(event);
  await replaceUserSession(event, {
    ...session,
    secure: { ...session.secure, actingAs },
  });

  return { actingAs: actingAs ?? null };
});
