import type { Role } from "~~/prisma/generated/enums";

// Who an admin is currently playing as, to test the game (see /admin): a
// player of a team, an NPC, or a given account (`USER`), seen exactly as that
// account sees the game.
export type ActingAs =
  | { role: "PLAYER"; teamId: string }
  | { role: "NPC"; npcId: string }
  | { role: "USER"; userId: string };

// What the banner shows while an admin acts as someone, translated by the
// client. `name` is null if the team, NPC or account was deleted meanwhile.
export interface ActingAsLabel {
  kind: "player" | "npc" | "account";
  name: string | null;
}

declare module "#auth-utils" {
  interface User {
    intraLogin: string;
    // Effective role: the admin's acting role while they impersonate one.
    // null for a 42 account no admin added to the game yet.
    role: Role | null;
    // Set when the session is fetched (server/plugins/session.ts). Staff (admins
    // and bocal) see /admin, only admins change anything.
    isAdmin?: boolean;
    isStaff?: boolean;
    actingAs?: ActingAsLabel | null;
    // Login of the account an admin is acting as, to manage it from the banner.
    actingAsLogin?: string | null;
  }

  interface SecureSessionData {
    actingAs?: ActingAs;
  }
}

export {};
