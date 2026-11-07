const PUBLIC_PATHS = new Set(["/login", "/setup"]);

/** Where to send the browser, or null to stay. The session cookie is only a presence check. */
export function authRedirect(pathname: string, hasSession: boolean): string | null {
  const isPublic = PUBLIC_PATHS.has(pathname);
  if (!hasSession && !isPublic) return "/login";
  if (hasSession && isPublic) return "/";
  return null;
}
