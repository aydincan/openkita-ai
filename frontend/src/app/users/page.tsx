import type { Metadata } from "next";
import { UserAdmin } from "@/features/users/UserAdmin";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.users.title };
}

export default function UsersPage() {
  return <UserAdmin />;
}
