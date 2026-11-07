"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/provider";

const fieldClass = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";
const buttonClass =
  "rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const { messages: m } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/backend/setup/status");
      if (!response.ok || cancelled) return;
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "needs_setup" in payload &&
        payload.needs_setup === true
      ) {
        router.push("/setup");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/backend/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">{m.auth.loginTitle}</h1>
      <p className="text-sm text-slate-800">{m.auth.loginIntro}</p>
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      <label className="block text-sm font-medium text-slate-900" htmlFor="login-email">
        {m.common.email}
        <input id="login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-slate-900" htmlFor="login-password">
        {m.common.password}
        <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {m.auth.loginAction}
      </button>
    </form>
  );
}

export function SetupForm() {
  const { messages: m } = useI18n();
  const router = useRouter();
  const [facilityName, setFacilityName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/backend/setup/status");
      if (!response.ok || cancelled) return;
      const payload: unknown = await response.json();
      if (
        typeof payload === "object" &&
        payload !== null &&
        "needs_setup" in payload &&
        payload.needs_setup === false
      ) {
        router.push("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(m.auth.passwordMismatch);
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch("/api/backend/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        facility_name: facilityName,
        display_name: displayName,
        email,
        password,
      }),
    });
    setPending(false);
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-auto max-w-md space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">{m.auth.setupTitle}</h1>
      <p className="text-sm text-slate-800">{m.auth.setupIntro}</p>
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      <label className="block text-sm font-medium text-slate-900" htmlFor="setup-facility">
        {m.auth.facilityName}
        <input id="setup-facility" required value={facilityName} onChange={(event) => setFacilityName(event.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-slate-900" htmlFor="setup-name">
        {m.common.displayName}
        <input id="setup-name" required autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-slate-900" htmlFor="setup-email">
        {m.common.email}
        <input id="setup-email" type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium text-slate-900" htmlFor="setup-password">
        {m.common.password}
        <input id="setup-password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
        <span className="mt-1 block text-xs font-normal text-slate-700">{m.auth.passwordHelp}</span>
      </label>
      <label className="block text-sm font-medium text-slate-900" htmlFor="setup-confirm">
        {m.auth.passwordConfirm}
        <input id="setup-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={fieldClass} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {m.auth.setupAction}
      </button>
    </form>
  );
}
