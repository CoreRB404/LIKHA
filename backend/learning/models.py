import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class Artwork(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client_id = models.UUIDField()
    payload_hash = models.CharField(max_length=64)
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=2000, blank=True)
    lab = models.CharField(max_length=12)
    concepts = models.JSONField(default=dict)
    file_key = models.CharField(max_length=100)
    image_hash = models.CharField(max_length=64)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    size = models.PositiveIntegerField()
    status = models.CharField(max_length=10, default="pending")
    imported = models.BooleanField(default=False)
    challenge = models.CharField(max_length=60, blank=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "client_id"], name="unique_art_save"), models.CheckConstraint(condition=Q(lab__in=["fashion", "festival", "craft", "art"]), name="art_lab"), models.CheckConstraint(condition=Q(status__in=["pending", "ready", "deleted"]), name="art_status")]
        indexes = [models.Index(fields=["owner", "status", "-created_at"])]


class ArtworkImport(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    fingerprint = models.CharField(max_length=64)
    artwork = models.OneToOneField(Artwork, on_delete=models.CASCADE)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "fingerprint"], name="unique_import")]


class ActivityCompletion(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20)
    source = models.CharField(max_length=100)
    window = models.CharField(max_length=20, default="lifetime")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "kind", "source", "window"], name="unique_completion")]


class RewardEvent(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    key = models.CharField(max_length=160)
    rule_version = models.PositiveIntegerField(default=1)
    stars = models.PositiveIntegerField(default=0)
    growth = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "key"], name="unique_reward")]


class Wallet(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    stars = models.PositiveIntegerField(default=0)
    lifetime = models.PositiveIntegerField(default=0)
    growth = models.PositiveIntegerField(default=0)


class QuizDefinition(models.Model):
    slug = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=120)
    version = models.PositiveIntegerField(default=1)
    questions = models.JSONField()  # Includes private answer key; never serialize directly.


class QuizAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client_id = models.UUIDField()
    quiz = models.ForeignKey(QuizDefinition, on_delete=models.PROTECT)
    quiz_version = models.PositiveIntegerField()
    window = models.CharField(max_length=20)
    questions = models.JSONField()
    answers = models.JSONField(null=True)
    score = models.PositiveIntegerField(null=True)
    rewarded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "client_id"], name="unique_quiz_start")]


class QuizRewardClaim(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    quiz = models.ForeignKey(QuizDefinition, on_delete=models.PROTECT)
    window = models.CharField(max_length=20)
    attempt = models.OneToOneField(QuizAttempt, on_delete=models.CASCADE)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "quiz", "window"], name="unique_week_reward")]
