import uuid
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase
from django.utils import timezone


class PopulatedAssessmentMigrationTests(TransactionTestCase):
    def test_upgrade_preserves_grades_rewards_and_converts_all_option_identifiers(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        previous = [('accounts', '0002_username_accounts'), ('learning', '0001_initial'), ('sessions', '0001_initial')]
        executor.migrate(previous)
        try:
            apps = executor.loader.project_state(previous).apps
            User = apps.get_model('accounts', 'User')
            Quiz = apps.get_model('learning', 'QuizDefinition')
            Attempt = apps.get_model('learning', 'QuizAttempt')
            Wallet = apps.get_model('learning', 'Wallet')
            Reward = apps.get_model('learning', 'RewardEvent')
            question = {'id':'migration-question','question':'A synthetic question?','category':'Test','options':['A','B','C','D'],'answer':2,'explanation':'Synthetic feedback','order':[2,0,3,1]}
            quiz = Quiz.objects.create(slug='migration', title='Migration assessment', questions=[question])
            expected = []
            for index in range(3):
                user = User.objects.create(username=f'migration-{index}', password='!')
                Wallet.objects.create(owner=user, stars=10, lifetime=10, growth=4)
                Reward.objects.create(owner=user, key=f'quiz:migration:{index}', stars=10, growth=4)
                completed = Attempt.objects.create(owner=user, client_id=uuid.uuid4(), quiz=quiz, quiz_version=1, window='2026-W45', questions=[question], answers={'migration-question':2}, score=1, rewarded=True, submitted_at=timezone.now())
                pending = Attempt.objects.create(owner=user, client_id=uuid.uuid4(), quiz=quiz, quiz_version=1, window='2026-W45', questions=[question])
                expected.append((user.pk,completed.pk,pending.pk))
            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            from learning.models import QuizAttempt, Wallet as NewWallet, RewardEvent
            for user_id, completed_id, pending_id in expected:
                completed = QuizAttempt.objects.get(pk=completed_id)
                pending = QuizAttempt.objects.get(pk=pending_id)
                ids = completed.questions[0]['option_ids']
                self.assertEqual(len(set(ids)),4)
                self.assertEqual(completed.answers['migration-question'],ids[2])
                self.assertEqual(completed.score,1)
                self.assertTrue(completed.rewarded)
                self.assertIsNone(pending.answers)
                self.assertEqual(len(pending.questions[0]['option_ids']),4)
                self.assertEqual(NewWallet.objects.get(owner_id=user_id).stars,10)
                self.assertEqual(RewardEvent.objects.filter(owner_id=user_id).count(),1)
        finally:
            MigrationExecutor(connection).migrate(latest)
