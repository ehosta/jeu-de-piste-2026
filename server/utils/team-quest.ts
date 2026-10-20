import type { H3Event } from "h3";

export async function getTeamQuestOr404(event: H3Event) {
  const id = getRouterParam(event, "id");

  const teamQuest = id
    ? await prisma.teamQuest.findUnique({
        where: { id },
        include: { quest: { include: { npc: true } } },
      })
    : null;

  if (!teamQuest) {
    throw createError({ statusCode: 404, statusMessage: "Team quest not found" });
  }

  return teamQuest;
}

export async function isTeamMember(userId: string, teamId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.teamId === teamId;
}
