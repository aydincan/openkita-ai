# Backend API (v0.1)

Interactive OpenAPI docs: `GET /docs` (Swagger UI), `/redoc`, schema `GET /openapi.json` – **only
when `APP_ENV` is not `production`** (Swagger UI loads assets from a CDN, so production disables them).
Run the API with `uvicorn app.main:create_app --factory` (no import-time app instance).

All responses carry baseline security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cache-Control: no-store`; plus a strict
`Content-Security-Policy` in production).

## `GET /health/live`

Minimal public liveness probe: `200 {"status": "ok"}`. It touches no dependency, so a database
outage does not make the container unhealthy. Used by the Docker `HEALTHCHECK`.

## `GET /health`

Reports API, database and (optional) AI provider status.

- `200` – database reachable (`status: "ok"`)
- `503` – database unreachable (`status: "error"`); the body is still the same JSON shape

The AI component never affects the overall status or HTTP code. `HEALTH_CHECK_TIMEOUT_SECONDS`
(max 5) bounds each check; the frontend proxy waits `BACKEND_TIMEOUT_MS` (default 8000) so the
two stay consistent.

> **Exposure:** `/health` and `/health/live` stay public and coarse (no versions of dependencies,
> no hosts, no error details) so probes keep working. Account and draft routes require a session.

```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "production",
  "components": {
    "api":      { "status": "up",       "detail": null, "latency_ms": null },
    "database": { "status": "up",       "detail": null, "latency_ms": 2.1 },
    "ai":       { "status": "disabled", "detail": "AI provider disabled by configuration", "latency_ms": null }
  }
}
```

Component `status` is one of `up`, `down`, `disabled`. `detail` is a short, non-sensitive message.
Each check is bounded by `HEALTH_CHECK_TIMEOUT_SECONDS`.

## Session

Cookie name `openkita_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` only when
`SESSION_COOKIE_SECURE=true`). The database stores the SHA-256 of the token (ADR 0005).
Protected routes without a valid session return `401 {"detail":"unauthenticated"}`.

Errors use `{ "detail": "<stable_code>" }`. The UI translates the code. Codes:
`invalid_credentials`, `unauthenticated`, `weak_password`, `setup_closed`, `email_taken`,
`forbidden`, `cannot_deactivate`, `model_unavailable`, `invalid_model_output`,
`skill_unavailable`, `export_not_confirmed`, `not_found`, `validation_error`.

## `GET /setup/status`

`200 {"needs_setup": true|false}`. Public. True only while no administrator exists.

## `POST /setup`

Body: `facility_name`, `display_name`, `email`, `password`. Creates the facility and the first
administrator, sets the session cookie, returns `201` and the user (no password hash).
`409 setup_closed` after that. `422 weak_password` for a short password or a placeholder
(`change-me`, `password`, `postgres`, `openkita`, `secret`, and the same list as the database).
There is no default password.

## `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`

Login body: `email`, `password`. Success sets the cookie and returns the user.
Wrong password, unknown email and a deactivated user all return `401 invalid_credentials`.
Logout is `204` and clears the cookie. `GET /auth/me` returns the current user.

## `GET /facility` · `PATCH /facility`

Any signed-in user of that facility can read `{id, name}`. Only an administrator can rename it
(`{"name": "..."}`). An educator receives `403 forbidden`.

`PATCH /facility/region` with `{"region_code": "50"}` or `{"region_code": null}` sets the coarse
public region used for the environment outlook (a DWD pollen area, not an address).
Administrators only. An unknown code is `422 invalid_region`. The response adds
`exposure_region_code` and `exposure_region_label`.

## `GET /exposure/regions` · `GET /exposure`

Any signed-in user can read the region list and the outlook. The outlook covers heat, UV,
pollen and air for that coarse region.

Each topic is `origin: "live"` or `origin: "synthetic"`. A live topic is a reading from
Deutscher Wetterdienst (pollen `s31fg.json`, UV `uvi.json`, heat `gt.json`, CC BY 4.0) or
Umweltbundesamt air data API v4 (`dl-de/by-2-0`). Requests send only the place that API needs
(a published city or station code). The facility id is not sent. Documents are cached on the
host with the source timestamp. A timestamp older than 36 hours sets `stale: true`; the live
numbers stay.

When the region is missing, the source does not answer, the document cannot be read, or that
source has no published place for the region, that topic is a fixed sample for the fictional
area `Beispielgebiet Nordlicht`. Synthetic topics set `sample_label_de` to
`Beispieldaten, nicht live` and `sample_label_en` to `Sample data, not live`. A successful live
reading is never replaced by the sample. The payload has no child, staff or illness fields.
RKI is not called.

## `GET /users` · `POST /users` · `POST /users/{id}/deactivate`

Administrator only, and only users of the caller's facility. `POST` always creates an
**educator** (a second administrator is not created here). Deactivating an administrator
returns `403 cannot_deactivate`. Deactivation also deletes that user's sessions.
`409 email_taken` when the email already exists.

## Drafts

All draft routes require a session and filter on `facility_id`. Another facility's id is `404`.

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/drafts` | Newest first, at most 20, for this facility |
| `POST` | `/drafts/parent-communication` | Runs the local model. Body: `facts`, `tone`, `language` (`de`/`en`/`tr`/`ar`), `message_type`, optional `kita_name`, `sender`, `group_name`, `reply_by` |
| `GET` | `/drafts/{id}` | One draft |
| `PATCH` | `/drafts/{id}` | Saves edited `subject` and `body`. An approved draft returns to `draft` |
| `POST` | `/drafts/{id}/approve` | Sets `status` to `approved`. Does not send anything |
| `POST` | `/drafts/{id}/export/pdf` and `.../docx` | File download. Requires `?confirm=true`, otherwise `400 export_not_confirmed`. `GET` does not export |

Generation asks Ollama for JSON, validates it against the parent-communication schema, and
stores the letter rendered on the server from those fields. The response is labelled
`ai_generated: true` and has no field that claims the letter was sent. `503 model_unavailable`
or `503 skill_unavailable`, and `422 invalid_model_output`, save nothing.

`tr` and `ar` are accepted as experimental languages. The stored letter includes a warning that
a fluent speaker must review it. The default model is not treated as supporting those languages.

Export filenames are `elternbrief.pdf` and `elternbrief.docx`. The file is the saved body plus
the footer `KI-Entwurf. Von einer Fachkraft zu prüfen. Nicht versendet.`

## Frontend proxy

The browser calls the **frontend** origin only.

- `GET /api/health` forwards to `GET /health` (`BACKEND_TIMEOUT_MS`, default 8000, allowed 7000–9000).
- `/api/backend/<path>` forwards cookie, body and query for an allow-listed path
  (`setup`, `auth`, `facility`, `facility/region`, `users`, `drafts`, `exposure`,
  `exposure/regions` and the export routes). Anything else,
  including `..`, is `404 {"error":"not_found"}` and is not forwarded.
  `POST`, `PATCH`, `PUT` and `DELETE` require an `Origin` whose host matches the request
  `Host`, or an origin equal to `PUBLIC_ORIGIN`. A missing or other origin is
  `403 {"error":"cross_site_request"}` and is not forwarded.
  Letter generation uses `BACKEND_GENERATE_TIMEOUT_MS` (default 130000, allowed 10000–300000).

Backend JSON answers (including `503`) are passed through. Otherwise:
`502 {"error":"backend_unreachable"}`, `504 {"error":"backend_timeout"}`.
The health proxy still uses `502 {"error":"backend_invalid_response"}` when the body is not a JSON object.

## Conventions

- JSON for API bodies; Pydantic models in `app/schemas`. No prompt or document content in logs.
- Errors: HTTP status plus `{ "detail": "<stable_code>" }`, never stack traces.
  Request validation uses the same shape. A known field code such as `weak_password` is
  returned as that code; other invalid bodies are `validation_error`. The submitted value
  is not included.
