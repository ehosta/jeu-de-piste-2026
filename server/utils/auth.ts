import type { H3Event } from "h3";
import type { UserSession } from "#auth-utils";
import type { Role } from "../../prisma/generated/enums";

const withNpc = { npc: { select: { id: true } } } as const;

// Roles can change after login (e.g. a player promoted to NPC), so the user is
// reloaded from the database instead of trusting the role stored in the session.
// Users are matched by 42 login: a 42 account an admin hasn't added (or has
// deleted since) has no actor, and waits on /attente, except owners
// (NUXT_ADMIN_LOGINS), who are put back as admins if anything removed them.
// Every admin also has a team and an NPC profile (server/utils/admins.ts),
// put back too if they were removed, and can act as a player of any
// team, any NPC or any account to test the game: that is stored server-side in
// their session only, `id`, `intraLogin` and `isAdmin` stay their own.
export async function getActor(session: UserSession) {
  if (!session.user) {
    return null;
  }

  const login = session.user.intraLogin;
  let user = await prisma.user.findUnique({
    where: { intraLogin: login },
    include: withNpc,
  });

  const missingVersions =
    user?.role === "ADMIN" && (!user.teamId || !user.npc);

  if ((user?.role !== "ADMIN" && isOwner(login)) || missingVersions) {
    await (user && missingVersions
      ? ensureAdminVersions(user)
      : ensureOwner(login));
    user = await prisma.user.findUnique({
      where: { intraLogin: login },
      include: withNpc,
    });
  }

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "ADMIN";
  const actingAs = isAdmin ? session.secure?.actingAs : undefined;

  if (actingAs?.role === "PLAYER" || actingAs?.role === "NPC") {
    return {
      id: user.id,
      intraLogin: user.intraLogin,
      isAdmin,
      actingAs,
      role: actingAs.role,
      teamId: actingAs.role === "PLAYER" ? actingAs.teamId : null,
      npcId: actingAs.role === "NPC" ? actingAs.npcId : null,
    };
  }

  // The account acted as, or their own if it was deleted meanwhile.
  const target =
    (actingAs?.role === "USER"
      ? await prisma.user.findUnique({
          where: { id: actingAs.userId },
          include: withNpc,
        })
      : null) ?? user;

  return {
    id: user.id,
    intraLogin: user.intraLogin,
    isAdmin,
    actingAs,
    role: target.role,
    teamId: target.teamId,
    npcId: target.npc?.id ?? null,
  };
}

export type Actor = NonNullable<Awaited<ReturnType<typeof getActor>>>;

export async function requireRole(event: H3Event, roles: Role[]) {
  const actor = await getActor(await requireUserSession(event));

  if (!actor || !roles.includes(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  return actor;
}

// Ignores impersonation, so an admin acting as a player can still switch back.
export async function requireAdmin(event: H3Event) {
  const actor = await getActor(await requireUserSession(event));

  if (!actor?.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  return actor;
}
