Current design contract: root project HTML/CSS remain the visual source of truth. Django uses generated original templates, scoped integration CSS, local original fonts and server-backed controllers. See e2e/original-design.spec.mjs for original-layout, sidebar, profile/pet, quiz and progress regressions.

# Local engineering checks and maintenance

These improvements apply to the username/password hosted application and preserve the separate no-install demo. They do not add email, verification links, public sharing, or operator notices to the student screens.

## Implemented improvements

The frontend entrypoint now loads one page controller at a time from `backend/frontend/page-*.js`. API transport and shared DOM/dialog behavior live in `api.js` and `ui.js`. Controllers are formatted consistently with the pinned Prettier version. The public build copies these source files; do not edit generated `backend/public` or `backend/templates/legacy` files.

Dialogs trap keyboard focus, make background controls inert, support Escape and restore focus to the opening button. Form errors are announced. Standalone pages have skip links, visible focus indicators and reduced-motion support. Contrast defects found on welcome/account/avatar/pet/quiz/gallery screens are corrected. Canvas keyboard controls support arrows to move the cursor, Shift+arrows to draw, Enter to use the selected tool, Escape for Draw, and Ctrl/Cmd+Z for Undo.

Artwork saves keep their stable request identifier after a failed request, allowing a safe retry. Disk-full, read-only/permission and database-unavailable errors have useful retry responses without leaking internal paths. Incomplete staging writes are cleaned up; pending saves recover without awarding twice. Image delivery verifies the stored checksum, and the read-only `check_storage` command checks SQLite integrity, foreign keys and private image hashes. Missing/corrupt files are reported rather than served as valid images.

JSON input rejects duplicate keys, invalid Unicode, non-finite values and excessive nesting. Tests cover malformed/truncated images, invalid lab/challenge values, ownership, safe rendering of script-shaped titles, stale concurrent profile changes and interrupted storage operations. Populated assessment migrations preserve grades and rewards while upgrading opaque option IDs. Username schema rollback/reapply preserves identifiers and password hashes; a full application downgrade still requires the documented backup/compatibility procedure.

## Password screening without email or required network access

Signup and password changes use a bundled 99,999-entry weak/compromised-password lookup blocklist, in addition to length/common/similarity validation. The source is the public SecLists common-credentials corpus; only lookup hashes are bundled, with its license and source metadata. SHA-1 is used solely for corpus lookup; account passwords are stored with Argon2.

Default `LIKHA_PASSWORD_BREACH_MODE=offline` needs no internet. A finite blocklist cannot cover every breach or every unsafe password. Optional `online` mode also queries HIBP's password-range API using only the first five SHA-1 characters and padded responses, never the password, username or full hash. Online mode fails closed if the service is unavailable or its response is malformed. Configure it deliberately if network-dependent password checks suit your use case.

To refresh the local corpus intentionally, run `python tools/update_password_corpus.py` with network access, review `backend/accounts/password-corpus-source.json`, and restart the application. The script never persists plaintext passwords. Custom `LIKHA_PASSWORD_BLOCKLIST` files must contain one uppercase 40-character hash per line; missing/corrupt lists fail the safety check rather than bypass it.

## Repeatable verification

Install runtime requirements first, then developer tools separately:

```powershell
.\.venv\Scripts\python.exe -m pip install --require-hashes -r requirements/production.txt
.\.venv\Scripts\python.exe -m pip install -r requirements/development.txt
npm.cmd ci --ignore-scripts
node node_modules/playwright/cli.js install chromium firefox webkit
```

On Linux use `.venv/bin/python`, `npm`, and add `--with-deps` to browser installation. Browser downloads and developer tools are not required by students or by the runtime application.

```powershell
.\.venv\Scripts\python.exe backend/manage.py test tests --noinput
.\.venv\Scripts\python.exe tools/run_hosted_browser.py --engineering
.\.venv\Scripts\python.exe tools/hosted_system_check.py
.\.venv\Scripts\python.exe tools/check_production.py
.\.venv\Scripts\python.exe -m bandit -r backend -x backend/tests,backend/accounts/migrations,backend/learning/migrations,backend/public
python tools/check_secrets.py
node node_modules/prettier/bin/prettier.cjs --check "backend/frontend/*.js"
```

Engineering browser tests use isolated synthetic accounts/databases and test Chromium, Firefox, WebKit, mobile Chromium and mobile WebKit. Installed Edge is also included on Windows. You can select one with `--engineering --project=firefox`. Each project has a fresh database, keeping signup throttling enabled and avoiding cross-test account collisions. Reports/traces are stored only under ignored `var/` directories.

The tests run axe WCAG A/AA rules through 2.2, keyboard drawing/focus, all four lab catalogs, mobile overflow/touch, private artwork saving, safe text rendering, and a simulated failed save followed by idempotent retry. Browser-engine/device emulation is not the same as testing actual Safari/iOS/Android hardware or listening with NVDA/VoiceOver. Those remain useful human acceptance checks; no automated tool proves complete accessibility compliance.

Bandit runs against backend source, with two narrowly documented password-validator false-positive suppressions: a mode named `online` is not a hardcoded password, and the range endpoint is a fixed HTTPS host plus five hex characters. Focused secret scanning reports locations without printing candidate values. These scans complement tests/review; they do not establish a security certification or review historical Git commits.

## Containers and CI

`tools/check_container.py` builds the real image, initializes a disposable named volume, starts it on loopback, checks readiness/private-file denial, restarts it and confirms database persistence, then removes only its own test resources. It requires a running Linux-container Docker engine. The local machine has the CLI but no running engine or Docker Desktop installation, so actual container execution is explicitly blocked here.

```powershell
python tools/check_container.py
```

CI now installs the locked browser dependencies, runs accessibility/browser engines, formatting, focused secret scanning, Bandit, dependency advisories, backend/recovery tests, and a real container smoke test after the image build. The workflow is configured; it has not been executed on a connected remote repository by this task. Do not report a remote green build without its result.

## Evidence and limits

The local backend suite has 50 passing tests. All 12 browser scenarios across six configurations passed. Local static security and formatting checks pass. The existing offline suite, pattern-preview pixel comparisons, 20-student load and restart/backup/restore checks also pass. See [the status register](engineering/IMPLEMENTATION_STATUS.md) for current evidence and release blockers.

Public hosting, real-device/screen-reader acceptance, organizational privacy decisions, off-host backup delivery and alert ownership are distinct from local implementation. Keep these limitations explicit rather than saying every possible engineering concept is complete.
