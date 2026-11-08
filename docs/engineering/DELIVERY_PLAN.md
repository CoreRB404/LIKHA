# Phased engineering delivery

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

Each phase must leave a runnable result, tests appropriate to its risk, updated status, and a concrete next step. Do not bundle a full visual rewrite with authentication. The following prompts supplement MASTER_PROMPT.md rather than override its constraints.

## Phase 0: Baseline and decisions

Prompt: "Inspect LIKHA and the engineering handbook. Inventory routes, duplicated storage code, quiz sources, public/private assets and existing tests. Capture baseline results, select supported pinned dependencies, and record architecture decisions. Preserve all working features. Identify launch-only unknowns without blocking local work."

Exit: verified baseline, supported stack selection, schema draft, route/access map, and migration plan. No claim of backend readiness.

## Phase 1: Backend foundation

Prompt: "Create the Django application structure, environment settings, custom user model before initial migrations, SQLite models/constraints, health endpoints, and reproducible developer setup. Add secret/data ignore rules before generating local files. Establish a public static allowlist and private storage boundary."

Exit: clean install/migrate/start, migration drift checks, protected-route skeleton, configuration validation, and no accidental repository exposure. Preserve portable source/build separately.

## Phase 2: Account lifecycle

Prompt: "Implement real signup, email verification, login/logout, password recovery, server sessions, persistent abuse throttles, account revocation, staff permissions/MFA, accessible forms and safe redirects. Use framework facilities and synthetic mail tests. Complete negative tests before wiring every page."

Exit: real cookie/session/CSRF and two-account tests; no hardcoded credentials or frontend-only auth. Real mail delivery remains a launch gate if credentials are pending.

## Phase 3: Private artwork vertical slice

Prompt: "Connect studio save and gallery to owned database records and private validated image storage. Implement idempotent save, crash-safe staging, list/reopen/download/update/delete, quotas, version conflict handling and direct-file authorization. Preserve drawing and failures visibly."

Exit: save across reload/device/restart, ownership and malformed-upload tests, replay safety, and no loss of unsaved canvas on failure.

## Phase 4: Progress, quizzes, avatars and pets

Prompt: "Move quiz grading, completion eligibility and reward rules to server services. Implement unique reward events, wallet projection, transaction/concurrency tests, authoritative pet growth, profile/avatar/pet saves and shared dashboard/standalone views. Remove browser authority from hosted mode."

Exit: no answer keys in pre-submit hosted payloads, no forged rewards, no duplicate credits under retries/races, correct visual growth on both pet views, and persistence across accounts/devices.

## Phase 5: Frontend consolidation and migration

Prompt: "Extract inline/dashboard duplicates into maintainable modules and enforce CSP without breaking canvas or tutorials. Finish all hosted routes and errors. Implement explicit validated legacy artwork import with no trusted reward totals. Keep and test the separate portable demo."

Exit: exact pattern preview/fill agreement, all lab templates correctly scoped, tutorials/seeking intact, logout account isolation, mobile/accessibility checks, portable artifact not contaminated by backend data.

## Phase 6: Production preparation and operational proof

Prompt: "Create production server/proxy/service or container configuration for the selected single-host SQLite topology. Implement secure configuration validation, CI, dependency/secret checks, private paths, persistent volumes, health/monitoring, backup/restore and rollback runbooks. Rehearse in staging and attach actual evidence."

Exit: restore drill, load test, deployed-header checks, two-user staging smoke, release checklist with exact remaining external blockers.

## Phase 7: Authorized release

Prompt: "With the configured infrastructure and authorization to publish, release the verified artifact using the deployment procedure, preserve live data, perform smoke checks, and monitor. Report the URL, revision, evidence, recovery plan and unresolved risks. Do not call the release successful if critical gates fail."

Exit: actual operational release evidence. Public hosting is not implied by completion of a documentation-only request.

## Per-phase report template

```text
Phase and implemented scope:
Files and architectural changes:
Tests run / results / environment:
Security and data-integrity evidence:
Migration or rollback implications:
Open decisions or blockers:
Status register updated:
Next actionable phase:
```
