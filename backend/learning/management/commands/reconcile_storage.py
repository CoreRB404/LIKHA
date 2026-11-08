from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from learning.models import Artwork
from learning import storage
from core.http import APIError
from learning.services import image_path, ready_artwork


class Command(BaseCommand):
    help = "Recover pending media saves and report missing files. Never deletes live ready artwork."

    def handle(self, **options):
        if storage.remote():
            storage.check_bucket()
            recovered = missing = 0
            for art in Artwork.objects.exclude(status="deleted").iterator():
                try:
                    if art.status == "pending":
                        ready_artwork(art)
                        recovered += 1
                    else:
                        storage.read_image(art)
                except APIError as error:
                    if error.status == 404:
                        missing += 1
                    else:
                        raise
            self.stdout.write(f"Recovered={recovered}; missing/corrupt={missing}. Remote orphan cleanup requires reviewed bucket inventory.")
            return
        recovered = missing = 0
        for art in Artwork.objects.exclude(status="deleted"):
            path = image_path(art)
            if art.status == "pending" and (path.exists() or path.with_suffix(".pending").exists()):
                ready_artwork(art)
                recovered += 1
            elif not path.exists():
                missing += 1
        # Only remove files unreferenced for >24h in this known private directory.
        referenced = set(Artwork.objects.values_list("file_key", flat=True))
        removed = 0
        for path in settings.PRIVATE_MEDIA_ROOT.iterdir():
            if path.is_file() and not path.is_symlink() and path.suffix in {".webp", ".pending"} and path.with_suffix(".webp").name not in referenced and timezone.now().timestamp() - path.stat().st_mtime > 86400:
                path.unlink()
                removed += 1
        self.stdout.write(f"Recovered={recovered}; missing={missing}; old unreferenced files removed={removed}")
