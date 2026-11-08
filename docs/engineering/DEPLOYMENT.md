# Deployment design and release gates

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Environments

Development: developer machine with supported Python, virtual environment, SQLite, a mail sink, and synthetic data. Staging: production-like Linux host/configuration, HTTPS, separate secrets/database/private media, and test accounts. Production: one persistent host, restricted administrative access, reviewed mail delivery, backups and monitoring.

Public students use the website URL in a browser; they do not install Python. `serve.py`, `python -m http.server`, Django `runserver`, portable ZIP, and a development tunnel are not the production account deployment.

## Proposed production topology

Use a supported Linux VM or equivalent single-instance service with durable local disk. Terminate TLS at a controlled reverse proxy such as Caddy or Nginx; run Django behind a production WSGI server as an unprivileged service user. Restrict direct application-port access. Serve collected public assets only. Keep the SQLite database and private media outside the proxy public root, mounted persistently if containers are used.

A container image contains code and dependencies, not live records or secrets. If containerized, mount database directory including WAL/SHM and private files; document permissions and backup access. Do not put SQLite on a network filesystem or assume a free ephemeral hosting tier preserves it. Start with one bounded worker and load-test before increasing write concurrency.

## Configuration contract to implement

Provide `.env.example` with names and dummy values for settings such as environment, Django secret, canonical HTTPS origin, allowed hosts, trusted CSRF origins, absolute SQLite path, private media root, static collection root, mail adapter credentials, and log/backup configuration. Exact names must match implemented settings and scripts. Production startup must reject missing secrets, debug mode, wildcard hosts/origins, or overlapping public/private paths.

For local HTTP use development-only cookie settings. For production set secure cookies and HTTPS policy explicitly. Configure forwarded scheme headers only behind the known proxy. Check invalid Host and spoofed forwarded headers with requests against the actual deployed topology.

## Release procedure

1. Select a tested, immutable revision/artifact. Confirm support/advisories and exact dependency lock. Compare configuration changes with the prior release.
2. Build and test the production artifact in staging. Run migration drift checks, static collection, and Django deployment checks with production settings. Treat warnings as findings to resolve or explicitly justify.
3. Verify persistent storage, disk space, private permissions, proxy limits, and TLS. Generate a consistent backup and demonstrate it can restore before any incompatible migration.
4. Use a documented maintenance/drain procedure for single-instance schema changes. Apply reviewed migrations once, not opportunistically in every worker startup. Do not erase or recreate the live database.
5. Start/restart the service, verify readiness, then run two-account smoke tests, save/download, quiz/reward replay, video seek, and direct-file exposure probes.
6. Watch errors, latency, disk and mail delivery. Keep the previous application artifact available. Reopen service only after critical smoke checks pass.

Provide exact commands only when matching deploy files exist. Document both Windows developer setup and Linux operations. A placeholder hostname is not a deployment URL and a README example is not a successful release.

## Public-launch gates

- [ ] Signup, verification, login, recovery, logout, revocation, admin MFA and abuse limits verified.
- [ ] Ownership including image/download/export endpoints verified with two accounts.
- [ ] Server-only quiz grading and transactional/idempotent rewards verified under concurrency.
- [ ] Private files/database/secrets/backups/source/dotfiles inaccessible over HTTP; no directory listing.
- [ ] HTTPS, proxy trust, security headers, enforced tested CSP, production cookies, no debug verified.
- [ ] Persistent SQLite/media survive restart/redeploy; observed write load meets target.
- [ ] Consistent encrypted off-host backup and isolated restore drill completed.
- [ ] Migration upgrade and rollback/restore strategy rehearsed for this release.
- [ ] Actual verification/reset email delivery works and credentials are managed securely.
- [ ] Privacy/audience/retention policy approved by the responsible owner; no public gallery by default.
- [ ] Accessibility and lab/product regressions pass on agreed browsers/devices.
- [ ] Monitoring, incident owner, budget, domain, and TLS renewal are operational.
- [ ] No open exploitable critical/high security findings; lower-risk exceptions documented.

Public publication requires authorization and real infrastructure configuration. Preparation, local implementation and staging verification should proceed within the user's authorized scope without repeatedly asking for permission.
