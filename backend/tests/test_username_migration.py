from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.contrib.auth.hashers import check_password, make_password
import uuid


class UsernameMigrationTests(TransactionTestCase):
    def test_schema_rollback_and_reapply_keep_identity_and_password(self):
        executor=MigrationExecutor(connection)
        latest=executor.loader.graph.leaf_nodes()
        previous=[('accounts','0001_initial'),('learning','0002_opaque_quiz_options'),('sessions','0001_initial')]
        executor.migrate(previous)
        try:
            OldUser=executor.loader.project_state(previous).apps.get_model('accounts','User')
            owner=OldUser.objects.create(email='rollback@example.test',password=make_password('A preserved rollback passphrase'))
            user_id=owner.pk
            MigrationExecutor(connection).migrate(latest)
            reverse=MigrationExecutor(connection)
            reverse.migrate(previous)
            HistoricalUser=reverse.loader.project_state(previous).apps.get_model('accounts','User')
            restored=HistoricalUser.objects.get(pk=user_id)
            self.assertEqual(restored.email,'rollback@example.test')
            self.assertTrue(check_password('A preserved rollback passphrase',restored.password))
            MigrationExecutor(connection).migrate(latest)
            from accounts.models import User
            upgraded=User.objects.get(pk=user_id)
            self.assertEqual(upgraded.username,'rollback@example.test')
            self.assertTrue(check_password('A preserved rollback passphrase',upgraded.password))
        finally:
            MigrationExecutor(connection).migrate(latest)

    def test_existing_identity_password_artwork_and_rewards_survive(self):
        executor = MigrationExecutor(connection)
        prior = [("accounts", "0001_initial"), ("learning", "0002_opaque_quiz_options"), ("sessions", "0001_initial")]
        latest = executor.loader.graph.leaf_nodes()
        executor.migrate(prior)
        try:
            apps = executor.loader.project_state(prior).apps
            OldUser = apps.get_model("accounts", "User")
            OldArtwork = apps.get_model("learning", "Artwork")
            OldWallet = apps.get_model("learning", "Wallet")
            user_id = uuid.uuid4()
            password = make_password("My preserved creative passphrase")
            user = OldUser.objects.create(id=user_id, email="legacy@example.test", password=password, is_active=True)
            OldWallet.objects.create(owner=user, stars=35, lifetime=35, growth=4)
            art_id = uuid.uuid4()
            OldArtwork.objects.create(id=art_id, owner=user, client_id=uuid.uuid4(), title="Preserved", lab="art", payload_hash="a" * 64, image_hash="b" * 64, file_key="preserved.webp", width=1000, height=700, size=100, status="ready")
            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            from accounts.models import User
            from learning.models import Artwork, Wallet
            migrated = User.objects.get(pk=user_id)
            self.assertEqual(migrated.username, "legacy@example.test")
            self.assertTrue(check_password("My preserved creative passphrase", migrated.password))
            self.assertEqual(Wallet.objects.get(owner=migrated).stars, 35)
            self.assertEqual(Artwork.objects.get(pk=art_id).owner_id, user_id)
            self.assertFalse(any(field.name == "email" for field in User._meta.fields))
        finally:
            MigrationExecutor(connection).migrate(latest)
