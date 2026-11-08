# Product requirements

> Account policy update: use username/password accounts with immediate login. Email collection, verification, SMTP/outbox delivery and emailed recovery in the original plan below are superseded by [AUTHENTICATION.md](AUTHENTICATION.md). Signed-in password changes require the current passphrase; forgotten passwords use a trusted local administrator reset.

## Accounts and access

Default hosted roles are Student and Administrator. Use Django permissions and explicit policies, not a role name sent by the browser. Teacher/classroom access is deferred until requirements define class membership and student-data visibility. Default artwork visibility is private; no public profiles, sharing links, chat, or student directory in the initial release.

A visitor can see the welcome, login, signup, recovery, privacy, and accessibility/help pages. A signed-in student can access learning features and their own records. Staff access requires explicit permissions and the administrative authentication policy.

Signup collects a username, password, confirmation, a display name, and required notice acknowledgment. Avoid full legal names, birthdays, addresses, school IDs, and demographic fields unless the institution establishes a need. Settle the audience/consent policy before public enrollment.

## Required flows

1. Signup -> account created -> immediate username/password login -> dashboard. Duplicate usernames show an availability error.
2. Login -> safe internal destination -> server-loaded progress. Invalid or disabled accounts get a non-enumerating error. Logout invalidates the server session and clears account-specific client views.
3. Create artwork -> explicit save -> durable private record -> gallery -> reopen/download/delete. A failed save must remain visible as failed; retain the current drawing for retry.
4. Select avatar/pet -> save -> reload or second-device login -> same selection. Pet growth uses earned progress, not a submitted stage.
5. Start assessment -> answer -> submit -> server grade -> first-eligible reward -> feedback. Retrying the same request cannot mint extra rewards.
6. Change password -> confirm current credentials -> validate new passphrase -> revoke sessions -> fresh login. Forgotten passphrases use a trusted local administrator reset, not email or a public reset-by-username endpoint.
7. Export own records and request account deletion. Clearly explain retention and backup expiry before confirming deletion.

## Acceptance examples

Student A's gallery is empty for Student B. B cannot fetch A's artwork even if B learns its UUID or file name. After A saves an artwork and the server restarts, A still sees it. Saving once while the network retries creates one artwork and one reward. Logging out and using browser Back does not expose A's saved data to B.

Each lab retains its own template list. A selected pattern is the same tile in preview and fill, with only density scaling. Changing brush color does not change the tile colors. Undo removes a fill without removing the original outline. Tutorial navigation preserves the drawing.

## Nonfunctional targets

Use these as initial acceptance targets, then measure with the agreed classroom load: usable at 360px width, keyboard-operable account forms, WCAG 2.2 AA as the accessibility target, API p95 below 500ms for metadata at 20 concurrent active students, and no lost or duplicated reward events. These are proposed targets, not current measured performance.

Target 99.5% monthly service availability, recovery point within 24 hours and restore within 4 hours for the first release. Hosting and backup design must meet these targets before they can be promised to users.
