"""Run real migrations/API/concurrency tests against an isolated local PostgreSQL.

Requires PostgreSQL server tools on PATH. Never connects to a supplied DATABASE_URL.
The temporary cluster listens only on loopback with a generated test password.
"""
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    for binary in ('initdb', 'pg_ctl'):
        if not shutil.which(binary):
            raise SystemExit(f'{binary} is required on PATH for this local PostgreSQL check.')
    with tempfile.TemporaryDirectory(prefix='likha-postgres-') as temporary:
        folder = Path(temporary)
        cluster = folder / 'cluster'
        password = secrets.token_urlsafe(32)
        password_file = folder / 'password'
        password_file.write_text(password, encoding='utf-8')
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        def run(args):
            print('PostgreSQL check: ' + Path(args[0]).name + ' ' + args[-1], flush=True)
            # A Windows server descendant can inherit a PIPE and keep read() open.
            # File-backed output lets pg_ctl return as soon as it has exited.
            with (folder / 'commands.log').open('a', encoding='utf-8') as output:
                return subprocess.run(args, check=True, stdout=output, stderr=subprocess.STDOUT, text=True,
                                      timeout=60,
                                      creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        run(['initdb', '-D', str(cluster), '-U', 'likha_test', '--pwfile=' + str(password_file), '--auth=scram-sha-256', '--encoding=UTF8', '--no-locale'])
        password_file.unlink()
        started = False
        try:
            run(['pg_ctl', '-D', str(cluster), '-l', str(folder / 'postgres.log'), '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'])
            started = True
            import psycopg
            with psycopg.connect(host='127.0.0.1', port=port, user='likha_test', password=password, dbname='postgres', autocommit=True, connect_timeout=10) as conn:
                conn.execute('CREATE DATABASE likha_ci')
                conn.execute('CREATE DATABASE test_likha_ci')
            for name in ('likha_ci', 'test_likha_ci'):
                with psycopg.connect(host='127.0.0.1', port=port, user='likha_test', password=password, dbname=name, autocommit=True, connect_timeout=10) as conn:
                    conn.execute('CREATE SCHEMA likha')
            os.environ['DATABASE_URL'] = f'postgresql://likha_test:{password}@127.0.0.1:{port}/likha_ci'
            os.environ['LIKHA_ENV'] = 'development'
            os.environ['LIKHA_MEDIA_BACKEND'] = 'local'
            os.environ['LIKHA_DATA_DIR'] = str(folder / 'app-data')
            os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
            sys.path.insert(0, str(root / 'backend'))
            import django
            django.setup()
            from django.conf import settings
            # Only this disposable loopback cluster uses plaintext; deployment always requires TLS.
            settings.DATABASES['default']['OPTIONS']['sslmode'] = 'disable'
            settings.STATIC_ROOT.mkdir(parents=True, exist_ok=True)
            from django.core.management import call_command
            call_command('prepare_postgres')
            call_command('migrate', interactive=False, verbosity=0)
            from django.test.runner import DiscoverRunner
            failures = DiscoverRunner(verbosity=1, interactive=False, keepdb=True).run_tests([
                'tests.test_backend.BackendTests', 'tests.test_backend.SQLiteConcurrencyTests',
                'tests.test_hardening', 'tests.test_supabase',
                'tests.test_learning_migration', 'tests.test_username_migration',
                'tests.test_operations.ProductionBoundaryTests'])
            if failures:
                raise SystemExit(1)
            print('Isolated PostgreSQL migrations, ownership, rewards and concurrent writes pass.')
        finally:
            if started:
                run(['pg_ctl', '-D', str(cluster), '-m', 'fast', '-w', 'stop'])


if __name__ == '__main__':
    main()
