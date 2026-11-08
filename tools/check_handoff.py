"""Verify the shipped source archive starts cleanly without the author's local data."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="likha-handoff-") as temporary:
    target = Path(temporary) / "project"
    target.mkdir()
    with zipfile.ZipFile(ROOT / "LIKHA-Hosted-Source.zip") as archive:
        for entry in archive.infolist():
            destination = (target / entry.filename).resolve()
            assert destination.is_relative_to(target.resolve()), "Unsafe archive entry"
            assert not entry.filename.startswith(("var/", ".venv/", ".git/"))
        archive.extractall(target)
    environment = {**os.environ, "LIKHA_ENV": "development", "LIKHA_DATA_DIR": str(Path(temporary) / "private"), "PYTHONDONTWRITEBYTECODE": "1"}
    for command in [
        ["tools/build_hosted.py"],
        ["tools/check_hosted_artifact.py"],
        ["backend/manage.py", "migrate", "--noinput"],
        ["backend/manage.py", "seed_content"],
        ["backend/manage.py", "check"],
        ["backend/manage.py", "shell", "-c", "from accounts.models import User; from learning.models import QuizDefinition; assert User.objects.count()==0; assert QuizDefinition.objects.count()==7; print('Fresh handoff: zero accounts and seven assessments.')"],
    ]:
        result = subprocess.run([sys.executable, *command], cwd=target, env=environment, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
    print("PASS extracted source ZIP: public build, clean database migrations, seven assessments, zero preexisting accounts, no private data.")
