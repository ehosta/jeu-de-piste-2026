// Puts a player in a team, by 42 login. The user doesn't need to have logged in
// yet: their row is created now and matched by login when they do.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody<
    { teamId?: unknown; intraLogin?: unknown } | undefined
  >(event);
  const teamId = body?.teamId;
  const intraLogin = parseIntraLogin(body?.intraLogin);

  if (!isUuid(teamId) || !intraLogin) {
    throw createError({ statusCode: 400, statusMessage: "Invalid login" });
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });

  if (!team) {
    throw createError({ statusCode: 404, statusMessage: "Team not found" });
  }

  const user = await prisma.user.findUnique({ where: { intraLogin } });

  if (user && user.role !== "PLAYER") {
    throw createError({ statusCode: 409, statusMessage: "Not a player" });
  }

  await prisma.user.upsert({
    where: { intraLogin },
    update: { teamId },
    create: { intraLogin, teamId },
  });

  return { intraLogin };
});
