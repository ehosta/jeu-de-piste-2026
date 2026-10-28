import type { TeamQuestStatus } from "~~/prisma/generated/enums";

export type QuestAction = "GIVE" | "VALIDATE" | "REJECT";

// What an NPC giving a quest may do after scanning a team, depending on
// where that team stands on the quest. A team with no TeamQuest row yet is
// considered HIDDEN.
const ACTIONS_BY_STATUS: Record<TeamQuestStatus, QuestAction[]> = {
  HIDDEN: ["GIVE"],
  GIVEN: [],
  SUBMITTED: ["VALIDATE", "REJECT"],
  VALIDATED: [],
  REJECTED: [],
};

// Status a TeamQuest moves to once an action is applied, the timestamp
// recording when it happened and, for a quest shared between NPCs, the field
// recording which NPC did it.
export const QUEST_ACTION_RESULTS = {
  GIVE: { status: "GIVEN", dateField: "givenAt", npcField: "givenById" },
  VALIDATE: { status: "VALIDATED", dateField: "validatedAt", npcField: "validatedById" },
  REJECT: { status: "REJECTED", dateField: "rejectedAt", npcField: null },
} as const satisfies Record<
  QuestAction,
  { status: TeamQuestStatus; dateField: string; npcField: string | null }
>;

// Timestamp recording when a team reached each status (none for HIDDEN, which
// has no TeamQuest row).
export const STATUS_DATE_FIELDS = {
  HIDDEN: null,
  GIVEN: "givenAt",
  SUBMITTED: "submittedAt",
  VALIDATED: "validatedAt",
  REJECTED: "rejectedAt",
} as const satisfies Record<TeamQuestStatus, string | null>;

export function getAllowedQuestActions(status: TeamQuestStatus): QuestAction[] {
  return ACTIONS_BY_STATUS[status];
}

export function isQuestAction(value: unknown): value is QuestAction {
  return typeof value === "string" && Object.hasOwn(QUEST_ACTION_RESULTS, value);
}

// Any member of a team can send its photo once given the quest, or after the
// NPC rejected it. Only one photo is under review at a time: while SUBMITTED,
// nobody can send another, but a member can withdraw it to retake it. Once
// VALIDATED, the photo is locked.
export const PHOTO_STATUSES: TeamQuestStatus[] = ["GIVEN", "REJECTED"];

export function canSubmitPhoto(status: TeamQuestStatus) {
  return PHOTO_STATUSES.includes(status);
}

export function canWithdrawPhoto(status: TeamQuestStatus) {
  return status === "SUBMITTED";
}
