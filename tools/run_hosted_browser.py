"""Run real-browser checks against a fresh, isolated local application instance."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
if "--engineering" in sys.argv and not any(arg.startswith("--project=") for arg in sys.argv):
    projects = ["chromium", "firefox", "webkit", "mobile-chromium", "mobile-webkit"]
    if os.name == "nt" and Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe").exists():
        projects.append("edge")
    for project in projects:
        subprocess.run([sys.executable, __file__, "--engineering", "--project=" + project], cwd=ROOT, check=True)
    raise SystemExit(0)
with tempfile.TemporaryDirectory(prefix="likha-browser-app-") as temporary:
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    environment = {**os.environ, "LIKHA_ENV": "development", "LIKHA_DATA_DIR": temporary, "LIKHA_ORIGIN": base, "LIKHA_HOSTED_URL": base}
    for args in [[sys.executable, "tools/build_hosted.py"], [sys.executable, "backend/manage.py", "migrate", "--noinput"], [sys.executable, "backend/manage.py", "seed_content"]]:
        subprocess.run(args, env=environment, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    with (Path(temporary) / "server.log").open("w") as log:
        process = subprocess.Popen([sys.executable, "tools/test_server.py", str(port), "--static"], cwd=ROOT, env=environment, stdin=subprocess.PIPE, text=True, stdout=log, stderr=log)
        try:
            for attempt in range(100):
                try:
                    with urlopen(base + "/health/live", timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError("Isolated application failed to become ready.")
            command = ["node", "node_modules/@playwright/test/cli.js", "test", *[arg for arg in sys.argv if arg.startswith("--project=")]] if "--engineering" in sys.argv else ["node", "tools/hosted_browser_check.mjs"]
            environment["LIKHA_TEST_PROJECT"] = next((arg.split("=",1)[1] for arg in sys.argv if arg.startswith("--project=")), "all")
            subprocess.run(command, cwd=ROOT, env=environment, check=True)
        finally:
            process.stdin.write("stop\n")
            process.stdin.flush()
            process.wait(timeout=15)
            process.stdin.close()
