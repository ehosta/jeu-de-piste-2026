import type { UserSession } from "#auth-utils";
import type { Prisma } from "~~/prisma/generated/client";

// Not expired yet (or no expiry: until an admin takes it down).
export function activeNotificationsWhere(): Prisma.NotificationWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}

// The notifications an account sees, from its effective role like
// `requireRole`: an admin acting as a player sees the players' ones. Admins,
// bocal (as themselves) and accounts waiting on /attente only see the ones
// sent to everyone.
export async function notificationsWhereFor(
  session: UserSession,
): Promise<Prisma.NotificationWhereInput> {
  const actor = await getActor(session);
  const audiences: Prisma.NotificationWhereInput[] = [{ audience: "ALL" }];

  if (actor?.role === "PLAYER") {
    audiences.push({ audience: "PLAYERS" });

    if (actor.teamId) {
      audiences.push({ audience: "TEAM", teamId: actor.teamId });
    }
  }

  if (actor?.role === "NPC") {
    audiences.push({ audience: "NPCS" });
  }

  return { AND: [activeNotificationsWhere(), { OR: audiences }] };
}

// Every browser refetches its notifications: sending one shows it, taking one
// down removes it from the screens.
export function publishNotifications() {
  publish(
    { to: ALL_TOPIC, events: ["notifications"] },
    { to: STAFF_TOPIC, events: ["admin"] },
  );
}
