import { MAX_DIFFICULTY } from "#shared/utils/scoring";

// "★★★☆☆" for a quest of difficulty 3.
export function stars(difficulty: number) {
  return "★".repeat(difficulty) + "☆".repeat(Math.max(0, MAX_DIFFICULTY - difficulty));
}
