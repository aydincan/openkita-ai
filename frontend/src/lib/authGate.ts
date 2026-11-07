const PUBLIC_PATHS = new Set(["/login", "/setup"]);

/**
 * Where to send the browser, or null to stay.
 * Cookie presence only gates the rest of the app. Login and setup stay reachable
 * so a leftover or invalid cookie cannot trap the visitor there.
 */
export function authRedirect(pathname: string, hasSession: boolean): string | null {
  if (PUBLIC_PATHS.has(pathname)) return null;
  if (!hasSession) return "/login";
  return null;
}
