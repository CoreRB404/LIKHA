# Operations, recovery, and maintenance

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Health and observability

Implement liveness that reveals no internals and readiness that checks required storage/database availability without expensive writes or secret disclosure. Readiness is for the controlled deployment system; avoid exposing database diagnostics publicly. Use request IDs, structured redacted logs, bounded retention and rotation.

Monitor server errors, request latency, auth throttle spikes, mail failures, upload rejection rate, SQLite lock failures, disk/inode usage, backup age/restore success, and TLS expiry. Initial alerts: no successful backup within 26 hours, persistent 5xx rate above 1% for 5 minutes, disk below 20% free, and repeated database-lock failures. Calibrate these after observing real traffic and identify the human responsible for response.

Do not log session cookies, password/recovery/verification values, full email addresses unnecessarily, request bodies, artwork data URLs, or SQL parameters containing personal data. Security events should identify action/outcome and restricted actor references, not duplicate sensitive content.

## Backup and restore

Initial targets: daily off-host backup, recovery point within 24 hours, restore within 4 hours, retention 30 days pending institutional approval. Encrypt backups, restrict credentials, and keep them separate from the application host. A backup on the same disk alone does not satisfy disaster recovery.

Use SQLite's supported online backup API or a verified equivalent for live snapshots. Do not copy only the main file while ignoring active WAL. Include private artwork, schema/version manifest and configuration restoration instructions without plaintext secrets. Keep database and media references consistent: use maintenance/quiescence for the initial coordinated backup process, or implement immutable media and a tested manifest-based snapshot policy. Document which strategy is actually implemented.

Restore drill: create an isolated instance, decrypt/restore database and files, run integrity and FK checks, apply relevant deletion records, verify artifact/schema compatibility, start with mail disabled, then test synthetic login, gallery images and balances. Record elapsed recovery time and backup age. Never run a restore experiment over live production data.

Perform restore drills before launch, after major schema/storage changes, and at least monthly initially. Keep a record of failures and remediation, not just a scheduled job entry. Test corrupted/missing backups and lost-host recovery.

## Rollback and incidents

For application-only defects, restore the previous compatible artifact/configuration. For schema changes, follow the rehearsed migration plan; reverse migrations can destroy data. Choose fix-forward where safe, or restore a coordinated backup with an explicit data-loss window and reconciliation plan. Retain evidence and communicate the actual impact.

If credentials leak, rotate them and revoke affected sessions/tokens, remove the exposure, review audit evidence, and follow the institution's notification process. Never promise that deleting a Git file removed its history. If private artwork is exposed, stop the public access path first and preserve necessary restricted evidence without copying student content into chat.

Document response ownership, escalation contacts, service commands, backup credentials recovery, and access revocation for departing staff before launch. Use placeholders in committed docs; keep personal contacts and secrets in the approved secure operations system.

## Routine maintenance

Patch dependencies/OS on a defined schedule and promptly address relevant advisories. Clean expired sessions/grants and bounded outbox failures. Reconcile staged media and orphan records safely. Reconcile wallet projections against the reward ledger without silently rewriting history. Review quotas, retention, lock metrics, and restore results. Reassess SQLite capacity before increasing classroom usage or adding application replicas.
