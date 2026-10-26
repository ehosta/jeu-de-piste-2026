import type { TeamQuestStatus } from "~~/prisma/generated/enums";

const STATUS_DATE_FIELDS = {
  HIDDEN: null,
  GIVEN: "givenAt",
  SUBMITTED: "submittedAt",
  VALIDATED: "validatedAt",
  REJECTED: "rejectedAt",
} as const satisfies Record<TeamQuestStatus, string | null>;

function isTeamQuestStatus(value: unknown): value is TeamQuestStatus {
  return typeof value === "string" && Object.hasOwn(STATUS_DATE_FIELDS, value);
}

// Forces a team's status on a quest, e.g. to simulate a photo submission
// (SUBMITTED) or to replay a quest from the start (HIDDEN).
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody<
    { teamId?: unknown; questId?: unknown; status?: unknown } | undefined
  >(event);
  const { teamId, questId, status } = body ?? {};

  if (!isUuid(teamId) || !isUuid(questId) || !isTeamQuestStatus(status)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid status" });
  }

  const where = { teamId_questId: { teamId, questId } };

  if (status === "HIDDEN") {
    const teamQuest = await prisma.teamQuest.findUnique({ where });

    if (teamQuest) {
      await prisma.teamQuest.delete({ where });
      await deletePhoto(teamQuest.photoPath);
    }

    return { status };
  }

  const dateField = STATUS_DATE_FIELDS[status];
  const data = { status, [dateField]: new Date() };

  await prisma.teamQuest.upsert({
    where,
    update: data,
    create: { teamId, questId, ...data },
  });

  return { status };
});
