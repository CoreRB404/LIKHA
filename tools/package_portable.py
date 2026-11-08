"""Build the ready-to-share ZIP. Python is used for packaging, not to run it."""
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "LIKHA-Portable.zip"
files = set()
for suffix in ("*.html", "*.css", "*.js", "*.ico"):
    files.update(path for path in ROOT.glob(suffix) if path.is_file())
files.update(path for path in (ROOT / ".vscode").rglob("*.html") if path.is_file())
for folder in ("craftlab", "festival_lab"):
    files.update(path for path in (ROOT / folder).rglob("*") if path.is_file())
# Keep picture fallbacks and current artwork; omit unused legacy tutorial videos
# and the large source sheets, which the app no longer needs at runtime.
files.update(path for path in (ROOT / "assets").rglob("*") if path.is_file() and path.suffix.lower() != ".mp4")
files.update(path for path in (ROOT / "images").glob("*") if path.is_file())
files.update((ROOT / "images/pets").glob("*-v1.webp"))
for source in ROOT.iterdir():
    if source.is_file() and source.suffix in {".js", ".html", ".css"}:
        for match in re.finditer(r'''assets/[^\s"'`<>]+\.mp4''', source.read_text(encoding="utf-8")):
            files.add(ROOT / match[0])

for species in ("rabbit", "cat", "dog", "lion", "panda", "tiger"):
    for stage in ("baby", "growing", "young", "grown"):
        assert ROOT / f"images/pets/{species}-{stage}-v1.webp" in files

instructions = """LIKHA - NO INSTALLATION NEEDED

1. Right-click LIKHA-Portable.zip and choose Extract All.
2. Open the extracted folder.
3. Double-click index.html. Use Google Chrome or Microsoft Edge.

Keep all files and folders together. Do not open index.html inside the ZIP viewer.
No Python, server command, VS Code extension, or internet connection is required.

Artworks, quizzes, stars, pet growth and avatar settings are saved in this browser.
Use the same browser and launch method to continue your progress.
To share with another laptop, send this entire ZIP, not just index.html.
"""
with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(files):
        assert path.is_file(), path
        assert path.resolve().is_relative_to(ROOT), path
        archive.write(path, path.relative_to(ROOT).as_posix())
    archive.writestr("START-HERE.txt", instructions)
print(f"Built {OUTPUT.name}: {len(files)} app files, {OUTPUT.stat().st_size / 1024**2:.1f} MB")
