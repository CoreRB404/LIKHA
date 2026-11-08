# Architecture decisions and open questions

Status convention: proposed -> accepted -> implemented -> verified. Proposed defaults guide implementation planning; they are not evidence that a dependency or feature exists.

| ID | Proposed decision | Rationale and consequence |
| --- | --- | --- |
| ADR-001 | Django modular monolith | Reuse auth, sessions, CSRF, ORM, migrations and administration; avoid custom security infrastructure |
| ADR-002 | SQLite, one persistent local-disk host | Meets requested storage with low operational complexity; constrains write throughput and horizontal scaling |
| ADR-003 | Same-origin cookie sessions | Simplifies browser auth and avoids localStorage bearer credentials; all mutations need CSRF protection |
| ADR-004 | Preserve vanilla frontend | Protect existing canvas/lab behavior; extract duplicated code incrementally |
| ADR-005 | Private artwork by default | Prevent student content exposure; requires protected image serving and explicit ownership |
| ADR-006 | Immutable server reward ledger | Handles retries and auditability; projections require reconciliation and transaction discipline |
| ADR-007 | Separate offline artifact | Preserves no-install demo without pretending browser files provide account security |
| ADR-008 | Exact shared pattern tile | Preview and fill must use the same pixels/colors; brush color is separate from textile selection |
| ADR-009 | No public social/classroom features initially | Keeps initial authorization/privacy scope bounded; add only with defined policies |
| ADR-010 | Explicit legacy artwork-only import | Existing local state has no trusted identity; balances/grades cannot establish hosted entitlement |

ADR-001 through ADR-010 are accepted for the implemented local release; ADR-002's real production hosting remains unprovisioned. Runtime uses Django 5.2.19 LTS, Pillow 13.0.0, server sessions and Argon2 with exact artifact hashes in `requirements/production.txt`. Current evidence is in IMPLEMENTATION_STATUS.md; acceptance does not imply public deployment.

## Implementation decisions recorded

- The backend uses `accounts`, `learning` and `core` modules rather than creating an empty app for every domain. Artwork and rewards use separate constrained models and domain services. Configuration is one explicit environment-aware settings module, avoiding duplicated security settings.
- Versioned private quiz banks and immutable attempt question snapshots use validated JSON. These contain bounded assessment content rather than a mutable combined user-state blob. Option identifiers are randomized per attempt so the original source's correct-option positions are not exposed by numeric API IDs. Migration 0002 upgrades previously created local attempts.
- Existing lab/standalone page shells are generated from the original frontend. The hosted dashboard/account screens have dedicated templates. The shared drawing IIFE is extracted without browser-local save/reward code. The build publishes an explicit asset allowlist and excludes the offline quiz key.
- Rewards use lifetime events, an integer wallet projection, unique transaction claims and SQLite IMMEDIATE transactions. Distinct new artwork credits are capped at 10/day; identical encoded-image copies receive no additional credit. This is a disclosed initial anti-farming policy, not evidence of artistic effort.
- Imported PNG/WebP artwork is validated, previewed and explicitly confirmed one file at a time. Arbitrary localStorage JSON and historical entitlement import are not enabled. Offline storage remains untouched.
- Staff use django-otp TOTP plus one-use recovery codes. The admin does not expose private student drawings. Teacher/classroom and public sharing features remain excluded.
- Outbox payloads are encrypted at rest and cleared after delivery. SMTP delivery is at least once, with single-use grants. Production mail, scheduling and sender-domain delivery still need external configuration.
- CSP allows same-origin scripts and no inline scripts. Dynamic layout/canvas styles retain `style-src 'unsafe-inline'`; HSTS subdomain/preload settings are intentionally omitted. These compatibility/domain-boundary exceptions are documented in DEPLOY_HOSTED.md.
- Backups use an authenticated encrypted archive and online SQLite snapshot during coordinated downtime, with a 512 MiB media-capacity guard. Restore is isolated, validates hashes/integrity, reapplies the latest deletion journal, and revokes sessions/grants. Off-host transfer and alert delivery are operator configuration, not simulated features.

## Decisions needed before public launch

- Who operates the site and responds to incidents? What is the intended audience and institutional privacy/consent policy?
- What domain and hosting environment provide durable local disk, HTTPS and the required backup budget?
- Which mail provider/sender can deliver verification and recovery messages reliably?
- Are email-based student accounts suitable for the audience, or is institution-managed enrollment needed?
- What retention/export/deletion process and account storage quota does the operator approve?
- What number of concurrent students must staging prove? Do artwork rewards need daily caps or other anti-farming rules?
- Is any staff access to student artwork required, and under what explicit permission and audit policy?
- Should imported legacy learning achievements receive credit through a separate verified institutional process?

Use safe private defaults for local work; do not infer legal consent or credentials. Do not create teacher access or public galleries while waiting for these answers.

## Future decision record template

```text
ID / title / date / status:
Problem and constraints:
Options considered:
Decision and rationale:
Security/privacy implications:
Data migration and rollback implications:
Evidence and revision:
Consequences and revisit trigger:
```

## ADR-011 ? username accounts (implemented)

At the user's request, username/passphrase accounts replace email-based accounts. Signup is immediately usable; email verification/recovery routes and email configuration are removed. The old identity column is renamed without changing user IDs, passwords, artwork or rewards. Existing email-shaped login identifiers remain valid usernames. Signed-in password changes revoke sessions; forgotten passwords require a trusted operator's Django `changepassword` command. Historical grant/outbox records are retired, not active workflows. This decision supersedes email-oriented portions of the initial handbook and ADR-007/010 migration descriptions where applicable.

## ADR-012 - Supabase and Render (implemented locally)

The user selected Supabase PostgreSQL for cloud persistence and Render for hosting. Add private Supabase Storage for artwork so ephemeral Render files cannot lose drawings. Retain Django username/passphrase authentication, a non-exposed likha schema and account-level row locks. SQLite/local storage remain development defaults. Cloud backup/restore is separate from the earlier SQLite commands, which now refuse cloud configurations. See docs/SUPABASE_RENDER.md for setup, measured checks and outstanding live-service verification. No credentials, purchases or deployment were performed.

## ADR-013 - migrate the active local installation to PostgreSQL

At the user's request, the existing local SQLite data was actually transferred into a dedicated loopback PostgreSQL 17 cluster. Canonical serialized rows, UUIDs, password hashes and full-precision timestamps were preserved; sessions were revoked. Verified 164 application records, all 5 image checksums, matching ledgers and restart persistence. Private active configuration selects PostgreSQL automatically; an activation marker prevents silent SQLite fallback. Original SQLite files and an authenticated encrypted database/media backup are retained privately for rollback, not used by the application. Pictures stay in private local storage. This supersedes SQLite-as-local-default guidance for this installation. No Supabase upload or public deployment occurred. See docs/LOCAL_POSTGRES.md.

## ADR-014 - remove the policy interface

At the user's request, remove the public privacy page/route, footer link and required signup notice checkbox. Remove the API acknowledgement requirement and automatic frontend notice-version submission. New UI registrations store a blank historical notice field rather than claiming acceptance; existing records are preserved. Keep private account/media access and export/deletion behavior.

## ADR-015 - password wording and eight-character minimum

At the user's request, account forms and validation messages use Password and require 8-128 characters. Remove developer/operator reset and email-configuration explanations from user screens. Existing hashes, account ownership, CSRF/session handling and compromised-password checks remain. Operator instructions stay in documentation.

## ADR-016 - original design is the Django visual source of truth

The user explicitly rejected the replacement landing/dashboard design. Generate Django-safe templates from original root HTML/CSS for index, dashboard, studio, gallery, avatar, pet and quiz. Remove inline browser-account/reward scripts and wire original components to authenticated APIs. Self-host original fonts; scope account CSS to avoid overriding page palettes/layout. Restore sidebar views, original gallery cards, sequential quiz/results and owned-artwork reopening. Keep account actions and narrowly scoped contrast/mobile-access corrections as integration details. No database migration or account data reset. Future backend work must preserve these visual sources instead of designing replacement pages.
