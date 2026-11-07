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
- SameSite=Lax does not stop a foreign site from POSTing to login. The frontend proxy rejects
  `POST`, `PATCH`, `PUT` and `DELETE` unless `Origin` is present and its host matches the
  request `Host`, or the origin equals `PUBLIC_ORIGIN`. Draft export is `POST` with
  `confirm=true`. A separate CSRF token remains later work.

## Consequences

+ A script on the page cannot read the session token. Localhost HTTP works without `Secure`.
  A cross-site state-changing request through the frontend proxy is rejected.
− SameSite=Lax still sends the cookie on a cross-site top-level GET. A client that reaches
  the backend directly, past the frontend proxy, is outside the Origin check. A public HTTPS
  deployment must set `SESSION_COOKIE_SECURE=true`.
