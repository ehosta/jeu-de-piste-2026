import type { AdminPatch } from "#shared/utils/admin-patch";

// The current game data as an admin patch: applied to an empty database, it
// recreates it. Edit it and send it back through the JSON import. The admins'
// team is left out: it is created again for admins without a team.
export default defineEventHandler(async (event): Promise<AdminPatch> => {
  await requireAdmin(event);

  const [game, users, teams, npcs, quests, progress] = await Promise.all([
    getGame(),
    prisma.user.findMany({
      // NPC accounts are created from `npcs`, admins stay in `users`.
      where: { OR: [{ npc: null }, { role: { not: "NPC" } }] },
      orderBy: { intraLogin: "asc" },
      include: { team: { select: { name: true, sandbox: true } } },
    }),
    prisma.team.findMany({ where: { sandbox: false }, orderBy: { name: "asc" } }),
    prisma.npc.findMany({
      orderBy: { name: "asc" },
      include: { user: { select: { intraLogin: true } } },
    }),
    // Listed apart from the NPCs, since a quest can be shared between them.
    prisma.quest.findMany({
      orderBy: { key: "asc" },
      include: {
        npcs: { select: { user: { select: { intraLogin: true } } } },
      },
    }),
    prisma.teamQuest.findMany({
      where: { team: { sandbox: false } },
      orderBy: [{ team: { name: "asc" } }, { quest: { key: "asc" } }],
      include: {
        team: { select: { name: true } },
        quest: { select: { key: true } },
      },
    }),
  ]);

  return {
    game: { paused: game.paused, pauseMessage: game.pauseMessage },
    teams: teams.map((team) => ({ name: team.name })),
    users: users.map((user) =>
      user.role !== "NPC"
        ? {
            login: user.intraLogin,
            role: user.role,
            team: user.team?.sandbox ? null : (user.team?.name ?? null),
          }
        : { login: user.intraLogin, role: user.role },
    ),
    npcs: npcs.map((npc) => ({
      login: npc.user.intraLogin,
      name: npc.name,
      lore: npc.lore,
    })),
    quests: quests.map((quest) => ({
      key: quest.key,
      npcs: quest.npcs.map((npc) => npc.user.intraLogin).sort(),
      label: quest.label,
      answer: quest.answer,
      difficulty: quest.difficulty,
    })),
    progress: progress.map((teamQuest) => ({
      team: teamQuest.team.name,
      quest: teamQuest.quest.key,
      status: teamQuest.status,
    })),
  };
});
