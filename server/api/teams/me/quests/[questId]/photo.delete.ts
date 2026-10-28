// Any member of a team withdraws the photo waiting for the NPC's review, e.g.
// to retake a wrong one: the quest is back to GIVEN.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER"]);
  await requireGameRunning(user);
  const questId = getRouterParam(event, "questId");

  const teamQuest =
    user.teamId && isUuid(questId)
      ? await prisma.teamQuest.findUnique({
          where: { teamId_questId: { teamId: user.teamId, questId } },
        })
      : null;

  if (!teamQuest || teamQuest.status === "HIDDEN") {
    throw createError({ statusCode: 404, statusMessage: "Quest not found" });
  }

  const notPending = createError({
    statusCode: 409,
    statusMessage: "No photo pending",
  });

  if (!canWithdrawPhoto(teamQuest.status)) {
    throw notPending;
  }

  // Only applies if the NPC hasn't reviewed this photo in the meantime.
  const { count } = await prisma.teamQuest.updateMany({
    where: {
      id: teamQuest.id,
      status: "SUBMITTED",
      photoPath: teamQuest.photoPath,
    },
    data: {
      status: "GIVEN",
      photoPath: null,
      submittedAt: null,
      submittedById: null,
    },
  });

  if (!count) {
    throw notPending;
  }

  await deletePhoto(teamQuest.photoPath);
  return { status: "GIVEN" as const };
});
