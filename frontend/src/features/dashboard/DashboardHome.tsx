"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { fill } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n";
import type { Draft } from "@/types/draft";
import { isDraft } from "@/types/draft";

const MODULES = [
  { href: "/exposure", key: "exposure", available: true },
  { href: "/parent-communication", key: "parentCommunication", available: true },
  { href: "/administration", key: "administration", available: false },
  { href: "/knowledge", key: "knowledge", available: false },
  { href: "/documents", key: "documents", available: false },
] as const;

export function ModuleCards({ messages }: { messages: Messages }) {
  return (
    <section aria-labelledby="modules-heading">
      <h2 id="modules-heading" className="text-lg font-semibold text-slate-900">
        {messages.dashboard.modulesTitle}
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {MODULES.map((module) => (
          <li key={module.key} className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">
              <Link href={module.href} className="underline decoration-slate-400 underline-offset-4 hover:decoration-slate-900">
                {messages.modules[module.key].title}
              </Link>
            </h3>
            <p className="mt-2 text-sm text-slate-800">{messages.modules[module.key].description}</p>
            {!module.available && (
              <p className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950">
                {messages.comingSoon.badge}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Welcome() {
  const { messages: m } = useI18n();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const response = await fetch("/api/backend/auth/me");
    if (!response.ok) {
      setError(true);
      return;
    }
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "display_name" in payload &&
      typeof payload.display_name === "string"
    ) {
      setName(payload.display_name);
    } else {
      setError(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/backend/auth/me");
      if (cancelled) return;
      if (!response.ok) {
        setError(true);
        return;
      }
      const payload: unknown = await response.json();
      if (cancelled) return;
      if (
        typeof payload === "object" &&
        payload !== null &&
        "display_name" in payload &&
        typeof payload.display_name === "string"
      ) {
        setName(payload.display_name);
      } else {
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-900">
        {m.errors.unauthenticated}{" "}
        <button type="button" onClick={() => void load()} className="underline">
          {m.common.retry}
        </button>
      </p>
    );
  }
  if (!name) return <p className="text-sm text-slate-700">{m.common.loading}</p>;
  return <p className="text-lg text-slate-900">{fill(m.dashboard.welcome, { name })}</p>;
}

export function RecentDrafts() {
  const { messages: m } = useI18n();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/backend/drafts");
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isDraft)) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    setDrafts(payload);
  }, [m]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/backend/drafts");
      if (cancelled) return;
      if (!response.ok) {
        setError(errorText(await readErrorCode(response), m));
        return;
      }
      const payload: unknown = await response.json();
      if (cancelled) return;
      if (!Array.isArray(payload) || !payload.every(isDraft)) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setDrafts(payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [m]);

  return (
    <section aria-labelledby="recent-heading" className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
      <h2 id="recent-heading" className="text-lg font-semibold text-slate-900">
        {m.dashboard.recentTitle}
      </h2>
      {error && (
        <div role="alert" className="mt-3 text-sm text-red-900">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 underline">
            {m.common.retry}
          </button>
        </div>
      )}
      {!error && drafts === null && <p className="mt-3 text-sm text-slate-700">{m.common.loading}</p>}
      {drafts && drafts.length === 0 && <p className="mt-3 text-sm text-slate-800">{m.dashboard.recentEmpty}</p>}
      {drafts && drafts.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-200">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <Link href={`/parent-communication?draft=${draft.id}`} className="font-medium text-slate-900 underline">
                {draft.subject}
              </Link>
              <span className="text-sm text-slate-700">
                {draft.status === "approved" ? m.parent.statusApproved : m.parent.statusDraft}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
