// An NPC picks the name the players see (on their quests and in the journal).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["NPC"]);
  const npc = await findActorNpc(user);
  const body = await readBody<{ name?: unknown } | undefined>(event);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!npc) {
    throw createError({ statusCode: 403, statusMessage: "No NPC profile" });
  }

  if (!name || name.length > MAX_NAME_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: "Invalid name" });
  }

  await prisma.npc.update({ where: { id: npc.id }, data: { name } });
  return { name };
});
