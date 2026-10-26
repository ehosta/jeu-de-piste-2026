import type { TeamQuestStatus } from "~~/prisma/generated/enums";

export type QuestAction = "GIVE" | "VALIDATE" | "REJECT";

// What the NPC owning a quest may do after scanning a team, depending on
// where that team stands on the quest. A team with no TeamQuest row yet is
// considered HIDDEN.
const ACTIONS_BY_STATUS: Record<TeamQuestStatus, QuestAction[]> = {
  HIDDEN: ["GIVE"],
  GIVEN: [],
  SUBMITTED: ["VALIDATE", "REJECT"],
  VALIDATED: [],
  REJECTED: [],
};

// Status a TeamQuest moves to once an action is applied, and the timestamp
// recording when it happened.
export const QUEST_ACTION_RESULTS = {
  GIVE: { status: "GIVEN", dateField: "givenAt" },
  VALIDATE: { status: "VALIDATED", dateField: "validatedAt" },
  REJECT: { status: "REJECTED", dateField: "rejectedAt" },
} as const satisfies Record<
  QuestAction,
  { status: TeamQuestStatus; dateField: string }
>;

export function getAllowedQuestActions(status: TeamQuestStatus): QuestAction[] {
  return ACTIONS_BY_STATUS[status];
}

export function isQuestAction(value: unknown): value is QuestAction {
  return typeof value === "string" && Object.hasOwn(QUEST_ACTION_RESULTS, value);
}

// A team can send (or retake) its photo once given the quest, until the NPC
// validates it: the photo is then locked.
export const PHOTO_STATUSES: TeamQuestStatus[] = ["GIVEN", "SUBMITTED", "REJECTED"];

export function canSubmitPhoto(status: TeamQuestStatus) {
  return PHOTO_STATUSES.includes(status);
}
