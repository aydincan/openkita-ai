import Link from "next/link";
import type { Messages } from "@/lib/i18n";

type Props = {
  title: string;
  description: string;
  messages: Messages;
};

/** Honest placeholder for modules that are not built yet: text only, no fake controls. */
export function ComingSoon({ title, description, messages }: Props) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 max-w-prose text-slate-800">{description}</p>
      <section
        aria-labelledby="coming-soon-heading"
        className="mt-8 rounded-xl border border-dashed border-slate-400 bg-white p-6"
      >
        <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-950">
          {messages.comingSoon.badge}
        </p>
        <h2 id="coming-soon-heading" className="mt-3 text-xl font-semibold text-slate-900">
          {messages.comingSoon.heading}
        </h2>
        <p className="mt-2 max-w-prose text-slate-800">{messages.comingSoon.body}</p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          {messages.common.backToDashboard}
        </Link>
      </section>
    </div>
  );
}
