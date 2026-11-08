"""Build a public allowlist and protected HTML shells. No student data or quiz key."""
from pathlib import Path
import re
import shutil
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
PUBLIC = BACKEND / "public"
TEMPLATES = BACKEND / "templates/legacy"
PUBLIC.mkdir(parents=True, exist_ok=True)
TEMPLATES.mkdir(parents=True, exist_ok=True)

# Only explicitly publish application assets. Never recurse over the repository.
for file in ROOT.glob("*.css"):
    shutil.copy2(file, PUBLIC / file.name)
for folder in ("assets", "images", "craftlab", "festival_lab"):
    for source in (ROOT / folder).rglob("*"):
        if not source.is_file() or source.suffix.lower() not in {".webp", ".png", ".jpg", ".jpeg", ".ico", ".mp4", ".mov", ".mp3", ".wav", ".ogg", ".woff2", ".txt"}:
            continue
        if source.suffix.lower() == ".txt" and not (source.parent == ROOT / "assets/fonts" and source.name.endswith("-OFL.txt")):
            continue
        if folder == "images" and source.name.endswith("-growth-v1.png"):
            continue
        target = PUBLIC / source.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
shutil.copy2(ROOT / "favicon.ico", PUBLIC / "favicon.ico")


def asset_paths(source):
    for prefix in ("images/", "assets/", "craftlab/", "festival_lab/"):
        source = source.replace(prefix, "/static/" + prefix)
    return source


PAGE_URLS = {name: "/" + name + "/" for name in ("dashboard", "studio", "gallery", "avatar", "pet", "quiz", "settings")}
PAGE_URLS.update({"index":"/", "challenges":"/dashboard/#dailyChallenge", "grow-a-pet":"/pet/", "weekly-quiz":"/quiz/"})


def clean_page_links(html):
    def replace(match):
        original = urlsplit(match[2])
        if original.scheme or original.netloc:
            return match[0]
        name = original.path.removeprefix("./").removeprefix("/")
        if not name.endswith(".html") or name[:-5] not in PAGE_URLS:
            return match[0]
        target = urlsplit(PAGE_URLS[name[:-5]])
        destination = urlunsplit(("", "", target.path, original.query, target.fragment or original.fragment))
        return "href=" + match[1] + destination + match[1]
    return re.sub(r"href=([\"'])([^\"']+)\1", replace, html)


for name in ("mask-reference.js", "pet-art.js", "site.js"):
    (PUBLIC / name).write_text(asset_paths((ROOT / name).read_text(encoding="utf-8")), encoding="utf-8")
drawing = (ROOT / "studio.js").read_text(encoding="utf-8").split("// LIKHA STUDIO")[0]
# Extract only the drawing IIFE, not the browser-local save/reward implementation.
drawing = drawing[:drawing.index("})();") + len("})();")]
drawing = drawing.replace('localStorage.getItem("selectedLab")', 'null')
# Reset the existing Undo stack after loading an owned saved image. No drawing
# implementation or portable source file is changed.
drawing = drawing[:-len("})();")] + 'canvas.addEventListener("likha-artwork-loaded", () => { history = []; saveHistory(); });\n})();'

(PUBLIC / "studio-drawing.js").write_text(asset_paths(drawing), encoding="utf-8")

scripts = {
    "index": [], "dashboard": [],
    "studio": ["mask-reference.js", "studio-drawing.js"],
    "avatar": [], "gallery": [], "pet": ["pet-art.js"], "quiz": [],
}
for page, extra in scripts.items():
    html = (ROOT / f"{page}.html").read_text(encoding="utf-8")
    html = re.sub(r"<script\b[^>]*>.*?</script>", "", html, flags=re.S | re.I)
    html = re.sub(r'<link\b[^>]*https://fonts\.[^>]*>', "", html)
    html = re.sub(r'\s+on\w+="[^"]*"', "", html)
    html = re.sub(r'(href|src)="([^"]+\.(?:css|ico))"', lambda m: f'{m[1]}="/static/{m[2]}"', html)
    html = asset_paths(html)
    html = html.replace('</head>', '<link rel="stylesheet" href="/static/original-fonts.css"><link rel="stylesheet" href="/static/hosted.css"><link rel="stylesheet" href="/static/original-integration.css"><script src="/static/api.js" defer></script>\n</head>')
    html = html.replace('href="studio.html"', 'href="/dashboard.html#choose-lab"')
    html = html.replace("Student Name", "Display name").replace("e.g. Maria Santos", "e.g. Creative Explorer")
    html = html.replace("<body", f'<body data-page="{page}" class="original-page"', 1)
    if page == "index":
        html = html.replace('href="dashboard.html"', 'href="/accounts/login/"')
    if page == "dashboard":
        html = html.replace('<aside class="sidebar">', '<aside class="sidebar" id="dashboardSidebar"><button type="button" class="nav-item" id="dashboardMenuClose" hidden>Close menu</button>', 1)
        html = html.replace('<div class="mobile-brand">', '<div class="mobile-brand"><button type="button" class="secondary-btn" id="dashboardMenuToggle" aria-expanded="false" aria-controls="dashboardSidebar">Menu</button>', 1)
        # Preserve the original sidebar. Account actions use the same nav-item style.
        html = html.replace('<div class="sidebar-bottom">', '<nav class="nav-list" aria-label="Account"><a class="nav-item" href="/settings.html">Account settings</a><button type="button" class="nav-item" data-logout>Sign out</button></nav><div class="sidebar-bottom">', 1)
        # The old metadata-only creation view had no drawable image. Its navigation
        # goes to the original Creative Labs; never submit browser reward records.
        html = re.sub(r'<section class="view" id="view-create">.*?</section>', '', html, flags=re.S)
    main = re.search(r"<main\b([^>]*)>", html)
    if main:
        identity = re.search(r'id="([^"]+)"', main[1])
        target = identity[1] if identity else "main"
        if not identity:
            html = html.replace(main[0], f'<main id="main" tabindex="-1"{main[1]}>', 1)
        html = re.sub(r'(<body\b[^>]*>)', lambda match: match[0] + f'<a class="skip-link" href="#{target}">Skip to content</a>', html, count=1)
    html = html.replace("</body>", ''.join(f'<script src="/static/{script}" {"type=module" if script == "hosted.js" else "defer"}></script>' for script in ["site.js", *extra, "hosted.js"]) + "</body>")
    html = clean_page_links(html)
    html = re.sub(r'<form\b(?![^>]*\bmethod=)', '<form method="post"', html)
    (TEMPLATES / f"{page}.html").write_text(html, encoding="utf-8")

for source in (BACKEND / "frontend").glob("*"):
    if source.suffix in {".js", ".css"}:
        shutil.copy2(source, PUBLIC / source.name)

for file in PUBLIC.rglob("*"):
    assert not file.is_symlink(), file
    assert file.suffix.lower() not in {".sqlite3", ".db", ".py", ".json", ".env"}, file
assert not (PUBLIC / "quiz.js").exists(), "The offline quiz answer key must never be published."
print("Built protected page shells and public asset allowlist.")
