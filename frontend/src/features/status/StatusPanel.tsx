"use client";

import { useI18n } from "@/lib/i18n/provider";
import type { ComponentState, HealthResponse } from "@/types/health";
import { useHealth } from "./useHealth";

const BADGE: Record<ComponentState, string> = {
  up: "bg-green-100 text-green-900 ring-green-700/30",
  down: "bg-red-100 text-red-900 ring-red-700/30",
  disabled: "bg-slate-100 text-slate-800 ring-slate-500/30",
};

const SYMBOL: Record<ComponentState, string> = { up: "✓", down: "✕", disabled: "–" };

export function StatusPanel() {
  const { messages: m } = useI18n();
  const { state, refresh } = useHealth();

  return (
    <section aria-labelledby="status-heading" className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="status-heading" className="text-lg font-semibold text-slate-900">
          {m.status.title}
        </h2>
        <button
          type="button"
          onClick={refresh}
          disabled={state.phase === "loading"}
          className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {m.status.refresh}
        </button>
      </div>

      <div className="mt-4">
        {state.phase === "loading" && (
          <p role="status" className="flex items-center gap-2 text-slate-700">
            <span
              aria-hidden="true"
              className="inline-block size-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent motion-reduce:animate-none"
            />
            {m.status.loading}
          </p>
        )}

        {state.phase === "error" && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
            <p className="font-semibold">{m.status.errorTitle}</p>
            <p className="mt-1 text-sm">{m.status.errorBody}</p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 rounded-md bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-900"
            >
              {m.common.retry}
            </button>
          </div>
        )}

        {state.phase === "success" && (
          <div role="status">
            <StatusDetails data={state.data} />
          </div>
        )}
      </div>
    </section>
  );
}

function StatusDetails({ data }: { data: HealthResponse }) {
  const { messages: m } = useI18n();
  const ok = data.status === "ok";
  const rows: { key: keyof HealthResponse["components"]; label: string }[] = [
    { key: "api", label: m.status.components.api },
    { key: "database", label: m.status.components.database },
    { key: "ai", label: m.status.components.ai },
  ];

  return (
    <div>
      <p
        className={`rounded-md px-3 py-2 text-sm font-semibold ${
          ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
        }`}
      >
        {ok ? m.status.overall.ok : m.status.overall.error}
      </p>
      <ul className="mt-3 divide-y divide-slate-200">
        {rows.map(({ key, label }) => {
          const component = data.components[key];
          return (
            <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium text-slate-900">{label}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset ${
                  // The AI provider is optional: "down" is a warning, not a fault.
                  key === "ai" && component.status === "down"
                    ? "bg-amber-100 text-amber-950 ring-amber-700/30"
                    : BADGE[component.status]
                }`}
              >
                <span aria-hidden="true">{SYMBOL[component.status]}</span>
                {m.status.states[component.status]}
              </span>
            </li>
          );
        })}
      </ul>
      {data.components.ai.status === "down" && (
        <p className="mt-2 text-sm text-slate-700">{m.status.aiHint}</p>
      )}
      <p className="mt-3 text-xs text-slate-600">
        {m.status.version} {data.version}
      </p>
    </div>
  );
}
