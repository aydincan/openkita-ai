# Installation

## Requirements

- **Docker route:** Docker Engine/Desktop with Compose v2. About 2 GB RAM for the base stack;
  a local LLM via Ollama needs considerably more (8 GB+ for an 8B model).
- **Local development route:** Node.js 22+, Python 3.12+, PostgreSQL 16 with the
  [pgvector](https://github.com/pgvector/pgvector) extension (optional: Ollama).

## 1. Docker Compose (quick start)

```bash
cp .env.example .env
# edit .env: set POSTGRES_PASSWORD to a strong, unique value (it is intentionally empty)
docker compose up --build
```

`POSTGRES_PASSWORD` is **required**: Docker Compose refuses to start while it is empty, and both
the database entrypoint and the backend refuse placeholders such as `change-me`. Any characters
are allowed (the backend builds the connection URL itself and encodes them); quote values
containing special characters in
`.env`, e.g. `POSTGRES_PASSWORD='p@ss/w0rd:#?'`. Generate one with `openssl rand -base64 24`.

Open <http://localhost:3000>. The first visit asks for the facility name and the first
administrator. There is no default account and no default password; short passwords and
placeholders such as `change-me` are refused. After that, setup stays closed. Sign in to see
the dashboard (welcome, AI status, recent drafts). Liveness probe:
<http://localhost:8000/health/live>, component status: <http://localhost:8000/health>.
The interactive API docs (`/docs`) are **disabled** when `APP_ENV=production` (the Compose
default); set `APP_ENV=development` to enable them (they load Swagger UI assets from a CDN).

The UI starts even when the backend or database is down; the status panel then shows the outage.

With a local Ollama (optional, needs resources):

```bash
docker compose --profile ollama up --build
docker compose exec ollama ollama pull llama3.1:8b    # once
```

Without the `ollama` profile the app runs normally; the status panel shows the AI provider as
unreachable with a hint (non-fatal). Set `AI_PROVIDER=none` in `.env` to show it as disabled instead.

Stop: `docker compose down` (add `-v` to also delete database and model volumes).

If you already run Ollama on the host, set `OLLAMA_BASE_URL` for the backend accordingly (in
`docker-compose.yml`, the backend's `OLLAMA_BASE_URL` points at the `ollama` service).

### Production notes

All ports bind to `127.0.0.1`. Put a reverse proxy with TLS (Caddy, nginx, Traefik) in front,
and only expose the frontend. A public HTTPS deployment must set `SESSION_COOKIE_SECURE=true`.
Leave it `false` for localhost HTTP: the session cookie is `HttpOnly` and `SameSite=Lax`, and
it is not marked `Secure` there. **Do not expose this version to the internet** without TLS
and `SESSION_COOKIE_SECURE=true`.

The frontend proxy rejects state-changing requests whose `Origin` host does not match the
request `Host`. When a reverse proxy presents a different host, set `PUBLIC_ORIGIN` to the
public origin, for example `https://kita.example`.

## 2. Local development

### Configuration

One root `.env` (copied from `.env.example`) serves both Docker Compose and local backend
development: the backend reads `<repo>/.env` regardless of the working directory (a `.env` in the
current directory overrides it). For local runs keep `POSTGRES_HOST=localhost` and set
`APP_ENV=development` if you want `/docs`.

### Database

Either run only the database container with its port published
(`docker compose -f docker-compose.yml -f deployment/docker/compose.dev.yml up -d db`, uses `DB_PORT`,
default 5432), or use a local PostgreSQL with pgvector. The database, user and password must match
`POSTGRES_*` in `.env`.

### Backend

Using [uv](https://docs.astral.sh/uv/) (recommended; installs exactly the locked versions):

```bash
cd backend
uv sync --frozen --extra dev          # creates .venv from uv.lock
uv run alembic upgrade head
uv run uvicorn app.main:create_app --factory --reload --port 8000
```

Without uv: `python3.12 -m venv .venv && source .venv/bin/activate && pip install --require-hashes -r requirements.lock.txt`
(runtime only; add `pytest pytest-asyncio httpx2 ruff mypy` yourself to run the checks).
After changing dependencies in `pyproject.toml` run `uv lock` and
`uv export --frozen --no-emit-project --format requirements-txt -o requirements.lock.txt`
(CI verifies both are current).

### Frontend

```bash
cd frontend
export NEXT_TELEMETRY_DISABLED=1      # privacy: opt out of Next.js telemetry (or: npx next telemetry disable)
npm ci
BACKEND_INTERNAL_URL=http://localhost:8000 npm run dev
```

### Checks

```bash
# backend
cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
# optional integration test against a real database (reads POSTGRES_* from the environment / .env):
RUN_DB_TESTS=1 uv run pytest

# frontend
cd frontend && npm run lint && npm run typecheck && npm test && npm run build
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Status panel: "Status nicht abrufbar" | Backend not running / `BACKEND_INTERNAL_URL` wrong |
| Status: database "Nicht erreichbar" | Postgres not running, wrong `POSTGRES_*` values/password |
| Backend exits at start with a validation error | Invalid env: empty/placeholder `POSTGRES_PASSWORD`, `EXTERNAL_AI_ENABLED=true`, non-asyncpg `DATABASE_URL` (the error text never contains secrets) |
| `docker compose` says POSTGRES_PASSWORD is missing | Set it in `.env` (see quick start) |
| `/docs` returns 404 | `APP_ENV=production`; use `development` locally |
| `extension "vector" is not available` | Not using a pgvector-enabled Postgres |
| Setup says it is already finished | An administrator exists. Sign in; there is no second setup and no default password |
| Parent letter: model unavailable, no draft saved | Ollama is not running, or `OLLAMA_MODEL` is not pulled. The UI keeps the form and stores nothing |
