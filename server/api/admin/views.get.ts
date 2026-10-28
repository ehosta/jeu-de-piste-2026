// What the dashboard switch in the header offers: the admin view, the admin's
// own team and NPC, a player of each team, each NPC and each account, with
// the one this session currently shows. Bocal only get their own team and NPC.
export default defineEventHandler(async (event) => {
  const admin = await requireStaff(event);
  const others = admin.isAdmin ? undefined : { take: 0 };

  const [me, teams, npcs, users] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      include: { team: true, npc: true },
    }),
    prisma.team.findMany({
      ...others,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.npc.findMany({
      ...others,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      ...others,
      where: { id: { not: admin.id } },
      orderBy: { intraLogin: "asc" },
      select: { id: true, intraLogin: true, role: true },
    }),
  ]);

  const actingAs = admin.actingAs;

  return {
    current: !actingAs
      ? "ADMIN"
      : actingAs.role === "PLAYER"
        ? `PLAYER:${actingAs.teamId}`
        : actingAs.role === "NPC"
          ? `NPC:${actingAs.npcId}`
          : `USER:${actingAs.userId}`,
    me: {
      team: me.team && { id: me.team.id, name: me.team.name },
      npc: me.npc && { id: me.npc.id, name: me.npc.name },
    },
    teams,
    npcs,
    users: users.map((user) => ({
      id: user.id,
      login: user.intraLogin,
      role: user.role,
    })),
  };
});
