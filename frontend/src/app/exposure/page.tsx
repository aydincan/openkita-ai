import type { Metadata } from "next";
import { ExposureView } from "@/features/exposure/ExposureView";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.exposure.title };
}

export default async function ExposurePage() {
  const { messages: m } = await getI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{m.exposure.title}</h1>
        <p className="mt-3 max-w-prose text-slate-800">{m.exposure.intro}</p>
      </div>
      <ExposureView variant="page" />
    </div>
  );
}
