import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/AuthForms";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.auth.loginTitle };
}

export default function LoginPage() {
  return <LoginForm />;
}
