// The teams ranked by points, and the final quest race (the teams that
// validated a secret quest, fastest first), for everyone in the game. `mine`
// marks the team of the player asking (or acted as). Admins and bocal also see
// the sandbox teams, to check their tests.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER", "NPC", "ADMIN", "BOCAL"]);
  const [{ questCount, leaderboard, finalRace }, secretCount] = await Promise.all([
    computeScores({ includeSandbox: user.isStaff }),
    prisma.quest.count({ where: { secret: true } }),
  ]);

  return {
    questCount,
    teams: leaderboard.map(({ teamId, ...entry }) => ({
      ...entry,
      mine: teamId === user.teamId,
    })),
    // Null when the game has no secret quest.
    finalRace: secretCount
      ? finalRace.map(({ teamId, ...entry }) => ({
          ...entry,
          mine: teamId === user.teamId,
        }))
      : null,
  };
});
