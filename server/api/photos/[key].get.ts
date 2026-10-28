// Serves a quest photo to the team that took it, the NPCs giving the quest and
// admins.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER", "NPC", "ADMIN"]);
  const key = getRouterParam(event, "key");

  const teamQuest = isPhotoKey(key)
    ? await prisma.teamQuest.findFirst({
        where: { photoPath: key },
        include: { quest: { select: { npcs: { select: { id: true } } } } },
      })
    : null;

  const npc = user.role === "NPC" ? await findActorNpc(user) : null;
  const allowed =
    teamQuest &&
    (user.isAdmin ||
      user.teamId === teamQuest.teamId ||
      teamQuest.quest.npcs.some((giver) => giver.id === npc?.id));

  const photo = allowed && key ? await readPhoto(key) : null;

  if (!photo || !key) {
    throw createError({ statusCode: 404, statusMessage: "Photo not found" });
  }

  setResponseHeaders(event, {
    "Content-Type": getPhotoContentType(key),
    "Cache-Control": "private, max-age=31536000, immutable",
  });

  return photo;
});
