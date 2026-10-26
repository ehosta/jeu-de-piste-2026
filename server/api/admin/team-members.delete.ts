export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody<{ intraLogin?: unknown } | undefined>(event);
  const intraLogin = parseIntraLogin(body?.intraLogin);

  if (!intraLogin) {
    throw createError({ statusCode: 400, statusMessage: "Invalid login" });
  }

  await prisma.user.updateMany({
    where: { intraLogin },
    data: { teamId: null },
  });

  return { intraLogin };
});
