"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, isLocale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

export function LanguageSwitcher() {
  const { locale, messages } = useI18n();
  const router = useRouter();

  function change(value: string) {
    if (!isLocale(value)) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-sm font-medium text-slate-800">
        {messages.common.language}
      </label>
      <select
        id="language-select"
        value={locale}
        onChange={(event) => change(event.target.value)}
        className="rounded-md border border-slate-400 bg-white px-2 py-1 text-sm text-slate-900"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code} lang={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
