export default defineEventHandler(async (event) => {
  const { oauth2 } = useRuntimeConfig();
  const query = getQuery(event);

  if (!query.code) {
    const state = crypto.randomUUID();
    setCookie(event, "oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
    });

    const params = new URLSearchParams({
      client_id: oauth2.clientId,
      redirect_uri: oauth2.redirectUrl,
      response_type: "code",
      scope: "public",
      state,
    });

    return sendRedirect(
      event,
      `https://api.intra.42.fr/oauth/authorize?${params}`,
    );
  }

  // Both must be there: without the cookie, a link carrying someone else's
  // code (and no state) would log the victim into that account.
  const expectedState = getCookie(event, "oauth_state");

  if (!expectedState || query.state !== expectedState) {
    throw createError({ statusCode: 400, statusMessage: "Invalid state" });
  }

  deleteCookie(event, "oauth_state");

  const tokens = await $fetch<{ access_token: string }>(
    "https://api.intra.42.fr/oauth/token",
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: oauth2.clientId,
        client_secret: oauth2.clientSecret,
        code: String(query.code),
        redirect_uri: oauth2.redirectUrl,
      }),
    },
  );

  const me = await $fetch<{ login: string }>(
    "https://api.intra.42.fr/v2/me",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );

  // Before the game (WAITING), every 42 account joins as a player without a
  // team. Once it runs, only the people an admin added can play: anyone else
  // gets a session too, and waits on /attente until an admin adds them.
  // Owners are always in.
  const known = await prisma.user.findUnique({ where: { intraLogin: me.login } });
  let user = known;

  if (isOwner(me.login)) {
    user = await ensureOwner(me.login);
  } else if (!known && (await getGame()).phase === "WAITING") {
    user = await prisma.user.create({ data: { intraLogin: me.login } });
    await prisma.waitingUser.deleteMany({ where: { intraLogin: me.login } });
  }

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } else {
    await prisma.waitingUser.upsert({
      where: { intraLogin: me.login },
      create: { intraLogin: me.login },
      update: { lastSeenAt: new Date() },
    });
  }

  // New players, accounts waiting to be placed, last logins.
  publish({ to: STAFF_TOPIC, events: ["admin"] });

  await setUserSession(event, {
    user: { intraLogin: me.login, role: user?.role ?? null },
  });

  return sendRedirect(event, "/");
});
