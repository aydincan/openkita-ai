"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/provider";
import type { Facility, SessionUser } from "@/types/session";
import { isRegionList, type ExposureRegionOption } from "@/types/exposure";

function readRole(payload: unknown): SessionUser["role"] | null {
  if (typeof payload !== "object" || payload === null || !("role" in payload)) return null;
  return payload.role === "administrator" || payload.role === "educator" ? payload.role : null;
}

function readFacility(payload: unknown): Facility | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (!("name" in payload) || typeof payload.name !== "string") return null;
  if (!("id" in payload) || typeof payload.id !== "string") return null;
  const code =
    "exposure_region_code" in payload &&
    (payload.exposure_region_code === null || typeof payload.exposure_region_code === "string")
      ? payload.exposure_region_code
      : null;
  const label =
    "exposure_region_label" in payload &&
    (payload.exposure_region_label === null || typeof payload.exposure_region_label === "string")
      ? payload.exposure_region_label
      : null;
  return { id: payload.id, name: payload.name, exposure_region_code: code, exposure_region_label: label };
}

export function FacilitySettings() {
  const { messages: m } = useI18n();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [role, setRole] = useState<SessionUser["role"] | null>(null);
  const [name, setName] = useState("");
  const [regions, setRegions] = useState<ExposureRegionOption[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [regionSaved, setRegionSaved] = useState(false);

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
    const nextRole = readRole(mePayload);
    const nextFacility = readFacility(facilityPayload);
    if (!nextRole || !nextFacility) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    setRole(nextRole);
    setFacility(nextFacility);
    setName(nextFacility.name);
    setRegionCode(nextFacility.exposure_region_code ?? "");
    if (nextRole === "administrator") {
      const regionResponse = await fetch("/api/backend/exposure/regions");
      if (!regionResponse.ok) {
        setError(errorText(await readErrorCode(regionResponse), m));
        return;
      }
      const regionPayload: unknown = await regionResponse.json();
      if (!isRegionList(regionPayload)) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setRegions(regionPayload);
    }
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
      const nextRole = readRole(mePayload);
      const nextFacility = readFacility(facilityPayload);
      if (!nextRole || !nextFacility) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setRole(nextRole);
      setFacility(nextFacility);
      setName(nextFacility.name);
      setRegionCode(nextFacility.exposure_region_code ?? "");
      if (nextRole !== "administrator") return;
      const regionResponse = await fetch("/api/backend/exposure/regions");
      if (cancelled) return;
      if (!regionResponse.ok) {
        setError(errorText(await readErrorCode(regionResponse), m));
        return;
      }
      const regionPayload: unknown = await regionResponse.json();
      if (cancelled) return;
      if (!isRegionList(regionPayload)) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setRegions(regionPayload);
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

  async function saveRegion(event: FormEvent) {
    event.preventDefault();
    setRegionSaved(false);
    setError(null);
    const response = await fetch("/api/backend/facility/region", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ region_code: regionCode || null }),
    });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    setRegionSaved(true);
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
      {facility && role === "administrator" && (
        <form id="exposure-region" onSubmit={(event) => void saveRegion(event)} className="mt-6 space-y-3">
          <h3 className="text-base font-semibold text-slate-900">{m.settings.regionTitle}</h3>
          <p className="text-sm text-slate-700">{m.settings.regionHelp}</p>
          <label className="block text-sm font-medium text-slate-900" htmlFor="exposure-region-select">
            {m.settings.regionLabel}
            <select
              id="exposure-region-select"
              value={regionCode}
              onChange={(event) => setRegionCode(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2"
            >
              <option value="">{m.settings.regionNone}</option>
              {regions.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            {m.common.save}
          </button>
          {regionSaved && <p role="status" className="text-sm text-slate-800">{m.settings.regionSaved}</p>}
        </form>
      )}
      {facility && role === "educator" && (
        <div className="mt-4 text-slate-900">
          <p>
            <span className="font-medium">{m.settings.facilityName}: </span>
            {facility.name}
          </p>
          <p className="mt-2">
            <span className="font-medium">{m.settings.regionLabel}: </span>
            {facility.exposure_region_label ?? m.settings.regionNone}
          </p>
          <p className="mt-1 text-sm text-slate-700">{m.settings.facilityReadOnly}</p>
          <p className="text-sm text-slate-700">{m.settings.regionReadOnly}</p>
        </div>
      )}
      <p className="mt-4">
        <Link href="/users" className="text-sm font-medium text-brand-800 underline">
          {m.settings.usersLink}
        </Link>
      </p>
    </section>
  );
}
