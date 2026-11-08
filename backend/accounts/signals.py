from django.db.backends.signals import connection_created
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PetState, Profile, User


@receiver(connection_created)
def configure_sqlite(sender, connection, **kwargs):
    if connection.vendor == "sqlite":
        with connection.cursor() as cursor:
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=15000")
            # File-backed databases only. In-memory test databases cannot use WAL.
            if "memory" not in str(connection.settings_dict["NAME"]):
                cursor.execute("PRAGMA journal_mode=WAL")


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created and not kwargs.get("raw", False):
        Profile.objects.create(user=instance)
        PetState.objects.create(user=instance)
