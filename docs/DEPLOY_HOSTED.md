# Deploy and operate the hosted application

The selected cloud target is **Supabase PostgreSQL + private Storage on Render**. Use [the Supabase/Render runbook](SUPABASE_RENDER.md). Docker/Caddy/SQLite instructions below remain the earlier single-host option.

The code and local verification are implemented. No public server, domain, off-host backup destination has been configured by this task. Docker configuration is supplied; the local Docker daemon was unavailable, so an actual container build/HTTPS deployment still requires staging verification. See [engineering evidence](engineering/IMPLEMENTATION_STATUS.md).

## Required external configuration

Use a single Linux host with persistent local storage and enough RAM for four WSGI threads, Argon2 and bounded image uploads. Configure a domain's DNS to that host, open only HTTP/HTTPS and restricted operator access. Students will access a URL; Python is installed on the server, not their laptops.

The operator must establish the age/enrollment/consent policy and approve the notice before enabling public signup. Set a real privacy contact. Do not set `LIKHA_PRIVACY_APPROVED=1` merely to bypass a startup check. Decide whether the initial 10 artwork rewards/day and 100 MiB/account limits match the intended classroom usage.

Copy `.env.example` to private `.env` and populate every production value. Compose reads this file; direct Django commands do not load it automatically. Use a unique secret of at least 50 random characters and an independently generated readiness token. Never commit `.env` or include it in portable ZIPs.

Set `LIKHA_DOMAIN` to the bare domain, `LIKHA_ORIGIN` to its HTTPS origin, and `DJANGO_ALLOWED_HOSTS` to explicit hostnames without schemes. Set `LIKHA_DATA_DIR=/data`, `LIKHA_STATIC_ROOT=/app/staticfiles`, and `LIKHA_TRUST_PROXY=1` for this Compose topology only. The Caddy proxy overwrites forwarded headers, and the app port is not published. Accounts use usernames and passphrases; do not configure SMTP or schedule account emails.

## First deployment

From the project root on the target Linux machine:

```sh
docker compose --env-file .env -f deploy/compose.yaml build
docker compose --env-file .env -f deploy/compose.yaml run --rm app python backend/manage.py migrate --noinput
docker compose --env-file .env -f deploy/compose.yaml run --rm app python backend/manage.py seed_content
docker compose --env-file .env -f deploy/compose.yaml run --rm app python backend/manage.py collectstatic --noinput
docker compose --env-file .env -f deploy/compose.yaml run --rm app python backend/manage.py check --deploy --fail-level WARNING
docker compose --env-file .env -f deploy/compose.yaml up -d
```

The first run initializes named private and public-static volumes. `collectstatic` must run before the proxy serves assets; it includes Django admin assets as well as LIKHA. On upgrades stop/drain app writes, back up first, then migrate and recollect the new static files before restart. The image contains generated templates and the allowlisted frontend; private data lives only in the private volume. Do not use `docker compose down -v` on a live installation.

Enroll a staff account using the commands in [RUN_HOSTED.md](RUN_HOSTED.md) through `docker compose ... run --rm app`. Do not create a shared/default administrator. Confirm the authenticator and recovery codes work in staging.

The deployment uses official Python and Caddy image tags pinned to registry digests, recorded in `deploy/image-pins.json`, and hash-locked Python dependencies. Review/rebuild those pins after security updates using `tools/pin_images.py`. Identity verification does not prove a container executes correctly: CI includes a container build job, but writing the workflow does not mean it has executed remotely.

## Scheduled operations

Run the following through the same private app environment, without exposing secrets in command-line arguments:

| Schedule | Command after `docker compose ... run --rm app` |
| --- | --- |
| Daily | `python backend/manage.py maintenance` |
| Daily | `python backend/manage.py clearsessions` |
| Daily | `python backend/manage.py reconcile_storage` |
| Daily | `python backend/manage.py reconcile_rewards` |
| Daily | `python backend/manage.py check_storage` |

Configure a host scheduler/systemd timers or equivalent. Account emails are removed: do not schedule `send_outbox`. That retired command fails closed. Configure log rotation and alerting separately.

Readiness is `/health/ready` with the secret `X-Health-Token`; liveness is `/health/live`. Restrict readiness diagnostics and store the token privately. Alert on persistent 5xx, write-lock errors, disk pressure and backup age over 26 hours. Set an actual response owner and contact outside committed code.

## Backup, restore and rollback

Generate a Fernet backup key once using `cryptography.fernet.Fernet.generate_key()` in a private session, store it independently, and set `LIKHA_BACKUP_KEY` only for operations needing it. Never put the key beside its backup or paste it into chat. The backup is encrypted and contains a SQLite online snapshot, coordinated artwork files, hashes, and the deletion journal. This initial adapter supports up to 512 MiB of total media; configure a tested streaming backup service before exceeding that bound.

Stop the web app and scheduled writers before taking a coordinated snapshot. In a configured private environment:

```sh
python backend/manage.py backup_site --quiesced --output /private-backups/likha-YYYY-MM-DD.fernet
python backend/manage.py restore_site /private-backups/likha-YYYY-MM-DD.fernet --destination /private-restore/new-instance --deletion-journal /data/deletions.jsonl
```

For Compose mount a restricted backup destination and pass the key from an approved secret environment, then run these management commands in the app image. Do not save the backup solely inside the same data volume. Transfer it and the latest restricted deletion journal to an independently protected off-host destination. Provisioning and validating that destination remains an operator task.

Restore writes only to a new directory, validates manifest hashes and SQLite integrity, reapplies the latest deletion journal, and clears sessions, recovery grants and pending mail. Supply the latest journal, including deletions after the backup. Verify schema compatibility, gallery bytes, ledger reconciliation, login, and counts with mail disabled before promoting. A local test restore does not establish disaster recovery on the target host.

Keep 30 days of encrypted backups pending the approved policy. Log the backup time, revision, bytes and restore result. The initial targets are RPO 24 hours and RTO 4 hours; they become commitments only after actual off-host recovery is rehearsed. Avoid restoring an old schema over a running new application. Prefer a compatible previous code artifact or a rehearsed fix-forward; use coordinated restore only with an explicit data-loss window.

## Intentional boundaries and release blockers

- SQLite is single-host local disk; do not mount its WAL on a network filesystem or create independent app replicas. Move to PostgreSQL before horizontal scaling or sustained write contention.
- HSTS is enabled for the host; subdomain coverage and browser preload are deliberately not asserted. Django checks W005/W021 are documented exceptions, not silently enabled for someone else's domain.
- CSP restricts scripts to the same origin without inline execution. Existing canvas/layout code uses dynamic styles, so `style-src 'unsafe-inline'` remains a documented compatibility exception. No remote fonts or trackers are needed.
- Passwords use Argon2, common/similarity validators and the bundled 99,999-entry weak/compromised-password lookup corpus. Optional HIBP range checks are available; see LOCAL_ENGINEERING.md for privacy, offline operation and finite-coverage limitations.
- Public sharing, teacher/classroom roles, purchases and arbitrary external image imports are intentionally outside this release. Private student artwork is not exposed to staff by default.
- School policy, Docker/HTTPS staging, off-host backup delivery/alerts and target-hardware performance are still external launch gates.

Run the full checklist in [engineering/DEPLOYMENT.md](engineering/DEPLOYMENT.md) against the deployed artifact, not just these files. Never publish an unconfigured development server as the production account system.
