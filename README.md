Local database: **PostgreSQL**. The existing data has been transferred; restart with `tools/local_postgres.py start` before launching Django. See [local PostgreSQL instructions](docs/LOCAL_POSTGRES.md).

Supabase/Render cloud setup: see [docs/SUPABASE_RENDER.md](docs/SUPABASE_RENDER.md). Username login stays in Django; cloud credentials and live deployment are not configured in this source.

# LIKHA

## Account-backed application

The Django + SQLite application is in `backend/`, alongside the original portable demo. It includes username/password accounts, private drawings, server-graded quizzes/rewards, avatar/pet persistence, staff MFA, and backup/restore commands.

Start it locally with `.\start-hosted.ps1`, or follow [hosted setup](docs/RUN_HOSTED.md). Open `http://127.0.0.1:8000/`. No email address or verification is required. See [production setup](docs/DEPLOY_HOSTED.md) for hosting and [implementation status](docs/engineering/IMPLEMENTATION_STATUS.md) for verification and remaining public-launch blockers. No public hosting is configured by this change.

The [engineering handbook](docs/engineering/README.md), [master prompt](docs/engineering/MASTER_PROMPT.md), and [AGENTS.md](AGENTS.md) guide further work. The instructions below describe the **separate browser-local demo**, not authenticated account storage.

The [local engineering guide](docs/LOCAL_ENGINEERING.md) documents keyboard/accessibility improvements, page modules, offline password screening, failure recovery, browser coverage and automated checks.

## Run without installing anything

Extract the entire LIKHA folder, then double-click the main `index.html` in Chrome or Edge. Keep the HTML files and their `images`, `assets`, `craftlab`, and `festival_lab` folders together. Python, Node, VS Code extensions, and an internet connection are not required to use the app.

The site includes the pet age images and tutorial videos as ordinary local files. Progress is saved in the browser used to open the app. File mode and a hosted site use separate browser storage, so use the same mode and browser to continue a saved session.

`LIKHA-Portable.zip` is the ready-to-share version: extract it completely and open `index.html` inside. Do not open the HTML from inside the ZIP viewer.

## Optional local server

If Python is already installed, you can also run from this folder:

```powershell
python serve.py
```

Open `http://localhost:8000/` and forward **port 8000** for remote access. The optional server uses concurrent requests, compresses HTML/CSS/JavaScript, and revalidates cached files when they change.

## Pages

| URL | Page |
| --- | --- |
| `/` | Welcome |
| `/dashboard.html` | Dashboard |
| `/dashboard.html#choose-lab` | Creative Lab options |
| `/studio.html` | Selected Creative Lab |
| `/quiz.html` | Weekly assessments |
| `/avatar.html` | Avatar editor |
| `/gallery.html` | Saved artwork |
| `/pet.html` | Pet companion |
| `/dashboard.html#dailyChallenge` | Creative challenges |

Application HTML, CSS, and JavaScript live at the root. `assets/` contains shared artwork, lab thumbnails, and tutorial media; `images/` contains avatar and pet images. Current pages use optimized WebP images. Original image URLs remain available for existing saved data. `.vscode/*.html` files are compatibility redirects for old shared links, with query strings and fragments preserved. Edit the root source files.

Progress and saved artwork remain in browser local storage. A different tunnel hostname is a different browser origin and has its own storage.

Pet progress is reconciled by `pet-progress.js` into the dashboard record. Each saved artwork counts once, and two quiz Pet Growth Points equal one growth activity. Stages begin at 2, 5, and 8 activity equivalents. Legacy artwork points and previously saved artworks are recovered without counting the same artwork twice; deleting artwork does not revoke an earned stage.

Pet appearance uses 24 distinct age illustrations, rather than resizing one picture. `pet-art.js` directly loads the bundled baby, growing, young, or adult WebP files in `images/pets/`; it needs no fetch requests or canvas image extraction at runtime. Both pet screens and the growth-journey cards use these same age assets. The original source sheets, `growth-manifest.json`, and `generation-prompts.json` are development assets. To re-export them, run the optional server and `node tools/export_pet_art.mjs`.

Craft Lab templates appear large and centered directly on the drawing canvas. **Tutorial** opens a separate view with the video on the left and a matching materials list on the right (stacked on narrow screens). **Back to canvas** preserves the drawing and pauses playback. All four tutorials use the MP4 files in `craftlab/`, including `Banig_v3.mp4` for Banig. Videos load when opened and stop when changing templates. The local server supports byte ranges for video playback and seeking.

Festival Lab's Parol uses the same main-canvas and tutorial layout, with `festival_lab/paper parol.mov` and its own materials list. The server supports MOV playback and seeking as well as MP4.

Festival masks use the four quadrants of `festival_lab/mask.jpg`. Choose a design in the dropdown or the reference panel's thumbnails. **Hide mask / Show mask** controls visibility; drag **Move** to reposition, or use the corner handle and +/− buttons to resize. **Reset** restores the initial position and size. Changing references preserves the drawing, and the panel stays inside the canvas on smaller screens.

`artwork-rewards.js` awards 15 stars per unique artwork from either creation flow, plus 5 for the first artwork and 10 for the fourth. A permanent ledger prevents repeat rewards even after visible reward history is trimmed. Previously unpaid lab saves are credited when progress is reconciled; existing dashboard artwork rewards and quiz balances are preserved.

## Checks

```powershell
python tools/audit_site.py
node tools/browser_check.mjs
node tools/pet_progress_test.mjs
node tools/artwork_rewards_test.mjs
node tools/offline_check.mjs
python tools/package_portable.py
```

The Python check validates local page links, CSS asset URLs, and image references. The browser check uses installed Google Chrome and Node 22+ to check every page, compatibility redirects, local resource requests, runtime errors, and lab selection. Override `CHROME_PATH` if Chrome is installed elsewhere. Third-party fonts are blocked during that check to test the fallback display and avoid depending on an external service.

Use `serve.py` for the optional offline-demo server; it now denies access to backend/data/configuration files. Do not use a generic repository-root file server for the hosted application or expose `.venv`, `var`, database files, mail, or secrets.
