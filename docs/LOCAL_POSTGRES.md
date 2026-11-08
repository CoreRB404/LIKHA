# Local PostgreSQL: active on this laptop

The local account application now uses **PostgreSQL 17**, not SQLite. This is a private local database, independent of Supabase and of the preexisting Windows PostgreSQL service. It listens only on `127.0.0.1` with generated password authentication. The controller manages only LIKHA's own cluster and verifies its identity before treating an existing connection as running.

## Verified transfer

The quiesced transfer copied 164 serialized application records, preserving primary keys, password hashes, full-precision timestamps, profiles/pets, artwork metadata, quizzes, and reward history. Regenerated Django permissions/content types are resolved using natural keys. Old login sessions were intentionally excluded; sign in again with the same username and password.

Verified after cutover: 7 accounts, 5 artworks, 14 reward events, 4 quiz attempts. All 5 ready artwork file checksums pass; all wallets match their reward ledgers. Canonical source/target record comparison passed before activating PostgreSQL. A synthetic login/save/image/reward check used the actual selected PostgreSQL connection and rolled its writes back. PostgreSQL was stopped/restarted and persistent records/images checked again.

Pictures remain in private `var/artworks/`; they are not stored inside the PostgreSQL database. Supabase connection and media upload are still separate cloud deployment work.

## Starting offline

From this project folder, after dependencies are installed:

```powershell
.\.venv\Scripts\python.exe tools/local_postgres.py start
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000 --noreload
```

Open `http://127.0.0.1:8000/`. Keep the application terminal open. Neither command needs internet. `start-hosted.ps1` additionally installs/checks dependencies, builds assets and applies migrations, so its first setup needs internet and PostgreSQL server tools installed. A new source handoff has no database or local credentials and initializes its own local cluster using that helper.

After stopping Django, you can stop PostgreSQL:

```powershell
.\.venv\Scripts\python.exe tools/local_postgres.py stop
```

Status/checks:

```powershell
.\.venv\Scripts\python.exe tools/local_postgres.py status
.\.venv\Scripts\python.exe backend/manage.py check_storage
.\.venv\Scripts\python.exe backend/manage.py reconcile_rewards
.\.venv\Scripts\python.exe tools/check_active_postgres.py
```

The last command creates only synthetic data inside a rolled-back transaction. It validates actual login and private artwork writes without retaining a test account.

## Private files and backups

- `var/postgres-data/`: live PostgreSQL cluster; never delete, ZIP while running, or serve publicly.
- `var/local-postgres.json`: active private connection configuration. `var/postgres-control.json` lets the local controller start the same cluster. Do not share either file.
- `var/postgresql-active`: prevents silently falling back to SQLite if the active configuration disappears.
- `var/postgres-migration-report.json`: counts, comparison digest and backup location, without usernames or password hashes.
- `var/backups/postgres-cutover-*/before-cutover.fernet`: authenticated encrypted source database/media snapshot. Its key is separately under `var/backup-keys/`.
- `var/backups/postgres-cutover-*/legacy-sqlite/`: original inactive SQLite files and earlier SQLite snapshots, retained for rollback. No `.sqlite3` database remains in the active `var/` directory.

Keep private backup copies and encryption keys in independently protected locations. The source ZIP excludes all of `var/`, so it is not a data backup. For new PostgreSQL backups use `pg_dump`/`pg_restore` with private credentials and back up `var/artworks/` and deletion records separately. `backup_site`/`restore_site` remain SQLite-only legacy tools and refuse the active PostgreSQL database. Do not restore the old SQLite backup over current PostgreSQL progress.

## Migrating another old local installation

Stop its app and all write jobs, install PostgreSQL server tools and project dependencies, then run:

```powershell
.\.venv\Scripts\python.exe tools/migrate_local_postgres.py --quiesced
```

This creates an encrypted rollback backup, initializes an isolated loopback PostgreSQL cluster, refuses nonempty targets, transfers records transactionally, compares every serialized record, validates media/rewards and activates the private PostgreSQL configuration last. Repeated imports after activation are refused. Migration errors never erase the source; review the target before attempting a new migration. An independent synthetic migration/restart test is available with `tools/check_local_migration.py`.

For cloud hosting, see [Supabase + Render](SUPABASE_RENDER.md). A configured `DATABASE_URL` takes precedence over this private local configuration; local plaintext connections are accepted only for the fixed loopback host. Cloud URLs continue to require TLS.
