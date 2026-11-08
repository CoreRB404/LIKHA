"""Render native Python build: publish only allowlisted assets, including admin."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, "tools/build_hosted.py"], cwd=root, check=True)
subprocess.run([sys.executable, "backend/manage.py", "collectstatic", "--noinput"], cwd=root, check=True)
