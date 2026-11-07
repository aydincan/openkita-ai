"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/provider";
import type { Messages } from "@/lib/i18n";
import { isExposureReport, type ExposureReport, type ExposureTopic } from "@/types/exposure";
import type { SessionUser } from "@/types/session";
import { formatFact, parentNoteFacts, sampleLabel } from "./format";

function stamp(value: string | null, locale: "de" | "en"): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TopicCard({
  topic,
  messages,
  locale,
  detailed,
}: {
  topic: ExposureTopic;
  messages: Messages;
  locale: "de" | "en";
  detailed: boolean;
}) {
  const copy = messages.exposure;
  const marker = sampleLabel(topic, locale, messages);
  const facts = detailed ? topic.facts : topic.facts.filter((fact) => fact.day === "tomorrow").concat(
    topic.facts.some((fact) => fact.day === "tomorrow") ? [] : topic.facts.filter((fact) => fact.day === "today"),
  );
  const shown = facts.length > 0 ? facts : topic.facts.slice(0, 1);
  const published = stamp(topic.source_timestamp, locale);
  const retrieved = stamp(topic.retrieved_at, locale);
  const dataset = topic.dataset_url.startsWith("https://") ? topic.dataset_url : null;

  return (
    <article className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm" aria-labelledby={`exposure-${topic.topic}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`exposure-${topic.topic}`} className="text-lg font-semibold text-slate-900">
          {copy.topics[topic.topic]}
        </h3>
        {marker && (
          <p className="rounded-full border border-slate-500 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-900">
            {marker}
          </p>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-800">
        <span className="font-medium">{copy.place}: </span>
        {topic.place_label}
      </p>
      <ul className="mt-3 space-y-1 text-slate-900">
        {shown.map((fact) => (
          <li key={`${topic.topic}-${fact.day}-${fact.subject ?? ""}-${fact.code}`}>
            <span className="font-medium">{copy.days[fact.day]}: </span>
            {formatFact(topic.topic, fact, messages)}
          </li>
        ))}
      </ul>
      {topic.reason !== "none" && topic.reason !== "region_missing" && (
        <p className="mt-2 text-sm text-slate-800">{copy.reasons[topic.reason]}</p>
      )}
      {topic.origin === "live" && topic.stale && (
        <p className="mt-2 text-sm text-amber-950" role="status">
          {copy.stale}
        </p>
      )}
      {detailed && (
        <dl className="mt-3 space-y-1 text-sm text-slate-800">
          <div>
            <dt className="inline font-medium">{copy.source}: </dt>
            <dd className="inline">{copy.sources[topic.source_id]}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{copy.licence}: </dt>
            <dd className="inline">{topic.licence}. {topic.source_id === "uba_air" ? copy.attributionUba : copy.attributionDwd}</dd>
          </div>
          {published && (
            <div>
              <dt className="inline font-medium">{copy.published}: </dt>
              <dd className="inline">
                <time dateTime={topic.source_timestamp ?? undefined}>{published}</time>
              </dd>
            </div>
          )}
          {retrieved && (
            <div>
              <dt className="inline font-medium">{copy.retrieved}: </dt>
              <dd className="inline">
                <time dateTime={topic.retrieved_at ?? undefined}>{retrieved}</time>
              </dd>
            </div>
          )}
        </dl>
      )}
      {detailed && topic.origin === "live" && dataset && (
        <p className="mt-2">
          <a href={dataset} className="text-sm font-medium text-brand-800 underline" rel="noopener noreferrer">
            {copy.publicLink}
          </a>
        </p>
      )}
    </article>
  );
}

export function ExposureView({ variant }: { variant: "page" | "outlook" }) {
  const { locale, messages } = useI18n();
  const copy = messages.exposure;
  const [report, setReport] = useState<ExposureReport | null>(null);
  const [role, setRole] = useState<SessionUser["role"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [exposureResponse, meResponse] = await Promise.all([
      fetch("/api/backend/exposure"),
      fetch("/api/backend/auth/me"),
    ]);
    if (!exposureResponse.ok) {
      setReport(null);
      setError(errorText(await readErrorCode(exposureResponse), messages));
      setLoading(false);
      return;
    }
    const payload: unknown = await exposureResponse.json();
    if (!isExposureReport(payload)) {
      setReport(null);
      setError(messages.errors.backend_invalid_response);
      setLoading(false);
      return;
    }
    setReport(payload);
    if (meResponse.ok) {
      const me: unknown = await meResponse.json();
      if (
        typeof me === "object" &&
        me !== null &&
        "role" in me &&
        (me.role === "administrator" || me.role === "educator")
      ) {
        setRole(me.role);
      }
    }
    setLoading(false);
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [exposureResponse, meResponse] = await Promise.all([
        fetch("/api/backend/exposure"),
        fetch("/api/backend/auth/me"),
      ]);
      if (cancelled) return;
      if (!exposureResponse.ok) {
        setError(errorText(await readErrorCode(exposureResponse), messages));
        setLoading(false);
        return;
      }
      const payload: unknown = await exposureResponse.json();
      if (cancelled) return;
      if (!isExposureReport(payload)) {
        setError(messages.errors.backend_invalid_response);
        setLoading(false);
        return;
      }
      setReport(payload);
      if (meResponse.ok) {
        const me: unknown = await meResponse.json();
        if (
          !cancelled &&
          typeof me === "object" &&
          me !== null &&
          "role" in me &&
          (me.role === "administrator" || me.role === "educator")
        ) {
          setRole(me.role);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  const detailed = variant === "page";
  const heading = variant === "outlook" ? copy.outlookTitle : copy.todayTitle;

  return (
    <section aria-labelledby={variant === "outlook" ? "outlook-heading" : "exposure-heading"} className="space-y-4">
      <div>
        <h2 id={variant === "outlook" ? "outlook-heading" : "exposure-heading"} className="text-lg font-semibold text-slate-900">
          {heading}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-slate-800">
          {variant === "outlook" ? copy.outlookIntro : copy.pageIntro}
        </p>
      </div>
      {loading && !report && !error && (
        <p role="status" className="text-sm text-slate-700">
          {copy.loading}
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm text-red-900">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} className="mt-2 underline">
            {messages.common.retry}
          </button>
        </div>
      )}
      {report && !report.region_set && (
        <p className="max-w-prose text-sm text-slate-800">
          {copy.noRegion}{" "}
          {role === "administrator" ? (
            <Link href="/settings#exposure-region" className="font-medium text-brand-800 underline">
              {copy.setRegion}
            </Link>
          ) : (
            <span>{copy.regionAdminOnly}</span>
          )}
        </p>
      )}
      {report && report.region_set && report.region_label && (
        <p className="text-sm text-slate-800">
          <span className="font-medium">{copy.region}: </span>
          {report.region_label}
        </p>
      )}
      {report && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {report.topics.map((topic) => (
            <li key={topic.topic}>
              <TopicCard topic={topic} messages={messages} locale={locale} detailed={detailed} />
            </li>
          ))}
        </ul>
      )}
      {report && (
        <p>
          <Link
            href={`/parent-communication?facts=${encodeURIComponent(parentNoteFacts(report, messages, locale))}`}
            className="text-sm font-medium text-brand-800 underline"
          >
            {copy.draftLink}
          </Link>
        </p>
      )}
      {report && variant === "outlook" && (
        <p>
          <Link href="/exposure" className="text-sm font-medium text-brand-800 underline">
            {copy.openPage}
          </Link>
        </p>
      )}
    </section>
  );
}
