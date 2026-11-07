"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { NAV_ITEMS } from "@/lib/navigation";

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { messages: m } = useI18n();

  return (
    <nav aria-label={m.common.mainNavigation}>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-brand-700 text-white"
                    : "text-slate-900 hover:bg-slate-200"
                }`}
              >
                <span>{m.nav[item.key]}</span>
                {!item.available && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      active ? "bg-white text-brand-800" : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {m.nav.soonBadge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
