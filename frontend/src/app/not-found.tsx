import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { messages: m } = await getI18n();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">{m.common.notFoundTitle}</h1>
      <p className="mt-3 text-slate-800">{m.common.notFoundBody}</p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
      >
        {m.common.backToDashboard}
      </Link>
    </div>
  );
}
