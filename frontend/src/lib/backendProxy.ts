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
