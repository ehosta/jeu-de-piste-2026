import type { Role, TeamQuestStatus } from "~~/prisma/generated/enums";

// How a team's status on a quest is colored everywhere in the app. Labels are
// translated (`questStatus.*` and `roles.*` in app/i18n).
export const QUEST_STATUS_TONES = {
  HIDDEN: "",
  GIVEN: "info",
  SUBMITTED: "warning",
  VALIDATED: "success",
  REJECTED: "danger",
  BLOCKED: "danger",
} as const satisfies Record<TeamQuestStatus, string>;

export const QUEST_STATUSES = Object.keys(QUEST_STATUS_TONES) as TeamQuestStatus[];

export const ROLES_ORDER: Role[] = ["ADMIN", "BOCAL", "NPC", "PLAYER"];
