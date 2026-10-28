// A player draws a new random name for their team (shared/utils/team-names.ts),
// in their language. Names stay unique: one already taken isn't drawn.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER"]);
  const body = await readBody<{ locale?: unknown } | undefined>(event);
  const locale = body?.locale === "en" ? "en" : "fr";

  if (!user.teamId) {
    throw createError({ statusCode: 404, statusMessage: "No team" });
  }

  const teams = await prisma.team.findMany({ select: { id: true, name: true, sandbox: true } });

  // The admins' team keeps its name.
  if (teams.some((team) => team.id === user.teamId && team.sandbox)) {
    throw createError({ statusCode: 403, statusMessage: "Admin team" });
  }

  const [name] = randomTeamNames(
    1,
    locale,
    teams.map((team) => team.name),
  );

  try {
    await prisma.team.update({ where: { id: user.teamId }, data: { name } });
  } catch {
    // Another team took the same name in the meantime.
    throw createError({ statusCode: 409, statusMessage: "Name taken" });
  }

  return { name };
});
