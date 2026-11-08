from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Retired: email-based accounts have been removed."

    def handle(self, **options):
        raise CommandError("Email delivery is disabled. Remove send_outbox from scheduled jobs.")
