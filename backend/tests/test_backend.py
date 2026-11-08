import hashlib
import io
import json
import re
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from pathlib import Path
from threading import Barrier

from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import close_old_connections, connection, transaction
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image

from accounts.models import AuditEvent, MailOutbox, RateBucket, User, VerificationGrant
from learning.models import ActivityCompletion, Artwork, QuizAttempt, QuizDefinition, RewardEvent, Wallet
from learning.services import progress, ready_artwork, save_artwork

PASSWORD = "A long creative passphrase 2026"
FAST_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


def upload(color="red", size=(100, 100)):
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, format="PNG")
    return SimpleUploadedFile("drawing.png", buffer.getvalue(), content_type="image/png")


class MediaMixin:
    def setUp(self):
        super().setUp()
        self.temp = tempfile.TemporaryDirectory(prefix="likha-test-")
        self.private = Path(self.temp.name) / "artworks"
        self.private.mkdir()
        self.override = override_settings(PRIVATE_MEDIA_ROOT=self.private, DATA_DIR=Path(self.temp.name), PASSWORD_HASHERS=FAST_HASHERS, EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
        self.override.enable()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.override.disable)


class BackendTests(MediaMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.a = User.objects.create_user("a@example.test", PASSWORD)
        self.b = User.objects.create_user("b@example.test", PASSWORD)
        self.client = Client(enforce_csrf_checks=True)
        self.token = self.client.get("/api/v1/session").json()["data"]["csrf"]

    def send(self, path, value=None, method="post", client=None):
        client = client or self.client
        token = client.get("/api/v1/session").json()["data"]["csrf"]
        return getattr(client, method)(path, json.dumps(value or {}), content_type="application/json", HTTP_X_CSRFTOKEN=token)

    def sign_in(self, user=None, client=None):
        response = self.send("/api/v1/auth/login", {"username": (user or self.a).username, "password": PASSWORD}, client=client)
        self.assertEqual(response.status_code, 200, response.content)
        return response

    def save_art(self, user=None, color="red", client_id=None, imported=False):
        return save_artwork(user or self.a, {"title": "A meaningful creation", "lab": "art", "client_id": str(client_id or uuid.uuid4())}, upload(color), imported)

    def test_signup_without_email_and_immediate_login(self):
        value = {"username": "NewArtist", "password": PASSWORD, "confirmation": PASSWORD, "display_name": "Artist", "notice_version": "2026-11-08"}
        response = self.send("/api/v1/auth/signup", value)
        self.assertEqual(response.status_code, 202)
        user = User.objects.get(username="newartist")
        self.assertNotEqual(user.password, PASSWORD)
        self.assertNotIn("email", response.json()["data"])
        self.assertEqual(self.send("/api/v1/auth/signup", value).status_code, 409)
        self.assertEqual(MailOutbox.objects.count(), 0)
        self.assertEqual(VerificationGrant.objects.count(), 0)
        self.assertEqual(self.send("/api/v1/auth/login", {"username": "NEWARTIST", "password": PASSWORD}).status_code, 200)
        self.assertEqual(self.client.get("/api/v1/progress").status_code, 200)
        self.assertNotIn("email", self.client.get("/api/v1/me").json()["data"]["profile"])

    def test_email_routes_and_pages_are_removed(self):
        for route in ["/accounts/verify/", "/accounts/forgot/", "/accounts/reset/", "/api/v1/auth/verify", "/api/v1/auth/verification-resend", "/api/v1/auth/password-reset/confirm"]:
            self.assertEqual(self.client.get(route).status_code, 404, route)
        self.assertNotIn('type="email"', self.client.get("/accounts/signup/").content.decode())
        self.assertNotIn('resendForm', self.client.get("/accounts/login/").content.decode())

    def test_signup_rejects_privilege_fields_and_short_password(self):
        base = {"username": "new@example.test", "password": PASSWORD, "confirmation": PASSWORD, "display_name": "Artist", "notice_version": "2026-11-08"}
        self.assertEqual(self.send("/api/v1/auth/signup", {**base, "is_staff": True}).status_code, 422)
        self.assertEqual(self.send("/api/v1/auth/signup", {**base, "password": "short", "confirmation": "short"}).status_code, 422)
        base.pop("notice_version")
        self.assertEqual(self.send("/api/v1/auth/signup", base).status_code, 202)
        self.assertEqual(User.objects.get(username=base["username"]).notice_version, "")
        self.assertEqual(self.client.get("/privacy/").status_code, 404)
        self.assertNotIn("/privacy/", self.client.get("/accounts/signup/").content.decode())

    def test_csrf_applies_to_login_logout_and_private_mutations(self):
        for route in ["/api/v1/auth/login", "/api/v1/auth/signup", "/api/v1/auth/logout"]:
            self.assertEqual(self.client.post(route, "{}", content_type="application/json").status_code, 403)
        self.sign_in()
        self.assertEqual(self.client.patch("/api/v1/me", "{}", content_type="application/json").status_code, 403)
        self.assertEqual(self.client.post("/api/v1/artworks", {}).status_code, 403)

    def test_session_rotation_logout_and_json_auth_failures(self):
        old = self.client.session.session_key
        self.sign_in()
        self.assertNotEqual(old, self.client.session.session_key)
        cookie = self.client.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")
        self.assertEqual(self.client.get("/api/v1/auth/logout").status_code, 405)
        self.assertEqual(self.send("/api/v1/auth/logout").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/progress").status_code, 401)
        self.assertEqual(self.client.get("/dashboard.html").status_code, 302)

    def test_idle_absolute_and_auth_version_expiry(self):
        for field, value in [("last_seen", int(time.time()) - 1900), ("auth_started", int(time.time()) - 44000), ("auth_version", 999)]:
            self.sign_in()
            session = self.client.session
            session[field] = value
            session.save()
            self.assertEqual(self.client.get("/api/v1/progress").status_code, 401)

    def test_authenticated_password_change_revokes_other_sessions(self):
        self.sign_in()
        other = Client(enforce_csrf_checks=True)
        self.sign_in(client=other)
        replacement = "My replacement creative passphrase"
        value = {"password": PASSWORD, "new_password": replacement, "confirmation": replacement}
        self.assertEqual(self.send("/api/v1/me/password", {**value,"password":"wrong"}).status_code, 403)
        self.assertEqual(self.send("/api/v1/me/password", value).status_code, 200)
        self.assertEqual(other.get("/api/v1/progress").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/progress").status_code, 401)
        response = self.send("/api/v1/auth/login", {"username": self.a.username, "password": replacement})
        self.assertEqual(response.status_code, 200)

    def test_eight_character_password_signup_login_and_change(self):
        password = "V7!q2R#x"
        value = {"username":"length-boundary", "display_name":"Boundary Artist", "password":password[:-1], "confirmation":password[:-1]}
        self.assertEqual(self.send('/api/v1/auth/signup', value).status_code, 422)
        value.update(password=password, confirmation=password)
        self.assertEqual(self.send('/api/v1/auth/signup', value).status_code, 202)
        self.assertEqual(self.send('/api/v1/auth/login', {'username':value['username'], 'password':password}).status_code, 200)
        replacement = "N9@t4W$z"
        self.assertEqual(self.send('/api/v1/me/password', {'password':password, 'new_password':replacement[:-1], 'confirmation':replacement[:-1]}).status_code, 422)
        self.assertEqual(self.send('/api/v1/me/password', {'password':password, 'new_password':replacement, 'confirmation':replacement}).status_code, 200)
        self.assertEqual(self.send('/api/v1/auth/login', {'username':value['username'], 'password':replacement}).status_code, 200)

    def test_login_throttling_still_applies_without_email(self):
        for _ in range(5):
            self.send("/api/v1/auth/login", {"username": self.a.username, "password": "wrong"})
        response = self.send("/api/v1/auth/login", {"username": self.a.username, "password": PASSWORD})
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response)
        self.assertNotIn(self.a.username, " ".join(RateBucket.objects.values_list("key", flat=True)))

    def test_two_accounts_cannot_access_artwork_metadata_image_or_mutations(self):
        art = self.save_art()
        self.sign_in(self.b)
        for path in [f"/api/v1/artworks/{art.pk}", f"/api/v1/artworks/{art.pk}/image"]:
            self.assertEqual(self.client.get(path).status_code, 404)
        for method in ["patch", "delete"]:
            self.assertEqual(self.send(f"/api/v1/artworks/{art.pk}", {"version": 1, **({"title": "Stolen"} if method == "patch" else {})}, method).status_code, 404)
        self.assertEqual(self.client.get("/api/v1/artworks").json()["data"]["total"], 0)

    def test_private_image_decoded_and_metadata_stripped(self):
        art = self.save_art()
        self.sign_in()
        response = self.client.get(f"/api/v1/artworks/{art.pk}/image")
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])
        content = b"".join(response.streaming_content)
        image = Image.open(io.BytesIO(content))
        self.assertEqual(image.format, "WEBP")
        self.assertNotIn("exif", image.info)
        download = self.client.get(f"/api/v1/artworks/{art.pk}/image?download=1")
        self.assertTrue(download["Content-Disposition"].startswith("attachment"))
        b"".join(download.streaming_content)

    def test_idempotent_save_reward_and_changed_payload_conflict(self):
        key = uuid.uuid4()
        first = self.save_art(client_id=key)
        second = self.save_art(client_id=key)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(progress(self.a)["stars"], 20)
        self.assertEqual(progress(self.a)["growth_units"], 2)
        from core.http import APIError
        with self.assertRaises(APIError):
            self.save_art(color="blue", client_id=key)
        self.assertEqual(Artwork.objects.count(), 1)

    def test_duplicate_image_has_no_extra_rewards_and_milestones_survive_deletion(self):
        for color in ["red", "red", "blue", "green", "orange"]:
            self.save_art(color=color)
        self.assertEqual(progress(self.a)["stars"], 75)
        self.assertEqual(progress(self.a)["completed_artworks"], 4)
        art = Artwork.objects.filter(owner=self.a).first()
        self.sign_in()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.send(f"/api/v1/artworks/{art.pk}", {"version": 1}, "delete").status_code, 200)
        self.assertEqual(progress(self.a)["stars"], 75)
        self.assertEqual(Artwork.objects.get(pk=art.pk).status, "deleted")
        self.assertFalse((self.private / art.file_key).exists())

    def test_image_type_dimensions_quota_and_owner_injection(self):
        self.sign_in()
        token = self.client.get("/api/v1/session").json()["data"]["csrf"]
        value = {"title": "Invalid", "lab": "art", "client_id": str(uuid.uuid4())}
        response = self.client.post("/api/v1/artworks", {**value, "image": SimpleUploadedFile("bad.png", b"<svg onload=alert(1)>")}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.post("/api/v1/artworks", {**value, "owner": str(self.b.pk), "image": upload()}, HTTP_X_CSRFTOKEN=token).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/artworks", {**value, "image": upload(size=(2049, 1))}, HTTP_X_CSRFTOKEN=token).status_code, 422)
        with override_settings(ARTWORK_QUOTA_BYTES=1):
            self.assertEqual(self.client.post("/api/v1/artworks", {**value, "image": upload()}, HTTP_X_CSRFTOKEN=token).status_code, 413)

    def test_versions_reject_stale_updates_and_profile_mass_assignment(self):
        art = self.save_art()
        self.sign_in()
        route = f"/api/v1/artworks/{art.pk}"
        self.assertEqual(self.send(route, {"title": "New title", "version": 1}, "patch").status_code, 200)
        self.assertEqual(self.send(route, {"title": "Stale title", "version": 1}, "patch").status_code, 409)
        self.assertEqual(self.send("/api/v1/me", {"version": 1, "stars": 999}, "patch").status_code, 422)
        self.assertEqual(self.send("/api/v1/me", {"version": 1, "avatar": 7}, "patch").status_code, 422)
        self.assertEqual(self.send("/api/v1/me", {"version": 1, "avatar": 6, "pet_species": "tiger", "pet_name": "Tala"}, "patch").status_code, 200)
        self.assertEqual(self.send("/api/v1/me", {"version": 1, "avatar": 2}, "patch").status_code, 409)

    def test_import_does_not_award_and_deduplicates(self):
        one = self.save_art(imported=True)
        two = self.save_art(imported=True)
        self.assertEqual(one.pk, two.pk)
        self.assertEqual(progress(self.a)["stars"], 0)
        self.assertEqual(progress(self.a)["growth_units"], 0)

    def test_quiz_key_private_grade_server_replay_practice_and_isolation(self):
        call_command("seed_content", verbosity=0)
        self.sign_in()
        response = self.send("/api/v1/quiz-attempts", {"client_id": str(uuid.uuid4()), "assessment": "week1"})
        self.assertEqual(response.status_code, 200, response.content)
        public = response.json()["data"]["attempt"]
        self.assertNotIn('"answer"', json.dumps(public))
        self.assertNotIn('"explanation"', json.dumps(public))
        self.assertTrue(all(len(option["id"]) == 32 for q in public["questions"] for option in q["options"]))
        attempt = QuizAttempt.objects.get(pk=public["id"])
        answers = {q["id"]: q["option_ids"][q["answer"]] for q in attempt.questions}
        route = f"/api/v1/quiz-attempts/{attempt.pk}/submit"
        first = self.send(route, {"answers": answers})
        self.assertEqual(first.json()["data"]["attempt"]["score"], 5)
        self.assertEqual(first.json()["data"]["progress"]["stars"], 50)
        self.assertEqual(first.json()["data"]["progress"]["growth_units"], 12)
        self.assertEqual(self.send(route, {"answers": answers}).json(), first.json())
        modified = {**answers, attempt.questions[0]["id"]: attempt.questions[0]["option_ids"][(attempt.questions[0]["answer"] + 1) % 4]}
        self.assertEqual(self.send(route, {"answers": modified}).status_code, 409)
        second = self.send("/api/v1/quiz-attempts", {"client_id": str(uuid.uuid4()), "assessment": "week1"}).json()["data"]["attempt"]
        private = QuizAttempt.objects.get(pk=second["id"])
        self.send(f"/api/v1/quiz-attempts/{private.pk}/submit", {"answers": {q["id"]: q["option_ids"][q["answer"]] for q in private.questions}})
        self.assertEqual(progress(self.a)["stars"], 50)
        self.sign_in(self.b)
        self.assertEqual(self.client.get(f"/api/v1/quiz-attempts/{attempt.pk}").status_code, 404)
        self.assertEqual(self.send(route, {"answers": answers}).status_code, 404)

    def test_quiz_window_expiry_and_invalid_submission(self):
        call_command("seed_content", verbosity=0)
        self.sign_in()
        public = self.send("/api/v1/quiz-attempts", {"client_id": str(uuid.uuid4()), "assessment": "week2"}).json()["data"]["attempt"]
        attempt = QuizAttempt.objects.get(pk=public["id"])
        attempt.window = "2020-W01"
        attempt.save()
        route = f"/api/v1/quiz-attempts/{attempt.pk}/submit"
        self.assertEqual(self.send(route, {"answers": {}}).status_code, 422)
        response = self.send(route, {"answers": {q["id"]: q["option_ids"][q["answer"]] for q in attempt.questions}})
        self.assertFalse(response.json()["data"]["attempt"]["rewarded"])
        self.assertEqual(progress(self.a)["stars"], 0)

    def test_challenge_requires_own_matching_new_artwork(self):
        self.sign_in()
        art = save_artwork(self.a, {"title": "Parol", "lab": "festival", "challenge": "parol-design", "client_id": str(uuid.uuid4())}, upload())
        route = "/api/v1/challenges/parol-design/complete"
        self.assertEqual(self.send(route, {"artwork_id": str(art.pk)}).status_code, 200)
        self.assertEqual(self.send(route, {"artwork_id": str(art.pk)}).status_code, 200)
        self.assertEqual(ActivityCompletion.objects.filter(kind="challenge").count(), 1)
        self.assertEqual(progress(self.a)["stars"], 20)
        self.sign_in(self.b)
        self.assertEqual(self.send(route, {"artwork_id": str(art.pk)}).status_code, 404)

    def test_export_and_account_delete_require_reauthentication(self):
        art = self.save_art()
        self.sign_in()
        self.assertEqual(self.send("/api/v1/me/export", {"password": "wrong"}).status_code, 403)
        exported = self.send("/api/v1/me/export", {"password": PASSWORD})
        self.assertEqual(exported.status_code, 200)
        self.assertEqual(exported["Content-Type"], "application/zip")
        self.assertEqual(self.send("/api/v1/me", {"password": PASSWORD, "confirmation": "DELETE"}, "delete").status_code, 200)
        self.assertFalse(User.objects.filter(pk=self.a.pk).exists())
        self.assertFalse((self.private / art.file_key).exists())
        self.assertIn(str(self.a.pk), (Path(self.temp.name) / "deletions.jsonl").read_text())

    def test_headers_and_repository_files_not_served(self):
        response = self.client.get("/")
        self.assertIn("script-src 'self'", response["Content-Security-Policy"])
        self.assertEqual(response["X-Frame-Options"], "DENY")
        for path in ["/.env", "/serve.py", "/var/likha.sqlite3", "/backend/learning/questions.json", "/static/quiz.js", "/.git/config", "/AGENTS.md", "/LIKHA-Portable.zip", "/images/pets/growth-manifest.json"]:
            self.assertEqual(self.client.get(path).status_code, 404, path)

    def test_staff_admin_requires_mfa_not_only_login(self):
        self.a.is_staff = self.a.is_superuser = True
        self.a.save()
        self.sign_in()
        response = self.client.get("/admin/")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_stale_tab_cannot_save_into_a_different_signed_in_account(self):
        self.sign_in(self.b)
        token = self.client.get("/api/v1/session").json()["data"]["csrf"]
        response = self.client.patch("/api/v1/me", json.dumps({"version": 1, "display_name": "Wrong account"}), content_type="application/json", HTTP_X_CSRFTOKEN=token, HTTP_X_LIKHA_ACCOUNT=str(self.a.pk))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "account_changed")
        self.b.profile.refresh_from_db()
        self.assertEqual(self.b.profile.display_name, "LIKHA Artist")


class SQLiteConcurrencyTests(MediaMixin, TransactionTestCase):
    reset_sequences = True

    def test_two_real_connections_save_once(self):
        self.assertNotIn("memory", str(connection.settings_dict["NAME"]))
        user = User.objects.create_user("concurrent@example.test", PASSWORD)
        key = uuid.uuid4()
        barrier = Barrier(2)
        def worker():
            close_old_connections()
            try:
                owner = User.objects.get(pk=user.pk)
                barrier.wait(timeout=10)
                art = save_artwork(owner, {"title": "Shared save", "lab": "art", "client_id": str(key)}, upload())
                return str(art.pk)
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(lambda _: worker(), range(2)))
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(Artwork.objects.count(), 1)
        self.assertEqual(progress(user)["stars"], 20)
        self.assertEqual(RewardEvent.objects.count(), 2)

    def test_connection_reopen_preserves_data_and_foreign_keys(self):
        user = User.objects.create_user("persistent@example.test", PASSWORD)
        art = save_artwork(user, {"title": "Persist", "lab": "art", "client_id": str(uuid.uuid4())}, upload())
        close_old_connections()
        self.assertEqual(Artwork.objects.get(pk=art.pk).status, "ready")
        with connection.cursor() as cursor:
            if connection.vendor == "postgresql":
                cursor.execute("SELECT COUNT(*) FROM learning_artwork WHERE id = %s", [art.pk])
                self.assertEqual(cursor.fetchone()[0], 1)
                return
            cursor.execute("PRAGMA foreign_keys")
            self.assertEqual(cursor.fetchone()[0], 1)
            cursor.execute("PRAGMA journal_mode")
            self.assertEqual(cursor.fetchone()[0], "wal")

    def test_parallel_new_artworks_claim_first_milestone_only_once(self):
        user = User.objects.create_user("parallel-art@example.test", PASSWORD)
        barrier = Barrier(2)
        def worker(color):
            close_old_connections()
            try:
                owner = User.objects.get(pk=user.pk)
                barrier.wait(timeout=10)
                return save_artwork(owner, {"title": "Parallel", "lab": "art", "client_id": str(uuid.uuid4())}, upload(color)).pk
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(worker, ["blue", "green"]))
        self.assertEqual(progress(user)["stars"], 35)
        self.assertEqual(progress(user)["growth_units"], 4)
        self.assertEqual(RewardEvent.objects.filter(key="milestone:artwork:first").count(), 1)

    def test_concurrent_profile_edits_return_one_conflict(self):
        user = User.objects.create_user('parallel-profile', PASSWORD)
        clients = [Client(), Client()]
        for client in clients:
            client.force_login(user)
        barrier = Barrier(2)
        def worker(item):
            index,client=item
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                response=client.patch('/api/v1/me',json.dumps({'version':1,'display_name':f'Device {index}'}),content_type='application/json')
                return response.status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes=list(pool.map(worker,enumerate(clients)))
        self.assertEqual(sorted(outcomes),[200,409])
        user.profile.refresh_from_db()
        self.assertEqual(user.profile.version,2)

    def test_parallel_quiz_submissions_claim_weekly_reward_only_once(self):
        from learning.services import start_attempt, submit_attempt
        call_command("seed_content", verbosity=0)
        user = User.objects.create_user("parallel-quiz@example.test", PASSWORD)
        attempts = [start_attempt(user, {"client_id": str(uuid.uuid4()), "assessment": "week1"}) for _ in range(2)]
        barrier = Barrier(2)
        def worker(attempt_id):
            close_old_connections()
            try:
                current = QuizAttempt.objects.select_related("quiz", "owner").get(pk=attempt_id)
                answers = {q["id"]: q["option_ids"][q["answer"]] for q in current.questions}
                barrier.wait(timeout=10)
                return submit_attempt(current, {"answers": answers}).rewarded
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(worker, [a.pk for a in attempts]))
        self.assertEqual(sum(outcomes), 1)
        self.assertEqual(progress(user)["stars"], 50)
        self.assertEqual(progress(user)["growth_units"], 12)


class PasswordHasherTests(TestCase):
    def test_default_hash_is_argon2(self):
        user = User(username="hasher@example.test")
        user.set_password(PASSWORD)
        self.assertTrue(user.password.startswith("argon2$"))
        self.assertTrue(user.check_password(PASSWORD))
