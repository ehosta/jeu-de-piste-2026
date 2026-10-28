// A quest key from its riddle, e.g. "La cantine à 8 €" -> "la-cantine-a-8".
export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

// A new quest's key, from its riddle, that no other quest has: "cantine",
// then "cantine-2"… The key only names the quest in the JSON import/export.
export function uniqueQuestKey(label: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const base = slugify(label) || "quete";
  let key = base;

  for (let suffix = 2; used.has(key); suffix++) {
    key = `${base}-${suffix}`;
  }

  return key;
}
