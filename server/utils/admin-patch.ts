import type { Prisma } from "~~/prisma/generated/client";
import type { Role } from "~~/prisma/generated/enums";
import type {
  AdminPatch,
  PatchIssue,
  PatchIssueCode,
  PatchIssueParams,
  NpcQuestPatch,
  PatchCounter,
  PatchReport,
  QuestPatch,
  WipeTarget,
} from "#shared/utils/admin-patch";

type Tx = Prisma.TransactionClient;

// A patch that is valid JSON but doesn't fit the data, e.g. a team name that
// doesn't exist. The whole transaction is rolled back. Reported like a parse
// issue: a code the client translates.
export class PatchApplyError extends Error {
  constructor(
    readonly path: string,
    readonly code: PatchIssueCode,
    readonly params?: PatchIssueParams,
  ) {
    super(`${path}: ${code} ${JSON.stringify(params ?? {})}`);
  }

  get issue(): PatchIssue {
    return { path: this.path, code: this.code, params: this.params };
  }
}

// Thrown at the end of a dry run to roll the transaction back.
class DryRun {
  constructor(readonly report: PatchReport) {}
}

function counter(): PatchCounter {
  return { created: 0, updated: 0, deleted: 0 };
}

// Applies a parsed patch (shared/utils/admin-patch.ts) in one transaction, in
// an order that lets an entry use what earlier sections created: wipe, game,
// teams, users, team members, NPCs and their quests, quests, progress.
// `actorLogin` is the admin sending it, who can't delete or demote themself,
// and owners (NUXT_ADMIN_LOGINS) can't be deleted or demoted by anyone. Admins
// and bocal always end up with a team and an NPC profile
// (server/utils/admins.ts).
export async function applyAdminPatch(
  patch: AdminPatch,
  options: { actorLogin: string; dryRun?: boolean },
) {
  let report: PatchReport;

  try {
    report = await prisma.$transaction(
      async (tx) => {
        const report = await new PatchRunner(tx, options.actorLogin).run(patch);

        if (options.dryRun) {
          throw new DryRun({ ...report, dryRun: true });
        }

        return report;
      },
      // Large imports run one query per entry.
      { maxWait: 10_000, timeout: 120_000 },
    );
  } catch (error) {
    if (error instanceof DryRun) {
      return error.report;
    }

    throw error;
  }

  // Cascading deletes can leave photo files without a TeamQuest.
  await deleteOrphanPhotos();
  return report;
}

class PatchRunner {
  report: PatchReport = {
    dryRun: false,
    wiped: {},
    game: false,
    teams: counter(),
    users: counter(),
    npcs: counter(),
    quests: counter(),
    progress: counter(),
  };

  constructor(
    private tx: Tx,
    private actorLogin: string,
  ) {}

  async run(patch: AdminPatch) {
    for (const target of patch.wipe ?? []) {
      this.report.wiped[target] = await this.wipe(target);
    }

    if (patch.game) {
      await this.tx.game.upsert({
        where: { id: 1 },
        create: { id: 1, ...patch.game },
        update: patch.game,
      });
      this.report.game = true;

      if (patch.game.phase === "WAITING") {
        await this.admitWaitingUsers();
      }
    }

    for (const [index, team] of (patch.teams ?? []).entries()) {
      await this.team(team, `teams[${index}]`);
    }

    for (const [index, user] of (patch.users ?? []).entries()) {
      await this.user(user, `users[${index}]`);
    }

    for (const [index, team] of (patch.teams ?? []).entries()) {
      if ("members" in team && team.members) {
        await this.members(team.rename ?? team.name, team.members, `teams[${index}]`);
      }
    }

    for (const [index, npc] of (patch.npcs ?? []).entries()) {
      await this.npc(npc, `npcs[${index}]`);
    }

    for (const [index, quest] of (patch.quests ?? []).entries()) {
      await this.quest(quest, `quests[${index}]`);
    }

    for (const [index, progress] of (patch.progress ?? []).entries()) {
      await this.progress(progress, `progress[${index}]`);
    }

    // Quests nobody can give any more (their NPCs were deleted or took them
    // off).
    this.report.quests.deleted += (
      await this.tx.quest.deleteMany({ where: { npcs: { none: {} } } })
    ).count;

    // New admins or bocal, or ones whose team or NPC was just removed. Their
    // sandbox teams go once nobody is left in them.
    await ensureAllAdminVersions(this.tx);
    await this.tx.team.deleteMany({
      where: { sandbox: true, members: { none: {} } },
    });
    return this.report;
  }

  // Admins and bocal are never wiped (their team and NPC come back at the end
  // of the run).
  async wipe(target: WipeTarget) {
    switch (target) {
      case "progress":
        return (await this.tx.teamQuest.deleteMany()).count;
      case "quests":
        return (await this.tx.quest.deleteMany()).count;
      case "npcs": {
        const { count } = await this.tx.npc.deleteMany();
        await this.tx.user.deleteMany({ where: { role: "NPC" } });
        return count;
      }
      case "teams":
        return (await this.tx.team.deleteMany()).count;
      case "players":
        return (await this.tx.user.deleteMany({ where: { role: "PLAYER" } }))
          .count;
    }
  }

  // Before the game, every 42 account that logged in plays: the ones kept out
  // while it was running join as players without a team.
  async admitWaitingUsers() {
    const waiting = await this.tx.waitingUser.findMany();
    const { count } = await this.tx.user.createMany({
      data: waiting.map(({ intraLogin }) => ({ intraLogin })),
      skipDuplicates: true,
    });

    this.report.users.created += count;
    await this.tx.waitingUser.deleteMany();
  }

  async findTeam(name: string, path: string) {
    const team = await this.tx.team.findUnique({ where: { name } });

    if (!team) {
      throw new PatchApplyError(path, "unknownTeam", { name });
    }

    return team;
  }

  async team(patch: NonNullable<AdminPatch["teams"]>[number], path: string) {
    if ("$delete" in patch) {
      const { count } = await this.tx.team.deleteMany({
        where: { name: patch.name },
      });
      this.report.teams.deleted += count;
      return;
    }

    // A team already renamed by an earlier run of the same patch is found
    // under its new name, so a patch can be applied twice.
    const existing =
      (await this.tx.team.findUnique({ where: { name: patch.name } })) ??
      (patch.rename
        ? await this.tx.team.findUnique({ where: { name: patch.rename } })
        : null);
    const name = patch.rename ?? patch.name;

    if (patch.rename && existing && existing.name !== patch.rename) {
      const taken = await this.tx.team.findUnique({ where: { name } });

      if (taken) {
        throw new PatchApplyError(`${path}.rename`, "teamExists", { name });
      }
    }

    const qrToken = patch.newQrCode ? crypto.randomUUID() : undefined;

    if (existing) {
      await this.tx.team.update({
        where: { id: existing.id },
        data: { name, qrToken },
      });
      this.report.teams.updated++;
    } else {
      await this.tx.team.create({ data: { name, qrToken } });
      this.report.teams.created++;
    }
  }

  async user(patch: NonNullable<AdminPatch["users"]>[number], path: string) {
    const isActor = patch.login === this.actorLogin;
    const owner = isOwner(patch.login);

    if ("$delete" in patch) {
      if (isActor) {
        throw new PatchApplyError(path, "cannotDeleteSelf");
      }

      if (owner) {
        throw new PatchApplyError(path, "ownerCannotBeDeleted", {
          login: patch.login,
        });
      }

      const { count } = await this.tx.user.deleteMany({
        where: { intraLogin: patch.login },
      });
      this.report.users.deleted += count;
      return;
    }

    const existing = await this.tx.user.findUnique({
      where: { intraLogin: patch.login },
    });
    const role: Role = patch.role ?? existing?.role ?? "PLAYER";

    if (isActor && role !== "ADMIN") {
      throw new PatchApplyError(`${path}.role`, "cannotDemoteSelf");
    }

    if (owner && role !== "ADMIN") {
      throw new PatchApplyError(`${path}.role`, "ownerStaysAdmin", {
        login: patch.login,
      });
    }

    let teamId: string | null | undefined;

    // Admins and bocal can play in a team too.
    if (patch.team) {
      if (role === "NPC") {
        throw new PatchApplyError(`${path}.team`, "npcHasNoTeam", {
          login: patch.login,
        });
      }

      teamId = (await this.findTeam(patch.team, `${path}.team`)).id;
    } else if (patch.team === null || role === "NPC") {
      teamId = null;
    }

    await this.tx.user.upsert({
      where: { intraLogin: patch.login },
      create: { intraLogin: patch.login, role, teamId },
      update: { role, teamId },
    });
    this.report.users[existing ? "updated" : "created"]++;
  }

  async members(teamName: string, logins: string[], path: string) {
    const team = await this.findTeam(teamName, `${path}.name`);

    for (const [index, login] of logins.entries()) {
      const user = await this.tx.user.findUnique({ where: { intraLogin: login } });

      if (user?.role === "NPC") {
        throw new PatchApplyError(`${path}.members[${index}]`, "npcHasNoTeam", {
          login,
        });
      }

      await this.tx.user.upsert({
        where: { intraLogin: login },
        create: { intraLogin: login, teamId: team.id },
        update: { teamId: team.id },
      });
      this.report.users[user ? "updated" : "created"]++;
    }
  }

  async npc(patch: NonNullable<AdminPatch["npcs"]>[number], path: string) {
    const user = await this.tx.user.findUnique({
      where: { intraLogin: patch.login },
      include: { npc: true },
    });

    // The account stays, as a player without a team (admins and bocal keep
    // their role).
    if ("$delete" in patch) {
      if (user?.npc) {
        await this.tx.npc.delete({ where: { id: user.npc.id } });
        this.report.npcs.deleted++;
      }

      if (user?.role === "NPC") {
        await this.tx.user.update({
          where: { id: user.id },
          data: { role: "PLAYER" },
        });
      }

      return;
    }

    if (!user?.npc && !patch.name) {
      throw new PatchApplyError(`${path}.name`, "npcNameRequired", {
        login: patch.login,
      });
    }

    // An admin or bocal keeps their role and team, and switches to their NPC
    // from the dashboard switch.
    const { id: userId } = await this.tx.user.upsert({
      where: { intraLogin: patch.login },
      create: { intraLogin: patch.login, role: "NPC" },
      update: isStaffRole(user?.role) ? {} : { role: "NPC", teamId: null },
    });

    const npc = user?.npc
      ? await this.tx.npc.update({
          where: { id: user.npc.id },
          data: { name: patch.name, lore: patch.lore },
        })
      : await this.tx.npc.create({
          data: { userId, name: patch.name ?? "", lore: patch.lore ?? "" },
        });
    this.report.npcs[user?.npc ? "updated" : "created"]++;

    for (const [index, quest] of (patch.quests ?? []).entries()) {
      await this.quest(quest, `${path}.quests[${index}]`, npc.id);
    }
  }

  // `npcId` is set for quests listed under an NPC: the quest is given to this
  // NPC too, and `$delete` only takes it from them.
  async quest(patch: QuestPatch | NpcQuestPatch, path: string, npcId?: string) {
    if ("$delete" in patch) {
      if (npcId) {
        const quest = await this.tx.quest.findUnique({ where: { key: patch.key } });

        if (quest) {
          await this.tx.quest.update({
            where: { id: quest.id },
            data: { npcs: { disconnect: { id: npcId } } },
          });
        }

        return;
      }

      const { count } = await this.tx.quest.deleteMany({
        where: { key: patch.key },
      });
      this.report.quests.deleted += count;
      return;
    }

    const existing =
      (await this.tx.quest.findUnique({ where: { key: patch.key } })) ??
      (patch.rename
        ? await this.tx.quest.findUnique({ where: { key: patch.rename } })
        : null);
    const key = patch.rename ?? patch.key;

    if (patch.rename && existing && existing.key !== patch.rename) {
      const taken = await this.tx.quest.findUnique({ where: { key } });

      if (taken) {
        throw new PatchApplyError(`${path}.rename`, "questExists", { key });
      }
    }

    let npcIds = npcId ? [npcId] : undefined;

    if ("npcs" in patch && patch.npcs) {
      npcIds = [];

      for (const [index, login] of patch.npcs.entries()) {
        const npc = await this.tx.npc.findFirst({
          where: { user: { intraLogin: login } },
        });

        if (!npc) {
          throw new PatchApplyError(`${path}.npcs[${index}]`, "notAnNpc", { login });
        }

        npcIds.push(npc.id);
      }
    }

    const ids = npcIds?.map((id) => ({ id }));
    const fields = {
      key,
      label: patch.label,
      answer: patch.answer,
      difficulty: patch.difficulty,
    };

    if (existing) {
      await this.tx.quest.update({
        where: { id: existing.id },
        data: {
          ...fields,
          // Under an NPC, added to the quest's NPCs; in `quests`, replaces them.
          npcs: ids && (npcId ? { connect: ids } : { set: ids }),
        },
      });
      this.report.quests.updated++;
      return;
    }

    if (!ids?.length || !patch.label || !patch.answer) {
      throw new PatchApplyError(path, "newQuestFields", { key });
    }

    await this.tx.quest.create({
      data: { ...fields, label: patch.label, answer: patch.answer, npcs: { connect: ids } },
    });
    this.report.quests.created++;
  }

  async progress(
    patch: NonNullable<AdminPatch["progress"]>[number],
    path: string,
  ) {
    const team = await this.findTeam(patch.team, `${path}.team`);
    const quest = await this.tx.quest.findUnique({ where: { key: patch.quest } });

    if (!quest) {
      throw new PatchApplyError(`${path}.quest`, "unknownQuest", {
        key: patch.quest,
      });
    }

    const where = { teamId_questId: { teamId: team.id, questId: quest.id } };
    const existing = await this.tx.teamQuest.findUnique({ where });

    // A team without a row is HIDDEN, without a photo.
    if (
      patch.expected &&
      (patch.expected.status !== (existing?.status ?? "HIDDEN") ||
        patch.expected.photoPath !== (existing?.photoPath ?? null))
    ) {
      throw new PatchApplyError(`${path}.expected`, "progressChanged", {
        team: patch.team,
        quest: patch.quest,
      });
    }

    // HIDDEN means the quest was never given: the row (and photo) goes away.
    if (patch.status === "HIDDEN") {
      const { count } = await this.tx.teamQuest.deleteMany({
        where: { teamId: team.id, questId: quest.id },
      });
      this.report.progress.deleted += count;
      return;
    }

    const dateField = STATUS_DATE_FIELDS[patch.status];
    // A status applied again (e.g. a reimported export) keeps its date: the
    // validation dates decide who validated a quest first.
    const data =
      existing?.status === patch.status
        ? { status: patch.status }
        : { status: patch.status, [dateField]: new Date() };

    // With `expected`, the row must still be the one checked above (a team or
    // NPC can change it while this transaction runs).
    if (patch.expected && existing) {
      const { count } = await this.tx.teamQuest.updateMany({
        where: {
          id: existing.id,
          status: existing.status,
          photoPath: existing.photoPath,
        },
        data,
      });

      if (!count) {
        throw new PatchApplyError(`${path}.expected`, "progressChanged", {
          team: patch.team,
          quest: patch.quest,
        });
      }
    } else {
      await this.tx.teamQuest.upsert({
        where,
        create: { teamId: team.id, questId: quest.id, ...data },
        update: data,
      });
    }

    this.report.progress[existing ? "updated" : "created"]++;
  }
}
