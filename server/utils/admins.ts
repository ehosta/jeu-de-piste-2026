import type { Prisma } from "~~/prisma/generated/client";
import type { Role } from "~~/prisma/generated/enums";

type Tx = Prisma.TransactionClient;

// The logins in NUXT_ADMIN_LOGINS own the game: they are always in the
// database as ADMIN, whatever happens to it (reset, wipe, patch, demotion).
export function ownerLogins() {
  return useRuntimeConfig()
    .adminLogins.split(",")
    .map((login) => login.trim())
    .filter(Boolean);
}

export function isOwner(login: string) {
  return ownerLogins().includes(login);
}

// Puts an owner back as an admin, with their player and NPC versions.
export async function ensureOwner(login: string, tx: Tx = prisma) {
  const user = await tx.user.upsert({
    where: { intraLogin: login },
    create: { intraLogin: login, role: "ADMIN" },
    update: { role: "ADMIN" },
  });
  await tx.waitingUser.deleteMany({ where: { intraLogin: login } });
  await ensureAdminVersions(user, tx);
  return user;
}

// Admins and bocal both oversee the game (/admin), bocal without changing
// anything (see `requireAdmin`).
export const STAFF_ROLES = ["ADMIN", "BOCAL"] as const satisfies Role[];

export function isStaffRole(role: Role | null | undefined) {
  return role === "ADMIN" || role === "BOCAL";
}

// The teams staff without a team play in, apart from the real teams of the
// game (`sandbox`): one for the admins, one for the bocal.
export const ADMIN_TEAM_NAME = "Admins";
export const BOCAL_TEAM_NAME = "Bocal";

// Every admin and bocal member also has a player version (a team: the shared
// sandbox one of their role unless an admin put them in another) and an NPC
// version, to switch to from the dashboard switch. Whatever removes them
// (wipe, deletion), they come back.
export async function ensureAdminVersions(
  user: { id: string; intraLogin: string; role: Role; teamId: string | null },
  tx: Tx = prisma,
) {
  if (!user.teamId) {
    const baseName = user.role === "BOCAL" ? BOCAL_TEAM_NAME : ADMIN_TEAM_NAME;
    // A real team already named like it keeps its name.
    const existing = await tx.team.findUnique({ where: { name: baseName } });
    const name = existing && !existing.sandbox ? `${baseName} (sandbox)` : baseName;

    await tx.team.upsert({
      where: { name },
      create: { name, sandbox: true, members: { connect: { id: user.id } } },
      update: { members: { connect: { id: user.id } } },
    });
  }

  await tx.npc.upsert({
    where: { userId: user.id },
    create: { userId: user.id, name: `PNJ de ${user.intraLogin}`, lore: "" },
    update: {},
  });
}

export async function ensureAllAdminVersions(tx: Tx = prisma) {
  const staff = await tx.user.findMany({
    where: { role: { in: [...STAFF_ROLES] }, OR: [{ teamId: null }, { npc: null }] },
  });

  for (const user of staff) {
    await ensureAdminVersions(user, tx);
  }
}
