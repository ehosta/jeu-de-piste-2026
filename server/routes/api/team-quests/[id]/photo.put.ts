import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event);
  const teamQuest = await getTeamQuestOr404(event);

  if (!(await isTeamMember(user.id, teamQuest.teamId))) {
    throw createError({ statusCode: 403, statusMessage: "Not a member of this team" });
  }

  if (teamQuest.status === "HIDDEN" || teamQuest.status === "VALIDATED") {
    throw createError({ statusCode: 409, statusMessage: "Photo cannot be changed for this quest" });
  }

  const photo = (await readMultipartFormData(event))?.find(
    (field) => field.name === "photo",
  );
  const extension = photo?.type && EXTENSIONS[photo.type];

  if (!photo || !extension) {
    throw createError({ statusCode: 400, statusMessage: "Missing or unsupported photo" });
  }

  if (photo.data.length > MAX_PHOTO_SIZE) {
    throw createError({ statusCode: 413, statusMessage: "Photo too large" });
  }

  const key = `team-quests/${teamQuest.id}/${crypto.randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: s3Bucket,
      Key: key,
      Body: photo.data,
      ContentType: photo.type,
    }),
  );

  await prisma.teamQuest.update({
    where: { id: teamQuest.id },
    data: { photoPath: key },
  });

  if (teamQuest.photoPath) {
    await s3.send(
      new DeleteObjectCommand({ Bucket: s3Bucket, Key: teamQuest.photoPath }),
    );
  }

  return { photoPath: key };
});
