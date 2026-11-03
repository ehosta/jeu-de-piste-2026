// Takes one notification down from the screens.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = getRouterParam(event, "id");

  const { count } = isUuid(id)
    ? await prisma.notification.deleteMany({ where: { id } })
    : { count: 0 };

  if (!count) {
    throw createError({ statusCode: 404, statusMessage: "Notification not found" });
  }

  publishNotifications();
  return { count };
});
