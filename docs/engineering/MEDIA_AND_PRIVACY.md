# Private artwork, media, and student privacy

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Storage categories

Bundled lab references, avatars, pet growth images, and tutorial videos are public application assets. Student-created drawings, exports, and account uploads are private. Store private files outside the repository's static tree and outside any automatically served directory. Database storage keys are internal generated identifiers, not user-controlled paths.

An owned image request first checks session, account state, and owner. Then stream the validated image or use a protected internal proxy redirect. Do not return a public URL as a substitute for access control. Set private/no-store cache headers; a file UUID alone is not authorization.

## Artwork ingestion defaults

Accept PNG/WebP only initially. Maximum upload 5 MiB; maximum decoded 4 megapixels and maximum dimension 2,048px. These are initial application limits; enforce matching proxy/body limits allowing multipart overhead. They comfortably include the current 1,000x700 drawing canvas. Return useful errors without discarding the unsaved drawing.

Verify decoded format, reject malformed/animated files, guard decompression bombs and decoder resource use, strip metadata, and re-encode with maintained imaging libraries. Do not trust filename extension, MIME header, dimensions supplied by the browser, or a data URL prefix. Generate server filenames; prevent traversal, absolute-path resolution, symlink escape, and overwrites. Reject SVG, HTML, arbitrary archives, and executable content.

Set a first-release private storage quota of 100 MiB/account and enforce it transactionally enough to prevent parallel bypass. Include temporary/pending uploads in accounting or bound them separately. Test disk-full failure, clean abandoned staged files safely, and account for re-encoded output size. Keep source data URLs out of general metadata/logs.

Tutorial videos must preserve range requests, correct MIME types, URL-encoded paths, and mobile behavior. Validate the MOV in target browsers; if transcoding is required, retain source and verify visual/audio content. Do not auto-fetch large video files on every dashboard visit.

## Privacy by default

Use pseudonymous display names and private galleries. Do not publish email, full name, student records, or artwork by default. Avoid behavioral advertising, tracking pixels, and unnecessary analytics. Staff access to student content must have a defined purpose and permission, with audit records.

Before enrollment establish audience age range, institution/controller, jurisdiction, consent or other lawful basis, parent/guardian process if applicable, retention periods, contact process, and school policy. These are release decisions requiring the responsible owner and appropriate review, not legal conclusions made by an implementation agent. Do not collect a birthday merely to avoid making this decision.

## Retention and deletion defaults for review

Propose inactive-account review after 12 months, application/security-log retention of 30 days, and encrypted backup retention of 30 days. The institution must confirm or replace these before production. Never retain sensitive request bodies as a log shortcut.

Account export requires recent authentication and contains only the requester’s records. Account deletion immediately revokes sessions and disables access, then removes owned live files/records according to the confirmed policy. Maintain the minimum deletion/tombstone mechanism necessary to prevent accidental resurrection during a restore; restrict its access and retention. Backups expire under the documented schedule, and restore procedures reapply deletions before reopening access.

Do not upload browser-local records automatically on login. Shared laptops may contain another student's work. Import must show a preview/count, destination account, scope and explicit confirmation, with cancel and export options. Imported balances and assessment achievements remain untrusted.
