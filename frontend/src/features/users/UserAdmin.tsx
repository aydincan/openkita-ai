"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { errorText, readErrorCode } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/provider";
import type { SessionUser } from "@/types/session";

const fieldClass = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-slate-900";

function isUser(value: unknown): value is SessionUser {
  if (typeof value !== "object" || value === null) return false;
  const user = value as Partial<SessionUser>;
  return typeof user.id === "string" && typeof user.email === "string" && typeof user.role === "string";
}

export function UserAdmin() {
  const { messages: m } = useI18n();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<SessionUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const meResponse = await fetch("/api/backend/auth/me");
    if (!meResponse.ok) {
      setError(errorText(await readErrorCode(meResponse), m));
      return;
    }
    const mePayload: unknown = await meResponse.json();
    if (!isUser(mePayload)) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    setMe(mePayload);
    if (mePayload.role !== "administrator") {
      setUsers([]);
      return;
    }
    const response = await fetch("/api/backend/users");
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isUser)) {
      setError(m.errors.backend_invalid_response);
      return;
    }
    setUsers(payload);
  }, [m]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const meResponse = await fetch("/api/backend/auth/me");
      if (cancelled) return;
      if (!meResponse.ok) {
        setError(errorText(await readErrorCode(meResponse), m));
        return;
      }
      const mePayload: unknown = await meResponse.json();
      if (cancelled) return;
      if (!isUser(mePayload)) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setMe(mePayload);
      if (mePayload.role !== "administrator") {
        setUsers([]);
        return;
      }
      const response = await fetch("/api/backend/users");
      if (cancelled) return;
      if (!response.ok) {
        setError(errorText(await readErrorCode(response), m));
        return;
      }
      const payload: unknown = await response.json();
      if (cancelled) return;
      if (!Array.isArray(payload) || !payload.every(isUser)) {
        setError(m.errors.backend_invalid_response);
        return;
      }
      setUsers(payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [m]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    setError(null);
    const response = await fetch("/api/backend/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, display_name: displayName, password }),
    });
    setPending(false);
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    setEmail("");
    setDisplayName("");
    setPassword("");
    setNotice(m.users.created);
    await load();
  }

  async function deactivate(id: string) {
    setError(null);
    const response = await fetch(`/api/backend/users/${id}/deactivate`, { method: "POST" });
    if (!response.ok) {
      setError(errorText(await readErrorCode(response), m));
      return;
    }
    setNotice(m.users.deactivated);
    await load();
  }

  if (error && !me) {
    return (
      <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">
        <p>{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 underline">
          {m.common.retry}
        </button>
      </div>
    );
  }
  if (!me) return <p>{m.common.loading}</p>;
  if (me.role !== "administrator") {
    return (
      <section className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">{m.users.forbiddenTitle}</h1>
        <p className="mt-3 max-w-prose text-slate-800">{m.users.forbiddenBody}</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{m.users.title}</h1>
        <p className="mt-3 max-w-prose text-slate-800">{m.users.intro}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {notice && <p role="status" className="text-sm text-slate-800">{notice}</p>}
      <form onSubmit={(event) => void create(event)} className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{m.users.createTitle}</h2>
        <label className="block text-sm font-medium text-slate-900" htmlFor="user-name">
          {m.common.displayName}
          <input id="user-name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-slate-900" htmlFor="user-email">
          {m.common.email}
          <input id="user-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-medium text-slate-900" htmlFor="user-password">
          {m.common.password}
          <input id="user-password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-slate-700">{m.auth.passwordHelp}</span>
        </label>
        <button type="submit" disabled={pending} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
          {m.users.createAction}
        </button>
      </form>
      <section aria-labelledby="user-list-heading">
        <h2 id="user-list-heading" className="text-lg font-semibold text-slate-900">{m.users.listTitle}</h2>
        {users === null && <p className="mt-3 text-sm text-slate-700">{m.common.loading}</p>}
        {users && users.filter((user) => user.role === "educator").length === 0 && (
          <p className="mt-3 text-sm text-slate-800">{m.users.empty}</p>
        )}
        {users && (
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-300 bg-white">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">{user.display_name}</p>
                  <p className="text-sm text-slate-700">{user.email}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span>{user.role === "administrator" ? m.users.roleAdmin : m.users.roleEducator}</span>
                  <span>{user.is_active ? m.users.active : m.users.inactive}</span>
                  {user.role === "educator" && user.is_active && (
                    <button type="button" onClick={() => void deactivate(user.id)} className="rounded-md border border-slate-400 px-3 py-1.5 font-medium text-slate-900 hover:bg-slate-100">
                      {m.users.deactivate}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
