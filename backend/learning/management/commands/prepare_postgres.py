from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Create the private Django schema before the first PostgreSQL migration."

    def handle(self, **options):
        if connection.vendor != "postgresql":
            raise CommandError("This command requires DATABASE_URL for PostgreSQL.")
        with connection.cursor() as cursor:
            cursor.execute('CREATE SCHEMA IF NOT EXISTS likha')
            cursor.execute('REVOKE ALL ON SCHEMA likha FROM PUBLIC')
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')")
            for (role,) in cursor.fetchall():
                cursor.execute(f'REVOKE ALL ON SCHEMA likha FROM "{role}"')
        self.stdout.write("Private schema prepared. Keep likha out of Supabase exposed schemas.")
