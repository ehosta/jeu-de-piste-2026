import type { GamePhase } from "~~/prisma/generated/enums";

// The game's phase and pause, shared by every page (see app.vue).
export function useGame() {
  return useFetch("/api/game", {
    key: "game",
    default: () => ({
      phase: "WAITING" as GamePhase,
      paused: false,
      pauseMessage: null as string | null,
      lore: null as string | null,
    }),
  });
}

// Why NPCs and players can't act right now, as server/utils/game.ts decides:
// before the game starts, and while it is paused (except for an admin acting
// as one of them).
export function useGameLock() {
  const { data: game } = useGame();
  const { user } = useUserSession();

  return computed(() => {
    if (game.value.phase === "WAITING") {
      return "notStarted" as const;
    }

    return game.value.paused && !user.value?.actingAs ? ("paused" as const) : null;
  });
}
