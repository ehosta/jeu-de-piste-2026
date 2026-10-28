import type { Prisma } from "~~/prisma/generated/client";

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

// The team admins without a team play in, apart from the real teams of the
// game (`sandbox`).
export const ADMIN_TEAM_NAME = "Admins";

// Every admin also has a player version (a team: the shared "Admins" one unless
// an admin put them in another) and an NPC version, to switch to from the
// dashboard switch. Whatever removes them (wipe, deletion), they come back.
export async function ensureAdminVersions(
  user: { id: string; intraLogin: string; teamId: string | null },
  tx: Tx = prisma,
) {
  if (!user.teamId) {
    // A real team already named "Admins" keeps its name.
    const existing = await tx.team.findUnique({ where: { name: ADMIN_TEAM_NAME } });
    const name = existing && !existing.sandbox ? `${ADMIN_TEAM_NAME} (sandbox)` : ADMIN_TEAM_NAME;

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
  const admins = await tx.user.findMany({
    where: { role: "ADMIN", OR: [{ teamId: null }, { npc: null }] },
  });

  for (const admin of admins) {
    await ensureAdminVersions(admin, tx);
  }
}
