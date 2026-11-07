import type { Messages } from "@/lib/i18n";

export async function readErrorCode(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return "generic";
    if ("detail" in payload && typeof payload.detail === "string") return payload.detail;
    if ("detail" in payload && Array.isArray(payload.detail)) return "validation_error";
    if ("error" in payload && typeof payload.error === "string") return payload.error;
  } catch {
    return "backend_invalid_response";
  }
  return "generic";
}

export function errorText(code: string, messages: Messages): string {
  if (Object.prototype.hasOwnProperty.call(messages.errors, code)) {
    return messages.errors[code as keyof Messages["errors"]];
  }
  return messages.errors.generic;
}
