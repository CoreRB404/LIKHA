"""Build a local compromised/common-password hash blocklist. Never stores plaintext."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "https://raw.githubusercontent.com/danielmiessler/SecLists/master/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt"
with urlopen(SOURCE, timeout=30) as response:
    content = response.read(4 * 1024 * 1024)
hashes = sorted({hashlib.sha1(line.rstrip(b"\r"), usedforsecurity=False).hexdigest().upper() for line in content.split(b"\n") if line.rstrip(b"\r")})
assert len(hashes) >= 90000, "Incomplete source dataset; refusing to replace corpus."
target = ROOT / "backend/accounts/breached-passwords.sha1"
target.write_text("\n".join(hashes) + "\n", encoding="ascii")
with urlopen("https://raw.githubusercontent.com/danielmiessler/SecLists/master/LICENSE", timeout=30) as response:
    (target.parent / "password-corpus-LICENSE.txt").write_bytes(response.read(64000))
metadata = {"source": SOURCE, "license": "MIT", "license_source": "https://github.com/danielmiessler/SecLists/blob/master/LICENSE", "source_sha256": hashlib.sha256(content).hexdigest(), "entries": len(hashes), "purpose": "Offline blocklist lookup only; SHA-1 is NOT used to store account passwords. Accounts use Argon2."}
(target.parent / "password-corpus-source.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
print(f"Built offline password blocklist: {len(hashes)} SHA-1 lookup hashes. No plaintext persisted.")
