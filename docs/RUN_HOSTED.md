# Run the account-backed LIKHA application

This installation now uses Django + local PostgreSQL, with artwork kept in private local files. See [local PostgreSQL operations](LOCAL_POSTGRES.md). The root `index.html` and `LIKHA-Portable.zip` remain the separate offline demo. Opening a file directly does not use hosted accounts.

## Windows setup

Install Python 3.12 or later and PostgreSQL server tools (PostgreSQL 17 is installed on this laptop). Open a terminal in the LIKHA project folder. The included PowerShell helper creates the local virtual environment, installs the hash-locked dependencies, builds the hosted assets, initializes/starts the private local PostgreSQL cluster, applies migrations and initializes assessments:

```powershell
.\start-hosted.ps1
```

If your PowerShell policy prevents local scripts, run the equivalent commands directly; no policy change is necessary:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements/production.txt
.\.venv\Scripts\python.exe tools/build_hosted.py
.\.venv\Scripts\python.exe tools/local_postgres.py setup
.\.venv\Scripts\python.exe tools/local_postgres.py start
.\.venv\Scripts\python.exe backend/manage.py migrate --noinput
.\.venv\Scripts\python.exe backend/manage.py seed_content
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000 --noreload
```

Open **http://127.0.0.1:8000/**. Keep the terminal open. Stop with Ctrl+C. If port 8000 is already occupied by the old offline server, stop that server first, or choose `127.0.0.1:8002` and open its matching URL.

After installation, start the database with `tools/local_postgres.py start`, then run the last command. Both work offline once dependencies are installed. After source updates, rebuild assets and apply supplied migrations. Do not delete PostgreSQL data or private configuration to resolve an error. Existing SQLite installations must complete the quiesced transfer described in LOCAL_POSTGRES.md before activation.

## Accounts without email

Create an account with a username, display name and passphrase, then sign in immediately. No email address, verification link, SMTP service or mail file is required. Usernames are case-insensitive.

Existing accounts keep their previous login identifier and passphrase. If your old identifier was an email address, enter that same text in the Username field; it now serves only as your existing username. Your drawings, rewards and pet remain attached to the same account.

Change your passphrase in Account settings using your current passphrase. A forgotten passphrase requires a trusted local administrator to verify your identity and reset it privately:

```powershell
.\.venv\Scripts\python.exe backend/manage.py changepassword USERNAME
```

This is an administrator console command, not a public reset link. Do not give users access to the server terminal or share replacement passphrases publicly.

## What is saved on the server

Each account has its own gallery, avatar, pet, assessment attempts, reward ledger and progress. PostgreSQL data is in `var/postgres-data/`, private connection configuration is in `var/local-postgres.json`, and validated drawings are in `var/artworks/`. Old SQLite files have been archived under private `var/backups/` and are no longer active. Logging in from another browser shows the same server records. Do not move PostgreSQL cluster files while it is running. Use PostgreSQL backups; the old SQLite backup command refuses this database.

Private image routes require the owning account. Anonymous or other-user requests cannot download them. Signup does not grant administrative privileges. The public asset build does not contain the offline quiz answer key or browser reward scripts.

Artworks earn 15 stars plus first/fourth bonuses. Reward credit is limited to 10 distinct new artwork images/account/day; identical-image copies and imported legacy work do not generate another reward. Saving still works after the reward limit. Quizzes are graded by the backend; practice does not repeat weekly rewards. Creative challenges use matching saved artwork as completion evidence and do not add an undocumented second payout.

Settings provides a password-confirmed private export, explicit single-image import with preview, and account deletion. Import old artwork as PNG/WebP; arbitrary browser balances and grades are not imported. Keep the old portable folder/browser storage until you have verified your work was transferred.

## Staff administration

Create an administrator privately, then enroll its authenticator before using `/admin/`:

```powershell
.\.venv\Scripts\python.exe backend/manage.py createsuperuser
.\.venv\Scripts\python.exe backend/manage.py enroll_staff_mfa your-staff-username
```

The enrollment command asks for the existing password and a valid authenticator code, then displays one-use recovery codes. Store these privately; do not screenshot or log them. An account password alone cannot enter the admin. The initial admin exposes account activation and read-only reward/security records, not private student drawings.

## Linux development

Use `python3 -m venv .venv`, `.venv/bin/python` in place of the Windows interpreter, and the same build/migrate/seed commands. The production configuration is described in [DEPLOY_HOSTED.md](DEPLOY_HOSTED.md); development `runserver` is not a public deployment.

## Verification commands

See [local engineering checks](LOCAL_ENGINEERING.md) for the expanded accessibility, browser, security, failure-recovery and container test commands.

```powershell
.\.venv\Scripts\python.exe tools/check_postgres.py
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe tools/check_production.py
.\.venv\Scripts\python.exe tools/hosted_system_check.py
python tools/check_hosted_artifact.py
```

With the development server running on port 8001 and Chrome/Node installed:

```powershell
node tools/hosted_browser_check.mjs
```

Override `LIKHA_HOSTED_URL` and `CHROME_PATH` if needed. Browser tests create only synthetic username accounts and remove the successful test account at the end. Failed test runs may leave synthetic records for investigation. Browser tests use immediate username login and are not intended to register accounts against a public live site.

## Clean website URLs

Hosted pages now use `/dashboard/`, `/studio/?lab=fashion`, `/gallery/`, `/avatar/`, `/pet/`, `/quiz/` and `/settings/`. Existing .html bookmarks redirect to canonical paths and preserve lab/challenge selections. Original source files and Django templates still use .html as their normal file extension. The portable file-based demo keeps its original links.
