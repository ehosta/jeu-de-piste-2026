export default defineEventHandler(async (event) => {
  const { oauth2 } = useRuntimeConfig();
  const query = getQuery(event);

  if (!query.code) {
    const state = crypto.randomUUID();
    setCookie(event, "oauth_state", state, {
      httpOnly: true,
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

  if (query.state !== getCookie(event, "oauth_state")) {
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

  const me = await $fetch<{ id: number; login: string }>(
    "https://api.intra.42.fr/v2/me",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );

  const user = await prisma.user.upsert({
    where: { intraLogin: me.login },
    update: {},
    create: { intraLogin: me.login },
  });

  await setUserSession(event, {
    user: { id: user.id, intraLogin: user.intraLogin, role: user.role },
  });

  return sendRedirect(event, "/");
});
