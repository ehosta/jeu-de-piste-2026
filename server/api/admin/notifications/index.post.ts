// Sends a notification (format: shared/utils/notifications.ts). It shows on the
// targeted screens right away.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const parsed = parseNotificationInput(await readBody(event));

  if (!parsed.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid notification",
      data: { issue: parsed.issue },
    });
  }

  const { message, audience, teamId, urgent, duration } = parsed.value;

  if (teamId && !(await prisma.team.findUnique({ where: { id: teamId } }))) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid notification",
      data: { issue: "teamRequired" },
    });
  }

  // Expired notifications are only kept until the next one is sent.
  await prisma.notification.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });

  const notification = await prisma.notification.create({
    data: {
      message,
      audience,
      teamId,
      urgent,
      sentBy: admin.intraLogin,
      expiresAt: duration ? new Date(Date.now() + duration * 60_000) : null,
    },
  });

  publishNotifications();
  return { id: notification.id };
});
