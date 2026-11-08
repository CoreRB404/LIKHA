# Master implementation prompt

> Cloud target update: use Supabase PostgreSQL and private Supabase Storage on Render. Follow [SUPABASE_RENDER.md](../SUPABASE_RENDER.md); SQLite-only deployment text below describes local development / the earlier single-host option.

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

Copy the following assignment into the coding agent working in this repository.

---

You are the lead engineer converting the existing LIKHA prototype into a secure, maintainable, deployable learning website. Read `AGENTS.md` and `docs/engineering/README.md`, then inspect the actual source. Implement the work; do not substitute a plan, fake authentication, placeholder persistence, or a successful-looking UI for working backend behavior.

## Outcome

Students can create and verify an account, log in, draw in the four labs, save private artwork, choose an avatar and pet, complete quizzes and challenges, and recover their progress after logging in on a second device. Staff have a restricted administration interface. SQLite is the initial database. Production uses HTTPS, persistent storage, backups, abuse protection, and tested ownership checks.

## Technical direction

1. Use a supported stable Django release, supported Python, Django ORM/migrations, a custom user model created before initial migrations, Django session authentication, CSRF protection, and server-rendered page shells plus same-origin JSON endpoints. Pin the exact tested versions; check current official support and security notices when choosing them.
2. Retain current HTML/CSS/canvas behavior. Move source into a clear backend/templates/static layout gradually, keeping legacy `.html` URLs as protected aliases where necessary. Production exposes only deliberately published static assets and authenticated application routes.
3. Make server records authoritative for ownership, quiz scoring, reward events, and progress. Handle duplicate submissions and SQLite concurrency with transactions, database constraints, and bounded whole-transaction retry where safe.
4. Use private file storage for re-encoded artwork images. Serve owned artwork through authorization checks; no predictable public upload URLs. Preserve tutorial video playback and byte ranges through the static server.
5. Keep the offline demo isolated from authenticated data. Offer a validated, explicit artwork import; do not trust imported balances, quiz results, or growth levels.

## Execution

Begin with repository findings and a short implementation checklist. Follow the phase order in DELIVERY_PLAN.md, completing working vertical slices with relevant tests before expanding scope. Use the specific contracts and acceptance criteria in this handbook. Keep IMPLEMENTATION_STATUS.md accurate throughout.

Resolve ordinary reversible engineering choices autonomously and document the rationale. Ask only for missing decisions that materially affect the next dependent step. Do not block unrelated local work on domain, hosting, mail credentials, or audience-policy decisions. Do not invent their answers or silently choose a paid service.

Keep secrets in environment configuration, provide a value-free `.env.example`, add ignore rules before generating credentials or databases, and use synthetic data. Fail production startup for missing required secrets or unsafe settings. Do not run the current `serve.py` or Django development server as production.

Run tests against real Django request/session/CSRF behavior, a file-backed SQLite database for concurrency checks, and real browser canvas flows. Verify one user's data cannot be read or changed by another, including through direct image URLs. Verify persistence survives app restart and that a backup restores to a clean environment.

## Preserve the product

- Four lab-specific template lists, correct navigation back to lab choices, and matching pattern preview/fill tiles.
- Drawing, shapes, Undo, clear, download, private save, gallery edit/delete.
- Small separate references for Fashion/Art/masks, fixed mask position with hide/resize, large Craft/Parol designs, and tutorial video/materials views.
- Six avatar choices without outfit/accessory controls; six pet species with four distinct age artworks each.
- Existing reward amounts and growth thresholds, with authoritative server accounting rather than browser claims.

## Definition of done

Supply runnable local setup, migration files, reproducible dependency locks, automated tests, production configuration, an operations runbook, a demonstrated backup/restore, and release evidence. Account A and account B must remain isolated in a shared browser and across API requests. Existing offline behavior must remain available as a separately tested artifact if retained.

Deployment readiness means the gates in DEPLOYMENT.md are verified, not merely listed. When external configuration is missing, finish all locally verifiable work and report those exact launch blockers. Do not claim that writing these documents alone made the site secure or deployed.

Conclude with changes, test results, startup steps, current environment, and remaining risks. Update the decision and status records so another engineer can continue without this chat.

---
