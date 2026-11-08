> Current UI policy: use the label Password, minimum 8 characters; no developer/operator guidance, email explanations or privacy acknowledgement in account screens.

# Username/password accounts ? no email workflow

This policy replaces the earlier email-based design at the user's request. Accounts do not collect an email address, require verification, send mail, or provide emailed recovery links. Do not reintroduce those requirements from older planning passages.

## Signup and login

Signup accepts a unique username, display name, password and confirmation. Usernames are normalized to lowercase, 3?254 characters, and use Django's Unicode username validator. The database enforces uniqueness. A duplicate returns a username-unavailable conflict; usernames are identifiers, not private email addresses. Existing pre-migration email identifiers are preserved verbatim as usernames so users retain access.

Accounts can sign in immediately after signup. Use Django authentication, Argon2 hashing, server sessions, CSRF protection, database-backed throttling, safe redirects, secure production cookies and existing idle/absolute session expiry. Do not replace real authentication with a frontend gate.

Passwords require 8-128 characters, with spaces and paste permitted, common-password/similarity validation and no arbitrary composition rules. No password or session token belongs in localStorage or logs. Account creation never accepts staff flags or trusted balances.

## Password changes and forgotten passwords

Signed-in users change their password in Account settings by confirming the current password. `POST /api/v1/me/password` validates the new password, changes the hash and auth version, and signs out all sessions. A user cannot change another account's password by supplying its ID or username.

A forgotten password requires the trusted local administrator to confirm the user's identity outside the application and run `python backend/manage.py changepassword USERNAME` in the private server environment. This uses Django's password validators and invalidates sessions through the authentication hash. Never expose a public reset-by-username endpoint, use security questions, or issue a default/shared replacement password.

## Migration and retired routes

Migration `accounts.0002_username_accounts` renames the existing email column to username, preserves UUIDs and password hashes, revokes sessions/grants and clears pending mail payloads. Existing artwork, balances, profile and pet ownership remain unchanged. The old verification, resend, forgot/reset pages and APIs are removed. The old outbox command fails closed and never sends mail; remove it from any scheduler.

Historical grant/outbox tables are retained for schema/restore compatibility and ordinary retention cleanup, with no active issuance or sender. Old private development-mail files are not served or reused. No SMTP values are required in development or production.

## Staff

Staff administration still requires django-otp TOTP or one-use recovery codes. `createsuperuser` and `enroll_staff_mfa` now use usernames. No public signup can choose a privileged role. Keep staff recovery and server-console access private and auditable.

## Required checks

Verify immediate username-only signup/login, no email input or profile field, retired routes return 404, invalid usernames and duplicate names are rejected, CSRF/throttling remain enforced, password changes require current credentials and revoke other sessions, and migration preserves existing login/artwork/reward data. Continue two-account ownership, uploads, grading and restore tests.
