// The leaderboard and the log of validated quests, computed from the
// validation dates: the first team to validate a quest gets the biggest bonus
// (shared/utils/scoring.ts). The admins' sandbox teams never take a real
// team's place: their validations don't count in the order of the real teams,
// and they only show (marked `sandbox`) with `includeSandbox`, for admins
// testing the game.
export async function computeScores({ includeSandbox = false } = {}) {
  const sandbox = includeSandbox ? undefined : false;
  const [teams, validations, questCount] = await Promise.all([
    prisma.team.findMany({
      where: { sandbox },
      select: { id: true, name: true, sandbox: true },
    }),
    prisma.teamQuest.findMany({
      where: { status: "VALIDATED", team: { sandbox } },
      orderBy: [{ validatedAt: "asc" }, { id: "asc" }],
      select: {
        questId: true,
        validatedAt: true,
        team: { select: { id: true, name: true, sandbox: true } },
        validatedBy: { select: { name: true } },
        quest: {
          select: {
            difficulty: true,
            npcs: { select: { name: true }, orderBy: { name: "asc" } },
          },
        },
      },
    }),
    prisma.quest.count(),
  ]);

  // Real teams that validated each quest so far.
  const validatedBefore = new Map<string, number>();

  const log = validations.map((validation) => {
    const rank = (validatedBefore.get(validation.questId) ?? 0) + 1;

    if (!validation.team.sandbox) {
      validatedBefore.set(validation.questId, rank);
    }

    return {
      at: validation.validatedAt,
      teamId: validation.team.id,
      team: validation.team.name,
      sandbox: validation.team.sandbox,
      // The NPC who validated it (one of the NPCs, for a shared quest).
      npc:
        validation.validatedBy?.name ??
        validation.quest.npcs.map((npc) => npc.name).join(" / "),
      difficulty: validation.quest.difficulty,
      rank,
      points: questPoints(validation.quest.difficulty, rank),
    };
  });

  const totals = new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        team: team.name,
        sandbox: team.sandbox,
        points: 0,
        validated: 0,
        lastAt: null as Date | null,
      },
    ]),
  );

  for (const entry of log) {
    const total = totals.get(entry.teamId);

    if (total) {
      total.points += entry.points;
      total.validated++;
      total.lastAt = entry.at;
    }
  }

  // Most points first; at equal points, real teams before sandbox ones, then
  // the team that got there first.
  const sorted = [...totals.values()].sort(
    (a, b) =>
      b.points - a.points ||
      Number(a.sandbox) - Number(b.sandbox) ||
      (a.lastAt?.getTime() ?? Infinity) - (b.lastAt?.getTime() ?? Infinity) ||
      a.team.localeCompare(b.team),
  );
  const real = sorted.filter((entry) => !entry.sandbox);

  // Teams with the same points share a rank. A sandbox team gets the rank it
  // would have among the real teams.
  const leaderboard = sorted.map((entry) => ({
    ...entry,
    rank: real.filter((other) => other.points > entry.points).length + 1,
  }));

  return { questCount, leaderboard, log: log.reverse() };
}
