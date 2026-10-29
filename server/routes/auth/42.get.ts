import type { LoginError } from "#shared/utils/login-error";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  // Back to the landing page, which explains what happened (in the lore).
  const fail = (reason: LoginError) =>
    sendRedirect(event, `/?login_error=${reason}`);

  // The player clicked "Deny" on the 42 page.
  if (query.error) {
    return fail(query.error === "access_denied" ? "denied" : "intra");
  }

  if (!query.code) {
    const state = crypto.randomUUID();
    setCookie(event, "oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
    });

    return sendRedirect(event, useIntra().getOAuthUrl({ state }).url);
  }

  // Both must be there: without the cookie, a link carrying someone else's
  // code (and no state) would log the victim into that account.
  const expectedState = getCookie(event, "oauth_state");

  if (!expectedState || query.state !== expectedState) {
    return fail("expired");
  }

  deleteCookie(event, "oauth_state");

  let login: string;

  try {
    login = await fetchIntraLogin(String(query.code));
  } catch (error) {
    if (error instanceof IntraLoginError) {
      return fail(error.reason);
    }

    throw error;
  }

  // Before the game (WAITING), every 42 account joins as a player without a
  // team. Once it runs, only the people an admin added can play: anyone else
  // gets a session too, and waits on /attente until an admin adds them.
  // Owners are always in.
  const known = await prisma.user.findUnique({ where: { intraLogin: login } });
  let user = known;

  if (isOwner(login)) {
    user = await ensureOwner(login);
  } else if (!known && (await getGame()).phase === "WAITING") {
    user = await prisma.user.create({ data: { intraLogin: login } });
    await prisma.waitingUser.deleteMany({ where: { intraLogin: login } });
  }

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } else {
    await prisma.waitingUser.upsert({
      where: { intraLogin: login },
      create: { intraLogin: login },
      update: { lastSeenAt: new Date() },
    });
  }

  // New players, accounts waiting to be placed, last logins.
  publish({ to: STAFF_TOPIC, events: ["admin"] });

  await setUserSession(event, {
    user: { intraLogin: login, role: user?.role ?? null },
  });

  return sendRedirect(event, "/");
});
