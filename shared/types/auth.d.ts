import type { Role } from "~~/prisma/generated/enums";

// Who an admin is currently playing as, to test the game (see /admin).
export type ActingAs =
  | { role: "PLAYER"; teamId: string }
  | { role: "NPC"; npcId: string };

declare module "#auth-utils" {
  interface User {
    id: string;
    intraLogin: string;
    // Effective role: the admin's acting role while they impersonate one.
    role: Role;
    // Set when the session is fetched (server/plugins/session.ts).
    isAdmin?: boolean;
    actingAs?: string | null;
  }

  interface SecureSessionData {
    actingAs?: ActingAs;
  }
}

export {};
