// Creates a test team and a test NPC with a few quests, so the whole flow can
// be tried before the real data is imported. Safe to call more than once.
const TEST_TEAM_NAME = "Les Testeurs";
// Not a valid 42 login, so it can't clash with a real user.
const TEST_NPC_LOGIN = "_test-npc";
const TEST_QUESTS = [
  { label: "La cantine à 8 euros", answer: "Cantine" },
  { label: "Le coin des machines à café", answer: "Machines à café" },
];

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  await prisma.team.upsert({
    where: { name: TEST_TEAM_NAME },
    update: {},
    create: { name: TEST_TEAM_NAME },
  });

  const npcUser = await prisma.user.upsert({
    where: { intraLogin: TEST_NPC_LOGIN },
    update: {},
    create: { intraLogin: TEST_NPC_LOGIN, role: "NPC" },
  });

  const npc = await prisma.npc.findUnique({ where: { userId: npcUser.id } });

  if (!npc) {
    await prisma.npc.create({
      data: {
        userId: npcUser.id,
        name: "PNJ de test",
        lore: "Un PNJ qui n'existe que pour tester le jeu.",
        quests: { create: TEST_QUESTS },
      },
    });
  }

  return { ok: true };
});
