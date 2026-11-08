import hashlib
import io
import json
import os
import sqlite3
import tempfile
import zipfile
from pathlib import Path

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from learning.models import Artwork
from learning.services import image_path


class Command(BaseCommand):
    help = "Create an encrypted coordinated database/media backup while the application is stopped."

    def add_arguments(self, parser):
        parser.add_argument("--output", required=True)
        parser.add_argument("--quiesced", action="store_true", help="Confirm the web app and jobs are stopped during this command.")

    def handle(self, output, quiesced=False, **options):
        if settings.DATABASES["default"]["ENGINE"] != "django.db.backends.sqlite3" or settings.MEDIA_BACKEND != "local":
            raise CommandError("This command supports local SQLite/media only. Follow docs/SUPABASE_RENDER.md for PostgreSQL and Storage backups.")
        if not quiesced:
            raise CommandError("Stop the web application and jobs, then pass --quiesced. Do not run this against active writes.")
        key = os.environ.get("LIKHA_BACKUP_KEY", "")
        try:
            encryption = Fernet(key.encode())
        except Exception:
            raise CommandError("Set LIKHA_BACKUP_KEY to an independently stored Fernet key.")
        destination = Path(output).resolve()
        for public in (settings.STATIC_ROOT, settings.PUBLIC_ROOT):
            if destination.is_relative_to(public.resolve()):
                raise CommandError("Backups cannot be written to a public directory.")
        if destination.exists():
            raise CommandError("Choose a new backup filename; existing backups are never overwritten.")
        total = sum(a.size for a in Artwork.objects.exclude(status="deleted"))
        if total > 512 * 1024 * 1024:
            raise CommandError("This backup adapter is limited to 512 MiB of media. Configure a streaming backup service before growing beyond this limit.")
        with tempfile.TemporaryDirectory(prefix="likha-backup-") as temporary:
            snapshot = Path(temporary) / "likha.sqlite3"
            source = sqlite3.connect(str(settings.DATABASES["default"]["NAME"]))
            target = sqlite3.connect(snapshot)
            try:
                source.backup(target)
                if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise CommandError("Database integrity check failed.")
            finally:
                source.close()
                target.close()
            archive_buffer = io.BytesIO()
            manifest = {"created_at": timezone.now().isoformat(), "format": 1, "files": {}}
            with zipfile.ZipFile(archive_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
                def include(path, name):
                    content = path.read_bytes()
                    archive.writestr(name, content)
                    manifest["files"][name] = hashlib.sha256(content).hexdigest()
                include(snapshot, "likha.sqlite3")
                for art in Artwork.objects.exclude(status="deleted"):
                    path = image_path(art)
                    if not path.exists():
                        path = path.with_suffix(".pending")
                    if not path.exists():
                        raise CommandError("A referenced artwork file is missing. Run reconcile_storage before backing up.")
                    include(path, "artworks/" + path.name)
                journal = settings.DATA_DIR / "deletions.jsonl"
                if journal.exists():
                    include(journal, "deletions.jsonl")
                archive.writestr("manifest.json", json.dumps(manifest, indent=2))
            encrypted = encryption.encrypt(archive_buffer.getvalue())
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("xb") as stream:
                stream.write(encrypted)
        self.stdout.write(self.style.SUCCESS(f"Encrypted backup created: {destination.name}. Copy off-host and test restore."))
