# OpenKita AI – Product Requirements (summary)

**Tagline:** *Less paperwork. Better communication. More time for children.*
(DE: *Weniger Papierkram. Bessere Kommunikation. Mehr Zeit für die Kinder.*)

## 1. Product

OpenKita AI is a **completely open-source, self-hosted AI assistant for German childcare
facilities** (Kitas / Kindergärten). It is **not** a Kita management system. It eases the
administrative and communication work of educators and facility managers. Initial market:
Germany; default UI language: German.

## 2. Principles

1. **Self-hosted and open source** – no mandatory proprietary cloud, no mandatory external AI API.
2. **Local-first AI** – inference via Ollama behind a provider-independent interface.
3. **Privacy by design** – a mandatory backend *Privacy Gateway* (Presidio + spaCy German; fail
   closed; external AI disabled by default) sits between the application and any AI provider.
4. **Human in the loop** – the AI drafts, a person approves. Nothing is sent or decided automatically.
5. **Honesty** – the assistant never invents policies; knowledge answers cite their sources.
6. **No child profiling** – no child profiles and no automated assessment of children.

## 3. Target users

Kita managers (Leitung), educators (pädagogische Fachkräfte), administrative staff. Deployed by the
facility itself or its IT provider (one facility per deployment).

## 4. MVP modules (not built yet)

| | Module | Key requirements |
|---|---|---|
| A | **Parent Communication Assistant** | Draft newsletters, announcements, invitations; translation DE/EN/TR/AR; PDF/DOCX export; **draft + human approval** workflow |
| B | **Administration Assistant** | Meeting notes → meeting minutes; checklists; task lists |
| C | **Kita Knowledge Assistant** | Upload PDF/DOCX/TXT/MD; RAG with pgvector; answers with citations; never invent policies |

Cross-cutting: authentication/roles, Privacy Gateway, document storage, audit-friendly logging
(without personal data), German/English UI.

## 5. Non-functional requirements

- Runs with `docker compose up` on a modest server; all config via environment variables.
- Accessible UI (WCAG 2.1 AA as target), responsive, German default.
- No telemetry. No third-party calls unless an admin explicitly configures them (and the Privacy
  Gateway allows it).
- Type-safe interfaces, automated tests, documented architectural decisions (ADRs).
- Licence: Apache License 2.0 (see `LICENSE` and `NOTICE`).

## 6. Out of scope (explicitly)

- Full Kita management (enrolment, attendance, contracts, billing of parents)
- Payroll
- Staff / shift scheduling
- Accounting
- Child profiles or portfolios
- Parent mobile apps
- Direct parent communication: sending e-mail, WhatsApp or other messages (export only)
- Child assessments or developmental diagnostics of any kind
- Voice assistant
- Automated staff decisions

## 7. Roadmap

| Version | Content |
|---|---|
| **v0.1 – Hackathon MVP** | **Foundation** *(first step, done)*: repo, Docker Compose, Next.js + FastAPI + PostgreSQL/pgvector, config, `/health`, status UI, layout/navigation, i18n DE/EN, AI provider interface + Ollama connection test, tests, docs, ADRs. **Then**: authentication (users, roles, single-facility setup with multi-facility-ready schema), dashboard, Parent Communication Assistant (A), Administration Assistant (B), local AI integration (Ollama), basic document export. Privacy: local-only processing, external AI disabled, fail closed (already enforced in config) |
| **v0.2 – Knowledge Assistant (C)** | Document upload and processing (parsing, chunking, local pgvector embeddings), RAG Q&A, source citations, "not in the documents" behaviour |
| **v0.3 – Production readiness** | Improved permissions, security review, audit logging, backups/restore, improved installation docs. Privacy Gateway (Presidio + spaCy German, fail closed) for optional protected external AI, enabled only after its privacy tests pass |
| **v0.4 – Integrations** | Open-source Kita management integrations, import/export, calendar integrations, more document formats. Public environment data (DWD, UBA, RKI) as specified in [prd-addendum-environment-collective.md](prd-addendum-environment-collective.md); aggregate illness signals are not part of v0.4 |
| **v1.0 – Production release** | Multi-facility support, advanced administration, configurable workflows, improved multilingual support, deployment and maintenance tooling |

Skills, the OpenKita MCP server and MCP client integrations are phased in
[prd-addendum-skills-mcp.md](prd-addendum-skills-mcp.md) along this roadmap.
