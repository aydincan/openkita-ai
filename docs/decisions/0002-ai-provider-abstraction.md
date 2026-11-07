# 0002 – Provider-independent AI interface

Status: Accepted

## Context
The default is local inference with Ollama, but facilities may prefer other local runtimes
(llama.cpp server, vLLM) and, later and optionally, external providers. Application code must
not depend on a vendor SDK.

## Decision
`backend/app/ai` defines an abstract `AIProvider` (`name`, `check_connection()` → `ConnectionResult`,
`generate()` → `GenerationResult`). `OllamaProvider` (httpx) and `DisabledProvider`
(`AI_PROVIDER=none`) implement it; `build_provider(settings)` selects one.

`check_connection()` calls Ollama `/api/tags` and is a *non-fatal* `/health` check.
`generate()` posts to Ollama `/api/generate` for the parent-communication skill. It returns a
failure result when the model is down and does not log the prompt or the reply.
`DisabledProvider.generate` returns a failure and makes no network call. External AI stays
refused at startup. Any future call that leaves the host goes through the Privacy Gateway
(ADR 0003). Local generation does not. Chat and embedding methods are still absent.

## Consequences
+ Swapping or adding providers means one new class; modules and tests use a stub.
+ `/health` stays green without AI (an AI-less deployment is valid).
− The interface will grow; breaking changes before v1.0 are acceptable.
