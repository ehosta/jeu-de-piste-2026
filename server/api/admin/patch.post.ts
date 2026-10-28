// Applies an admin patch (format: shared/utils/admin-patch.ts, docs/ADMIN.md).
// Used by every admin edit as well as the JSON import. `?dryRun=1` runs it and
// rolls it back, to preview what it would change.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const dryRun = getQuery(event).dryRun === "1";
  const parsed = parseAdminPatch(await readBody(event));

  if (!parsed.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid patch",
      data: { issues: parsed.issues },
    });
  }

  try {
    return await applyAdminPatch(parsed.patch, {
      actorLogin: admin.intraLogin,
      dryRun,
    });
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
