// Fills an empty database from prefill.json, then puts the owners and the
// admins' player and NPC versions back (also done on every login and request,
// see server/utils/auth.ts, this only makes them show up in /admin right after
// a reset).
export default defineNitroPlugin(async () => {
  if (await isDatabaseEmpty()) {
    try {
      await applyPrefill();
      console.info("[prefill] empty database filled from prefill.json");
    } catch (error) {
      console.error("[prefill] prefill.json could not be applied:", error);
    }
  }

  for (const login of ownerLogins()) {
    await ensureOwner(login);
  }

  await ensureAllAdminVersions();
});
