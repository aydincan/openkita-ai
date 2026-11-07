import type { Messages } from "@/lib/i18n";

export type NavKey = keyof Pick<
  Messages["nav"],
  | "dashboard"
  | "exposure"
  | "parentCommunication"
  | "administration"
  | "knowledge"
  | "documents"
  | "users"
  | "settings"
>;

export type NavItem = {
  key: NavKey;
  href: string;
  /** false = module not built yet; its page shows an honest "coming later" state. */
  available: boolean;
};

/** Every href must point to an existing page (enforced by navigation.test.ts). */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "dashboard", href: "/", available: true },
  { key: "exposure", href: "/exposure", available: true },
  { key: "parentCommunication", href: "/parent-communication", available: true },
  { key: "administration", href: "/administration", available: false },
  { key: "knowledge", href: "/knowledge", available: false },
  { key: "documents", href: "/documents", available: false },
  { key: "users", href: "/users", available: true },
  { key: "settings", href: "/settings", available: true },
];
