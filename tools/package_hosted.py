"""Build a source handoff ZIP using an allowlist; never include local account data."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "LIKHA-Hosted-Source.zip"
files = set()
for suffix in (".html", ".css", ".js", ".ico"):
    files.update(path for path in ROOT.iterdir() if path.is_file() and path.suffix == suffix)
files.update(ROOT / name for name in ["README.md", "AGENTS.md", ".gitignore", ".dockerignore", ".env.example", "serve.py", "start-hosted.ps1", "package.json", "package-lock.json", "playwright.config.mjs", "render.yaml"])
for folder in ("backend", "requirements", "deploy", "docs", "tools", "e2e", ".github", "assets", "images", "craftlab", "festival_lab"):
    for path in (ROOT / folder).rglob("*"):
        if not path.is_file() or path.is_symlink():
            continue
        parts = path.relative_to(ROOT).parts
        if "__pycache__" in parts or path.suffix in {".pyc", ".log", ".sqlite3", ".db"}:
            continue
        if parts[:2] == ("backend", "public") or parts[:3] == ("backend", "templates", "legacy"):
            continue
        if path.name.endswith("-growth-v1.png"):
            continue
        if folder == "assets" and path.suffix.lower() == ".mp4":
            # Current tutorials are in craftlab/ and festival_lab/. The old
            # assets/banig-tutorial.mp4 is not part of the hosted application.
            continue
        files.add(path)
with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(files):
        relative = path.relative_to(ROOT)
        assert relative.parts[0] not in {"var", ".venv", ".git"}
        assert path.name != ".env" and not path.name.endswith((".sqlite3-wal", ".sqlite3-shm"))
        archive.write(path, relative.as_posix())
    archive.writestr("START-HERE.txt", "LIKHA hosted source handoff\n\nRead docs/RUN_HOSTED.md for local setup and docs/DEPLOY_HOSTED.md for deployment.\nRun start-hosted.ps1 on Windows with Python 3.12+.\nNo accounts, databases, private drawings, development mail, secrets or virtual environment are included.\nCreate your own local account with a username and passphrase; no email required.\nRoot index.html is the separate offline demo, not the account application.\n")
with zipfile.ZipFile(OUTPUT) as archive:
    names = archive.namelist()
    assert not any(name.startswith(("var/", ".venv/", ".git/", "backend/public/")) or name == ".env" for name in names)
print(f"Built {OUTPUT.name}: {len(files)} source/assets files, {OUTPUT.stat().st_size / 1024**2:.1f} MiB; private data excluded.")
