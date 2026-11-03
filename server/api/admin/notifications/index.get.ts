// The notifications still showing, for /admin/notifications (admins and
// bocal), with how many browsers are connected to receive them.
export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const notifications = await prisma.notification.findMany({
    where: activeNotificationsWhere(),
    orderBy: { createdAt: "desc" },
    include: { team: { select: { name: true } } },
  });

  return {
    connected: countRealtimeClients(),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      message: notification.message,
      audience: notification.audience,
      team: notification.team?.name ?? null,
      urgent: notification.urgent,
      sentBy: notification.sentBy,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    })),
  };
});
