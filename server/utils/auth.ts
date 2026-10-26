import type { H3Event } from "h3";
import type { UserSession } from "#auth-utils";
import type { Role } from "../../prisma/generated/enums";

// Roles can change after login (e.g. a player promoted to NPC), so the user is
// reloaded from the database instead of trusting the role stored in the session.
// An admin can also act as a player of any team or as any NPC to test the game:
// that is stored server-side in their session only, their real role stays ADMIN.
export async function getActor(session: UserSession) {
  if (!session.user) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "ADMIN";
  const actingAs = isAdmin ? session.secure?.actingAs : undefined;

  return {
    id: user.id,
    intraLogin: user.intraLogin,
    isAdmin,
    actingAs,
    role: actingAs?.role ?? user.role,
    teamId: actingAs
      ? actingAs.role === "PLAYER"
        ? actingAs.teamId
        : null
      : user.teamId,
    npcId: actingAs?.role === "NPC" ? actingAs.npcId : null,
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
