"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/provider";
import type { Draft, LetterLanguage } from "@/types/draft";
import { isDraft } from "@/types/draft";

const fieldClass = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";
const TONES = ["friendly", "neutral", "formal", "warm"] as const;
const LANGUAGES = ["de", "en", "tr", "ar"] as const;
const TYPES = [
  "announcement",
  "invitation",
  "reminder",
  "information",
  "closure_notice",
  "request",
  "other",
] as const;

export function LetterStudio() {
  const { messages: m } = useI18n();
  const draftId = useSearchParams().get("draft");
  const [facts, setFacts] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("friendly");
  const [language, setLanguage] = useState<LetterLanguage>("de");
  const [messageType, setMessageType] = useState<(typeof TYPES)[number]>("announcement");
  const [kitaName, setKitaName] = useState("");
  const [sender, setSender] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const experimental = language === "tr" || language === "ar" || draft?.language === "tr" || draft?.language === "ar";

  const apply = useCallback((next: Draft) => {
    setDraft(next);
    setSubject(next.subject);
    setBody(next.body);
    setLanguage(next.language);
    setConfirmed(false);
    setPhase("ready");
  }, []);

  const loadDraft = useCallback(
    async (id: string) => {
      setPhase("loading");
      setError(null);
      const response = await fetch(`/api/backend/drafts/${id}`);
      if (!response.ok) {
        setError(errorText(await readErrorCode(response), m));
        setPhase("error");
        return;
      }
      const payload: unknown = await response.json();
      if (!isDraft(payload)) {
        setError(m.errors.backend_invalid_response);
        setPhase("error");
        return;
      }
      apply(payload);
    },
    [apply, m],
  );

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/backend/drafts/${draftId}`);
      if (cancelled) return;
      if (!response.ok) {
        setError(errorText(await readErrorCode(response), m));
        setPhase("error");
        return;
      }
      const payload: unknown = await response.json();
      if (cancelled) return;
      if (!isDraft(payload)) {
        setError(m.errors.backend_invalid_response);
        setPhase("error");
        return;
      }
      apply(payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [apply, draftId, m]);

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!facts.trim()) {
      setError(m.errors.validation_error);
      return;
    }
    setPhase("loading");
    setError(null);
    setNotice(null);
    const response = await fetch("/api/backend/drafts/parent-communication", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        facts,
        tone,
        language,
        message_type: messageType,
        kita_name: kitaName || null,
        sender: sender || null,
      }),
    });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      setPhase("error");
      return;
    }
    const payload: unknown = await response.json();
    if (!isDraft(payload)) {
      setError(m.errors.backend_invalid_response);
      setPhase("error");
      return;
    }
    apply(payload);
    window.history.replaceState(null, "", `/parent-communication?draft=${payload.id}`);
  }

  async function save() {
    if (!draft) return;
    setError(null);
    const response = await fetch(`/api/backend/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, body }),
    });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    const payload: unknown = await response.json();
    if (!isDraft(payload)) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    apply(payload);
    setNotice(m.parent.saved);
  }

  async function approve() {
    if (!draft) return;
    setError(null);
    const response = await fetch(`/api/backend/drafts/${draft.id}/approve`, { method: "POST" });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    const payload: unknown = await response.json();
    if (!isDraft(payload)) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    apply(payload);
    setNotice(m.parent.approved);
  }

  async function download(kind: "pdf" | "docx") {
    if (!draft) return;
    if (!confirmed) {
      setError(m.parent.exportNeedsConfirm);
      return;
    }
    const response = await fetch(`/api/backend/drafts/${draft.id}/export/${kind}?confirm=true`, {
      method: "POST",
    });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = kind === "pdf" ? "elternbrief.pdf" : "elternbrief.docx";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{m.parent.title}</h1>
        <p className="mt-3 max-w-prose text-slate-800">{m.parent.intro}</p>
      </div>

      <form onSubmit={(event) => void generate(event)} className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-900" htmlFor="letter-facts">
          {m.parent.facts}
          <textarea id="letter-facts" required rows={5} value={facts} onChange={(event) => setFacts(event.target.value)} className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-slate-700">{m.parent.factsHelp}</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-900" htmlFor="letter-type">
            {m.parent.messageType}
            <select id="letter-type" value={messageType} onChange={(event) => setMessageType(event.target.value as (typeof TYPES)[number])} className={fieldClass}>
              {TYPES.map((item) => (
                <option key={item} value={item}>{m.parent.types[item]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-900" htmlFor="letter-tone">
            {m.parent.tone}
            <select id="letter-tone" value={tone} onChange={(event) => setTone(event.target.value as (typeof TONES)[number])} className={fieldClass}>
              {TONES.map((item) => (
                <option key={item} value={item}>{m.parent.tones[item]}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-900" htmlFor="letter-language">
            {m.parent.language}
            <select id="letter-language" value={language} onChange={(event) => setLanguage(event.target.value as LetterLanguage)} className={fieldClass}>
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>{m.parent.languages[item]}</option>
              ))}
            </select>
          </label>
        </div>
        {(language === "tr" || language === "ar") && (
          <p role="note" className="rounded-md bg-amber-100 p-3 text-sm text-amber-950">{m.parent.experimental}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-900" htmlFor="letter-kita">
            {m.parent.kitaName}
            <input id="letter-kita" value={kitaName} onChange={(event) => setKitaName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-900" htmlFor="letter-sender">
            {m.parent.sender}
            <input id="letter-sender" value={sender} onChange={(event) => setSender(event.target.value)} className={fieldClass} />
          </label>
        </div>
        <button type="submit" disabled={phase === "loading"} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
          {phase === "loading" ? m.parent.generating : m.parent.generate}
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
          <p>{error}</p>
          {draftId && (
            <button type="button" onClick={() => void loadDraft(draftId)} className="mt-3 underline">
              {m.common.retry}
            </button>
          )}
        </div>
      )}

      {phase === "idle" && !draft && <p className="text-sm text-slate-800">{m.parent.empty}</p>}

      {draft && (
        <section aria-labelledby="draft-heading" className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="draft-heading" className="text-lg font-semibold text-slate-900">{m.parent.aiLabel}</h2>
            <p className="text-sm text-slate-700">{draft.status === "approved" ? m.parent.statusApproved : m.parent.statusDraft}</p>
          </div>
          {notice && <p role="status" className="text-sm text-slate-800">{notice}</p>}
          <p className="text-sm text-slate-800">{m.parent.approveHelp}</p>
          <p className="text-sm text-slate-700">{m.parent.editResets}</p>
          {experimental && (
            <p role="note" className="rounded-md bg-amber-100 p-3 text-sm text-amber-950">{m.parent.experimental}</p>
          )}
          <label className="block text-sm font-medium text-slate-900" htmlFor="draft-subject">
            {m.parent.subject}
            <input id="draft-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-900" htmlFor="draft-body">
            {m.parent.body}
            <textarea id="draft-body" rows={14} dir={draft.language === "ar" ? "rtl" : "ltr"} value={body} onChange={(event) => setBody(event.target.value)} className={`${fieldClass} whitespace-pre-wrap`} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void save()} className="rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
              {m.common.save}
            </button>
            <button type="button" onClick={() => void approve()} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
              {m.parent.approve}
            </button>
          </div>
          {draft.missing_information.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900">{m.parent.missingTitle}</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                {draft.missing_information.map((item) => (
                  <li key={item.placeholder}>{item.placeholder}: {item.question}</li>
                ))}
              </ul>
            </div>
          )}
          {draft.warnings.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-900">{m.parent.warningsTitle}</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-800">
                {draft.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-900">{m.parent.exportTitle}</h3>
            <label className="mt-2 flex items-start gap-2 text-sm text-slate-900" htmlFor="export-confirm">
              <input id="export-confirm" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span>{experimental ? m.parent.exportConfirmExperimental : m.parent.exportConfirm}</span>
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => void download("pdf")} className="rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
                {m.parent.exportPdf}
              </button>
              <button type="button" onClick={() => void download("docx")} className="rounded-md border border-slate-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
                {m.parent.exportDocx}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
