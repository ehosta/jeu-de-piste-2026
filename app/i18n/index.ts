import { en } from "./en";
import { fr } from "./fr";

export type Messages = typeof fr;
export type Locale = "fr" | "en";
export const LOCALES: Locale[] = ["fr", "en"];

const MESSAGES: Record<Locale, Messages> = { fr, en };

// "admin.teams.title", for every string in the messages.
type Keys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Keys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Keys<Messages>;
export type MessageParams = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params: MessageParams = {}) {
  let message = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], MESSAGES[locale]);

  if (typeof message !== "string") {
    return key;
  }

  // "one | many", chosen from `count` (0 is singular in French).
  const forms = message.split(" | ");

  if (forms.length === 2 && typeof params.count === "number") {
    const singular = locale === "fr" ? params.count <= 1 : params.count === 1;
    message = forms[singular ? 0 : 1]!;
  }

  return (message as string).replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

// From an Accept-Language header or navigator.language: French speakers get
// French, everyone else English.
export function detectLocale(language: string | undefined): Locale {
  if (!language) {
    return "fr";
  }

  return language.trim().toLowerCase().startsWith("fr") ? "fr" : "en";
}
