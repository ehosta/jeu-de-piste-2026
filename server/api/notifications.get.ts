// The admins' messages for the logged-in account, newest first (see
// server/utils/notifications.ts for who sees what).
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);

  const notifications = await prisma.notification.findMany({
    where: await notificationsWhereFor(session),
    orderBy: { createdAt: "desc" },
  });

  return notifications.map((notification) => ({
    id: notification.id,
    message: notification.message,
    urgent: notification.urgent,
    createdAt: notification.createdAt,
    expiresAt: notification.expiresAt,
  }));
});
