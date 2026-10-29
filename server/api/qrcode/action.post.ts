// Applies an NPC action (give / validate / reject) to one of their quests (own
// or shared with other NPCs) for
// the scanned team. The status is re-checked here, so a stale screen or a
// double tap can't e.g. reject an already validated (locked) quest. Reviews
// also send the photo the NPC looked at, so a photo withdrawn or retaken in
// the meantime can't be validated unseen.
export default defineEventHandler(async (event) => {
  const npc = await requireNpc(event);
  const body = await readBody<
    | { token?: unknown; questId?: unknown; action?: unknown; photoPath?: unknown }
    | undefined
  >(event);
  const team = await findTeamByQrToken(body?.token);
  const questId = body?.questId;
  const action = body?.action;

  if (!isUuid(questId) || !isQuestAction(action)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid action" });
  }

  const quest = await prisma.quest.findFirst({
    where: { id: questId, npcs: { some: { id: npc.id } } },
  });

  if (!quest) {
    throw createError({ statusCode: 404, statusMessage: "Quest not found" });
  }

  const teamQuest = await prisma.teamQuest.findUnique({
    where: { teamId_questId: { teamId: team.id, questId: quest.id } },
  });
  const status = teamQuest?.status ?? "HIDDEN";

  const notAllowed = createError({
    statusCode: 409,
    statusMessage: "Action not allowed",
  });

  if (!getAllowedQuestActions(status).includes(action)) {
    throw notAllowed;
  }

  if (action !== "GIVE" && body?.photoPath !== teamQuest?.photoPath) {
    throw notAllowed;
  }

  const { status: nextStatus, dateField, npcField } = QUEST_ACTION_RESULTS[action];
  // A shared quest remembers which of its NPCs gave and validated it.
  const data = {
    status: nextStatus,
    [dateField]: new Date(),
    ...(npcField && { [npcField]: npc.id }),
  };

  // Both writes only apply if the status and photo are still the ones checked
  // above.
  const { count } = teamQuest
    ? await prisma.teamQuest.updateMany({
        where: { id: teamQuest.id, status, photoPath: teamQuest.photoPath },
        data,
      })
    : await prisma.teamQuest.createMany({
        data: { teamId: team.id, questId: quest.id, ...data },
        skipDuplicates: true,
      });

  if (!count) {
    throw notAllowed;
  }

  await publishTeamQuestChange(team.id, quest.id, {
    scores: action === "VALIDATE",
  });

  return { status: nextStatus };
});
