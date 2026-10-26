// A player sends (or retakes) their team's photo for a quest they were given.
// The quest then waits for the NPC's review, until it is validated and locked.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["PLAYER"]);
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

  const locked = createError({ statusCode: 409, statusMessage: "Photo locked" });

  if (!canSubmitPhoto(teamQuest.status)) {
    throw locked;
  }

  const tooLarge = createError({
    statusCode: 413,
    statusMessage: "Photo too large",
  });

  if (Number(getRequestHeader(event, "content-length")) > MAX_PHOTO_BYTES) {
    throw tooLarge;
  }

  const form = await readMultipartFormData(event);
  const file = form?.find((part) => part.name === "photo");

  if (!file?.data.length) {
    throw createError({ statusCode: 400, statusMessage: "Missing photo" });
  }

  if (file.data.length > MAX_PHOTO_BYTES) {
    throw tooLarge;
  }

  const extension = detectImageExtension(file.data);

  if (!extension) {
    throw createError({
      statusCode: 415,
      statusMessage: "Unsupported image",
    });
  }

  const photoPath = await savePhoto(teamQuest.id, file.data, extension);

  // Only applies if the NPC hasn't validated the quest in the meantime.
  const { count } = await prisma.teamQuest.updateMany({
    where: { id: teamQuest.id, status: { in: PHOTO_STATUSES } },
    data: { status: "SUBMITTED", submittedAt: new Date(), photoPath },
  });

  if (!count) {
    await deletePhoto(photoPath);
    throw locked;
  }

  await deletePhoto(teamQuest.photoPath);

  return { status: "SUBMITTED" as const, photoPath };
});
