# Current system and preservation map

Inspected 2026-11-08. Recheck files before implementation; this is a baseline, not a perpetual audit.

This file preserves the pre-backend baseline. The implemented hosted application is described in [the current status](IMPLEMENTATION_STATUS.md) and [setup guide](../RUN_HOSTED.md); do not treat the historical absence of authentication below as the current backend state.

## What exists

The root contains static HTML/CSS/JavaScript. `index.html` is the entry, with `dashboard.html`, `studio.html?lab=...`, `gallery.html`, `avatar.html`, `pet.html`, and `quiz.html`. Dashboard has multiple views and substantial inline code. Some root and `.vscode` pages are compatibility redirects.

`serve.py` is a development-oriented `SimpleHTTPRequestHandler` / `ThreadingHTTPServer`. It serves the repository directory, compresses text, and supports tutorial media ranges. It has no application authentication or ORM. Adding a SQLite file beneath its served root could expose that database; the production application must use a different serving boundary.

State lives in localStorage, including:

| Key or module | Purpose | Hosted replacement |
| --- | --- | --- |
| `likhaDashboardPrototype_v1` | Combined dashboard, activities, avatar, pet, rewards | Account-scoped API snapshot |
| `likhaArtworks` | Canvas/gallery saved artwork | Owned Artwork records and private files |
| `likhaQuizDataV1` | Quiz attempts and rewards | Server attempt and reward records |
| `likhaSavedAvatar`, `likhaSelectedAvatar` | Avatar selection | Validated Profile fields |
| `likhaPet` | Legacy pet state | PetState and verified growth events |
| `pet-progress.js` | Browser reconciliation and legacy recovery | Server domain service |
| `artwork-rewards.js` | Browser artwork rewards ledger | Transactional RewardEvent ledger |

Quiz answers are present in `quiz.js`. That is acceptable for a local practice demo but cannot establish trusted assessment or rewards. Hosted quiz payloads must omit the answer key until the applicable feedback policy permits disclosure.

## Behavior that must survive

Fashion templates: shirt, dress, barong, malong. Festival: parol, mask. Craft: basket, banig, fan, pot. Art: blank, flower, house, mountain. Do not recreate the previous combined dropdown defect.

Studio now generates pattern previews and fills from the same cached tile. Selecting a pattern activates an enclosed-area fill, then returns to Draw. Brush color must not substitute for the selected tile. Preserve this invariant when extracting modules.

Tutorial sources are `craftlab/Basket.mp4`, `craftlab/Banig_v3.mp4`, `craftlab/Fan.mp4`, `craftlab/claypot.mp4`, and `festival_lab/paper parol.mov`. Check target-browser support, seeking, and delayed loading after reorganizing paths.

Pet illustrations use `images/pets/*-{baby,growing,young,grown}-v1.webp`. `pet-art.js` loads 24 age illustrations. Keep the distinct growth artwork, not CSS scaling of one picture. Six avatars include `avatar-filipino-artist-6`.

## Existing verification

`tools/audit_site.py` validates local references. Node checks cover pet progression, artwork rewards, browser pages, offline operation, and pattern filling. `tools/fashion_pattern_check.mjs` accepts `fashion`, `festival`, `craft`, or `art` and verifies pattern-preview pixel agreement, real mouse interaction, Undo, and lab-specific dropdowns.

These checks establish prototype regressions only. They do not establish authentication, multi-user isolation, production security, or backend concurrency safety.

## Migration risks

Inline dashboard behavior and standalone pages duplicate state access. Inventory every storage write before enabling hosted mode. Existing browser data cannot be assigned a trusted identity or trusted reward balance. Preserve export/import opportunity without silently uploading a previous student's records on a shared laptop.
