import type { Metadata } from "next";
import { ExposureView } from "@/features/exposure/ExposureView";
import { ModuleCards, RecentDrafts, Welcome } from "@/features/dashboard/DashboardHome";
import { StatusPanel } from "@/features/status/StatusPanel";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.dashboard.title };
}

export default async function DashboardPage() {
  const { messages: m } = await getI18n();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{m.dashboard.title}</h1>
        <div className="mt-3 max-w-prose">
          <Welcome />
        </div>
        <p className="mt-3 max-w-prose text-slate-800">{m.dashboard.intro}</p>
      </div>
      <StatusPanel />
      <ExposureView variant="outlook" />
      <RecentDrafts />
      <ModuleCards messages={m} />
    </div>
  );
}
