// Applies prefill.json again (without its game state), e.g. after editing it
// or wiping the database.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);

  try {
    const report = await applyPrefill({
      actorLogin: admin.intraLogin,
      keepGame: true,
    });
    await publishEverything();
    return report;
  } catch (error) {
    if (error instanceof PatchApplyError) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid patch",
        data: { issues: [error.issue] },
      });
    }

    throw error;
  }
});
