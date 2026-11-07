# 0004 – Single facility per deployment, multi-facility-ready

Status: Accepted

## Context
Typical operators are one Kita (or one Träger running separate instances). Multi-tenant SaaS
operation is not a goal and would raise the data-protection stakes considerably.

## Decision
One deployment serves **one facility**; there is no tenant switching in the UI or auth. To avoid a
painful rewrite later, domain tables will carry a `facility_id` foreign key and queries will go
through services that take the facility context explicitly. A single `facility` row is created
during setup (v0.1). Vector chunks (v0.2) are scoped by `facility_id` too.

## Consequences
+ Simple operation and mental model now; a future multi-facility mode is a feature, not a migration of every table.
− Slight overhead (an extra column and parameter) for features that never use more than one facility.
