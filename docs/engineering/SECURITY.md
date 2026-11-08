# Threat model and security implementation requirements

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Assets and trust boundaries

Protect credentials, sessions, student identifiers, private drawings, assessment answers, reward balances, administrative access, database/backups, and recovery mail. Adversaries include anonymous bots, authenticated students changing IDs or payloads, a shared-browser user, compromised scripts, and an operator/configuration mistake.

The browser, request metadata, uploaded files, localStorage exports, client totals, and external links are untrusted. The proxy/application boundary and application/private-storage boundary need explicit configuration. A signed-in user is not authorized for all records.

| Threat | Required control | Evidence |
| --- | --- | --- |
| Credential guessing/enumeration | Generic responses, persistent throttles, safe recovery | Negative and load tests |
| Session theft/fixation | TLS, secure cookie policy, rotation/revocation | Actual Set-Cookie and lifecycle tests |
| CSRF | Django middleware and tokens on every mutation | Cross-origin/missing-token tests |
| Cross-user access/IDOR | Owner-scoped queries, image checks, least privilege | Two-account CRUD and direct-file tests |
| SQL injection | Parameterized ORM; tightly reviewed raw SQL only | Injection inputs and review |
| XSS | Escaped templates, textContent, safe rendering and CSP | Stored title/name payload tests |
| Upload abuse | Decode/re-encode, limits, private names/storage | Malformed/oversized/polyglot tests |
| Reward manipulation | Server grading, constrained ledger, transactions | Tamper, replay and concurrent tests |
| Repository exposure | Explicit static allowlist, no root file server | HTTP probes for DB/env/source/backups |
| Operational data loss | Persistent volumes, consistent encrypted backups | Independent restore drill |

## Application controls

Default-deny protected views and API routes. Use owner filters for read, update, delete, image delivery, export, and nested records. Never rely on client ownership fields, hidden navigation, unguessable IDs, or frontend route guards. Staff permissions must be narrow, auditable, and tested; no public admin signup.

Keep Django escaping enabled. Render user strings as text, not HTML. Audit inline dashboard interpolation and `innerHTML` before connecting server records. If rich content becomes necessary, use a maintained allowlist sanitizer with tests; initial release supports plain text. Never accept executable SVG/HTML as student artwork.

Bound body size, decoded image pixels, page size, query filters, and expensive operations. Set timeouts and resource budgets. Use explicit serializers/field allowlists to prevent mass assignment. Protect outbound integration destinations; do not add arbitrary URL import/fetch endpoints or filesystem-path parameters.

## Browser and transport policy

Production requires HTTPS, correct allowed hosts and trusted origins, disabled debug, secure session/CSRF cookies, and a secret unique to the environment. Trust forwarded scheme/client IP headers only from the controlled proxy, which must replace spoofed incoming values.

Implement CSP first in report-only, extract inline scripts/events, then enforce. Target `default-src 'self'`, tightly bounded script/style sources, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, and `form-action 'self'`. Explicitly permit required blob/data image and media uses after testing canvas exports/previews; do not blanket-enable unsafe scripts to silence errors. Host fonts locally or use existing fallbacks. Apply nosniff, restrictive referrer/permissions policy, and clickjacking protection. Enable HSTS after validating HTTPS recovery; do not preload or include unrelated subdomains casually.

Private API/pages/media use appropriate no-store responses and no shared-cache storage. Add tests for browser Back and logout. Avoid service-worker caching of account-specific data. CSP is defense in depth, not permission to render unsafe HTML.

## Supply chain and secrets

Choose maintained dependencies with verified support, exact locked versions, hashes where supported, and license records. Review advisories and scan Python/JS/container dependencies in CI. Pin base-image versions/digests and rebuild on security patches. Use code review and least-privilege CI credentials; no long-lived deployment key in frontend bundles.

Before generating sensitive files add exclusions for `.env`, private data directories, `*.sqlite3`, WAL/SHM, dumps, backups, media, and logs. Provide dummy configuration only. Check staged/release artifacts for secrets. On actual leakage rotate credentials; deleting a file does not revoke it.

Track each finding with severity, owner, remediation, test evidence, and remaining risk. No unresolved exploitable critical/high issue may pass the initial public release gate. This is a project release policy, not a claim of certification or complete security.
