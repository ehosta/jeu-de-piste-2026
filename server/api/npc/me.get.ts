// The NPC's own profile: the name the players see, and the quests they give
// (with the other NPCs a quest is shared with).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["NPC"]);
  const npc = await findActorNpc(user);

  if (!npc) {
    throw createError({ statusCode: 403, statusMessage: "No NPC profile" });
  }

  const quests = await prisma.quest.findMany({
    where: { npcs: { some: { id: npc.id } } },
    orderBy: { key: "asc" },
    include: { npcs: { where: { id: { not: npc.id } }, select: { name: true } } },
  });

  return {
    name: npc.name,
    lore: npc.lore,
    quests: quests.map((quest) => ({
      id: quest.id,
      label: quest.label,
      answer: quest.answer,
      difficulty: quest.difficulty,
      sharedWith: quest.npcs.map((other) => other.name),
    })),
  };
});
