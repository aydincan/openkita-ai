import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { I18nProvider } from "@/lib/i18n/provider";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return {
    title: { default: messages.app.name, template: `%s · ${messages.app.name}` },
    description: messages.app.tagline,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = await getI18n();
  const headerStore = await headers();
  const showNavigation = headerStore.get("x-openkita-public") !== "1";
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale} messages={messages}>
          <AppShell showNavigation={showNavigation}>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
