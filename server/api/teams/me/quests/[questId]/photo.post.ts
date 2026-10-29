// Any member of a team sends its photo for a quest it was given (or whose photo
// the NPC rejected). The quest then waits for the NPC's review, and nobody in
// the team can send another photo meanwhile (they can withdraw it, see
// photo.delete.ts). Once validated, the photo is locked.
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

  // The client tells the two apart by statusMessage.
  const conflict = (status: string) =>
    createError({
      statusCode: 409,
      statusMessage: status === "SUBMITTED" ? "Photo pending" : "Photo locked",
    });

  if (!canSubmitPhoto(teamQuest.status)) {
    throw conflict(teamQuest.status);
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

  // Only applies if no teammate sent a photo in the meantime: with two uploads
  // at once, the first one wins.
  const { count } = await prisma.teamQuest.updateMany({
    where: { id: teamQuest.id, status: teamQuest.status },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      submittedById: user.id,
      photoPath,
    },
  });

  if (!count) {
    await deletePhoto(photoPath);
    const current = await prisma.teamQuest.findUnique({
      where: { id: teamQuest.id },
    });
    throw conflict(current?.status ?? "VALIDATED");
  }

  await deletePhoto(teamQuest.photoPath);
  await publishTeamQuestChange(teamQuest.teamId, teamQuest.questId);

  return { status: "SUBMITTED" as const, photoPath };
});
