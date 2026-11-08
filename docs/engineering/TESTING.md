# Verification strategy and evidence

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Test levels

Use domain tests for rule arithmetic and validators, Django request tests for auth/authorization/CSRF, migration tests for database changes, and real-browser tests for account and canvas flows. Use a file-backed SQLite database with separate connections for locking/race checks; an in-memory test database can hide production behavior.

Avoid tests that only repeat implementation constants. Verify externally observable outcomes, failure behavior, invariant preservation, and cross-user isolation. A mock mail adapter is useful for token flow but does not prove production email delivery. A mocked save does not prove storage durability.

## Required scenarios

| Area | Minimum meaningful checks |
| --- | --- |
| Signup | Valid user, normalized duplicate, parallel duplicate, invalid fields, no privilege assignment, verification required |
| Sessions | Rotation, Secure/HttpOnly/SameSite in production, idle/absolute expiry, logout, reset/disable revoke, safe redirects |
| CSRF | Login/signup/logout/profile/upload/delete/reset mutations reject missing/incorrect token using real CSRF enforcement |
| Ownership | A/B reads, updates, deletes, nested IDs, images, exports, and nonexistent IDs; anonymous requests cannot bypass |
| Media | Bad extension/MIME, oversized bytes/pixels, decoder errors, SVG/HTML, path traversal, quota race, disk full |
| Rewards | Forged totals ignored/rejected, duplicate save, modified replay, edit/delete, milestones, simultaneous first/fourth claims |
| Quizzes | No answer key before submit, invalid choices, cross-user attempt, window boundary, replay, concurrent reward claim |
| Persistence | Reload, new browser session, second device/context, process restart, file/database crash recovery |
| Import | Explicit consent, schema/size limits, dedup, no trusted balances, failure leaves original export recoverable |
| Frontend | Two-account switch, stale response cancellation, expired save, conflict recovery, unsaved drawing preserved |
| Operations | Migration upgrade, actual backup restore, database integrity, deletion replay, artifact exposure probes |

## Product regression checks

Run the existing local-reference and prototype checks where applicable. Update their expected hosted behavior without weakening checks simply to make a rewrite pass. Keep separate hosted and portable suites.

```powershell
python tools/audit_site.py
node tools/pet_progress_test.mjs
node tools/artwork_rewards_test.mjs
node tools/fashion_pattern_check.mjs fashion
node tools/fashion_pattern_check.mjs festival
node tools/fashion_pattern_check.mjs craft
node tools/fashion_pattern_check.mjs art
node tools/offline_check.mjs
```

The browser scripts require Node and Chrome; some expect the optional static server. Inspect their environment variables and setup instructions before running. New Django commands such as `manage.py test`, `check --deploy`, and migration checks become valid only after backend scaffolding exists. Do not describe nonexistent CI jobs as passing.

Preserve exact preview/fill tile comparison for every pattern, closed-outline fill boundaries, immediate return to Draw, multiple Undo operations, correct lab dropdowns, mask fixed location/hide/resize, tutorial back/seek, six avatar selections, and all pet ages. Test keyboard focus and account-form errors with automated accessibility checks plus manual keyboard review.

## CI and load

Proposed CI: clean locked install -> formatting/lint -> secret/dependency scans -> Django checks/migration drift -> unit/integration/security tests -> frontend regression -> production artifact build -> staging smoke. No real credentials or student data in CI. Record advisory exceptions explicitly; do not silently ignore security scan failures.

Load the agreed classroom scenario, including concurrent image saves and submissions, on the chosen SQLite configuration. Measure p50/p95 latency, lock errors, CPU/memory, disk growth, and duplicate/lost events. Failure to meet the defined load is a launch blocker or requires a documented smaller deployment scope.

Store evidence with command, environment, revision/artifact ID, date, summary and failures. Redact personal data. Only mark a control verified when its evidence exists and remains relevant to the deployed artifact.

## Expanded local suite

The implemented commands and measured results are in [LOCAL_ENGINEERING.md](../LOCAL_ENGINEERING.md): 50 backend tests, Playwright/axe across six browser configurations, static security/secret/dependency checks, storage failure and checksum verification, populated migration rollback/reapply, and a real-container smoke script. Docker execution needs a running engine; CI is configured but has not run remotely in this session.
