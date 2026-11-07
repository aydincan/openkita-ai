import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, getMessages, resolveLocale } from "./index";

/** Locale and messages for the current request (server components). */
export async function getI18n() {
  const store = await cookies();
  const locale = resolveLocale(store.get(LOCALE_COOKIE)?.value);
  return { locale, messages: getMessages(locale) };
}
