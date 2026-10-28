// The validated quests, newest first, for everyone in the game. Only the NPC
// and the difficulty are shown, not the riddle, so it doesn't help the
// other teams. Admins also see the sandbox teams, to check their tests.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER", "NPC", "ADMIN"]);
  const { log } = await computeScores({ includeSandbox: user.isAdmin });

  return log.slice(0, 300).map(({ teamId, ...entry }) => ({
    ...entry,
    mine: teamId === user.teamId,
  }));
});
