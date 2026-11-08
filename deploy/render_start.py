"""Fail closed on misconfiguration, migrate, then bind Render's assigned port."""
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from django.conf import settings
from django.core.management import call_command
from learning.storage import check_bucket

if (settings.DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql"
        or settings.MEDIA_BACKEND != "supabase"):
    raise SystemExit("Render requires PostgreSQL and Supabase private artwork storage.")
check_bucket()
call_command("prepare_postgres")
call_command("migrate", interactive=False)
call_command("seed_content")
port = int(os.environ.get("PORT", "10000"))
if not 1 <= port <= 65535:
    raise SystemExit("Invalid PORT.")
from waitress import serve
from config.wsgi import application
from core.hosting import RENDER_PROXY_OPTIONS
serve(application, host="0.0.0.0", port=port, threads=4, channel_timeout=30,
      max_request_body_size=6291456, max_request_header_size=32768,
      **RENDER_PROXY_OPTIONS)
