# Same-origin HTTP contract

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

These endpoints are proposed contracts. Implement and test them before treating them as available. Use `/api/v1/`, Django session cookies, CSRF on unsafe methods including login, JSON metadata, and multipart artwork uploads. HTML account forms may coexist with JSON responses using consistent policies.

| Method and path | Contract |
| --- | --- |
| GET `/api/v1/session` | Authentication status and CSRF bootstrap; no private data if anonymous |
| POST `/api/v1/auth/signup` | Username, password, confirmation, display name, notice version; 202 created or 409 username unavailable |
| POST `/api/v1/auth/login` | Authenticate; rotate session; return own profile |
| POST `/api/v1/auth/logout` | Invalidate session; no logout by GET |
| GET/PATCH `/api/v1/me` | Own profile; explicit allowed fields only |
| POST `/api/v1/me/password` | Current passphrase, new passphrase and confirmation; revoke sessions after change |
| GET `/api/v1/progress` | Own authoritative wallet, growth, stage, and completions |
| GET `/api/v1/artworks?cursor=...&limit=...` | Owned ready artworks; default 20, maximum 100 |
| POST `/api/v1/artworks` | Bounded metadata/image and client save UUID; idempotent logical save |
| GET/PATCH/DELETE `/api/v1/artworks/{id}` | Owner-only; optimistic version on mutations |
| GET `/api/v1/artworks/{id}/image` | Owner-checked binary image; private/no-store cache policy |
| GET `/api/v1/labs` | Allowlisted templates and pattern keys; no filesystem discovery |
| GET `/api/v1/quizzes/current` | Published questions/options; no correct-answer flags |
| POST `/api/v1/quiz-attempts` | Server selects/version-locks quiz and reward window |
| POST `/api/v1/quiz-attempts/{id}/submit` | Validate choices; grade and reward atomically once |
| POST `/api/v1/challenges/{id}/complete` | Validate server-defined completion evidence; no arbitrary stars |
| POST `/api/v1/imports/artworks` | Explicit validated import; no trusted reward migration |
| POST `/api/v1/me/export` | Request bounded private export; recent authentication |
| DELETE `/api/v1/me` | Reauthentication and confirmed deletion policy |

## Validation and semantics

UUIDs do not replace ownership checks. Set owner from `request.user`; reject/ignore identity and entitlement fields using explicit schemas, never blind model assignment. Lab/template/pattern/avatar/species keys must match allowed catalogs, including lab membership. Titles: 1..120 characters; description: at most 2,000; display name: 1..60. Validate metadata and decoded media independently.

Return `{ "data": ... }` for successful JSON responses and `{ "error": { "code": "...", "message": "...", "fields": {}, "request_id": "..." } }` for errors. Do not return debug traces or internal paths. API authentication failures return JSON 401 rather than an HTML redirect; page requests can redirect safely to login. Use 403 for permitted-to-disclose policy/CSRF failures, 404 for inaccessible artwork, 409 for version/idempotency conflicts, 413 for payload limits, 422 for validated field failures, and 429 for throttling. Normalize framework errors through tested handlers.

CSRF tokens are available through the documented session/bootstrap flow and sent in `X-CSRFToken`. SameSite is defense in depth, not a CSRF substitute. No mutation through GET. Disable permissive CORS; only introduce origins explicitly if a future architecture requires them.

For updates require a version/If-Match mechanism and return 409 on stale writes; do not overwrite a second device's changes silently. Persist deduplication identifiers for successful artwork saves and assessment submissions. A replay after deletion returns the prior/tombstoned operation result, not a newly rewarded artwork. Bind deduplication scope to user and endpoint, and compare payload fingerprints.

Retries of reads are bounded. Retry mutations only with a stable logical identifier and defined replay behavior. A timeout is an unknown result, not proof of failure. The client shows saving/saved/failed/needs-login states and never increments rewards before server acknowledgment.
