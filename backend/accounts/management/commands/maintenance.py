from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from accounts.models import AuditEvent, MailOutbox, RateBucket, VerificationGrant


class Command(BaseCommand):
    help = "Expire throttles, grants, delivered mail and audit records under the 30-day policy."

    def handle(self, **options):
        now = timezone.now()
        RateBucket.objects.filter(expires_at__lt=now).delete()
        VerificationGrant.objects.filter(expires_at__lt=now - timedelta(days=1)).delete()
        MailOutbox.objects.filter(created_at__lt=now - timedelta(days=2)).delete()
        AuditEvent.objects.filter(created_at__lt=now - timedelta(days=30)).delete()
        self.stdout.write("Expired operational records cleaned. Run clearsessions separately.")
