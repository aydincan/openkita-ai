import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.modules.documents.title };
}

export default async function Page() {
  const { messages } = await getI18n();
  return (
    <ComingSoon
      title={messages.modules.documents.title}
      description={messages.modules.documents.description}
      messages={messages}
    />
  );
}
