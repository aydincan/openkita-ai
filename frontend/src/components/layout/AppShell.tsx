"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Navigation } from "./Navigation";

export function AppShell({
  children,
  showNavigation = true,
}: {
  children: ReactNode;
  showNavigation?: boolean;
}) {
  const { messages: m } = useI18n();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await fetch("/api/backend/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={showNavigation ? "min-h-screen md:grid md:grid-cols-[16rem_1fr]" : "min-h-screen"}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg"
      >
        {m.common.skipToContent}
      </a>

      {showNavigation && (
      <aside className="border-b border-slate-300 bg-white md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:py-5">
          <Link href="/" className="block">
            <span className="block text-xl font-bold text-brand-800">{m.app.name}</span>
          </Link>
          <button
            type="button"
            className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-900 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? m.common.closeMenu : m.common.openMenu}
          </button>
        </div>
        <div
          id="primary-navigation"
          className={`${menuOpen ? "block" : "hidden"} px-3 pb-4 md:block`}
        >
          <Navigation onNavigate={() => setMenuOpen(false)} />
        </div>
      </aside>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-3 md:px-8">
          {showNavigation ? (
            <p className="text-sm text-slate-800">{m.app.tagline}</p>
          ) : (
            <p className="text-xl font-bold text-brand-800">{m.app.name}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            {showNavigation && (
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                {m.common.logout}
              </button>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
