// How validated quests turn into points, for the leaderboard and the log.
// Computed on the fly from the validation dates (server/utils/scores.ts).

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;

export const POINTS_PER_DIFFICULTY = 100;
// Bonus for the first teams to validate a quest, in percent: +50% for the
// first, then 10 less for each next one, down to nothing from the sixth.
export const FIRST_BONUS = 50;
export const BONUS_STEP = 10;

export function rankBonus(rank: number) {
  return Math.max(0, FIRST_BONUS - BONUS_STEP * (rank - 1));
}

// `rank`: 1 for the first team to validate this quest, 2 for the second…
export function questPoints(difficulty: number, rank: number) {
  return (difficulty * POINTS_PER_DIFFICULTY * (100 + rankBonus(rank))) / 100;
}
