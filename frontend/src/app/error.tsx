"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { messages: m } = useI18n();
  const router = useRouter();

  function retry() {
    // Re-fetch server components first, then re-render the failed segment.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-900">
      <h1 className="text-2xl font-bold">{m.common.errorTitle}</h1>
      <p className="mt-2">{m.common.errorBody}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-4 rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900"
      >
        {m.common.retry}
      </button>
    </div>
  );
}
