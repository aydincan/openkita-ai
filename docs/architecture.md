# OpenKita AI – Architecture (Foundation, v0.1)

This document describes the architecture and project structure of the **project foundation**
(first step of roadmap v0.1). It was written *before* the implementation and is kept up to date with it.
Anything marked **planned** is intentionally not implemented yet.

## 1. Goals and constraints

- Self-hosted, open-source, no mandatory proprietary cloud service.
- Local-first AI (Ollama) behind a provider-independent interface.
- One facility per deployment, but data model and code stay multi-facility-ready (ADR 0004).
- Privacy by design: external AI disabled by default, a mandatory Privacy Gateway is planned
  (ADR 0003). No child profiles, no automated assessments.
- All configuration through environment variables (`.env.example` is complete, contains no secrets).

## 2. System overview

```
 Browser ──HTTP──► frontend (Next.js, :3000)
                      │  server-side proxies  /api/health , /api/backend/*
                      ▼
                   backend (FastAPI, :8000) ──SQLAlchemy async──► db (PostgreSQL + pgvector, :5432)
                      │
                      ├── app.ai (provider interface) ──HTTP──► ollama (optional, :11434)
                      └── app.skills (loader) ◄── read-only mount of skills/
```

- The browser only talks to the frontend origin. Server-side route handlers forward `/api/health`
  and an allow-listed set of backend paths (`/api/backend/...`) using `BACKEND_INTERNAL_URL`.
  The proxy forwards the session cookie and `Set-Cookie`. This keeps the backend URL out of the
  client bundle. The backend still has a configurable CORS allow-list (credentials on, explicit
  origins) for people who run the frontend elsewhere.
- Ollama is **optional**. Its absence never makes `/health` fail (it is reported as
  `down`/`disabled`); only the database is a *required* dependency.

## 3. Repository layout

```
.
├── docker-compose.yml          # db, backend, frontend; ollama via profile "ollama"
├── .env.example                # every configuration variable, no secrets
├── README.md
├── LICENSE                     # Apache License 2.0
├── NOTICE
├── THIRD_PARTY_NOTICES.md
├── .github/                    # workflows/ci.yml, dependabot.yml
├── backend/
│   ├── pyproject.toml          # deps (bounded), ruff, mypy, pytest config
│   ├── uv.lock, requirements.lock.txt   # locked dependencies (hashes)
│   ├── docker-entrypoint.sh    # wait for DB → migrate → serve
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/                # async migration environment + versions/
│   ├── app/
│   │   ├── main.py             # app factory, lifespan, CORS, router wiring
│   │   ├── api/                # HTTP layer only: routers + dependencies
│   │   │   ├── deps.py         # session user, parent-communication skill
│   │   │   └── routes/         # health, auth, facility, users, drafts
│   │   ├── core/               # settings (pydantic-settings), logging, database engine/session
│   │   ├── models/             # facility, users, sessions, drafts (facility_id on user-owned rows)
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # auth, drafts, health; no HTTP, no ORM leakage
│   │   ├── skills/             # thin loader, prompt, JSON validation, letter renderer, runner
│   │   ├── ai/                 # provider interface, Ollama connection test + local generate
│   │   ├── documents/          # PDF (reportlab) and DOCX (python-docx) export of a saved draft
│   │   └── security/           # argon2 passwords + server-side sessions; Privacy Gateway planned
│   └── tests/                  # pytest: health, config, DB failure, AI provider
├── frontend/
│   ├── package.json, tsconfig.json, next.config.ts, eslint, vitest config
│   ├── Dockerfile
│   └── src/
│       ├── app/                # App Router: dashboard, setup, login, users, parent letter, proxies
│       ├── components/         # presentational UI (layout shell, navigation, ui primitives)
│       ├── features/           # feature slices (status/ = health widget + hook)
│       ├── lib/                # i18n, config, API client, helpers
│       ├── types/              # shared TypeScript types mirroring backend schemas
│       └── test/               # test setup
├── deployment/
│   ├── docker/                 # postgres-init.sql (CREATE EXTENSION vector), compose.dev.yml (publish DB port)
│   └── scripts/                # smoke-test.sh (checks a running stack)
├── docs/                       # architecture, installation, privacy, contributing, api, PRD, decisions/
└── examples/sample-documents/  # synthetic, non-personal sample content for later modules
```

### Layering rules (backend)

`api → services → (ai | models/db | documents | security)`; never the reverse.
Routers contain no business logic; services take their dependencies (session, provider,
settings) as arguments, which keeps them unit-testable without a running server.

## 4. Backend design

| Concern | Decision |
|---|---|
| Framework | FastAPI + Pydantic v2, fully typed (mypy strict-ish) |
| Config | `pydantic-settings`, plain env variable names, all documented in `.env.example`; cached `get_settings()`. The DB URL is assembled from `POSTGRES_*` with `sqlalchemy.URL.create` (any password characters work); secrets are `SecretStr`, validation errors never echo input; empty/placeholder passwords are refused; the root `.env` is found from any working directory |
| App factory | `uvicorn app.main:create_app --factory`; no instance or settings are created at import time |
| Hardening | Security-headers middleware (strict CSP in production); interactive docs only when `APP_ENV != production` |
| Database | PostgreSQL 16 with pgvector image; SQLAlchemy 2.x (2.1, locked) **async** (`asyncpg`) + Alembic, deterministic constraint naming (ADR 0001) |
| Health | `GET /health` → `{status, version, components:{api, database, ai}}`. `status` is `ok` when the DB is up, otherwise `error` (see below) |
| AI | `AIProvider` (`check_connection`, `generate`); Ollama `/api/tags` and `/api/generate`; disabled provider returns a failed generation and does not call the network. Prompts and replies are not logged |
| Errors | Dependency failures never produce a stack trace to the client; the DB check returns `{status: "down"}` with a short, non-sensitive message and the HTTP status is `503` |

### `/health` semantics

- `database` is **required**: `up` or `down`.
- `ai` is **optional**: `up`, `down` (configured but unreachable), or `disabled`.
- Overall `status`: `ok` (DB up), `error` (DB down). The AI component never changes overall
  status, so a deployment without Ollama is healthy.
- HTTP code: `200` when `ok`, `503` when `error`.
- Each external check has a short timeout (`HEALTH_CHECK_TIMEOUT_SECONDS`, max 5 s) so `/health`
  cannot hang; the frontend proxy waits `BACKEND_TIMEOUT_MS` (default 8 s), the browser 10 s.
- `GET /health/live` is a dependency-free liveness probe, used by the container `HEALTHCHECK`
  (a database outage must not mark the backend container unhealthy). `/health` stays public
  and coarse so probes keep working. Account and draft routes require a session.

## 5. Frontend design

- Next.js (App Router) + TypeScript + Tailwind CSS v4.
- **i18n**: a small typed dictionary (`lib/i18n`): `de` is the source of truth and defines the
  `Messages` type; `en` must satisfy it (compile-time completeness). Locale is stored in a cookie,
  read on the server for first paint (no hydration flicker), default `de`. Adding a language =
  adding one file and registering it. No dependency required.
- **Layout**: skip-link, header with language switcher, responsive sidebar/top navigation
  (collapsible on small screens), landmark roles, visible focus rings, WCAG-AA contrast palette.
- **Navigation**: Dashboard, Exposure (Belastung), Parent Communication, Users (administrators),
  Administration, Kita Knowledge, Documents, Settings. Exposure, parent communication, users and
  settings are real pages. Administration, knowledge and documents render `ComingSoon`.
  No control pretends to send a letter.
- **Session gate**: middleware redirects to `/login` when the session cookie is absent, and away
  from `/login` and `/setup` when it is present. The API still answers `401` for an invalid cookie.
- **Dashboard**: welcome (display name), the health panel, an environment outlook, recent drafts,
  and shortcuts.
- **Status feature** (`features/status`): `useHealth` hook (fetch with abort + timeout) →
  `StatusPanel` with explicit `loading`, `error` (with retry button, which really retries) and
  `success` states, shown on the dashboard.

## 6. Data model

Alembic `0001` enables `vector`. `0002` adds:

| Table | Role |
|---|---|
| `deployment_state` | Singleton (`id = 1`). `setup_completed` closes first-run setup |
| `facilities` | One row per deployment, created by setup. Optional `exposure_region_code` is a coarse DWD area, not an address |
| `users` | Email, argon2 hash, display name, role `administrator` or `educator`, `facility_id`, `active` |
| `sessions` | SHA-256 of the cookie token, `facility_id`, expiry |
| `drafts` | Parent-letter draft: status `draft` or `approved`, rendered body, validated fields, `facility_id` |

There are no child profiles. Every user-owned row has `facility_id` and services filter on the
caller's facility (ADR 0004). Documents and vector chunks remain planned.

## 7. Deployment

`docker compose up --build` starts `db`, `backend` and `frontend` (Next.js standalone build).
The backend mounts `./skills` read-only at `/srv/skills`.
The database entrypoint refuses placeholder passwords (such as `change-me`) before PostgreSQL
initialises. The backend entrypoint waits for the database (retry), runs `alembic upgrade head`,
then serves via the app factory. The frontend depends on the backend with `service_started`, so the
UI is available (and shows the outage) even when the database or backend is down.
`docker compose --profile ollama
up` additionally starts Ollama. Ports are bound to `127.0.0.1`. Healthchecks live in the
Dockerfiles (`HEALTHCHECK`) and for `db` in the compose file. Base and service images are pinned by
tag and digest; Python dependencies are installed from the hash-locked `requirements.lock.txt`
(exported from `uv.lock`) before the application code is copied (layer caching). The frontend sends
CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`
headers (`next.config.ts`). CI: `.github/workflows/ci.yml`.

## 8. Planned (not built in this step)

Administration assistant, Kita knowledge / RAG, document ingestion, the Privacy Gateway
outbound path, the MCP server and MCP client, skill-version pinning, and a CSRF token beyond
SameSite=Lax. See [PRD.md](PRD.md) and [decisions/](decisions/README.md).
