"use client";

import "./globals.css";

/**
 * Last-resort boundary: replaces the root layout, so it cannot use the i18n provider or the
 * app shell. Static bilingual text (German first, the product default).
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="de">
      <body>
        <main className="mx-auto max-w-xl p-8">
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-900">
            <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
            <p className="mt-2">
              Die Anwendung konnte nicht geladen werden. Bitte versuchen Sie es erneut.
            </p>
            <p lang="en" className="mt-1 text-sm">
              The application could not be loaded. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900"
            >
              Erneut versuchen / Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
