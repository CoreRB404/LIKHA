"""Quiesced, verified SQLite -> local PostgreSQL cutover. Never deletes source data."""
import argparse
import datetime
import hashlib
import io
import json
import os
import shutil
import socket
import sqlite3
import sys
import zipfile
from contextlib import closing
from pathlib import Path

from cryptography.fernet import Fernet
from local_postgres import ROOT, DATA, CONTROL, ACTIVE, setup, connect


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiesced", action="store_true", required=True,
                        help="Confirm the application and write jobs are stopped.")
    parser.parse_args()
    if ACTIVE.exists():
        raise SystemExit("PostgreSQL is already active; refusing to import again or overwrite live data.")
    if os.environ.get("DATABASE_URL"):
        raise SystemExit("Unset DATABASE_URL. This tool migrates only to LIKHA's own loopback cluster.")
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", 8000)) == 0:
            raise SystemExit("Stop the application on port 8000 before migrating.")
    source = DATA / "likha.sqlite3"
    if not source.is_file():
        raise SystemExit("No var/likha.sqlite3 source database exists. Nothing was changed.")
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_dir = DATA / "backups" / ("postgres-cutover-" + timestamp)
    backup_dir.mkdir(parents=True, exist_ok=False)
    snapshot = backup_dir / "source.sqlite3"
    with closing(sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)) as old:
        with closing(sqlite3.connect(snapshot)) as target:
            old.backup(target)
            if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok" or target.execute("PRAGMA foreign_key_check").fetchall():
                raise SystemExit("Source integrity check failed; no cutover was attempted.")
    key_dir = DATA / "backup-keys"
    key_dir.mkdir(exist_ok=True)
    key = Fernet.generate_key()
    key_path = key_dir / ("postgres-cutover-" + timestamp + ".key")
    with key_path.open("xb") as stream:
        stream.write(key)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as output:
        output.write(snapshot, "likha.sqlite3")
        for path in sorted((DATA / "artworks").glob("*")):
            if path.is_symlink():
                raise SystemExit("Unexpected artwork symlink; review before migration.")
            if path.is_file():
                output.write(path, "artworks/" + path.name)
        for name in ("deletions.jsonl", "development-secret"):
            if (DATA / name).is_file():
                output.write(DATA / name, name)
    encrypted = backup_dir / "before-cutover.fernet"
    encrypted.write_bytes(Fernet(key).encrypt(archive.getvalue()))
    if Fernet(key).decrypt(encrypted.read_bytes()) != archive.getvalue():
        raise SystemExit("Backup authentication failed. Source remains active.")
    print("Encrypted source/media backup verified; key stored separately under private var/backup-keys.", flush=True)
    config = setup()
    with connect(config) as conn:
        tables = conn.execute("SELECT tablename FROM pg_tables WHERE schemaname='likha'").fetchall()
        if tables:
            raise SystemExit("Target schema is not empty. Refusing to overwrite; source remains active.")

    sys.path.insert(0, str(ROOT / "backend"))
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
    os.environ["LIKHA_ENV"] = "development"
    os.environ["LIKHA_DATA_DIR"] = str(DATA)
    os.environ["LIKHA_MEDIA_BACKEND"] = "local"
    from django.conf import settings
    from config.local_database import local_database
    from config.database import database_config
    settings.DATABASES["default"] = local_database(CONTROL)
    settings.DATABASES["legacy"] = database_config("", backup_dir)
    settings.DATABASES["legacy"]["NAME"] = snapshot
    import django
    django.setup()
    from django.apps import apps
    from django.core import serializers
    from django.core.management import call_command
    from django.core.serializers.json import DjangoJSONEncoder
    from django.db import connections, transaction

    class PreciseEncoder(DjangoJSONEncoder):
        def default(self, obj):
            if isinstance(obj, datetime.datetime):
                return obj.isoformat()
            return super().default(obj)

    excluded = {"contenttypes.contenttype", "auth.permission", "sessions.session"}
    app_models = [(app, [model for model in app.get_models() if model._meta.label_lower not in excluded])
                  for app in apps.get_app_configs()]
    models = serializers.sort_dependencies(app_models, allow_cycles=True)

    def export(alias):
        objects = (obj for model in models for obj in model._base_manager.using(alias).order_by(model._meta.pk.name))
        value = serializers.serialize("json", objects, use_natural_foreign_keys=True, cls=PreciseEncoder)
        # Database-generated FK identifiers are represented by natural keys.
        return json.dumps(json.loads(value), sort_keys=True, separators=(",", ":"))

    fixture = export("legacy")
    counts = {model._meta.label_lower: model._base_manager.using("legacy").count() for model in models}
    fixture_path = backup_dir / "transfer.json"
    try:
        fixture_path.write_text(fixture, encoding="utf-8")
        call_command("migrate", interactive=False, verbosity=0)
        with transaction.atomic():
            call_command("loaddata", str(fixture_path), verbosity=0)
            actual = export("default")
            if actual != fixture:
                raise RuntimeError("Record comparison failed; target import rolled back and source remains active.")
            from learning.models import Artwork, Wallet, RewardEvent
            from learning.storage import read_image
            from django.db.models import Sum
            checked_images = 0
            for art in Artwork.objects.filter(status="ready"):
                read_image(art)
                checked_images += 1
            for wallet in Wallet.objects.all():
                totals = RewardEvent.objects.filter(owner_id=wallet.owner_id).aggregate(stars=Sum("stars"), growth=Sum("growth"))
                if wallet.stars != (totals["stars"] or 0) or wallet.lifetime != (totals["stars"] or 0) or wallet.growth != (totals["growth"] or 0):
                    raise RuntimeError("Reward reconciliation failed; source remains active.")
            with connections["default"].cursor() as cursor:
                cursor.execute('SET CONSTRAINTS ALL IMMEDIATE')
        call_command("check_storage", verbosity=0)
        report = {"database": "postgresql", "verified_at": timestamp, "model_counts": counts,
                  "fixture_sha256": hashlib.sha256(fixture.encode()).hexdigest(),
                  "verified_images": checked_images, "sessions_revoked": True,
                  "backup": str(encrypted.relative_to(DATA))}
        (DATA / "postgres-migration-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        connections.close_all()
        # Activation is last, after a byte-for-byte canonical record comparison.
        pending = DATA / "local-postgres.pending.json"
        shutil.copyfile(CONTROL, pending)
        os.replace(pending, ACTIVE)
        (DATA / "postgresql-active").write_text("PostgreSQL only; SQLite fallback is disabled.\n", encoding="utf-8")
        # Move, never erase, the now-inactive source and older SQLite snapshots.
        legacy_dir = backup_dir / "legacy-sqlite"
        legacy_dir.mkdir()
        for path in DATA.iterdir():
            if path.is_file() and (path.name.endswith((".sqlite3", ".sqlite3-wal", ".sqlite3-shm"))):
                shutil.move(str(path), legacy_dir / path.name)
        print(f"Cutover verified: {sum(counts.values())} records, {checked_images} image checksums; login sessions revoked.")
        print("The application now uses local PostgreSQL. SQLite files are archived privately, not active.")
    finally:
        connections.close_all()
        fixture_path.unlink(missing_ok=True)
        snapshot.unlink(missing_ok=True)
        snapshot.with_name(snapshot.name + "-wal").unlink(missing_ok=True)
        snapshot.with_name(snapshot.name + "-shm").unlink(missing_ok=True)


if __name__ == "__main__":
    main()
