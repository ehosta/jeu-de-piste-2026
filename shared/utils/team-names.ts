// Random team names, half fantasy and half 42/dev: "Les Mages Segfaultés",
// "The Recursive Liches". French adjectives agree with the noun's gender.

export type TeamNameLocale = "fr" | "en";

type Gender = "m" | "f";

const FR_NOUNS: [string, Gender][] = [
  ["Mages", "m"],
  ["Sorcières", "f"],
  ["Paladins", "m"],
  ["Golems", "m"],
  ["Licornes", "f"],
  ["Chimères", "f"],
  ["Gobelins", "m"],
  ["Dragons", "m"],
  ["Bardes", "m"],
  ["Nécromanciennes", "f"],
  ["Druides", "m"],
  ["Fées", "f"],
  ["Liches", "f"],
  ["Kobolds", "m"],
  ["Elfes", "m"],
  ["Trolls", "m"],
  ["Vouivres", "f"],
  ["Goules", "f"],
  ["Hiboux", "m"],
  ["Grimoires", "m"],
  ["Pointeurs", "m"],
  ["Daemons", "m"],
  ["Forks", "m"],
  ["Piscineux", "m"],
  ["Moulinettes", "f"],
  ["Norminettes", "f"],
  ["Canards en plastique", "m"],
  ["Sémaphores", "m"],
  ["Mutex", "m"],
  ["Potions", "f"],
];

// [masculine, feminine], plural.
const FR_ADJECTIVES: [string, string][] = [
  ["Segfaultés", "Segfaultées"],
  ["Ensorcelés", "Ensorcelées"],
  ["Maudits", "Maudites"],
  ["Récursifs", "Récursives"],
  ["Normés", "Normées"],
  ["Compilés", "Compilées"],
  ["Flamboyants", "Flamboyantes"],
  ["Légendaires", "Légendaires"],
  ["Errants", "Errantes"],
  ["Mystiques", "Mystiques"],
  ["Nocturnes", "Nocturnes"],
  ["Indentés", "Indentées"],
  ["Asynchrones", "Asynchrones"],
  ["Héroïques", "Héroïques"],
  ["Enchantés", "Enchantées"],
  ["Perdus", "Perdues"],
  ["Sauvages", "Sauvages"],
  ["Courageux", "Courageuses"],
  ["Malicieux", "Malicieuses"],
  ["Immortels", "Immortelles"],
  ["Déréférencés", "Déréférencées"],
  ["Dorés", "Dorées"],
  ["Oubliés", "Oubliées"],
  ["Infinis", "Infinies"],
  ["Pixelisés", "Pixelisées"],
  ["Chaotiques", "Chaotiques"],
  ["Rusés", "Rusées"],
  ["Valeureux", "Valeureuses"],
  ["Endiablés", "Endiablées"],
  ["Arcaniques", "Arcaniques"],
];

const EN_NOUNS = [
  "Mages",
  "Witches",
  "Paladins",
  "Golems",
  "Unicorns",
  "Chimeras",
  "Goblins",
  "Dragons",
  "Bards",
  "Necromancers",
  "Druids",
  "Fairies",
  "Liches",
  "Kobolds",
  "Elves",
  "Trolls",
  "Wyverns",
  "Ghouls",
  "Owls",
  "Grimoires",
  "Pointers",
  "Daemons",
  "Forks",
  "Pisciners",
  "Moulinettes",
  "Norminettes",
  "Rubber Ducks",
  "Semaphores",
  "Mutexes",
  "Potions",
];

const EN_ADJECTIVES = [
  "Segfaulted",
  "Bewitched",
  "Cursed",
  "Recursive",
  "Normed",
  "Compiled",
  "Blazing",
  "Legendary",
  "Wandering",
  "Mystic",
  "Nocturnal",
  "Indented",
  "Async",
  "Heroic",
  "Enchanted",
  "Lost",
  "Wild",
  "Brave",
  "Sneaky",
  "Immortal",
  "Dangling",
  "Golden",
  "Forgotten",
  "Infinite",
  "Pixelated",
  "Chaotic",
  "Cunning",
  "Valiant",
  "Volatile",
  "Arcane",
];

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)]!;
}

export function randomTeamName(locale: TeamNameLocale, random = Math.random) {
  if (locale === "en") {
    return `The ${pick(EN_ADJECTIVES, random)} ${pick(EN_NOUNS, random)}`;
  }

  const [noun, gender] = pick(FR_NOUNS, random);
  const [masculine, feminine] = pick(FR_ADJECTIVES, random);
  return `Les ${noun} ${gender === "m" ? masculine : feminine}`;
}

// `count` names different from each other and from `taken` (case-insensitive).
// Falls back to a number suffix if the lists run out.
export function randomTeamNames(
  count: number,
  locale: TeamNameLocale,
  taken: Iterable<string> = [],
  random = Math.random,
) {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  const names: string[] = [];

  while (names.length < count) {
    let name = randomTeamName(locale, random);

    for (let attempt = 0; used.has(name.toLowerCase()) && attempt < 50; attempt++) {
      name = randomTeamName(locale, random);
    }

    for (let suffix = 2; used.has(name.toLowerCase()); suffix++) {
      name = `${name.replace(/ \d+$/, "")} ${suffix}`;
    }

    used.add(name.toLowerCase());
    names.push(name);
  }

  return names;
}
