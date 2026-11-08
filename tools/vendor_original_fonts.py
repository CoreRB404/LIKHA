"""Vendor the two original Google Fonts for same-origin, offline-capable pages."""
import hashlib
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / 'assets/fonts'
target.mkdir(parents=True, exist_ok=True)
url = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400..800&family=Nunito:wght@400..900&display=swap'
request = Request(url, headers={'User-Agent':'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'})
with urlopen(request, timeout=30) as response:
    source = response.read().decode()
rules = []
records = []
for family, name in [('Baloo 2', 'baloo2'), ('Nunito', 'nunito')]:
    blocks = [block for block in re.findall(r'@font-face\s*\{[^}]+\}', source) if "font-family: '" + family + "'" in block]
    block = blocks[-1]  # Latin subset includes the Filipino alphabet and punctuation.
    remote = re.search(r'url\((https://fonts.gstatic.com/[^)]+)\)', block)[1]
    with urlopen(remote, timeout=30) as response:
        content = response.read()
    if content[:4] != b'wOF2':
        raise RuntimeError('Expected WOFF2 font')
    filename = name + '-latin.woff2'
    (target / filename).write_bytes(content)
    rules.append(block.replace(remote, '/static/assets/fonts/' + filename))
    license_url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/' + name + '/OFL.txt'
    with urlopen(license_url, timeout=30) as response:
        (target / (name + '-OFL.txt')).write_text("\n".join(line.rstrip() for line in response.read().decode("utf-8").splitlines()) + "\n", encoding="utf-8")
    records.append({'family':family,'source':remote,'license_source':license_url,'sha256':hashlib.sha256(content).hexdigest()})
(ROOT / 'backend/frontend/original-fonts.css').write_text('\n'.join(rules) + '\n', encoding='utf-8')
(ROOT / 'requirements/fonts.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
print('Vendored original Baloo 2 and Nunito fonts with OFL licenses.')
