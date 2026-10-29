// Takes every notification down from the screens.
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { count } = await prisma.notification.deleteMany();
  publishNotifications();
  return { count };
});
