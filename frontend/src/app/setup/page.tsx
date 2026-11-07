import type { Metadata } from "next";
import { SetupForm } from "@/features/auth/AuthForms";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.auth.setupTitle };
}

export default function SetupPage() {
  return <SetupForm />;
}
