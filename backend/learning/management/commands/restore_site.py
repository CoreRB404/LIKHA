import hashlib
import io
import json
import os
import sqlite3
import zipfile
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Restore an encrypted backup to a NEW isolated directory; never overwrites a live database."

    def add_arguments(self, parser):
        parser.add_argument("backup")
        parser.add_argument("--destination", required=True)
        parser.add_argument("--deletion-journal", help="Latest restricted deletion journal, including deletions after the backup.")

    def handle(self, backup, destination, deletion_journal=None, **options):
        if settings.DATABASES["default"]["ENGINE"] != "django.db.backends.sqlite3" or settings.MEDIA_BACKEND != "local":
            raise CommandError("This command supports local SQLite/media only. Follow docs/SUPABASE_RENDER.md for PostgreSQL and Storage backups.")
        target = Path(destination).resolve()
        if target.exists() or target == settings.DATA_DIR or target.is_relative_to(settings.PUBLIC_ROOT) or target.is_relative_to(settings.STATIC_ROOT):
            raise CommandError("Restore destination must be a new private directory, separate from the running instance.")
        try:
            encrypted = Path(backup).read_bytes()
            if len(encrypted) > 800 * 1024 * 1024:
                raise CommandError("Backup exceeds this adapter's capacity.")
            payload = Fernet(os.environ["LIKHA_BACKUP_KEY"].encode()).decrypt(encrypted)
        except (InvalidToken, KeyError, ValueError):
            raise CommandError("Backup authentication failed. Check the independently stored backup key.")
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            manifest = json.loads(archive.read("manifest.json"))
            if manifest.get("format") != 1 or set(archive.namelist()) != set(manifest["files"]) | {"manifest.json"}:
                raise CommandError("Unsupported or incomplete backup manifest.")
            for name, digest in manifest["files"].items():
                path = (target / name).resolve()
                if not path.is_relative_to(target) or name.startswith(("/", "\\")) or ":" in name:
                    raise CommandError("Unsafe archive path.")
                content = archive.read(name)
                if hashlib.sha256(content).hexdigest() != digest:
                    raise CommandError("Backup content hash mismatch.")
            # All entries authenticated and checked before any extraction.
            target.mkdir(parents=True)
            for name in manifest["files"]:
                path = target / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(archive.read(name))
        journal_lines = []
        for journal in [target / "deletions.jsonl", Path(deletion_journal) if deletion_journal else None]:
            if journal and journal.exists():
                journal_lines.extend(journal.read_text(encoding="utf-8").splitlines())
        # Use Django's deletion collector under an isolated settings invocation,
        # rather than disabling FK constraints or maintaining hand-written cascades.
        from django.db import connections
        from accounts.models import User
        from learning.models import Artwork
        alias = "restore_target"
        db_config = {**settings.DATABASES["default"], "NAME": target / "likha.sqlite3"}
        connections.databases[alias] = db_config
        try:
            deleted = {json.loads(line)["user_id"] for line in journal_lines if line}
            for user_id in deleted:
                # UUID storage in SQLite is normalized by the ORM.
                user = User.objects.using(alias).filter(pk=user_id).first()
                if user:
                    names = list(Artwork.objects.using(alias).filter(owner_id=user.pk).values_list("file_key", flat=True))
                    user.delete(using=alias)
                    for name in names:
                        for suffix in (".webp", ".pending"):
                            path = (target / "artworks" / name).with_suffix(suffix)
                            if path.resolve().is_relative_to((target / "artworks").resolve()):
                                path.unlink(missing_ok=True)
        finally:
            connections[alias].close()
            del connections.databases[alias]
            del connections[alias]
        database = sqlite3.connect(target / "likha.sqlite3")
        try:
            if database.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or database.execute("PRAGMA foreign_key_check").fetchall():
                raise CommandError("Restored database failed integrity checks.")
            # Recovery links and authenticated sessions must not revive after restore.
            database.execute("DELETE FROM django_session")
            database.execute("DELETE FROM accounts_verificationgrant")
            database.execute("DELETE FROM accounts_mailoutbox")
            database.commit()
        finally:
            database.close()
        if journal_lines:
            (target / "deletions.jsonl").write_text("\n".join(dict.fromkeys(journal_lines)) + "\n", encoding="utf-8")
        self.stdout.write(self.style.SUCCESS("Restored and integrity-checked in isolation. Sessions/grants revoked; review before promoting."))
