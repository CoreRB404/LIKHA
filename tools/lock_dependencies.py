"""Record exact runtime distribution hashes and upstream license metadata from PyPI."""
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "requirements/production.txt"
packages = []
for line in source.read_text().splitlines():
    stripped = line.strip().removesuffix("\\").strip()
    if "==" in stripped and not stripped.startswith(("#", "--")):
        packages.append(stripped.split("==", 1))
locked = ["# Exact tested runtime dependencies; hashes cover published platform artifacts.", "# Regenerate intentionally with python tools/lock_dependencies.py."]
licenses = []
for package, version in packages:
    with urlopen(f"https://pypi.org/pypi/{package}/{version}/json", timeout=30) as response:
        metadata = json.load(response)
    hashes = sorted({url["digests"]["sha256"] for url in metadata["urls"] if not url.get("yanked")})
    if not hashes:
        raise RuntimeError(f"No unyanked distribution: {package}=={version}")
    locked.append(f"{package}=={version} \\")
    for index, digest in enumerate(hashes):
        locked.append(f"    --hash=sha256:{digest}" + (" \\" if index < len(hashes) - 1 else ""))
    info = metadata["info"]
    licenses.append({"name": package, "version": version, "license_expression": info.get("license_expression"), "license": info.get("license"), "project_urls": info.get("project_urls")})
source.write_text("\n".join(locked) + "\n", encoding="utf-8")
(ROOT / "requirements/licenses.json").write_text(json.dumps(licenses, indent=2) + "\n", encoding="utf-8")
print(f"Locked and hashed {len(packages)} runtime dependencies; license metadata recorded.")
