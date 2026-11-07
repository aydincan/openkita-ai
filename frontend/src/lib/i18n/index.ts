import { de } from "./messages/de";
import type { Messages } from "./messages/de";
import { en } from "./messages/en";

export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_COOKIE = "openkita-locale";

/** Native names, shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { de: "Deutsch", en: "English" };

const catalogs: Record<Locale, Messages> = { de, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

/** Replace `{name}` placeholders. Unknown keys are left as written. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    return values[key] ?? match;
  });
}

export type { Messages };
