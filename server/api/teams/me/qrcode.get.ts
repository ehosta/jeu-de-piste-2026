export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER"]);

  if (!user.teamId) {
    throw createError({ statusCode: 404, statusMessage: "No team" });
  }

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: user.teamId },
  });

  return sendQrCodeSvg(event, team.qrToken);
});
