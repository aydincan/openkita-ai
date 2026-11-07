const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

const ALLOWED = new RegExp(
  `^(setup/status|setup|auth/(login|logout|me)|facility|users|users/${UUID}/deactivate|drafts|drafts/parent-communication|drafts/${UUID}(/approve|/export/(pdf|docx))?)$`,
);

/** Join path segments and allow only known backend routes. */
export function safeBackendPath(parts: string[]): string | null {
  if (parts.some((part) => part === "" || part === "." || part === ".." || part.includes("/"))) {
    return null;
  }
  const path = parts.join("/");
  return ALLOWED.test(path) ? path : null;
}

export function backendTimeoutMs(path: string, method: string, shortMs: number, longMs: number): number {
  if (method === "POST" && path === "drafts/parent-communication") return longMs;
  return shortMs;
}

const STATE_CHANGING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** `scheme://host` for an HTTP origin, or null when the value is not one. */
function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * SameSite=Lax does not stop a foreign page from POSTing here. State-changing
 * proxy calls need an Origin whose host matches the incoming Host, or an Origin
 * equal to the configured public origin. A missing Origin is rejected.
 */
export function stateChangingOriginAllowed(
  method: string,
  originHeader: string | null,
  hostHeader: string | null,
  publicOrigin: string | null | undefined,
): boolean {
  if (!STATE_CHANGING.has(method)) return true;
  const origin = originHeader ? httpOrigin(originHeader) : null;
  if (!origin) return false;
  const host = hostHeader?.trim().toLowerCase() ?? "";
  if (host !== "" && new URL(origin).host.toLowerCase() === host) return true;
  const configured = publicOrigin?.trim() ? httpOrigin(publicOrigin.trim()) : null;
  return configured !== null && configured === origin;
}
