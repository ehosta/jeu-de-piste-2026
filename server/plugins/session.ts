import type { ActingAs } from "#shared/types/auth";

// The session stores the role as it was at login, but it can change afterwards
// (e.g. a player promoted to NPC, or an admin acting as another role). The
// effective role is recomputed whenever the app fetches the session (on every
// page load), so the UI matches what `requireRole` enforces.
export default defineNitroPlugin(() => {
  sessionHooks.hook("fetch", async (session) => {
    const actor = await getActor(session);

    if (!actor || !session.user) {
      return;
    }

    session.user.role = actor.role;
    session.user.isAdmin = actor.isAdmin;
    session.user.actingAs = await describeActingAs(actor.actingAs);
  });
});

async function describeActingAs(actingAs: ActingAs | undefined) {
  if (actingAs?.role === "PLAYER") {
    const team = await prisma.team.findUnique({
      where: { id: actingAs.teamId },
    });
    return `Joueur · ${team?.name ?? "groupe supprimé"}`;
  }

  if (actingAs?.role === "NPC") {
    const npc = await prisma.npc.findUnique({ where: { id: actingAs.npcId } });
    return `PNJ · ${npc?.name ?? "PNJ supprimé"}`;
  }

  return null;
}
