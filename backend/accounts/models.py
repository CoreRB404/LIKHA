import uuid
from django.utils import timezone

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models import Q
from django.contrib.auth.validators import UnicodeUsernameValidator


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, username, password=None, **extra):
        user = self.model(username=username.strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True)
        return self.create_user(username, password, **extra)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=254, unique=True, validators=[UnicodeUsernameValidator()])
    email = None
    auth_version = models.PositiveIntegerField(default=1)
    notice_version = models.CharField(max_length=30, default="2026-11-08")
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []
    objects = UserManager()

    def save(self, *args, **kwargs):
        self.username = self.username.strip().lower()
        super().save(*args, **kwargs)


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    display_name = models.CharField(max_length=60, default="LIKHA Artist")
    avatar = models.PositiveSmallIntegerField(default=1)
    version = models.PositiveIntegerField(default=1)
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(avatar__gte=1, avatar__lte=6), name="avatar_range")]


class PetState(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    species = models.CharField(max_length=12, default="cat", choices=[(x, x) for x in ("cat", "dog", "rabbit", "lion", "panda", "tiger")])
    name = models.CharField(max_length=20, default="Mimi")
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(species__in=["cat", "dog", "rabbit", "lion", "panda", "tiger"]), name="pet_species")]


class VerificationGrant(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    digest = models.CharField(max_length=64, unique=True)
    purpose = models.CharField(max_length=12)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True)
    auth_version = models.PositiveIntegerField()


class MailOutbox(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    encrypted_payload = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt = models.DateTimeField(default=timezone.now)


class RateBucket(models.Model):
    key = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField(db_index=True)
    count = models.PositiveIntegerField(default=0)


class AuditEvent(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=50)
    outcome = models.CharField(max_length=20)
    target = models.CharField(max_length=100, blank=True)
    request_id = models.CharField(max_length=36, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class DeletionRecord(models.Model):
    user_id = models.UUIDField(unique=True)
    deleted_at = models.DateTimeField(auto_now_add=True)
