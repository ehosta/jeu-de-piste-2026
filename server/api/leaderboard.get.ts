// The teams ranked by points, for everyone in the game. `mine` marks the
// team of the player asking (or acted as). Admins and bocal also see the
// sandbox teams, to check their tests.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER", "NPC", "ADMIN", "BOCAL"]);
  const { questCount, leaderboard } = await computeScores({
    includeSandbox: user.isStaff,
  });

  return {
    questCount,
    teams: leaderboard.map(({ teamId, ...entry }) => ({
      ...entry,
      mine: teamId === user.teamId,
    })),
  };
});
