export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);

  const id = getRouterParam(event, "id");
  const team = isUuid(id)
    ? await prisma.team.findUnique({ where: { id } })
    : null;

  if (!team) {
    throw createError({ statusCode: 404, statusMessage: "Team not found" });
  }

  return sendQrCodeSvg(event, team.qrToken);
});
