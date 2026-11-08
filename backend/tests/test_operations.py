import io
import json
import os
import sqlite3
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection, close_old_connections
from django.test import Client, TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import DeletionRecord, MailOutbox, User
from learning.models import Artwork, Wallet
from learning.services import delete_account, image_path, save_artwork
from tests.test_backend import MediaMixin, PASSWORD, upload


class RecoveryTests(MediaMixin, TransactionTestCase):
    def test_actual_corrupt_sqlite_file_is_reported_without_modification(self):
        import gc
        self.addCleanup(gc.collect)  # Release the intentionally failed driver connection before Windows temp cleanup.
        from django.db.backends.sqlite3.base import DatabaseWrapper
        path=Path(self.temp.name)/'corrupt.sqlite3'
        original=b'This is a synthetic corrupted SQLite file.'*100
        path.write_bytes(original)
        wrapper=DatabaseWrapper({**connection.settings_dict,'NAME':str(path)},alias='isolated_corruption_check')
        try:
            with patch('learning.management.commands.check_storage.connection',wrapper):
                with self.assertRaises(CommandError) as raised:
                    call_command('check_storage',verbosity=0)
            self.assertIn('corrupt',str(raised.exception))
            self.assertEqual(path.read_bytes(),original)
        finally:
            wrapper.close()

    def test_encrypted_coordinated_backup_restore_and_later_deletion_replay(self):
        user = User.objects.create_user("restore@example.test", PASSWORD)
        user_id = user.pk
        survivor = User.objects.create_user("survivor@example.test", PASSWORD)
        art = save_artwork(user, {"title": "Restore me", "lab": "art", "client_id": str(uuid.uuid4())}, upload())
        other = save_artwork(survivor, {"title": "Keep me", "lab": "art", "client_id": str(uuid.uuid4())}, upload("blue"))
        original_bytes = image_path(other).read_bytes()
        output = Path(self.temp.name) / "snapshot.fernet"
        key = Fernet.generate_key().decode()
        with patch.dict(os.environ, {"LIKHA_BACKUP_KEY": key}):
            with self.assertRaises(CommandError):
                call_command("backup_site", output=str(output), quiesced=False, verbosity=0)
            call_command("backup_site", output=str(output), quiesced=True, verbosity=0)
            self.assertFalse(output.read_bytes().startswith(b"PK"))
            delete_account(user)
            destination = Path(self.temp.name) / "restored"
            with patch.object(type(self), "databases", frozenset({"default", "restore_target"})):
                call_command("restore_site", str(output), destination=str(destination), deletion_journal=str(Path(self.temp.name) / "deletions.jsonl"), verbosity=0)
            restored = sqlite3.connect(destination / "likha.sqlite3")
            self.addCleanup(restored.close)
            self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(restored.execute("SELECT count(*) FROM accounts_user WHERE id=?", [user_id.hex]).fetchone()[0], 0)
            self.assertEqual(restored.execute("SELECT count(*) FROM accounts_user WHERE id=?", [survivor.pk.hex]).fetchone()[0], 1)
            self.assertEqual(restored.execute("SELECT stars FROM learning_wallet WHERE owner_id=?", [survivor.pk.hex]).fetchone()[0], 20)
            self.assertEqual((destination / "artworks" / other.file_key).read_bytes(), original_bytes)
            self.assertFalse((destination / "artworks" / art.file_key).exists())
            self.assertEqual(restored.execute("SELECT count(*) FROM django_session").fetchone()[0], 0)
            with self.assertRaises(CommandError):
                call_command("restore_site", str(output), destination=str(destination), verbosity=0)

    def test_wrong_backup_key_rejected_without_writing_destination(self):
        output = Path(self.temp.name) / "snapshot.fernet"
        with patch.dict(os.environ, {"LIKHA_BACKUP_KEY": Fernet.generate_key().decode()}):
            call_command("backup_site", output=str(output), quiesced=True, verbosity=0)
        destination = Path(self.temp.name) / "bad-restore"
        with patch.dict(os.environ, {"LIKHA_BACKUP_KEY": Fernet.generate_key().decode()}):
            with self.assertRaises(CommandError):
                call_command("restore_site", str(output), destination=str(destination), verbosity=0)
        self.assertFalse(destination.exists())

    def test_pending_file_recovery_after_interrupted_finalize(self):
        user = User.objects.create_user("pending@example.test", PASSWORD)
        with patch("learning.services.ready_artwork", side_effect=OSError("simulated interruption")):
            with self.assertRaises(OSError):
                save_artwork(user, {"title": "Pending", "lab": "art", "client_id": str(uuid.uuid4())}, upload())
        art = Artwork.objects.get(owner=user)
        self.assertEqual(art.status, "pending")
        self.assertTrue(image_path(art).with_suffix(".pending").exists())
        call_command("reconcile_storage", verbosity=0)
        art.refresh_from_db()
        self.assertEqual(art.status, "ready")
        self.assertEqual(Wallet.objects.get(owner=user).stars, 20)
        call_command("reconcile_storage", verbosity=0)
        self.assertEqual(Wallet.objects.get(owner=user).stars, 20)

    def test_maintenance_obeys_retention(self):
        user = User.objects.create_user("maintenance@example.test", PASSWORD)
        from accounts.models import AuditEvent, RateBucket
        old = AuditEvent.objects.create(actor=user, action="old", outcome="ok")
        AuditEvent.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=31))
        AuditEvent.objects.create(actor=user, action="new", outcome="ok")
        RateBucket.objects.create(key="expired", expires_at=timezone.now() - timedelta(seconds=1))
        call_command("maintenance", verbosity=0)
        self.assertFalse(AuditEvent.objects.filter(pk=old.pk).exists())
        self.assertEqual(AuditEvent.objects.count(), 1)
        self.assertFalse(RateBucket.objects.exists())


class ProductionBoundaryTests(MediaMixin, TransactionTestCase):
    def test_production_cookie_and_https_headers_with_controlled_proxy(self):
        user = User.objects.create_user("secure@example.test", PASSWORD)
        client = Client(enforce_csrf_checks=True)
        with override_settings(SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True, SESSION_COOKIE_NAME="__Host-likha", SECURE_SSL_REDIRECT=True, SECURE_HSTS_SECONDS=31536000, SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https")):
            self.assertEqual(client.get("/api/v1/session").status_code, 301)
            initial = client.get("/api/v1/session", secure=True, HTTP_X_FORWARDED_PROTO="https")
            token = initial.json()["data"]["csrf"]
            response = client.post("/api/v1/auth/login", json.dumps({"username": user.username, "password": PASSWORD}), content_type="application/json", secure=True, HTTP_X_CSRFTOKEN=token, HTTP_X_FORWARDED_PROTO="https", HTTP_ORIGIN="https://testserver")
            self.assertEqual(response.status_code, 200, response.content)
            cookie = response.cookies["__Host-likha"]
            self.assertTrue(cookie["secure"])
            self.assertTrue(cookie["httponly"])
            self.assertEqual(cookie["path"], "/")
            self.assertEqual(cookie["domain"], "")
            self.assertIn("max-age=31536000", response["Strict-Transport-Security"])
            self.assertIn("no-store", response["Cache-Control"])
            cross = client.post("/api/v1/auth/logout", "{}", content_type="application/json", secure=True, HTTP_X_CSRFTOKEN=token, HTTP_X_FORWARDED_PROTO="https", HTTP_ORIGIN="https://attacker.invalid")
            self.assertEqual(cross.status_code, 403)

    def test_staff_totp_is_required_and_accepted(self):
        from django_otp.oath import totp
        from django_otp.plugins.otp_totp.models import TOTPDevice
        user = User.objects.create_superuser("staff@example.test", PASSWORD)
        device = TOTPDevice.objects.create(user=user, name="primary", confirmed=True)
        client = Client(enforce_csrf_checks=True)
        response = client.get("/admin/login/")
        token = client.cookies["csrftoken"].value
        invalid = client.post("/admin/login/", {"username": user.username, "password": PASSWORD, "otp_device": device.persistent_id, "otp_token": "000000", "csrfmiddlewaretoken": token, "next": "/admin/"})
        self.assertEqual(invalid.status_code, 200)
        device.refresh_from_db()
        device.throttling_failure_count = 0
        device.throttling_failure_timestamp = None
        device.save()
        code = str(totp(device.bin_key, device.step, device.t0, device.digits, device.drift)).zfill(device.digits)
        accepted = client.post("/admin/login/", {"username": user.username, "password": PASSWORD, "otp_device": device.persistent_id, "otp_token": code, "csrfmiddlewaretoken": token, "next": "/admin/"})
        self.assertEqual(accepted.status_code, 302, accepted.content)
        self.assertEqual(client.get("/admin/").status_code, 200)
