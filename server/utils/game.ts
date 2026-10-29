import type { Actor } from "./auth";

export async function getGame() {
  return (
    (await prisma.game.findUnique({ where: { id: 1 } })) ?? {
      phase: "WAITING" as const,
      paused: false,
      pauseMessage: null,
      lore: null,
    }
  );
}

// Before the game starts, NPCs and players can't change anything, admins
// acting as one included. While it is paused (from /admin), admins acting as
// one still can, to test or fix things meanwhile.
export async function requireGameRunning(actor: Actor) {
  const game = await getGame();

  if (game.phase === "WAITING") {
    throw createError({ statusCode: 423, statusMessage: "Game not started" });
  }

  if (game.paused && !actor.actingAs) {
    throw createError({ statusCode: 423, statusMessage: "Game paused" });
  }
}
