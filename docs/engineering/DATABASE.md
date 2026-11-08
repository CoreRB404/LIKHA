# SQLite data design and integrity

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Proposed records

Use Django migrations and a custom user model before the first auth migration. Store UTC timestamps; derive assessment windows using the configured Asia/Manila business timezone.

| Model | Essential fields and constraints |
| --- | --- |
| User | UUID public ID, normalized unique username, password hash, active/staff flags, auth/session version |
| Profile | One-to-one user, bounded display name, avatar enum 1..6, created/updated times |
| PetState | One-to-one user, species enum, bounded name; earned growth derived from events |
| Artwork | UUID, owner FK, lab enum, title, description, private image key, width/height/bytes, status, version, client save UUID, timestamps; unique owner + client save UUID |
| ArtworkImport | Owner, source fingerprint, import state; unique owner + source fingerprint |
| QuizDefinition | Versioned definition, active/release times, question/option records and server-only correct answers |
| QuizAttempt | UUID, owner, quiz version, attempt UUID, state, started/submitted timestamps, score; unique owner + attempt UUID |
| QuizAnswer | Attempt FK, question FK, chosen option FK; unique attempt + question; enforce option belongs to question |
| ActivityCompletion | Owner, activity type, stable source ID, eligibility window; unique owner + type + source ID + window |
| RewardEvent | Owner, immutable event key, rule version, star delta, growth units, source, timestamp; unique owner + event key |
| Wallet | One-to-one owner, nonnegative current stars and lifetime earned; rebuildable/reconcilable from ledger |
| VerificationGrant (retired legacy) | User, token digest, purpose, expiry, used timestamp; consume atomically |
| AuditEvent | Actor reference, action, outcome, target type/ID, request ID, time; no passwords/tokens/artwork content |
| MailOutbox (retired legacy) | Unique notification key, recipient reference, template, state, next attempt, delivery time; no raw recovery token in general logs |

Prefer integer fields for balances and rational growth units. Store growth in half-activity units: one artwork/activity = 2 units; one quiz pet point = 1 unit. Never use floating-point rewards. Add positive/enum constraints, FK policy, appropriate owner/time indexes, and explicit maximum lengths. Do not implement mutable business records as one unvalidated JSON blob.

## Identity and uniqueness

Usernames are stored lowercase and protected by a database unique constraint. Signup validates Django username characters and length. Existing email-shaped identifiers are retained as usernames during migration so no account, password or owned progress is lost. Treat UUIDs as identifiers, never as permission checks.

## Transaction rules

Create the artwork/attempt completion, reward events, and wallet changes in a short `transaction.atomic()` operation. Use unique event constraints for idempotency and atomic database arithmetic for balances. SQLite does not provide effective row locking through `select_for_update()`; do not design correctness around it.

On a retry, return the existing logical result. If a client save UUID is reused for a different payload, return a conflict rather than silently replacing its image. Test two connections submitting the same operation concurrently. Retry only recognized transient locking failures at the complete transaction boundary, with bounded backoff; never rerun only part of a transaction or external side effects.

Filesystem writes are not part of a database transaction. Validate/re-encode into staging, create a pending record, atomically promote the private file, and transition to ready with its single reward event. Define recovery for crashes at each boundary. Never expose a ready image that does not exist; clean abandoned staged/orphan files with a safe reconciliation task. Deliver mail through an idempotent outbox after commit.

## SQLite configuration and migration

Use an absolute database path outside static/media roots. Verify foreign keys are enabled. Select WAL and busy timeout deliberately, document connection initialization and checkpoint behavior, and test the actual Django/SQLite versions. WAL still allows only one writer at a time. Avoid long transactions, image processing within write transactions, and naive async writes.

Never commit live databases, WAL/SHM files, backups, or production data. Migrations must create a clean database and upgrade the previous release. Use expand/backfill/contract for incompatible changes; test populated upgrades and restore. A schema downgrade is not guaranteed safe merely because application code rolls back.

Use SQLite's online backup facility for consistent live snapshots, not a blind copy of just the `.sqlite3` file while WAL is active. Restore and run integrity/foreign-key checks in an isolated environment. See [OPERATIONS.md](OPERATIONS.md).

Move to PostgreSQL when measured contention or hosting requirements exceed the single-host design. Preserve ORM/service invariants, rehearse migration and count/reconcile records and balances before cutover.
