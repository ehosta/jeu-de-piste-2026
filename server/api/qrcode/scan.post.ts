// Resolves a scanned team QR code into the scanning NPC's quests (shared ones
// included), each with the actions its current status allows for that team.
export default defineEventHandler(async (event) => {
  const npc = await requireNpc(event);
  const body = await readBody<{ token?: unknown } | undefined>(event);
  const team = await findTeamByQrToken(body?.token);

  const quests = await prisma.quest.findMany({
    where: { npcs: { some: { id: npc.id } } },
    orderBy: { key: "asc" },
    include: {
      teamQuest: { where: { teamId: team.id } },
      npcs: { where: { id: { not: npc.id } }, select: { name: true } },
    },
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
        // The other NPCs sharing this quest.
        sharedWith: quest.npcs.map((other) => other.name),
        status,
        photoPath: teamQuest?.photoPath ?? null,
        actions: getAllowedQuestActions(status),
      };
    }),
  };
});
