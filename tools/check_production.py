"""Exercise real production settings safely with synthetic configuration and an isolated DB."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="likha-production-check-") as temporary:
    environment = {**os.environ,
        "LIKHA_ENV": "production", "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "DJANGO_ALLOWED_HOSTS": "likha.example.test", "LIKHA_ORIGIN": "https://likha.example.test",
        "LIKHA_DATA_DIR": temporary, "LIKHA_STATIC_ROOT": str(Path(temporary) / "staticfiles"),
        "LIKHA_HEALTH_TOKEN": secrets.token_urlsafe(32),
        "LIKHA_PRIVACY_CONTACT": "privacy@example.test", "LIKHA_PRIVACY_APPROVED": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    command = [sys.executable, "backend/manage.py", "check", "--deploy", "--fail-level", "WARNING"]
    result = subprocess.run(command, cwd=ROOT, env=environment, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(result.stdout + result.stderr)
    print("PASS production Django deployment checks (synthetic config; not a deployment).")
    for key, value in [("DJANGO_SECRET_KEY", ""), ("DJANGO_ALLOWED_HOSTS", "*"), ("LIKHA_ORIGIN", "http://example.test"), ("LIKHA_PRIVACY_APPROVED", "0")]:
        invalid = {**environment, key: value}
        failed = subprocess.run(command, cwd=ROOT, env=invalid, capture_output=True, text=True)
        assert failed.returncode != 0, f"Unsafe setting accepted: {key}"
        print(f"PASS unsafe production configuration rejected: {key}")
