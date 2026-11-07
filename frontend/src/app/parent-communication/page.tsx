import type { Metadata } from "next";
import { Suspense } from "react";
import { LetterStudio } from "@/features/parent-communication/LetterStudio";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { messages } = await getI18n();
  return { title: messages.modules.parentCommunication.title };
}

export default async function Page() {
  const { messages } = await getI18n();
  return (
    <Suspense fallback={<p>{messages.common.loading}</p>}>
      <LetterStudio />
    </Suspense>
  );
}
