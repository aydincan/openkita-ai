# Contributing

Thanks for helping! OpenKita AI is built for people who work with children, so we favour
small, honest, well-tested changes.

## Ground rules

- **No real personal data** (children, parents, staff) anywhere: code, tests, issues, screenshots.
- No proprietary cloud dependencies; everything must be self-hostable.
- No UI element that looks functional but does nothing. Unbuilt features are labelled as such.
- Respect the principles in [PRD.md](PRD.md) (out-of-scope list, human-in-the-loop, no child assessment).
- Architectural changes need an ADR in `docs/decisions/`.

## Workflow

1. Open an issue (or comment on one) before larger work.
2. Branch from `main`, keep PRs focused.
3. Run the checks from [installation.md](installation.md#checks). CI
   (`.github/workflows/ci.yml`, GitHub Actions) runs them on every push/PR and must be green:
   - backend: lock-file freshness (`uv lock --check`), `ruff check`, `ruff format --check`, `mypy`,
     `pytest` against a real `pgvector/pgvector` PostgreSQL service, and Alembic
     upgrade → downgrade → upgrade;
   - frontend: `npm ci`, `lint`, `typecheck`, `test`, `build`;
   - docker: `docker compose config` validation and an image build.
   Actions are pinned to commit SHAs; Dependabot proposes updates. Changing Python dependencies
   means updating `uv.lock` and `requirements.lock.txt` (see installation.md).
4. Add/adjust tests and docs. New UI text goes into **both** catalogs (`de.ts` is the source of
   truth, `en.ts` must satisfy its type).

## Code style

- Python: ruff (line length 100), strict mypy, layering `api → services → ai/models/...`.
- TypeScript: strict, no `any`; features live in `src/features/<name>`.
- Commit messages: imperative, short subject (Conventional Commits welcome).

## Licence

Contributions are accepted under the [Apache License 2.0](../LICENSE) (inbound = outbound): by
submitting a pull request you agree that your contribution is licensed under it. A
`Signed-off-by:` line (DCO, `git commit -s`) is welcome but not required.
