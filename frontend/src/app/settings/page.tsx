import type { Metadata } from "next";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { FacilitySettings } from "@/features/settings/FacilitySettings";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.settings.title };
}

export default async function SettingsPage() {
  const { messages: m } = await getI18n();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">{m.settings.title}</h1>
      <section aria-labelledby="lang-heading" className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 id="lang-heading" className="text-lg font-semibold text-slate-900">
          {m.settings.languageTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-700">{m.settings.languageHelp}</p>
        <div className="mt-3">
          <LanguageSwitcher />
        </div>
      </section>
      <FacilitySettings />
      <section aria-labelledby="more-heading" className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 id="more-heading" className="text-lg font-semibold text-slate-900">
          {m.settings.moreTitle}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate-800">{m.settings.moreBody}</p>
      </section>
    </div>
  );
}
