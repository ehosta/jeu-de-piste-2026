// Resolves a scanned team QR code into the scanning NPC's quests, each with the
// actions its current status allows for that team.
export default defineEventHandler(async (event) => {
  const npc = await requireNpc(event);
  const body = await readBody<{ token?: unknown } | undefined>(event);
  const team = await findTeamByQrToken(body?.token);

  const quests = await prisma.quest.findMany({
    where: { npcId: npc.id },
    include: { teamQuest: { where: { teamId: team.id } } },
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
        status,
        photoPath: teamQuest?.photoPath ?? null,
        actions: getAllowedQuestActions(status),
      };
    }),
  };
});
