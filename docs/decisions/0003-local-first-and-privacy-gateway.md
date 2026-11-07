# 0003 – Local-first AI and mandatory Privacy Gateway (planned)

Status: Accepted (design); **not implemented in v0.1**

## Context
Kita content can contain personal data about children, parents and staff (special-category data
in places). German/EU data protection (GDPR/DSGVO) applies; many facilities are run by churches,
municipalities or associations with strict requirements.

## Decision
1. Inference is **local-first** (Ollama). No external API is required.
2. **External AI is disabled by default.** `EXTERNAL_AI_ENABLED=true` is currently *rejected at
   startup* (fail closed) because no gateway exists yet.
3. A **mandatory backend Privacy Gateway** will sit in front of every AI call: Presidio +
   spaCy German for detection/pseudonymisation, a policy engine, and **fail-closed** behaviour
   (if the gateway cannot run or is uncertain, the request is blocked, not forwarded).
4. **No child profiles and no automated assessments** are built, by design.
5. Human approval is required before any generated content leaves the system (export only).
6. Logs must not contain prompt or document content.

## Consequences
+ A clear security story, and a single place to audit data flows.
− The gateway adds latency and false positives/negatives; it reduces risk but does **not**
  make a deployment GDPR-compliant by itself (see `docs/privacy.md`).
− Session authentication lives in `app/security` (ADR 0005). The Privacy Gateway in that
  package remains planned for v0.3. Until then, AI calls go only to the local provider and
  external AI stays rejected at startup.
