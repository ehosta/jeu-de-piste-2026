import type { H3Event } from "h3";
import type { UserSession } from "#auth-utils";
import type { ActingAs } from "#shared/types/auth";
import type { Role } from "../../prisma/generated/enums";

const withNpc = { npc: { select: { id: true } } } as const;

// Roles can change after login (e.g. a player promoted to NPC), so the user is
// reloaded from the database instead of trusting the role stored in the session.
// Users are matched by 42 login: a 42 account an admin hasn't added (or has
// deleted since) has no actor, and waits on /attente, except owners
// (NUXT_ADMIN_LOGINS), who are put back as admins if anything removed them.
// Every admin and bocal member (`isStaff`) also has a team and an NPC profile
// (server/utils/admins.ts), put back too if they were removed. Admins can act
// as a player of any team, any NPC or any account to test the game, bocal only
// as their own player and NPC versions (see /api/admin/act-as): that is stored
// server-side in their session only, `id`, `intraLogin`, `isAdmin` and
// `isStaff` stay their own.
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
    !!user && isStaffRole(user.role) && (!user.teamId || !user.npc);

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
  const isStaff = isStaffRole(user.role);
  const actingAs =
    isAdmin || (isStaff && isOwnVersion(user, session.secure?.actingAs))
      ? session.secure?.actingAs
      : undefined;

  if (actingAs?.role === "PLAYER" || actingAs?.role === "NPC") {
    return {
      id: user.id,
      intraLogin: user.intraLogin,
      isAdmin,
      isStaff,
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
    isStaff,
    actingAs,
    role: target.role,
    teamId: target.teamId,
    npcId: target.npc?.id ?? null,
  };
}

// Bocal only act as their own player and NPC versions: anything else (e.g.
// their team changed since they switched) shows them as themselves.
export function isOwnVersion(
  user: { teamId: string | null; npc: { id: string } | null },
  actingAs: ActingAs | undefined,
) {
  return (
    (actingAs?.role === "PLAYER" && actingAs.teamId === user.teamId) ||
    (actingAs?.role === "NPC" && actingAs.npcId === user.npc?.id)
  );
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
// For everything that changes the game.
export async function requireAdmin(event: H3Event) {
  const actor = await getActor(await requireUserSession(event));

  if (!actor?.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  return actor;
}

// Admins and bocal, for what only shows the game (and switching views).
export async function requireStaff(event: H3Event) {
  const actor = await getActor(await requireUserSession(event));

  if (!actor?.isStaff) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  return actor;
}
