// Game stats for the end of the game (/admin/stats): totals, times, records
// and the best of each kind. Only the real teams count, the admins' sandbox
// ones are left out. Times are in milliseconds, null when nothing to measure.
export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const [game, teams, quests, npcs, playerCount, teamQuests, scores] = await Promise.all([
    getGame(),
    prisma.team.findMany({
      where: { sandbox: false },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.quest.findMany({
      select: { id: true, key: true, label: true, difficulty: true, secret: true },
    }),
    prisma.npc.findMany({ select: { id: true, name: true, user: { select: { role: true } } } }),
    prisma.user.count({ where: { role: "PLAYER", team: { sandbox: false } } }),
    prisma.teamQuest.findMany({
      where: { team: { sandbox: false }, status: { not: "HIDDEN" } },
      select: {
        teamId: true,
        questId: true,
        status: true,
        givenAt: true,
        submittedAt: true,
        validatedAt: true,
        rejectedAt: true,
        givenById: true,
        validatedById: true,
        submittedBy: { select: { intraLogin: true } },
      },
    }),
    computeScores(),
  ]);

  const teamName = new Map(teams.map((team) => [team.id, team.name]));
  const questById = new Map(quests.map((quest) => [quest.id, quest]));

  const validated = teamQuests.filter((entry) => entry.status === "VALIDATED");
  // From given to validated: how long a team took to find the place.
  const solveTimes = validated.flatMap((entry) =>
    entry.givenAt && entry.validatedAt
      ? [{ entry, ms: entry.validatedAt.getTime() - entry.givenAt.getTime() }]
      : [],
  );
  // From the last photo sent to its validation: how long the NPC took.
  const reviewTimes = validated.flatMap((entry) =>
    entry.submittedAt && entry.validatedAt
      ? [{ entry, ms: entry.validatedAt.getTime() - entry.submittedAt.getTime() }]
      : [],
  );

  const describe = (entry: (typeof teamQuests)[number], ms: number | null = null) => {
    const quest = questById.get(entry.questId);
    return {
      team: teamName.get(entry.teamId) ?? "",
      quest: quest?.label ?? "",
      difficulty: quest?.difficulty ?? 0,
      ms,
      at: entry.validatedAt,
    };
  };

  const byTime = [...solveTimes].sort((a, b) => a.ms - b.ms);
  const fastest = byTime[0];
  const slowest = byTime.at(-1);
  const chronological = [...validated].sort(
    (a, b) => (a.validatedAt?.getTime() ?? 0) - (b.validatedAt?.getTime() ?? 0),
  );
  const first = chronological[0];
  const last = chronological.at(-1);

  // Validations per clock hour, to find the rush.
  const hours = new Map<string, number>();

  for (const entry of validated) {
    if (entry.validatedAt) {
      const hour = new Date(entry.validatedAt);
      hour.setMinutes(0, 0, 0);
      hours.set(hour.toISOString(), (hours.get(hour.toISOString()) ?? 0) + 1);
    }
  }

  const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];

  const perQuest = quests
    .map((quest) => {
      const entries = teamQuests.filter((entry) => entry.questId === quest.id);
      const done = entries.filter((entry) => entry.status === "VALIDATED");
      const times = solveTimes.filter(({ entry }) => entry.questId === quest.id);

      return {
        key: quest.key,
        label: quest.label,
        difficulty: quest.difficulty,
        secret: quest.secret,
        given: entries.length,
        validated: done.length,
        rejected: entries.filter((entry) => entry.rejectedAt).length,
        averageMs: average(times.map(({ ms }) => ms)),
      };
    })
    .sort((a, b) => b.validated - a.validated || a.label.localeCompare(b.label));

  const perTeam = teams
    .map((team) => {
      const entries = teamQuests.filter((entry) => entry.teamId === team.id);
      const score = scores.leaderboard.find((entry) => entry.teamId === team.id);

      return {
        name: team.name,
        members: team._count.members,
        points: score?.points ?? 0,
        validated: entries.filter((entry) => entry.status === "VALIDATED").length,
        rejected: entries.filter((entry) => entry.rejectedAt).length,
        averageMs: average(
          solveTimes.filter(({ entry }) => entry.teamId === team.id).map(({ ms }) => ms),
        ),
      };
    })
    .sort((a, b) => b.points - a.points);

  const perNpc = npcs
    .map((npc) => ({
      name: npc.name,
      given: teamQuests.filter((entry) => entry.givenById === npc.id).length,
      validated: validated.filter((entry) => entry.validatedById === npc.id).length,
      reviewMs: average(
        reviewTimes.filter(({ entry }) => entry.validatedById === npc.id).map(({ ms }) => ms),
      ),
    }))
    .filter((npc) => npc.given || npc.validated)
    .sort((a, b) => b.validated - a.validated || b.given - a.given);

  // Who took the most validated photos.
  const photographers = new Map<string, number>();

  for (const entry of validated) {
    const login = entry.submittedBy?.intraLogin;

    if (login) {
      photographers.set(login, (photographers.get(login) ?? 0) + 1);
    }
  }

  const topPhotographer = [...photographers.entries()].sort((a, b) => b[1] - a[1])[0];

  const perDifficulty = Array.from({ length: MAX_DIFFICULTY - MIN_DIFFICULTY + 1 }, (_, index) => {
    const difficulty = MIN_DIFFICULTY + index;
    const times = solveTimes.filter(
      ({ entry }) => questById.get(entry.questId)?.difficulty === difficulty,
    );

    return {
      difficulty,
      quests: quests.filter((quest) => quest.difficulty === difficulty).length,
      validated: validated.filter(
        (entry) => questById.get(entry.questId)?.difficulty === difficulty,
      ).length,
      averageMs: average(times.map(({ ms }) => ms)),
    };
  }).filter((row) => row.quests);

  const totalPoints = scores.leaderboard.reduce((sum, entry) => sum + entry.points, 0);
  const normalQuests = quests.filter((quest) => !quest.secret).length;
  const winner = scores.finalRace[0];
  const mostPopular = perQuest.find((quest) => quest.validated);
  const toughest = perQuest
    .filter((quest) => quest.averageMs !== null)
    .sort((a, b) => (b.averageMs ?? 0) - (a.averageMs ?? 0))[0];

  return {
    game: {
      startedAt: game.startedAt,
      lastAt: last?.validatedAt ?? null,
      durationMs:
        game.startedAt && last?.validatedAt
          ? last.validatedAt.getTime() - game.startedAt.getTime()
          : null,
    },
    totals: {
      players: playerCount,
      teams: teams.length,
      // The admins' and bocal's NPC versions aren't counted.
      npcs: npcs.filter((npc) => npc.user.role === "NPC").length,
      quests: normalQuests,
      secretQuests: quests.length - normalQuests,
      given: teamQuests.length,
      validated: validated.length,
      rejected: teamQuests.filter((entry) => entry.rejectedAt).length,
      blocked: teamQuests.filter((entry) => entry.status === "BLOCKED").length,
      points: totalPoints,
      averagePoints: teams.length ? Math.round(totalPoints / teams.length) : 0,
      // Out of every quest for every team.
      completion:
        teams.length && quests.length ? validated.length / (teams.length * quests.length) : 0,
      photographers: photographers.size,
    },
    times: {
      averageSolveMs: average(solveTimes.map(({ ms }) => ms)),
      averageReviewMs: average(reviewTimes.map(({ ms }) => ms)),
    },
    records: {
      fastest: fastest ? describe(fastest.entry, fastest.ms) : null,
      slowest: slowest && slowest !== fastest ? describe(slowest.entry, slowest.ms) : null,
      first: first ? describe(first) : null,
      last: last && last !== first ? describe(last) : null,
      peak: peak ? { hour: peak[0], validated: peak[1] } : null,
      mostPopular: mostPopular ? { label: mostPopular.label, validated: mostPopular.validated } : null,
      toughest: toughest ? { label: toughest.label, ms: toughest.averageMs } : null,
      neverValidated: perQuest.filter((quest) => !quest.validated).map((quest) => quest.label),
      topPhotographer: topPhotographer
        ? { login: topPhotographer[0], validated: topPhotographer[1] }
        : null,
      topNpc: perNpc[0] ? { name: perNpc[0].name, validated: perNpc[0].validated } : null,
    },
    final: {
      threshold: game.secretThreshold,
      unlocked: scores.leaderboard.filter((entry) =>
        hasSecretAccess(entry.points, game.secretThreshold),
      ).length,
      finished: scores.finalRace.length,
      winner: winner ? { team: winner.team, at: winner.at } : null,
    },
    perDifficulty,
    perQuest,
    perTeam,
    perNpc,
  };
});

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}
