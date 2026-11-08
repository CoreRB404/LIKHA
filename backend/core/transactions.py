"""Serialize each account's state changes on PostgreSQL, and SQLite IMMEDIATE."""
from contextlib import contextmanager

from django.contrib.auth import get_user_model
from django.db import transaction


@contextmanager
def account_transaction(owner):
    with transaction.atomic():
        # Consistent lock order: account first, then artwork/attempt/profile.
        get_user_model().objects.select_for_update().get(pk=owner.pk)
        yield
