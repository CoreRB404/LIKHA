"""Fail if hosted assets expose source, offline account storage, or private answer keys."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
public = ROOT / "backend/public"
allowed = {".css", ".js", ".ico", ".webp", ".png", ".jpg", ".jpeg", ".mp4", ".mov", ".mp3", ".wav", ".ogg", ".woff2", ".txt"}
files = [p for p in public.rglob("*") if p.is_file()]
assert files, "Build the hosted frontend first."
for path in files:
    assert path.suffix.lower() in allowed and not path.is_symlink(), path
    if path.suffix.lower() == ".txt":
        assert path.parent == public / "assets/fonts" and path.name.endswith("-OFL.txt"), path
for name in ["quiz.js", "dashboard.html", "pet-progress.js", "artwork-rewards.js", "serve.py", "questions.json"]:
    assert not (public / name).exists(), name
for path in public.glob("*.js"):
    source = path.read_text(encoding="utf-8")
    assert not re.search(r"localStorage\.(?:setItem|getItem|removeItem)\(", source), path
    assert 'answer: 0' not in source, path
for path in (ROOT / "backend/templates/legacy").glob("*.html"):
    source = path.read_text(encoding="utf-8")
    assert not re.search(r"\son\w+\s*=", source, re.I), path
    for match in re.finditer(r"<script\b([^>]*)>(.*?)</script>", source, re.I | re.S):
        assert "src=" in match[1] and not match[2].strip(), path
    assert "https://fonts." not in source, path
print(f"PASS hosted public allowlist: {len(files)} files; no private backend/source/quiz keys or localStorage account persistence.")
