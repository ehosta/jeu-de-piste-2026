// Serves a quest photo to the team that took it, the NPCs giving the quest (and
// their groups), admins and bocal.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER", "NPC", "ADMIN", "BOCAL"]);
  const key = getRouterParam(event, "key");

  const teamQuest = isPhotoKey(key)
    ? await prisma.teamQuest.findFirst({
        where: { photoPath: key },
        include: { quest: { include: QUEST_GIVERS } },
      })
    : null;

  const npc = user.role === "NPC" ? await findActorNpc(user) : null;
  const allowed =
    teamQuest &&
    (user.isStaff ||
      user.teamId === teamQuest.teamId ||
      questGivers(teamQuest.quest.npcs).some((giver) => giver.id === npc?.id));

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
