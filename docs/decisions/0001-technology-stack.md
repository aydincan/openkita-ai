# 0001 – Technology stack

Status: Accepted

## Context
OpenKita AI must be self-hostable on modest hardware, easy for contributors, and ready for
Python-based AI/NLP tooling (Presidio, spaCy, document parsers) and pgvector-based retrieval.

## Decision
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS. Typed dictionaries for i18n
  instead of an i18n library (two languages, no runtime dependency; revisit when plural/ICU
  formatting is needed). Tests: Vitest + Testing Library.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, pydantic-settings. Python is chosen because the
  planned Privacy Gateway (Presidio, spaCy German) and document tooling are Python-native.
- **Database:** PostgreSQL 16 using the `pgvector/pgvector` image, so vector search is available
  later without changing infrastructure.
- **ORM/migrations:** SQLAlchemy 2.x **async** (`asyncpg`) + Alembic. We target SQLAlchemy **2.1**
  (the version the lock file resolves to and the one all tests/images run on; bounded `<2.2`).
  `Base.metadata` uses a naming convention for constraints; Alembic runs with `compare_type`. Async fits FastAPI and the
  I/O-bound workloads (HTTP calls to Ollama, DB); the health check can enforce timeouts on both.
  Alembic runs with an async engine in `alembic/env.py`.
- **Browser ↔ backend:** the browser only talks to the frontend; a Next.js route handler proxies
  `/api/health` to the backend (`BACKEND_INTERNAL_URL`). No CORS needed by default.
- **Dependencies:** Python dependencies have upper bounds and are locked with `uv.lock`;
  `requirements.lock.txt` (hashes, exported from it) is what the Docker image installs with
  `--require-hashes`. npm uses `package-lock.json` (`npm ci`).
- **Packaging:** Docker Compose (db, backend, frontend; `ollama` profile optional). Images are
  pinned by tag + digest. DB credentials are passed as separate `POSTGRES_*` variables and the
  backend assembles the URL, so any password character is safe.
- **CI:** GitHub Actions (SHA-pinned, read-only permissions) running lint/type/test/build, a real
  pgvector PostgreSQL for the integration test and migrations, and a compose/image build.
- **Quality:** ruff + mypy (strict) + pytest; ESLint + `tsc --noEmit` + Vitest.

## Consequences
+ One language per concern, strong typing on both sides, Python ecosystem for AI.
+ Async DB code is slightly more involved than sync (lazy loading must be avoided; sessions per request).
− Two runtimes (Node, Python) to maintain; mitigated by Docker.
− Frontend types in `src/types` mirror backend schemas manually for now (OpenAPI-generated
  types can be added later).
