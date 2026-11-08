from django.core.management.base import BaseCommand, CommandError
from django.db.models import Sum
from learning.models import RewardEvent, Wallet


class Command(BaseCommand):
    help = "Read-only comparison of wallet projections with the immutable reward ledger."

    def handle(self, **options):
        mismatches = 0
        for wallet in Wallet.objects.all():
            totals = RewardEvent.objects.filter(owner=wallet.owner).aggregate(stars=Sum("stars"), growth=Sum("growth"))
            if wallet.stars != (totals["stars"] or 0) or wallet.lifetime != (totals["stars"] or 0) or wallet.growth != (totals["growth"] or 0):
                mismatches += 1
        if mismatches:
            raise CommandError(f"{mismatches} wallet projections differ from their ledgers. Investigate; no history was modified.")
        self.stdout.write("All wallet projections match their reward ledgers.")
