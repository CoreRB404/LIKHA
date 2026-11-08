# LIKHA engineering instructions

## Scope and truthfulness

Cloud target update: the user selected Supabase PostgreSQL + private Supabase Storage with Render hosting. Follow `docs/SUPABASE_RENDER.md`; it supersedes SQLite-only cloud architecture below. The local installation now uses PostgreSQL with private local artwork files; SQLite is retained only for legacy migration and isolated compatibility tests. Preserve Django username authentication, private schema, ownership and account-level PostgreSQL locking. No real cloud project has been connected or deployed.

This repository contains the original browser-local demo and a separately built Django + PostgreSQL application under `backend/`. Username/password signup and login, private artwork, server grading/rewards, profile/pet persistence, staff OTP, and recovery commands are implemented locally. Public production deployment is not configured. Consult `docs/engineering/IMPLEMENTATION_STATUS.md` for current evidence and blockers; do not assume a documented or locally tested control has been verified on a public server.

Read [the engineering index](docs/engineering/README.md) and [the master implementation prompt](docs/engineering/MASTER_PROMPT.md) before implementing the hosted conversion. For a small unrelated fix, read only the relevant guide and preserve existing behavior. User instructions take precedence. These instructions do not require additional approval for ordinary implementation work already requested.


Account policy: username and password only, minimum 8 characters. Keep developer/operator setup instructions out of user-facing pages. No email collection, verification, SMTP configuration or emailed recovery. Follow `docs/engineering/AUTHENTICATION.md`; it supersedes older email-oriented planning text. Existing login identifiers remain usernames after migration.

Local engineering verification: read `docs/LOCAL_ENGINEERING.md` for page-module boundaries, accessibility/keyboard contracts, offline password screening, malformed-input/storage failure tests and the browser/security matrix. Keep operator notices in documentation, not student screens.

## Working rules

- Inspect the current code and applicable instructions before editing. Keep the existing design, Filipino cultural content, and learning flows unless a change is requested.
- Implement a Django modular monolith with PostgreSQL for local and hosted accounts. SQLite is legacy migration/test support only. Verify supported dependency versions when implementation begins. Do not invent a custom password system, JWT browser storage, or a frontend-only login gate.
- Use framework authentication, server-side sessions, CSRF middleware, ORM migrations, explicit object ownership, and transactional domain services. Browser state is untrusted.
- Keep the hosted account application and the existing portable offline demo explicitly separate. File URLs cannot provide shared authenticated SQLite access.
- Never serve the entire repository in production. Database files, backups, source, dotfiles, configuration, and private student artwork must not be public static files.
- Never award stars or pet growth from client-submitted totals. The server grades quizzes and records unique reward events.
- Preserve per-lab templates, exact pattern-preview/fill agreement, drawing, Undo, separate references, tutorials, six avatars, and 24 pet age images.
- Prefer narrow changes and readable modules. Extract the large inline dashboard gradually. No unrelated rewrite or speculative infrastructure.
- Add meaningful tests for ownership, session security, persistence, idempotency, migrations, and affected learning flows. Run the relevant existing checks too.
- Keep secrets and real student data out of code, fixtures, logs, screenshots, and AI prompts. Use synthetic accounts.
- Update the implementation status and decision log with evidence. A checkbox or document is not proof that a control is implemented.
- Finish reversible preparation and validation within the authorized scope. Do not publish publicly, buy services, send messages, or destroy user data without authorization for those actions.

## Completion report

State what changed, the checks actually run and their outcomes, remaining blockers, and whether the result is local, staging, or production. Never call the application deployment-ready while release gates remain open.
