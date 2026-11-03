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

// The game's own notification (not an admin's), for each team that has
// reached Game.secretThreshold: it can now ask an NPC for the secret quest.
// Kept in step with the points and the threshold: sent once a team reaches it
// (after a validation, or the threshold lowered), taken down if it falls back
// under (threshold raised, validation undone) or once it validated a secret
// quest. Only `teamId` is checked when given; nothing if the game has no
// secret quest.
export async function syncSecretNotifications(teamId?: string) {
  const [{ leaderboard, finalRace }, { secretThreshold }, secretCount, sent] =
    await Promise.all([
      computeScores({ includeSandbox: true }),
      getGame(),
      prisma.quest.count({ where: { secret: true } }),
      prisma.notification.findMany({
        where: { sentBy: GAME_SENDER, audience: "TEAM", teamId },
        select: { id: true, teamId: true },
      }),
    ]);

  const finished = new Set(finalRace.map((entry) => entry.teamId));
  // Open from the start (threshold 0): nothing to announce.
  const due = new Set(
    secretCount && secretThreshold > 0
      ? leaderboard
          .filter(
            (entry) =>
              (!teamId || entry.teamId === teamId) &&
              !finished.has(entry.teamId) &&
              hasSecretAccess(entry.points, secretThreshold),
          )
          .map((entry) => entry.teamId)
      : [],
  );
  const notified = new Set(sent.map((notification) => notification.teamId));
  const stale = sent.filter((notification) => !due.has(notification.teamId!));
  const missing = [...due].filter((id) => !notified.has(id));

  if (!stale.length && !missing.length) {
    return;
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: { id: { in: stale.map((notification) => notification.id) } },
    }),
    prisma.notification.createMany({
      data: missing.map((id) => ({
        message: SECRET_UNLOCKED_MESSAGE,
        audience: "TEAM" as const,
        teamId: id,
        urgent: true,
        sentBy: GAME_SENDER,
      })),
    }),
  ]);

  publishNotifications();
}

// In the admins' list of notifications, instead of a 42 login.
export const GAME_SENDER = "jeu";

const SECRET_UNLOCKED_MESSAGE =
  "Vous avez assez d'exp pour l'objectif final ! Trouvez un PNJ : il peut maintenant vous confier la quête secrète. Le premier groupe à la valider remporte la course finale.";
