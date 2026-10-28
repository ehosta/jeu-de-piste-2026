import type { ActingAs } from "#shared/types/auth";

// The session stores the role as it was at login, but it can change afterwards
// (e.g. a player promoted to NPC, or an admin acting as another role). The
// effective role is recomputed whenever the app fetches the session (on every
// page load), so the UI matches what `requireRole` enforces.
export default defineNitroPlugin(() => {
  sessionHooks.hook("fetch", async (session) => {
    const actor = await getActor(session);

    if (!session.user) {
      return;
    }

    // Not (or no longer) in the game: see /attente.
    if (!actor) {
      session.user.role = null;
      session.user.isAdmin = false;
      session.user.actingAs = null;
      session.user.actingAsLogin = null;
      return;
    }

    session.user.role = actor.role;
    session.user.isAdmin = actor.isAdmin;
    const acting = await describeActingAs(actor.actingAs);
    session.user.actingAs = acting?.label ?? null;
    session.user.actingAsLogin = acting?.login ?? null;
  });
});

async function describeActingAs(actingAs: ActingAs | undefined) {
  if (actingAs?.role === "PLAYER") {
    const team = await prisma.team.findUnique({
      where: { id: actingAs.teamId },
    });
    return { label: { kind: "player" as const, name: team?.name ?? null } };
  }

  if (actingAs?.role === "NPC") {
    const npc = await prisma.npc.findUnique({
      where: { id: actingAs.npcId },
      include: { user: { select: { intraLogin: true } } },
    });
    return {
      label: { kind: "npc" as const, name: npc?.name ?? null },
      login: npc?.user.intraLogin,
    };
  }

  if (actingAs?.role === "USER") {
    const user = await prisma.user.findUnique({ where: { id: actingAs.userId } });
    return {
      label: { kind: "account" as const, name: user?.intraLogin ?? null },
      login: user?.intraLogin,
    };
  }

  return null;
}
