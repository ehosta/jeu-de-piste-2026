import type {
  GamePhase,
  Role,
  TeamQuestStatus,
} from "~~/prisma/generated/enums";
import { MAX_DIFFICULTY, MIN_DIFFICULTY } from "./scoring";

// An admin patch describes changes to the game data in one JSON document, a bit
// like the body of a giant PATCH request: every entry is matched by a readable
// key (42 login, team name, quest key) and only the fields it sets change.
// Missing entries are created, `"$delete": true` removes one, and `wipe` clears
// whole collections first. The same format is used by the admin pages, the JSON
// import and the export, and is applied in a single transaction
// (server/utils/admin-patch.ts). Documented in docs/ADMIN.md.

export const WIPE_TARGETS = [
  "progress",
  "quests",
  "npcs",
  "teams",
  "players",
] as const;

export type WipeTarget = (typeof WIPE_TARGETS)[number];

export const ROLES = ["ADMIN", "NPC", "PLAYER"] as const satisfies Role[];

export const GAME_PHASES = ["WAITING", "RUNNING"] as const satisfies GamePhase[];

export const TEAM_QUEST_STATUSES = [
  "HIDDEN",
  "GIVEN",
  "SUBMITTED",
  "VALIDATED",
  "REJECTED",
] as const satisfies TeamQuestStatus[];

export interface GamePatch {
  // Back to WAITING, the 42 accounts kept out join as players.
  phase?: GamePhase;
  paused?: boolean;
  pauseMessage?: string | null;
}

export type TeamPatch =
  | { name: string; $delete: true }
  | {
      name: string;
      rename?: string;
      // Logins put in this team (created as players if unknown). Other members
      // stay: remove one with `{ "login": …, "team": null }` in `users`.
      members?: string[];
      // Issues a new QR code, e.g. if a team's code leaked.
      newQrCode?: boolean;
    };

export type UserPatch =
  | { login: string; $delete: true }
  | { login: string; role?: Role; team?: string | null };

export interface QuestFields {
  rename?: string;
  label?: string;
  answer?: string;
  // From MIN_DIFFICULTY to MAX_DIFFICULTY (shared/utils/scoring.ts).
  difficulty?: number;
}

// Listed under an NPC, a quest is created or updated and given to this NPC
// too (it keeps its other NPCs). `"$delete": true` only takes it from this NPC:
// a quest left without NPC is deleted.
export type NpcQuestPatch =
  | { key: string; $delete: true }
  | ({ key: string } & QuestFields);

export type NpcPatch =
  | { login: string; $delete: true }
  | { login: string; name?: string; lore?: string; quests?: NpcQuestPatch[] };

// `npcs` replaces the logins of the NPCs who give the quest (one or more: a
// quest can be shared between NPCs).
export type QuestPatch =
  | { key: string; $delete: true }
  | ({ key: string; npcs?: string[] } & QuestFields);

export interface ProgressPatch {
  team: string;
  quest: string;
  status: TeamQuestStatus;
}

export interface AdminPatch {
  wipe?: WipeTarget[];
  game?: GamePatch;
  teams?: TeamPatch[];
  users?: UserPatch[];
  npcs?: NpcPatch[];
  quests?: QuestPatch[];
  progress?: ProgressPatch[];
}

// Issues are codes with parameters, translated by the client (`patch.<code>`
// in app/i18n).
export type PatchIssueCode =
  | "unknownField"
  | "loginExpected"
  | "loginInvalid"
  | "textExpected"
  | "empty"
  | "tooLong"
  | "questKeyInvalid"
  | "unknownRole"
  | "unknownStatus"
  | "unknownPhase"
  | "unknownWipeTarget"
  | "booleanExpected"
  | "listExpected"
  | "objectExpected"
  | "duplicate"
  | "deleteTrueOnly"
  | "loginListExpected"
  | "documentObject"
  | "invalidJson"
  | "unknownTeam"
  | "teamExists"
  | "cannotDeleteSelf"
  | "ownerCannotBeDeleted"
  | "cannotDemoteSelf"
  | "ownerStaysAdmin"
  | "npcHasNoTeam"
  | "npcNameRequired"
  | "questExists"
  | "notAnNpc"
  | "newQuestFields"
  | "unknownQuest"
  | "difficultyInvalid";

export type PatchIssueParams = Record<string, string | number>;

export interface PatchIssue {
  path: string;
  code: PatchIssueCode;
  params?: PatchIssueParams;
}

export type ParsedPatch =
  | { ok: true; patch: AdminPatch }
  | { ok: false; issues: PatchIssue[] };

// 42 logins, lowercase (see parseIntraLogin).
const LOGIN_REGEX = /^[a-z0-9-]{1,32}$/;
// Quest keys: short, lowercase, URL-safe, e.g. "cantine" or "afk-2".
export const QUEST_KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// Team and NPC names.
export const MAX_NAME_LENGTH = 80;
const MAX_TEXT_LENGTH = 4000;

const TOP_LEVEL_KEYS = [
  "$schema",
  "wipe",
  "game",
  "teams",
  "users",
  "npcs",
  "quests",
  "progress",
];

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown) {
  return JSON.stringify(value) ?? String(value);
}

// Collects every problem in the document instead of stopping at the first one,
// so a large import can be fixed in one go.
class Parser {
  issues: PatchIssue[] = [];

  issue(path: string, code: PatchIssueCode, params?: PatchIssueParams) {
    this.issues.push({ path, code, params });
  }

  keys(raw: Raw, path: string, allowed: string[]) {
    for (const key of Object.keys(raw)) {
      if (!allowed.includes(key)) {
        this.issue(
          path ? `${path}.${key}` : key,
          "unknownField",
          { expected: allowed.join(", ") },
        );
      }
    }
  }

  login(value: unknown, path: string) {
    if (typeof value !== "string") {
      this.issue(path, "loginExpected");
      return undefined;
    }

    const login = value.trim().toLowerCase();

    if (!LOGIN_REGEX.test(login)) {
      this.issue(path, "loginInvalid", { value: describe(value) });
      return undefined;
    }

    return login;
  }

  logins(value: unknown, path: string) {
    if (!Array.isArray(value)) {
      this.issue(path, "loginListExpected");
      return undefined;
    }

    return value
      .map((login, index) => this.login(login, `${path}[${index}]`))
      .filter((login) => login !== undefined);
  }

  text(value: unknown, path: string, maxLength: number, allowEmpty = false) {
    if (typeof value !== "string") {
      this.issue(path, "textExpected");
      return undefined;
    }

    const text = value.trim();

    if (!allowEmpty && !text) {
      this.issue(path, "empty");
      return undefined;
    }

    if (text.length > maxLength) {
      this.issue(path, "tooLong", { max: maxLength });
      return undefined;
    }

    return text;
  }

  name(value: unknown, path: string) {
    return this.text(value, path, MAX_NAME_LENGTH);
  }

  questKey(value: unknown, path: string) {
    if (typeof value !== "string" || !QUEST_KEY_REGEX.test(value)) {
      this.issue(path, "questKeyInvalid", { value: describe(value) });
      return undefined;
    }

    return value;
  }

  oneOf<T extends string>(
    value: unknown,
    path: string,
    allowed: readonly T[],
    code: PatchIssueCode,
  ) {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
      this.issue(path, code, {
        value: describe(value),
        expected: allowed.join(", "),
      });
      return undefined;
    }

    return value as T;
  }

  difficulty(value: unknown, path: string) {
    if (
      !Number.isInteger(value) ||
      (value as number) < MIN_DIFFICULTY ||
      (value as number) > MAX_DIFFICULTY
    ) {
      this.issue(path, "difficultyInvalid", {
        value: describe(value),
        min: MIN_DIFFICULTY,
        max: MAX_DIFFICULTY,
      });
      return undefined;
    }

    return value as number;
  }

  boolean(value: unknown, path: string) {
    if (typeof value !== "boolean") {
      this.issue(path, "booleanExpected");
      return undefined;
    }

    return value;
  }

  // Runs `parseItem` on each element of an optional array field.
  list<T>(
    value: unknown,
    path: string,
    parseItem: (raw: Raw, path: string) => T | undefined,
  ) {
    if (value === undefined) {
      return undefined;
    }

    if (!Array.isArray(value)) {
      this.issue(path, "listExpected");
      return undefined;
    }

    const items: T[] = [];

    value.forEach((raw, index) => {
      const itemPath = `${path}[${index}]`;

      if (!isObject(raw)) {
        this.issue(itemPath, "objectExpected");
        return;
      }

      const item = parseItem(raw, itemPath);

      if (item) {
        items.push(item);
      }
    });

    return items;
  }

  // Entries are matched by `idKey`: the same one listed twice is most likely a
  // copy-paste mistake.
  unique<T>(items: T[] | undefined, path: string, id: (item: T) => string) {
    const seen = new Set<string>();

    items?.forEach((item, index) => {
      const key = id(item);

      if (seen.has(key)) {
        this.issue(`${path}[${index}]`, "duplicate", { value: describe(key) });
      }

      seen.add(key);
    });
  }

  // `"$delete": true` must stand alone next to the entry's key.
  deletion(raw: Raw, path: string, idKey: string) {
    if (!("$delete" in raw)) {
      return false;
    }

    if (raw.$delete !== true) {
      this.issue(`${path}.$delete`, "deleteTrueOnly");
      return false;
    }

    this.keys(raw, path, [idKey, "$delete"]);
    return true;
  }

  questFields(raw: Raw, path: string) {
    const fields: QuestFields = {};

    if (raw.rename !== undefined) {
      fields.rename = this.questKey(raw.rename, `${path}.rename`);
    }

    if (raw.label !== undefined) {
      fields.label = this.text(raw.label, `${path}.label`, MAX_TEXT_LENGTH);
    }

    if (raw.answer !== undefined) {
      fields.answer = this.text(raw.answer, `${path}.answer`, MAX_TEXT_LENGTH);
    }

    if (raw.difficulty !== undefined) {
      fields.difficulty = this.difficulty(raw.difficulty, `${path}.difficulty`);
    }

    return fields;
  }

  team = (raw: Raw, path: string): TeamPatch | undefined => {
    const name = this.name(raw.name, `${path}.name`);

    if (this.deletion(raw, path, "name")) {
      return name ? { name, $delete: true } : undefined;
    }

    this.keys(raw, path, ["name", "rename", "members", "newQrCode"]);
    const team: TeamPatch = { name: name ?? "" };

    if (raw.rename !== undefined) {
      team.rename = this.name(raw.rename, `${path}.rename`);
    }

    if (raw.members !== undefined) {
      team.members = this.logins(raw.members, `${path}.members`);
    }

    if (raw.newQrCode !== undefined) {
      team.newQrCode = this.boolean(raw.newQrCode, `${path}.newQrCode`);
    }

    return name ? team : undefined;
  };

  user = (raw: Raw, path: string): UserPatch | undefined => {
    const login = this.login(raw.login, `${path}.login`);

    if (this.deletion(raw, path, "login")) {
      return login ? { login, $delete: true } : undefined;
    }

    this.keys(raw, path, ["login", "role", "team"]);
    const user: UserPatch = { login: login ?? "" };

    if (raw.role !== undefined) {
      user.role = this.oneOf(raw.role, `${path}.role`, ROLES, "unknownRole");
    }

    if (raw.team === null) {
      user.team = null;
    } else if (raw.team !== undefined) {
      user.team = this.name(raw.team, `${path}.team`);
    }

    return login ? user : undefined;
  };

  npcQuest = (raw: Raw, path: string): NpcQuestPatch | undefined => {
    const key = this.questKey(raw.key, `${path}.key`);

    if (this.deletion(raw, path, "key")) {
      return key ? { key, $delete: true } : undefined;
    }

    this.keys(raw, path, ["key", "rename", "label", "answer", "difficulty"]);
    return key ? { key, ...this.questFields(raw, path) } : undefined;
  };

  npc = (raw: Raw, path: string): NpcPatch | undefined => {
    const login = this.login(raw.login, `${path}.login`);

    if (this.deletion(raw, path, "login")) {
      return login ? { login, $delete: true } : undefined;
    }

    this.keys(raw, path, ["login", "name", "lore", "quests"]);
    const npc: NpcPatch = { login: login ?? "" };

    if (raw.name !== undefined) {
      npc.name = this.name(raw.name, `${path}.name`);
    }

    if (raw.lore !== undefined) {
      npc.lore = this.text(raw.lore, `${path}.lore`, MAX_TEXT_LENGTH, true);
    }

    npc.quests = this.list(raw.quests, `${path}.quests`, this.npcQuest);

    return login ? npc : undefined;
  };

  quest = (raw: Raw, path: string): QuestPatch | undefined => {
    const key = this.questKey(raw.key, `${path}.key`);

    if (this.deletion(raw, path, "key")) {
      return key ? { key, $delete: true } : undefined;
    }

    this.keys(raw, path, ["key", "npcs", "rename", "label", "answer", "difficulty"]);
    const quest: QuestPatch = { key: key ?? "", ...this.questFields(raw, path) };

    if (raw.npcs !== undefined) {
      quest.npcs = this.logins(raw.npcs, `${path}.npcs`);

      if (quest.npcs && !quest.npcs.length) {
        this.issue(`${path}.npcs`, "empty");
      }
    }

    return key ? quest : undefined;
  };

  progress = (raw: Raw, path: string): ProgressPatch | undefined => {
    this.keys(raw, path, ["team", "quest", "status"]);
    const team = this.name(raw.team, `${path}.team`);
    const quest = this.questKey(raw.quest, `${path}.quest`);
    const status = this.oneOf(
      raw.status,
      `${path}.status`,
      TEAM_QUEST_STATUSES,
      "unknownStatus",
    );

    return team && quest && status ? { team, quest, status } : undefined;
  };

  game(raw: unknown): GamePatch | undefined {
    if (raw === undefined) {
      return undefined;
    }

    if (!isObject(raw)) {
      this.issue("game", "objectExpected");
      return undefined;
    }

    this.keys(raw, "game", ["phase", "paused", "pauseMessage"]);
    const game: GamePatch = {};

    if (raw.phase !== undefined) {
      game.phase = this.oneOf(raw.phase, "game.phase", GAME_PHASES, "unknownPhase");
    }

    if (raw.paused !== undefined) {
      game.paused = this.boolean(raw.paused, "game.paused");
    }

    if (raw.pauseMessage === null) {
      game.pauseMessage = null;
    } else if (raw.pauseMessage !== undefined) {
      game.pauseMessage =
        this.text(raw.pauseMessage, "game.pauseMessage", MAX_TEXT_LENGTH, true) ||
        null;
    }

    return game;
  }

  wipe(raw: unknown): WipeTarget[] | undefined {
    if (raw === undefined) {
      return undefined;
    }

    if (!Array.isArray(raw)) {
      this.issue("wipe", "listExpected");
      return undefined;
    }

    return raw
      .map((target, index) =>
        this.oneOf(target, `wipe[${index}]`, WIPE_TARGETS, "unknownWipeTarget"),
      )
      .filter((target) => target !== undefined);
  }
}

export function parseAdminPatch(input: unknown): ParsedPatch {
  const parser = new Parser();

  if (!isObject(input)) {
    return {
      ok: false,
      issues: [{ path: "", code: "documentObject" }],
    };
  }

  parser.keys(input, "", TOP_LEVEL_KEYS);

  const patch: AdminPatch = {
    wipe: parser.wipe(input.wipe),
    game: parser.game(input.game),
    teams: parser.list(input.teams, "teams", parser.team),
    users: parser.list(input.users, "users", parser.user),
    npcs: parser.list(input.npcs, "npcs", parser.npc),
    quests: parser.list(input.quests, "quests", parser.quest),
    progress: parser.list(input.progress, "progress", parser.progress),
  };

  parser.unique(patch.teams, "teams", (team) => team.name);
  parser.unique(patch.users, "users", (user) => user.login);
  parser.unique(patch.npcs, "npcs", (npc) => npc.login);
  // A quest can be listed under several NPCs (it is shared), but only once
  // per NPC.
  patch.npcs?.forEach((npc, index) => {
    if ("quests" in npc) {
      parser.unique(npc.quests, `npcs[${index}].quests`, (quest) => quest.key);
    }
  });
  parser.unique(patch.quests, "quests", (quest) => quest.key);
  parser.unique(
    patch.progress,
    "progress",
    (progress) => `${progress.team} / ${progress.quest}`,
  );

  if (parser.issues.length) {
    return { ok: false, issues: parser.issues };
  }

  return { ok: true, patch };
}

// Parses the text typed or uploaded in the admin JSON editor.
export function parseAdminPatchText(text: string): ParsedPatch {
  let input: unknown;

  try {
    input = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          path: "",
          code: "invalidJson",
          params: { error: (error as Error).message },
        },
      ],
    };
  }

  return parseAdminPatch(input);
}

export interface PatchCounter {
  created: number;
  updated: number;
  deleted: number;
}

// What a patch changed (or would change, on a dry run).
export interface PatchReport {
  dryRun: boolean;
  wiped: Partial<Record<WipeTarget, number>>;
  game: boolean;
  teams: PatchCounter;
  users: PatchCounter;
  npcs: PatchCounter;
  quests: PatchCounter;
  progress: PatchCounter;
}
