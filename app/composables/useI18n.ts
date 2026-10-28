import {
  detectLocale,
  translate,
  type Locale,
  type MessageKey,
  type MessageParams,
} from "~/i18n";

export type Translate = (key: MessageKey, params?: MessageParams) => string;

// The language picked in the header (kept in a cookie), or the browser's.
export function useI18n() {
  const cookie = useCookie<Locale | null>("lang", {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const locale = useState<Locale>("locale", () => {
    if (cookie.value === "fr" || cookie.value === "en") {
      return cookie.value;
    }

    return detectLocale(
      import.meta.server
        ? useRequestHeaders(["accept-language"])["accept-language"]
        : navigator.language,
    );
  });

  function setLocale(value: Locale) {
    locale.value = value;
    cookie.value = value;
  }

  const t: Translate = (key, params) => translate(locale.value, key, params);

  function formatDateTime(value: string | Date | null) {
    return value
      ? new Date(value).toLocaleString(locale.value === "fr" ? "fr-FR" : "en-GB", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : t("common.never");
  }

  // 1er, 2e… / 1st, 2nd…
  function ordinal(rank: number) {
    if (locale.value === "fr") {
      return rank === 1 ? "1er" : `${rank}e`;
    }

    const suffixes: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };
    return `${rank}${suffixes[new Intl.PluralRules("en", { type: "ordinal" }).select(rank)]}`;
  }

  return { locale, setLocale, t, formatDateTime, ordinal };
}
