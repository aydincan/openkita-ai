# Privacy and data protection

> **Honest statement:** using OpenKita AI does **not by itself establish GDPR (DSGVO)
> compliance.** Compliance depends on how *you* operate it: legal basis, records of processing,
> data-processing agreements, technical and organisational measures, retention, and your
> data-protection officer's assessment. This document describes what the software does and
> intends to do; it is not legal advice.

## Current state (v0.1 – foundation)

- The software processes **no personal data** yet: no login, no uploads, no AI generation.
- No telemetry by the application itself. Next.js' anonymous telemetry is disabled in the Docker
  image (`NEXT_TELEMETRY_DISABLED=1`); when running `npm run dev`/`build` locally, set that variable
  or run `npx next telemetry disable` (see `docs/installation.md`).
- No third-party requests in production: the interactive API docs (`/docs`, `/redoc`,
  `/openapi.json`) are disabled when `APP_ENV=production` (the Compose default) because Swagger UI
  and ReDoc load assets from a public CDN. In `APP_ENV=development` they are enabled and the
  *developer's browser* contacts that CDN. The UI itself uses system fonts and no external assets.
  Container image pulls and package installs naturally contact their registries at build time.
- The only browser storage is a language cookie (`openkita-locale`), strictly functional.
- Health responses expose no connection strings, passwords or stack traces.
- `EXTERNAL_AI_ENABLED=true` is rejected at startup (fail closed).

## Design principles for upcoming versions

1. **Local-first** inference (Ollama). External AI off by default; never required.
2. **Privacy Gateway (planned, v0.3):** mandatory for every AI call; Presidio + spaCy German to
   detect/pseudonymise personal data; fail closed; local-only by default. Until it exists
   (v0.1–v0.2), AI processing is local-only (Ollama on the same host) and external AI is
   rejected at startup.
3. **No child profiles, no automated assessments** of children, no automated staff decisions.
4. **Human approval** before content leaves the system; the software never sends messages itself.
5. **No content in logs.** Prompts and documents are not logged.
6. **Data minimisation:** users are advised not to enter personal data about children in free text.
7. **Self-hosted:** data stays on your infrastructure; backups and retention are the operator's duty.

## Operator checklist (starting point)

- Run behind TLS; restrict network access; keep the system updated.
- Back up the database and volumes; encrypt disks.
- Document the processing in your Verzeichnis von Verarbeitungstätigkeiten (Art. 30 GDPR).
- Consult your data-protection officer before processing any child-related data.
- Keep `EXTERNAL_AI_ENABLED=false` unless the Privacy Gateway exists and you have a legal basis.

## Sample data

All sample content in this repository is synthetic. Never commit real personal data.
