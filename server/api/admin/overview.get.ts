// Everything the admin page needs: teams with their progress, and NPCs with
// their quests.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  const [teams, npcs] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        members: { select: { intraLogin: true } },
        quests: { select: { questId: true, status: true, photoPath: true } },
      },
    }),
    prisma.npc.findMany({
      orderBy: { name: "asc" },
      include: { quests: { select: { id: true, label: true } } },
    }),
  ]);

  return {
    actingAs: admin.actingAs ?? null,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      members: team.members.map((member) => member.intraLogin),
      progress: Object.fromEntries(
        team.quests.map((teamQuest) => [
          teamQuest.questId,
          { status: teamQuest.status, photoPath: teamQuest.photoPath },
        ]),
      ),
    })),
    npcs: npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      quests: npc.quests,
    })),
  };
});
