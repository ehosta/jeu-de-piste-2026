import prefill from "~~/prefill.json";

// The data the game starts with (prefill.json, in the admin patch format: see
// docs/ADMIN.md), e.g. the admins and the volunteer NPCs with their quests.
// Applied on an empty database, and again from /admin (Maintenance): entries
// are matched by key, so it only creates what is missing and resets the
// fields it sets. Applied again, its `game` part is left out, so it doesn't
// stop a running game.
export async function applyPrefill(
  options: { actorLogin?: string; keepGame?: boolean } = {},
) {
  const parsed = parseAdminPatch(prefill);

  if (!parsed.ok) {
    const [issue] = parsed.issues;
    throw new PatchApplyError(
      `prefill.json ${issue?.path ?? ""}`,
      issue?.code ?? "documentObject",
      issue?.params,
    );
  }

  const { game, ...rest } = parsed.patch;
  return applyAdminPatch(options.keepGame ? rest : { game, ...rest }, {
    actorLogin: options.actorLogin ?? "",
  });
}

// An empty database has no Game row yet: the prefill creates it.
export async function isDatabaseEmpty() {
  return !(await prisma.game.findUnique({ where: { id: 1 } }));
}
