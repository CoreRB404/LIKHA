"""Real WSGI process/restart, 20-student load, and encrypted restore drill.

Uses an isolated temporary database, synthetic accounts and loopback only.
"""
import concurrent.futures
import http.cookiejar
import io
import json
import os
from pathlib import Path
import secrets
import socket
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

from cryptography.fernet import Fernet
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "Synthetic load-test creative passphrase"
report = {"checks": [], "environment": "isolated local Waitress process; not production"}


def run(environment, *arguments):
    result = subprocess.run([sys.executable, "backend/manage.py", *arguments], cwd=ROOT, env=environment, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout


with tempfile.TemporaryDirectory(prefix="likha-system-") as temporary:
    data_dir = Path(temporary) / "data"
    environment = {**os.environ, "LIKHA_DATA_DIR": str(data_dir), "LIKHA_ENV": "development", "PYTHONPATH": str(ROOT / "backend"), "LIKHA_BACKUP_KEY": Fernet.generate_key().decode(), "PYTHONDONTWRITEBYTECODE": "1"}
    run(environment, "migrate", "--noinput")
    run(environment, "seed_content")
    run(environment, "shell", "-c", "from accounts.models import User; from django.utils import timezone; u=User(username='load-0@example.test'); u.set_password('Synthetic load-test creative passphrase'); u.save(); [User.objects.create(username=f'load-{i}@example.test',password=u.password) for i in range(1,20)]")
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    environment["LIKHA_ORIGIN"] = base
    process = None
    logs = (Path(temporary) / "server.log").open("w", encoding="utf-8")

    def start():
        global process
        process = subprocess.Popen([sys.executable, "tools/test_server.py", str(port)], cwd=ROOT, env=environment, stdin=subprocess.PIPE, text=True, stdout=logs, stderr=logs)
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError("WSGI process exited before becoming ready.")
            try:
                with urllib.request.urlopen(base + "/health/live", timeout=1) as response:
                    if response.status == 200:
                        return
            except (OSError, urllib.error.URLError):
                time.sleep(.1)
        raise RuntimeError("WSGI process never became ready.")

    def stop():
        if process and process.poll() is None:
            process.stdin.write("stop\n")
            process.stdin.flush()
            process.wait(timeout=15)
            process.stdin.close()
            for _ in range(50):
                try:
                    with urllib.request.urlopen(base + "/health/live", timeout=.3):
                        time.sleep(.1)
                except (OSError, urllib.error.URLError):
                    break
            else:
                raise RuntimeError("The owned WSGI process did not stop; restart proof is invalid.")

    def new_client():
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(client, path, payload=None, token="", method="GET", raw=False):
        headers = {"Accept": "application/json"}
        body = None
        if payload is not None:
            headers.update({"Content-Type": "application/json", "X-CSRFToken": token})
            body = json.dumps(payload).encode()
        with client.open(urllib.request.Request(base + path, data=body, headers=headers, method=method), timeout=30) as response:
            content = response.read()
            return content if raw else json.loads(content)["data"]

    def authenticate(index):
        client = new_client()
        token = request(client, "/api/v1/session")["csrf"]
        result = request(client, "/api/v1/auth/login", {"username": f"load-{index}@example.test", "password": PASSWORD}, token, "POST")
        return client, result["csrf"]

    def save(index, client, token):
        image = io.BytesIO()
        Image.new("RGB", (1000, 700), (20 + index * 5, 80, 180)).save(image, "PNG")
        boundary = "likha-" + secrets.token_hex(12)
        fields = {"title": "Synthetic restart/load artwork", "lab": "art", "client_id": str(uuid.uuid4())}
        parts = []
        for key, value in fields.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="drawing.png"\r\nContent-Type: image/png\r\n\r\n'.encode() + image.getvalue() + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        req = urllib.request.Request(base + "/api/v1/artworks", data=b"".join(parts), headers={"X-CSRFToken": token, "Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
        with client.open(req, timeout=45) as response:
            return json.load(response)["data"]["artwork"]

    try:
        start()
        clients = [authenticate(i) for i in range(20)]
        metadata_times = []
        save_times = []
        def student(index):
            client, token = clients[index]
            started = time.perf_counter()
            request(client, "/api/v1/me")
            request(client, "/api/v1/progress")
            metadata_ms = (time.perf_counter() - started) * 1000 / 2
            started = time.perf_counter()
            art = save(index, client, token)
            save_ms = (time.perf_counter() - started) * 1000
            return art, metadata_ms, save_ms
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            results = list(executor.map(student, range(20)))
        assert len({result[0]["id"] for result in results}) == 20
        for index, (client, token) in enumerate(clients):
            state = request(client, "/api/v1/progress")["progress"]
            assert state["stars"] == 20 and state["growth_units"] == 2 and state["artwork_count"] == 1
        report["load"] = {"concurrent_students": 20, "successful_saves": 20, "metadata_pair_mean_request_p95_ms": round(sorted(r[1] for r in results)[18], 2), "image_save_p95_ms": round(sorted(r[2] for r in results)[18], 2), "duplicate_or_lost_rewards": 0}
        print("PASS 20 concurrent synthetic students: isolated artwork saves and exact reward totals.")
        report["checks"].append("20-concurrent-student-durable-saves")
        art = results[0][0]
        original = request(clients[0][0], art["image_url"], raw=True)
        stop()
        start()
        state = request(clients[0][0], "/api/v1/progress")["progress"]
        assert state["stars"] == 20
        assert request(clients[0][0], art["image_url"], raw=True) == original
        print("PASS actual WSGI process restart preserves sessions, artwork bytes and progress.")
        report["checks"].append("actual-process-restart")
        stop()
        started = time.perf_counter()
        backup = Path(temporary) / "backup.fernet"
        run(environment, "backup_site", "--output", str(backup), "--quiesced")
        restored = Path(temporary) / "restored"
        run(environment, "restore_site", str(backup), "--destination", str(restored))
        restore_seconds = time.perf_counter() - started
        environment["LIKHA_DATA_DIR"] = str(restored)
        start()
        fresh, token = authenticate(0)
        state = request(fresh, "/api/v1/progress")["progress"]
        assert state["stars"] == 20 and request(fresh, art["image_url"], raw=True) == original
        run(environment, "reconcile_rewards")
        report["checks"].append("encrypted-backup-restore-restart-login-media-ledger")
        report["restore_seconds"] = round(restore_seconds, 2)
        report["result"] = "passed"
        (ROOT / "var").mkdir(exist_ok=True)
        (ROOT / "var/system-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"PASS encrypted off-process backup/restore and fresh login; local recovery drill {restore_seconds:.2f}s.")
        print(json.dumps(report["load"]))
    finally:
        stop()
        logs.close()
