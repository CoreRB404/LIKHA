# Implementation and readiness register

Account UI update: removed operator-reset/email setup notes from user screens, renamed Password labels/errors, and changed signup/password-change minimum to 8 characters (maximum 128). Existing password hashes are unchanged. Boundary regression verifies 7 characters rejected, 8 accepted for signup/change, and login with both resulting passwords.

UI update: privacy policy page/route, footer link and signup acknowledgement checkbox were removed at the user's request. Signup no longer requires notice_version and new UI signups do not record a fabricated acknowledgement. Historical fields remain unchanged; account ownership, authentication, export/deletion and operator configuration remain in place.

Local PostgreSQL cutover completed: 164 application records transferred from the former SQLite database with canonical source/target comparison, UUID/password/timestamp preservation, 5 verified artwork checksums and reward reconciliation. Active runtime reports PostgreSQL with 7 accounts, 5 artworks, 14 rewards and 4 quiz attempts. Synthetic actual-runtime login/save/read/reward writes were rolled back; database restart and storage/ledger checks passed. SQLite originals are archived privately and no longer active. See [local PostgreSQL](../LOCAL_POSTGRES.md). This does not constitute a Supabase upload.

Supabase/Render update: PostgreSQL TLS/private-schema configuration, account write locks, server-only private Storage, Render blueprint/build/start and WhiteNoise are implemented. Evidence: 58 SQLite tests and 52 isolated PostgreSQL tests pass; Render build/static smoke and mocked cloud retries/ownership/export/delete pass; runtime audit reports no known vulnerabilities. Real Supabase/Render staging, existing-data transfer and cloud backup/restore remain unverified. See [runbook](../SUPABASE_RENDER.md). Earlier SQLite recovery evidence does not establish cloud recovery.

Updated 2026-11-08 (Asia/Manila). The account application is implemented and verified locally. It is **not publicly deployed**. Hosting credentials, approved enrollment/privacy policy, public HTTPS staging, and off-host operational configuration remain external release gates.

## Implemented application

| Capability | Local evidence |
| --- | --- |
| Django 5.2.19 LTS + SQLite schema | Custom UUID/username user before initial auth migration; committed migrations; file-backed SQLite with foreign keys, WAL and IMMEDIATE transactions |
| Account lifecycle | Username-only signup with immediate login, duplicate username conflicts, login/logout, current-password change and session rotation/expiry/revocation |
| Password/session security | Argon2, 15?128-character passphrase validators, HttpOnly/SameSite cookies, production Secure host-only cookie, real CSRF enforcement and origin checks |
| Abuse protection | Database-backed login/signup/recovery/resend limits; account/IP buckets use HMAC identifiers; proxy address accepted only in the configured topology |
| Private artwork | Owner-scoped metadata/image/download/update/delete; validated re-encoded PNG/WebP; private generated filenames; quota; optimistic versions; idempotent saves and crash recovery |
| Authoritative learning | Private 50-question bank, seven versioned assessments, randomized opaque option IDs, server grading, weekly reward claims and immutable reward ledger |
| Progress/avatar/pet | Persistent profile and six avatars, six pet species/four distinct ages, integer growth units, shared server snapshots, first/fourth artwork milestones |
| Challenges | Catalog-bound challenge links and matching owned new-artwork completion evidence; no invented extra challenge reward |
| Privacy controls | Explicit previewed image import without historical entitlements, password-confirmed ZIP export/deletion, live file removal and restricted deletion journal |
| Shared-browser isolation | Real A/B browser handoff; private image denies B; stale-tab expected-account guard rejects cross-account writes |
| Staff access | django-otp TOTP and one-use recovery enrollment; admin rejects password-only access; private student drawings excluded |
| Frontend separation | Existing drawing/reference/tutorial code and standalone shells retained; dedicated hosted dashboard/account templates; no localStorage account authority in hosted assets |
| Public/private boundary | Explicit public asset build; no offline quiz.js, private answer bank, database or backend source in public assets; safe legacy URL aliases |
| Recovery/operations | Encrypted consistent snapshot, coordinated media, hash/integrity-checked isolated restore, deletion replay, session/grant clearing, ledger reconciliation and cleanup commands |
| Reproducible delivery | Exact package versions + hashes + license metadata; official image digest pins; Docker/Caddy/Compose files; Windows helper; source-handoff packager; CI workflow |

## Verification actually run

Commands use the local `.venv` interpreter. Reports with synthetic data are in ignored `var/`; tests are committed and repeatable. No real student data or credentials were used.

| Check | Observed result |
| --- | --- |
| `backend/manage.py test tests --noinput` | 50 tests pass: CSRF/sessions, ownership, media/quota, retired email routes, username migration, staff TOTP, reward races, parallel assessment claims, recovery and deletion replay |
| `backend/manage.py makemigrations --check --dry-run` | No model drift at verification |
| `tools/check_production.py` | Django deployment checks pass with synthetic production configuration; missing secrets/privacy approval, wildcard hosts and non-HTTPS origin rejected |
| `tools/check_hosted_artifact.py` | 107 allowlisted LIKHA public asset files; no private answer keys/backend files/browser account-store calls or inline scripts |
| `tools/check_compose.py` | Compose resolves with synthetic values; backend port private, persistent data and digest-pinned proxy verified structurally |
| `tools/run_hosted_browser.py` | Real Chrome username-only signup/immediate login, mouse drawing/pattern/save/gallery, avatar 6, pet, quiz, logout, account B isolation, account A persistence, tutorials and mask pass without unexpected errors |
| `tools/hosted_system_check.py` | Real Waitress process, 20 concurrent synthetic student saves, exact per-user rewards, process restart, encrypted restore and fresh login/media verification pass |
| Local load observation | 20/20 saves; metadata-pair mean-request p95 approximately 254ms; image-save p95 approximately 1.60s; no duplicate/lost rewards. Local measurement, not a target-host SLA |
| Local recovery observation | Snapshot/restore approximately 4.30 seconds for the synthetic dataset, not a production disaster-recovery promise |
| Runtime dependency scan | No known advisories after replacing Pillow with 13.0.0 |
| Dependency consistency | `pip check` and hash-locked requirement resolution pass |
| Prototype checks | Reference audit, pet/reward checks and full file-mode browser regression pass, including tutorials, offline saves/rewards, all 24 pet ages, downloads and legacy redirects |
| Source handoff | Extracted ZIP builds its hosted assets, creates a clean database, initializes seven assessments and has zero preexisting accounts; private data excluded |

## External launch gates still open

- Hosting account and domain/DNS. Email and SMTP are no longer required.
- Docker image execution and Caddy HTTPS staging on the target host. Docker CLI/config validation works locally, but the daemon is unavailable; no container build is claimed.
- Operator-approved age/enrollment/consent and retention policy, privacy contact, and incident/support owner.
- Off-host encrypted backup destination, independently stored keys/latest deletion journal, recurring jobs, monitoring and alert delivery.
- Load/restore/accessibility/header/browser verification against the actual production artifact and hardware.
- Actual-device and manual screen-reader acceptance; the automated browser/accessibility matrix is now passing.

## Explicit implementation boundaries

No public galleries, teacher/class membership, purchases, social features, arbitrary URL imports or trusted migration of browser rewards are implemented. Import is one confirmed PNG/WebP artwork at a time. Assessment content uses bounded private JSON banks and immutable attempt snapshots rather than separate question/option tables. CSP retains inline styles for dynamic layouts but forbids inline scripts. HSTS preload/subdomain scope is deliberately not asserted.

The encrypted archive adapter refuses media totals above 512 MiB; a tested streaming backup solution is needed before expanding beyond that capacity. Restore requires coordinated downtime/isolated destination and the latest deletion journal; it is not automatic failover.

## Running and continuing

See [local setup](../RUN_HOSTED.md), [deployment commands](../DEPLOY_HOSTED.md), [decisions](DECISIONS.md), and the [release checklist](DEPLOYMENT.md). CI is supplied but has not run on a connected remote repository by this task. Do not mark public release complete based on local checks.

## Username policy update

Email requirements and emailed recovery are removed. Migration preserves existing UUIDs, login identifiers (now usernames), password hashes, artwork and rewards, and retires pending account mail/grants. Existing sessions are revoked. Password changes require current credentials; a forgotten passphrase uses the trusted administrator console. Old outbox/grant tables are historical compatibility records, not active account features.

## Local engineering hardening

Implemented shared UI/API modules and seven separately loaded page controllers; keyboard canvas drawing/Undo; focus-trapped dialogs with background inertness, Escape and focus restoration; skip links; reduced-motion handling; contrast fixes; retry-safe saves and explicit transient storage/database errors; partial-write cleanup; private image checksums and a read-only storage-integrity command; strict malformed-JSON handling; broader image/input/failure/concurrency tests; populated assessment upgrade and username rollback/reapply coverage; bundled offline weak/compromised-password screening with optional HIBP range checks; and CI accessibility/security/container smoke jobs.

Evidence: 50 Django tests pass; 12 engineering browser scenarios pass in Chromium, Firefox, Edge, desktop WebKit, mobile Chromium and mobile WebKit; axe A/AA rules through WCAG 2.2 have no reported violations in the tested screens/states. Bandit reports zero findings after two narrow documented false-positive suppressions. Secret-pattern, formatting, public-artifact and production-configuration checks pass. Offline and pattern pixel-match regression checks remain passing. See [LOCAL_ENGINEERING.md](../LOCAL_ENGINEERING.md).

Docker execution is still blocked by the absent local engine; `check_container.py` and CI now exercise the actual image when an engine is available. CI configuration is not a claim that a remote run passed. Emulated mobile/WebKit checks do not replace physical-device Safari/iOS/Android or manual NVDA/VoiceOver acceptance. A 99,999-entry offline password blocklist is finite; optional online mode broadens coverage without emailing or transmitting passwords.
