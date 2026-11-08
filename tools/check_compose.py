"""Validate deployment structure with synthetic configuration; never starts services."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="likha-compose-") as temporary:
    source = ROOT / ".env.example"
    envfile = Path(temporary) / "test.env"
    values = {
        "LIKHA_DOMAIN": "likha.example.test", "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "DJANGO_ALLOWED_HOSTS": "likha.example.test", "LIKHA_ORIGIN": "https://likha.example.test",
        "LIKHA_HEALTH_TOKEN": secrets.token_urlsafe(32),
        "LIKHA_PRIVACY_CONTACT": "privacy@example.test", "LIKHA_PRIVACY_APPROVED": "1",
    }
    lines = []
    for line in source.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            lines.append(key + "=" + values.get(key, value))
    envfile.write_text("\n".join(lines) + "\n")
    result = subprocess.run(["docker", "compose", "--env-file", str(envfile), "-f", str(ROOT / "deploy/compose.yaml"), "config", "--format", "json"], cwd=ROOT, env={**os.environ, "LIKHA_ENV_FILE": str(envfile)}, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit("Compose validation failed: " + result.stderr)
    config = json.loads(result.stdout)
    assert not config["services"]["app"].get("ports"), "The backend port must not be public."
    assert len(config["services"]["proxy"]["ports"]) == 2
    assert "@sha256:" in config["services"]["proxy"]["image"]
    assert any(volume.get("target") == "/data" for volume in config["services"]["app"]["volumes"])
    assert config["services"]["app"]["environment"]["LIKHA_ENV"] == "production"
    print("PASS Compose structure: private app port, explicit HTTPS proxy, persistent data, digest-pinned proxy. No services were started.")
