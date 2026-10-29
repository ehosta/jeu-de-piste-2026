// Resolves a scanned team QR code into the scanning NPC's quests (shared ones
// and their group's included), each with the actions its current status allows for that team.
export default defineEventHandler(async (event) => {
  const npc = await requireNpc(event);
  const body = await readBody<{ token?: unknown } | undefined>(event);
  const team = await findTeamByQrToken(body?.token);

  const quests = await prisma.quest.findMany({
    where: npcQuestsWhere(npc),
    orderBy: { key: "asc" },
    include: { ...QUEST_GIVERS, teamQuest: { where: { teamId: team.id } } },
  });

  return {
    team: {
      name: team.name,
      members: team.members.map((member) => member.intraLogin),
    },
    quests: quests.map((quest) => {
      const teamQuest = quest.teamQuest[0];
      const status = teamQuest?.status ?? "HIDDEN";

      return {
        id: quest.id,
        label: quest.label,
        answer: quest.answer,
        // The other NPCs who can give it (shared quest, same group).
        sharedWith: questGivers(quest.npcs)
          .filter((other) => other.id !== npc.id)
          .map((other) => other.name),
        status,
        photoPath: teamQuest?.photoPath ?? null,
        actions: getAllowedQuestActions(status),
      };
    }),
  };
});
