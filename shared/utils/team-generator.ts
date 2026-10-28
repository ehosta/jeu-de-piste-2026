// Splits players into random teams of about `size` players, with sizes that
// differ by at most one:
// - "atMost": no team is bigger than `size` (more, smaller teams);
// - "atLeast": no team is smaller than `size` (fewer, bigger teams), unless
//   there are fewer players than that.
export type TeamSizeMode = "atMost" | "atLeast";

export function shuffle<T>(items: readonly T[], random = Math.random) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  return shuffled;
}

export function teamCount(players: number, size: number, mode: TeamSizeMode) {
  if (players <= 0) {
    return 0;
  }

  return Math.max(
    1,
    mode === "atMost" ? Math.ceil(players / size) : Math.floor(players / size),
  );
}

export function splitIntoTeams<T>(
  players: readonly T[],
  size: number,
  mode: TeamSizeMode,
  random = Math.random,
) {
  const count = teamCount(players.length, size, mode);
  const teams: T[][] = Array.from({ length: count }, () => []);

  // Dealt like cards, so team sizes differ by at most one.
  shuffle(players, random).forEach((player, index) => {
    teams[index % count]!.push(player);
  });

  return teams;
}
