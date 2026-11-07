import { NextResponse, type NextRequest } from "next/server";
import { authRedirect } from "@/lib/authGate";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Presence only. Login and setup stay open when the cookie is stale (authRedirect).
  const hasSession = request.cookies.has("openkita_session");
  const target = authRedirect(pathname, hasSession);
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url);
  }
  const headers = new Headers(request.headers);
  headers.set("x-openkita-public", pathname === "/login" || pathname === "/setup" ? "1" : "0");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
