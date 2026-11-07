import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { getMessages, type Locale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";

export function renderWithI18n(ui: ReactElement, locale: Locale = "de") {
  return render(
    <I18nProvider locale={locale} messages={getMessages(locale)}>
      {ui}
    </I18nProvider>,
  );
}
