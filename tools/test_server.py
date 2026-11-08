"""Owned loopback-only test worker, stopped through its private stdin pipe.

Not a deployment entrypoint. The pipe avoids killing unrelated processes and
works with Windows virtual-environment launcher children.
"""
import argparse
import os
from pathlib import Path
import sys
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
from django.core.wsgi import get_wsgi_application
from waitress import create_server

parser = argparse.ArgumentParser()
parser.add_argument("port", type=int)
parser.add_argument("--static", action="store_true")
arguments = parser.parse_args()
application = get_wsgi_application()
if arguments.static:
    from django.contrib.staticfiles.handlers import StaticFilesHandler
    application = StaticFilesHandler(application)
server = create_server(application, host="127.0.0.1", port=arguments.port, threads=4)
thread = threading.Thread(target=server.run, daemon=True)
thread.start()
try:
    for command in sys.stdin:
        if command.strip() == "stop":
            break
finally:
    server.task_dispatcher.shutdown()
    server.close()
