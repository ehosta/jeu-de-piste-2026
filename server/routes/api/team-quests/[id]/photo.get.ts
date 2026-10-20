import { GetObjectCommand } from "@aws-sdk/client-s3";

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const teamQuest = await getTeamQuestOr404(event);

  const canView =
    user.role === "ADMIN" ||
    teamQuest.quest.npc.userId === user.id ||
    (await isTeamMember(user.id, teamQuest.teamId));

  if (!canView) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  if (!teamQuest.photoPath) {
    throw createError({ statusCode: 404, statusMessage: "No photo yet" });
  }

  const object = await s3.send(
    new GetObjectCommand({ Bucket: s3Bucket, Key: teamQuest.photoPath }),
  );

  if (!object.Body) {
    throw createError({ statusCode: 404, statusMessage: "Photo not found" });
  }

  setResponseHeaders(event, {
    "Content-Type": object.ContentType ?? "application/octet-stream",
    // The URL stays the same when the photo is replaced, so always revalidate
    "Cache-Control": "private, no-cache",
    ...(object.ETag && { ETag: object.ETag }),
  });

  return object.Body.transformToWebStream();
});
