import type { NotificationAudience } from "~~/prisma/generated/enums";
import { isUuid } from "./uuid";

// Admin messages pushed to the players' and NPCs' screens (/admin/notifications).
export const MAX_NOTIFICATION_LENGTH = 300;

export const NOTIFICATION_AUDIENCES: NotificationAudience[] = ["ALL", "PLAYERS", "NPCS", "TEAM"];

// How long a notification stays up, in minutes. Null: until an admin takes it
// down.
export const NOTIFICATION_DURATIONS = [null, 5, 15, 30, 60, 120] as const;

export type NotificationDuration = (typeof NOTIFICATION_DURATIONS)[number];

export interface NotificationInput {
  message: string;
  audience: NotificationAudience;
  teamId: string | null;
  urgent: boolean;
  duration: NotificationDuration;
}

export type NotificationInputIssue =
  | "messageRequired"
  | "messageTooLong"
  | "invalidAudience"
  | "teamRequired"
  | "invalidDuration";

// Checks the body of POST /api/admin/notifications. The client uses it too, to
// disable sending until the form is valid.
export function parseNotificationInput(
  body: unknown,
): { ok: true; value: NotificationInput } | { ok: false; issue: NotificationInputIssue } {
  const input = (body ?? {}) as Record<string, unknown>;
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const audience = input.audience as NotificationAudience;
  const duration = (input.duration ?? null) as NotificationDuration;

  if (!message) {
    return { ok: false, issue: "messageRequired" };
  }

  if (message.length > MAX_NOTIFICATION_LENGTH) {
    return { ok: false, issue: "messageTooLong" };
  }

  if (!NOTIFICATION_AUDIENCES.includes(audience)) {
    return { ok: false, issue: "invalidAudience" };
  }

  const teamId = audience === "TEAM" ? input.teamId : null;

  if (audience === "TEAM" && !isUuid(teamId)) {
    return { ok: false, issue: "teamRequired" };
  }

  if (!NOTIFICATION_DURATIONS.includes(duration)) {
    return { ok: false, issue: "invalidDuration" };
  }

  return {
    ok: true,
    value: {
      message,
      audience,
      teamId: (teamId as string | null) ?? null,
      urgent: input.urgent === true,
      duration,
    },
  };
}
