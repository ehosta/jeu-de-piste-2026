// The player's team and the quests it was given so far.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER"]);

  if (!user.teamId) {
    return null;
  }

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: user.teamId },
    include: {
      members: { select: { intraLogin: true } },
      quests: {
        where: { status: { not: "HIDDEN" } },
        orderBy: { givenAt: "asc" },
        include: {
          quest: { select: { label: true, npc: { select: { name: true } } } },
        },
      },
    },
  });

  return {
    name: team.name,
    members: team.members.map((member) => member.intraLogin),
    quests: team.quests.map((teamQuest) => ({
      id: teamQuest.questId,
      label: teamQuest.quest.label,
      npc: teamQuest.quest.npc.name,
      status: teamQuest.status,
      photoPath: teamQuest.photoPath,
      canSubmitPhoto: canSubmitPhoto(teamQuest.status),
    })),
  };
});
