"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/provider";
import type { Facility, SessionUser } from "@/types/session";

export function FacilitySettings() {
  const { messages: m } = useI18n();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [role, setRole] = useState<SessionUser["role"] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [meResponse, facilityResponse] = await Promise.all([
      fetch("/api/backend/auth/me"),
      fetch("/api/backend/facility"),
    ]);
    if (!meResponse.ok || !facilityResponse.ok) {
      setError(errorText(await readErrorCode(meResponse.ok ? facilityResponse : meResponse), m));
      return;
    }
    const mePayload: unknown = await meResponse.json();
    const facilityPayload: unknown = await facilityResponse.json();
    if (
      typeof mePayload !== "object" ||
      mePayload === null ||
      !("role" in mePayload) ||
      (mePayload.role !== "administrator" && mePayload.role !== "educator") ||
      typeof facilityPayload !== "object" ||
      facilityPayload === null ||
      !("name" in facilityPayload) ||
      typeof facilityPayload.name !== "string" ||
      !("id" in facilityPayload) ||
      typeof facilityPayload.id !== "string"
    ) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    setRole(mePayload.role);
    setFacility({ id: facilityPayload.id, name: facilityPayload.name });
    setName(facilityPayload.name);
  }, [m]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [meResponse, facilityResponse] = await Promise.all([
        fetch("/api/backend/auth/me"),
        fetch("/api/backend/facility"),
      ]);
      if (cancelled) return;
      if (!meResponse.ok || !facilityResponse.ok) {
        setError(errorText(await readErrorCode(meResponse.ok ? facilityResponse : meResponse), m));
        return;
      }
      const mePayload: unknown = await meResponse.json();
      const facilityPayload: unknown = await facilityResponse.json();
      if (cancelled) return;
      if (
        typeof mePayload !== "object" ||
        mePayload === null ||
        !("role" in mePayload) ||
        (mePayload.role !== "administrator" && mePayload.role !== "educator") ||
        typeof facilityPayload !== "object" ||
        facilityPayload === null ||
        !("name" in facilityPayload) ||
        typeof facilityPayload.name !== "string" ||
        !("id" in facilityPayload) ||
        typeof facilityPayload.id !== "string"
      ) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setRole(mePayload.role);
      setFacility({ id: facilityPayload.id, name: facilityPayload.name });
      setName(facilityPayload.name);
    })();
    return () => {
      cancelled = true;
    };
  }, [m]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const response = await fetch("/api/backend/facility", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    setSaved(true);
    await load();
  }

  return (
    <section aria-labelledby="facility-heading" className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
      <h2 id="facility-heading" className="text-lg font-semibold text-slate-900">
        {m.settings.facilityTitle}
      </h2>
      <p className="mt-1 text-sm text-slate-700">{m.settings.facilityHelp}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-900">
          {error}{" "}
          <button type="button" onClick={() => void load()} className="underline">
            {m.common.retry}
          </button>
        </p>
      )}
      {!facility && !error && <p className="mt-3 text-sm text-slate-700">{m.common.loading}</p>}
      {facility && role === "administrator" && (
        <form onSubmit={(event) => void save(event)} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-900" htmlFor="facility-name">
            {m.settings.facilityName}
            <input
              id="facility-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-400 px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            {m.common.save}
          </button>
          {saved && <p role="status" className="text-sm text-slate-800">{m.settings.facilitySaved}</p>}
        </form>
      )}
      {facility && role === "educator" && (
        <p className="mt-4 text-slate-900">
          <span className="font-medium">{m.settings.facilityName}: </span>
          {facility.name}
          <span className="mt-1 block text-sm text-slate-700">{m.settings.facilityReadOnly}</span>
        </p>
      )}
      <p className="mt-4">
        <Link href="/users" className="text-sm font-medium text-brand-800 underline">
          {m.settings.usersLink}
        </Link>
      </p>
    </section>
  );
}
