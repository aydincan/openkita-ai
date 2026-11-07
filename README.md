# OpenKita AI

**Product:** [https://sticker-topic-apart-unlike.trycloudflare.com](https://sticker-topic-apart-unlike.trycloudflare.com)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Less paperwork. Better communication. More time for children.**
*(Weniger Papierkram. Bessere Kommunikation. Mehr Zeit für die Kinder.)*

OpenKita AI is a completely open-source, **self-hosted AI assistant for German childcare
facilities** (Kitas / Kindergärten). It is **not** a Kita management system: it is an assistant
that eases administrative and communication work, with local-first AI (Ollama) and a human always
in the loop.

> **Status: v0.1 (Hackathon MVP) – foundation step complete.** The application shell, backend, database, health/status
> display and developer tooling exist. The assistants themselves are **not built yet**; their pages
> say so honestly.

## Vision

| Planned module | What it will do |
|---|---|
| **Parent Communication** | Draft newsletters, announcements and invitations; translate DE/EN/TR/AR; export PDF/DOCX; draft → human approval |
| **Administration** | Turn notes into meeting minutes, checklists and task lists |
| **Kita Knowledge** | Answer questions from your own PDF/DOCX/TXT/MD documents (RAG, pgvector) with citations – never inventing policies |

Planned cross-cutting: authentication, and a mandatory **Privacy Gateway** (Presidio + spaCy German,
fail closed, external AI off by default). Explicitly out of scope: full Kita management, payroll,
scheduling, accounting, child profiles, parent apps, sending messages, child assessments, voice,
automated staff decisions. See [docs/PRD.md](docs/PRD.md) for requirements and the roadmap v0.1 → v1.0.

## Privacy and GDPR – an honest statement

OpenKita AI is designed for privacy (self-hosted, local-first, no telemetry, external AI disabled
by default), but **the software does not by itself establish GDPR/DSGVO compliance.** Compliance
depends on how you operate it (legal basis, processing records, agreements, security measures,
your data protection officer). This version processes no personal data yet. Details:
[docs/privacy.md](docs/privacy.md).

## Quick start (Docker Compose)

```bash
cp .env.example .env          # then set a strong POSTGRES_PASSWORD (required, left empty on purpose)
docker compose up --build
```

- App: <http://localhost:3000> (German by default; switch language in the header)
- Health: <http://localhost:8000/health> (status) · <http://localhost:8000/health/live> (liveness)
- API docs (`/docs`) are only available with `APP_ENV=development` (disabled by default in Docker)
- Optional local AI: `docker compose --profile ollama up --build`

> ⚠️ There is no authentication yet. Do not expose this version to the internet.

## Local development

```bash
# Backend (Python 3.12+, uv, PostgreSQL with pgvector running; reads the root .env)
cd backend && uv sync --frozen --extra dev && uv run alembic upgrade head
uv run uvicorn app.main:create_app --factory --reload

# Frontend (Node 22+)
cd frontend && export NEXT_TELEMETRY_DISABLED=1 && npm ci && npm run dev
```

Checks: `uv run ruff check . && uv run mypy && uv run pytest` (backend), `npm run lint && npm run typecheck && npm test && npm run build` (frontend).
Full instructions: [docs/installation.md](docs/installation.md).

## Tech stack

Next.js · TypeScript · Tailwind CSS · FastAPI · Pydantic · SQLAlchemy 2 (async) · Alembic ·
PostgreSQL + pgvector · Docker Compose · Ollama (optional). Rationale: [docs/decisions/](docs/decisions/).

## Project structure

```
backend/      FastAPI app (api, core, models, schemas, services, ai, documents, security) + tests
frontend/     Next.js app (app, components, features, lib, types)
deployment/   Docker helper files and scripts
docs/         architecture, installation, privacy, contributing, api, PRD, ADRs
examples/     synthetic sample documents
```

See [docs/architecture.md](docs/architecture.md).

## Contributing

See [docs/contributing.md](docs/contributing.md). Never include real personal data. CI runs on GitHub Actions.

## Licence

OpenKita AI is licensed under the [Apache License 2.0](LICENSE); see also [NOTICE](NOTICE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
