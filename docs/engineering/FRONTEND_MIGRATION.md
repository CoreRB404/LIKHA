# Frontend and legacy-state migration

## Preserve before refactoring

Capture current desktop/mobile behavior and run the existing checks before changes. Preserve the visual system, accessible labels, lab-specific catalogs, mask controls, tutorials, patterns, pet artwork, and avatar choices. Do not rename assets or rewrite the dashboard just to match a preferred framework.

Extract dashboard inline styles/scripts incrementally into page modules so an enforced CSP becomes practical. Keep shared services separate from DOM rendering: API transport, session lifecycle, catalog data, progress snapshot, and per-page controllers. Start with one real authenticated gallery slice, then convert the remaining pages.

## Hosted client state

Create a small same-origin API client that sends session credentials, CSRF on mutations, bounded payloads, request IDs, and stable save/submit identifiers. Normalize JSON and binary/error responses. Do not assume every 200 response is valid app JSON or every failure is an expired session.

The server response supplies owned records and derived progress. Client memory may cache that snapshot for rendering; localStorage is limited to non-sensitive preferences. No browser-generated role, owner, wallet, quiz grade, pet stage, or completion can override server truth. On 401 preserve unsaved work in memory and request sign-in; do not silently switch the hosted page to offline rewards.

Show distinct loading, empty, failed, saving, saved, conflict, and expired-session states. Disable duplicate submit controls while maintaining idempotency on the server. Preserve an unsaved canvas after a failed request. Do not report success until the backend commits a ready record. Apply optimistic concurrency for profile/artwork changes from multiple tabs/devices.

Logout clears profile, gallery, progress, private image URLs, in-memory caches, and any account-scoped drafts under the chosen policy. Refetch on authentication change. Prevent stale responses from a previous account populating the next account's view, using an account/session generation guard or cancellation. Test browser Back and shared-laptop handoff.

## Offline demo separation

The current portable ZIP remains browser-local and has no account security. Maintain a documented portable build/source boundary that does not package backend source, secrets, databases, answer keys intended only for hosted quizzes, or live student uploads. The existing packager must be reviewed when files move; a new backend `.py` file must never be accidentally added to a public artifact.

Authenticated features require HTTP/HTTPS and the backend. Opening `index.html` directly must not show a fake logged-in account or attempt filesystem SQLite access. Make the selected mode explicit in documentation and UI where it affects persistence. Test both artifacts separately rather than letting environment errors choose the mode.

## Legacy import

Inventory all current storage keys and malformed/duplicate-ID repair behavior. Offer an explicit local export before conversion. Server import accepts bounded artwork images and basic metadata, validates them like any upload, and assigns ownership to the authenticated importing account. Use a per-account stable source fingerprint to avoid duplicate imports.

Do not import trusted stars, levels, assessment scores, quiz attempts, staff flags, or lifetime reward totals from localStorage. Mark imported artwork as legacy and reward-ineligible by default. Explain this before confirmation. An institution-approved historical credit process must be separate, restricted, audited, and idempotent.

Never clear original browser storage until the user has verified the export/import result and explicitly requests removal. A migration failure must be recoverable without data loss. Test corrupt JSON, huge data URLs, duplicates, interrupted imports, previous-account data, unsupported assets, and repeated import requests.
