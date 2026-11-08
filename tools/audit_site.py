"""Check local page links and asset paths: python tools/audit_site.py."""

from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
errors = []
checked = 0


def check(source, value):
    global checked
    value = value.strip()
    if not value or value.startswith(("#", "data:", "javascript:", "mailto:", "//")) or "${" in value:
        return
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return
    target = ROOT / unquote(url.path).lstrip("/") if url.path.startswith("/") else source.parent / unquote(url.path)
    checked += 1
    if not target.exists():
        errors.append(f"{source.relative_to(ROOT)}: missing {value}")


class PageParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"href", "src", "poster", "data-image"} and value:
                check(self.source, value)
            if key and key.startswith("on") and value and "\\'" in value:
                errors.append(f"{self.source.name}: invalid escaped inline handler")


for source in sorted(ROOT.glob("*.html")) + sorted((ROOT / ".vscode").glob("*.html")):
    if not source.is_file():
        continue
    parser = PageParser()
    parser.source = source
    content = source.read_text(encoding="utf-8")
    parser.feed(content)
    for match in re.finditer(r"url\(['\"]?([^)'\"]+)", content):
        check(source, match.group(1))

for source in ROOT.glob("*.css"):
    for match in re.finditer(r"url\(['\"]?([^)'\"]+)", source.read_text(encoding="utf-8")):
        check(source, match.group(1))

for source in ROOT.glob("*.js"):
    for match in re.finditer(r'''["']((?:images|assets|craftlab|festival_lab)/[^"'`]+\.(?:png|jpg|webp|mp4|mov))["']''', source.read_text(encoding="utf-8")):
        check(source, match.group(1))

if errors:
    raise SystemExit("\n".join(errors))
print(f"PASS: {checked} local links and asset paths resolve.")
