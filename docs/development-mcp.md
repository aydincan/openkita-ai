# Development MCP servers (Cursor)

These MCP servers help **developers** working on OpenKita AI inside Cursor. They are
development tooling only: they are not part of the product, not shipped in Docker images and
never used by a running OpenKita installation. (The product's own MCP server is specified in
[prd-addendum-skills-mcp.md](prd-addendum-skills-mcp.md).)

The project-level configuration lives in [`.cursor/mcp.json`](../.cursor/mcp.json). It contains
**no secrets**. Tokens and connection strings come from a local, git-ignored env file (see below).

## Servers

| Name | Package (pinned) | Purpose | Needs |
|---|---|---|---|
| `context7` | npm `@upstash/context7-mcp@4.5.1` (MIT, [upstash/context7](https://github.com/upstash/context7)) | Current library documentation (FastAPI, Next.js, SQLAlchemy, pgvector …) | Node.js + `npx`. No API key required |
| `github` | Docker `ghcr.io/github/github-mcp-server:v2.1.0`, pinned by digest (MIT, [github/github-mcp-server](https://github.com/github/github-mcp-server)) | Read issues, PRs, Actions runs and repo content | Docker, `GITHUB_PERSONAL_ACCESS_TOKEN` |
| `openkita-dev-postgres` | Docker `crystaldba/postgres-mcp:0.3.0`, pinned by digest (MIT, [crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp)) | Inspect the **local dev** schema, explain queries, check indexes / pgvector | Docker, `DATABASE_URI`, published DB port |

## Local env file: `.cursor/.env.mcp`

`github` and `openkita-dev-postgres` read their variables via Cursor's `envFile` option
(`"envFile": "${workspaceFolder}/.cursor/.env.mcp"`, supported for stdio servers). This is simpler
than exporting variables for a GUI-started Cursor (`launchctl setenv`, login shells).
The file is ignored by git through the existing `.env.*` rule in `.gitignore`
(`git check-ignore -v .cursor/.env.mcp` confirms it). Create it yourself:

```dotenv
# .cursor/.env.mcp  – local only, never commit
GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_…
DATABASE_URI=postgresql://openkita_readonly:choose-a-password@localhost:5432/openkita
```

If the file or a variable is missing, that server fails to start. Nothing falls back to a hard-coded credential.

### context7

Runs locally with `npx`. Without an API key you get public libraries at a lower rate limit.
If you need more, create a free key at context7.com and add `"--api-key", "${env:CONTEXT7_API_KEY}"`
to the `args` **in your local copy only**. Do not commit keys. Queries (library names, topics) go to
Context7's hosted service, so don't put project secrets or personal data in prompts that trigger it.

### github

- Use a **fine-grained** token limited to this repository with read-only permissions
  (Contents, Issues, Pull requests, Actions, Metadata), with an expiry date.
- The server runs with `GITHUB_READ_ONLY=1`, so write tools are disabled even if the token could
  write. Toolsets are limited to `context,repos,issues,pull_requests,actions`.
- The image is pinned by digest. To upgrade, check the release notes, then update tag and digest together.
- Alternative: the `gh` CLI (`gh issue list`, `gh pr view`, `gh run view`) does the same from the
  terminal without an MCP server. Disable this server if you prefer `gh`.

### openkita-dev-postgres

**1. Publish the database port.** The default `docker-compose.yml` does **not** publish the
database port. Use the development override in `deployment/docker/compose.dev.yml`, which binds it to
`127.0.0.1:${DB_PORT:-5432}`:

```bash
docker compose -f docker-compose.yml -f deployment/docker/compose.dev.yml up -d db
```

**2. Create a dedicated read-only role.** Don't use the application owner role (`POSTGRES_USER`).
Once, against the local dev DB:

```bash
docker compose exec db psql -U openkita -d openkita -c \
  "CREATE ROLE openkita_readonly LOGIN PASSWORD 'choose-a-password'; GRANT pg_read_all_data TO openkita_readonly;"
```

(`pg_read_all_data` is built into PostgreSQL ≥ 14. The compose file uses PostgreSQL 16.)

**3. Set `DATABASE_URI`** in `.cursor/.env.mcp` with the plain `postgresql://` scheme, not the
backend's `postgresql+asyncpg://`. Keep `localhost`: the postgres-mcp image remaps it to
`host.docker.internal` on macOS/Windows.

Notes:
- The server runs in `--access-mode=restricted`: read-only transactions and an execution time limit.
  Together with the read-only role, this gives two independent layers.
- `OPENAI_API_KEY` is set to an empty string on purpose. postgres-mcp 0.3.0 contains an LLM-based
  index-tuning path that instantiates an OpenAI client. With an empty key it can't send schema or
  query data to OpenAI. Don't set a real key here.
- Why Docker and not `uvx`: `postgres-mcp==0.3.0` on PyPI pins `pglast==7.2.0`, which does not
  exist on PyPI, so `uvx postgres-mcp==0.3.0` fails to resolve. The published image works.
- The old `@modelcontextprotocol/server-postgres` reference server is archived and deprecated on npm and
  must not be used. `postgres-mcp` is maintained (commits in 2026), but its latest tagged release is
  v0.3.0 (May 2025). Re-check before bumping the pin.

## Enabling in Cursor

1. Open **Cursor Settings → MCP** (Tools & Integrations). Project servers from `.cursor/mcp.json`
   are listed under the project.
2. Toggle on the servers you want. A green dot means the server started; click the server to see its tools.
3. If a server shows an error, check the logs under **Output → MCP**. Usual causes are a missing
   `.cursor/.env.mcp`, Docker not running, or the DB port not being published.

All three servers are optional. Enable only the ones you need.

## Security rules

- **Never point any MCP server at production or real Kita data.** Use only the local dev
  database with synthetic data (see `examples/sample-documents/`). Real Kita data contains
  personal data of children, parents and staff (special-category data in places). An agent
  that can read it would send it to the LLM provider your editor uses.
- Keep the Postgres server in `restricted` mode with the read-only role. Never commit changes
  that loosen this.
- Never write tokens or passwords into `.cursor/mcp.json`. Use `.cursor/.env.mcp` only.
- Use least-privilege, repository-scoped, expiring GitHub tokens.
- Tool output (issue text, PR comments, docs) is untrusted input and may contain prompt
  injection. Review agent actions before approving them.
- Versions and images are pinned (images by digest). Review the changelog before bumping.
- Do not add other MCP servers to the shared project config without the review checklist in
  [prd-addendum-skills-mcp.md](prd-addendum-skills-mcp.md#43-adoption-review-checklist).
