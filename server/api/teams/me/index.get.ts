// The player's team, the quests it was given so far, and where it stands:
// points and rank (for an admin's sandbox team, the rank it would have), and
// how many quests the game has, to know when the team has done them all.
// `secret`: the points needed for the secret quests (the final objective), and
// whether the team reached them or already validated one.
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
          quest: {
            select: {
              label: true,
              difficulty: true,
              secret: true,
              ...QUEST_GIVERS,
            },
          },
          givenBy: { select: { name: true } },
          submittedBy: { select: { intraLogin: true } },
        },
      },
    },
  });

  const [{ questCount, leaderboard, finalRace }, { secretThreshold }, secretCount] =
    await Promise.all([
      computeScores({ includeSandbox: true }),
      getGame(),
      prisma.quest.count({ where: { secret: true } }),
    ]);
  const score = leaderboard.find((entry) => entry.teamId === team.id);
  const finished = finalRace.find((entry) => entry.teamId === team.id);

  return {
    name: team.name,
    questCount,
    points: score?.points ?? null,
    rank: score?.rank ?? null,
    // Null when the game has no secret quest.
    secret: secretCount
      ? {
          threshold: secretThreshold,
          unlocked: hasSecretAccess(score?.points ?? 0, secretThreshold),
          // Rank in the final quest race.
          finishedRank: finished?.rank ?? null,
        }
      : null,
    members: team.members.map((member) => member.intraLogin),
    quests: team.quests.map((teamQuest) => {
      const npcs = questGivers(teamQuest.quest.npcs).map((npc) => npc.name);
      const npc = teamQuest.givenBy?.name ?? npcs[0] ?? "";

      return {
        id: teamQuest.questId,
        label: teamQuest.quest.label,
        difficulty: teamQuest.quest.difficulty,
        secret: teamQuest.quest.secret,
        // Who gave it, and the other NPCs who can review it (shared quest,
        // same group).
        npc,
        otherNpcs: npcs.filter((name) => name !== npc),
        status: teamQuest.status,
        photoPath: teamQuest.photoPath,
        submittedBy: teamQuest.submittedBy?.intraLogin ?? null,
        canSubmitPhoto: canSubmitPhoto(teamQuest.status),
        canWithdrawPhoto: canWithdrawPhoto(teamQuest.status),
      };
    }),
  };
});
