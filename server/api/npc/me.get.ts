// The NPC's own profile: the name the players see, their group, and the quests
// they give (with the other NPCs who can give them too: shared quest, group).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["NPC"]);
  const npc = await findActorNpc(user);

  if (!npc) {
    throw createError({ statusCode: 403, statusMessage: "No NPC profile" });
  }

  const quests = await prisma.quest.findMany({
    where: npcQuestsWhere(npc),
    orderBy: { key: "asc" },
    include: QUEST_GIVERS,
  });
  const group = npc.groupId
    ? await prisma.npcGroup.findUnique({
        where: { id: npc.groupId },
        include: { npcs: { select: { name: true }, orderBy: { name: "asc" } } },
      })
    : null;

  return {
    name: npc.name,
    lore: npc.lore,
    // Null for a solo NPC.
    group: group && {
      name: group.name,
      others: group.npcs
        .map((other) => other.name)
        .filter((name) => name !== npc.name),
    },
    quests: quests.map((quest) => ({
      id: quest.id,
      label: quest.label,
      answer: quest.answer,
      difficulty: quest.difficulty,
      sharedWith: questGivers(quest.npcs)
        .filter((other) => other.id !== npc.id)
        .map((other) => other.name),
    })),
  };
});
