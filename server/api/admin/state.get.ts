// Everything the admin pages show: game state, accounts waiting to be added,
// users, teams with their progress, NPCs with their quests, and every quest
// with the NPCs giving it (a quest can be shared). Bocal see it all too, in
// read-only pages (`useCanEdit`).
export default defineEventHandler(async (event) => {
  const admin = await requireStaff(event);

  const [game, waiting, users, teams, npcs, quests] = await Promise.all([
    getGame(),
    prisma.waitingUser.findMany({ orderBy: { lastSeenAt: "desc" } }),
    prisma.user.findMany({
      orderBy: { intraLogin: "asc" },
      include: {
        team: { select: { name: true } },
        npc: { select: { name: true } },
      },
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        members: { select: { intraLogin: true }, orderBy: { intraLogin: "asc" } },
        quests: {
          select: {
            status: true,
            photoPath: true,
            submittedAt: true,
            validatedAt: true,
            submittedBy: { select: { intraLogin: true } },
            validatedBy: { select: { name: true } },
            quest: { select: { key: true } },
          },
        },
      },
    }),
    prisma.npc.findMany({
      orderBy: { name: "asc" },
      include: {
        user: { select: { intraLogin: true } },
        quests: {
          orderBy: { key: "asc" },
          include: {
            npcs: {
              select: { id: true, name: true, user: { select: { intraLogin: true } } },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    }),
    prisma.quest.findMany({
      orderBy: { key: "asc" },
      include: { npcs: { select: { name: true }, orderBy: { name: "asc" } } },
    }),
  ]);

  // Accounts added since they logged in are no longer waiting.
  const known = new Set(users.map((user) => user.intraLogin));

  return {
    me: admin.intraLogin,
    actingAs: admin.actingAs ?? null,
    game: {
      phase: game.phase,
      paused: game.paused,
      pauseMessage: game.pauseMessage,
    },
    waiting: waiting
      .filter((user) => !known.has(user.intraLogin))
      .map((user) => ({
        login: user.intraLogin,
        lastSeenAt: user.lastSeenAt,
      })),
    users: users.map((user) => ({
      id: user.id,
      login: user.intraLogin,
      role: user.role,
      // In NUXT_ADMIN_LOGINS: always admin, can't be deleted.
      owner: isOwner(user.intraLogin),
      team: user.team?.name ?? null,
      // Admins and bocal can also be an NPC.
      npc: user.npc?.name ?? null,
      lastLoginAt: user.lastLoginAt,
    })),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      createdAt: team.createdAt,
      // An admin's or bocal's player version, not a team of the game.
      sandbox: team.sandbox,
      members: team.members.map((member) => member.intraLogin),
      progress: Object.fromEntries(
        team.quests.map((teamQuest) => [
          teamQuest.quest.key,
          {
            status: teamQuest.status,
            photoPath: teamQuest.photoPath,
            // For the photo review (/admin/photos).
            submittedBy: teamQuest.submittedBy?.intraLogin ?? null,
            submittedAt: teamQuest.submittedAt,
            validatedBy: teamQuest.validatedBy?.name ?? null,
            validatedAt: teamQuest.validatedAt,
          },
        ]),
      ),
    })),
    npcs: npcs.map((npc) => ({
      id: npc.id,
      login: npc.user.intraLogin,
      name: npc.name,
      lore: npc.lore,
      quests: npc.quests.map((quest) => ({
        key: quest.key,
        label: quest.label,
        answer: quest.answer,
        difficulty: quest.difficulty,
        // The other NPCs giving this quest.
        sharedWith: quest.npcs
          .filter((other) => other.id !== npc.id)
          .map((other) => ({ login: other.user.intraLogin, name: other.name })),
      })),
    })),
    quests: quests.map((quest) => ({
      key: quest.key,
      label: quest.label,
      difficulty: quest.difficulty,
      npcs: quest.npcs.map((npc) => npc.name),
    })),
  };
});
