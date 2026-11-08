from django.core.management.base import BaseCommand, CommandError
from django.db import connection, DatabaseError
from learning.models import Artwork
from learning.storage import read_image, remote, check_bucket
from core.http import APIError


class Command(BaseCommand):
    help = "Read-only database connectivity (SQLite integrity where supported) and private image checksums."

    def handle(self, **options):
        try:
            with connection.cursor() as cursor:
                if connection.vendor == "sqlite":
                    cursor.execute('PRAGMA quick_check')
                    if cursor.fetchall() != [('ok',)]:
                        raise CommandError('SQLite integrity check failed; restore from a verified backup.')
                    cursor.execute('PRAGMA foreign_key_check')
                    if cursor.fetchall():
                        raise CommandError('Foreign-key integrity check failed.')
                else:
                    cursor.execute('SELECT COUNT(*) FROM django_migrations')
            if remote():
                check_bucket()
            checked = 0
            for art in Artwork.objects.filter(status='ready').iterator():
                read_image(art)
                checked+=1
        except APIError as error:
            raise CommandError(error.message) from None
        except OSError:
            raise CommandError('Private storage is unavailable; no data was changed.')
        except DatabaseError:
            raise CommandError('Database storage is unavailable or corrupt; restore a verified backup. No data was changed.')
        self.stdout.write(f'{connection.vendor} connectivity/integrity and {checked} private image checksums pass.')
