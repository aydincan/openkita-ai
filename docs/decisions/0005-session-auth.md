# 0005 – Server-side session cookie

Status: Accepted

## Context

v0.1 needs a login for one facility (ADR 0004). The browser must not hold a credential that
page scripts can read. A CSRF token and the Privacy Gateway are later work (ADR 0003).

## Decision

- Passwords are hashed with argon2-cffi (MIT). A password must be 8–128 characters and must
  not be one of the placeholders already refused for `POSTGRES_PASSWORD`
  (`change-me`, `changeme`, `change_me`, `password`, `postgres`, `openkita`, `secret`, empty).
- A session token is `secrets.token_urlsafe(32)`, sent in the cookie `openkita_session`.
  The database stores only the SHA-256 hex digest. The cookie is `HttpOnly`, `SameSite=Lax`,
  `Path=/`. `Secure` is set only when `SESSION_COOKIE_SECURE=true` (default `false`, because
  Compose serves HTTP on localhost). Lifetime is `SESSION_TTL_HOURS` (default 12, range 1–168).
- Logout deletes the session row and clears the cookie. Deactivating a user deletes that
  user's sessions. An unknown email and an inactive account both run a dummy argon2 verify
  and return the same `invalid_credentials` body as a wrong password.
- Authorisation: an educator cannot manage users or change facility settings. Every query for
  user-owned rows filters on the caller's `facility_id`. A draft from another facility is
  `404`, the same as a missing draft.
- The facility and the first administrator are created by `POST /setup`. A second setup
  returns `409 setup_closed`. There is no default account and no default password.
- SameSite=Lax is the v0.1 control for cookie-authenticated requests. A separate CSRF token
  is deferred until a browser is exposed beyond a trusted origin.

## Consequences

+ A script on the page cannot read the session token. Localhost HTTP works without `Secure`.
− A foreign site can still attempt some cross-site requests that SameSite=Lax allows.
  Set `SESSION_COOKIE_SECURE=true` behind TLS, and add a CSRF token, before exposing the UI
  beyond localhost.
