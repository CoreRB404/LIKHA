# Supabase database/storage and Render hosting

The cloud target is Render for Django, Supabase PostgreSQL for records, and a **private Supabase Storage bucket** for artwork. Username/passphrase accounts stay in Django; Supabase Auth and email are not required. This guide supersedes SQLite-only cloud planning. This laptop now uses local PostgreSQL with private local media; SQLite remains for migration and isolated compatibility tests. No cloud resources were created or connected during implementation.

## Supabase setup

1. Select your Supabase project. In **Connect**, choose the PostgreSQL **session pooler**, port **5432**, and copy the URI. Use the database password, not an API key. URL-encode special characters in the password. Set the URI as Render's `DATABASE_URL`, with `?sslmode=require`. Do not use transaction-pooler port 6543 for this setup.
2. In Storage create `likha-private`, **Public disabled**. Allow `image/webp` and `application/json` (private deletion tombstones), with a 5 MiB upload limit. Do not add anonymous or browser-client access policies. Django uses a server credential and checks ownership itself.
3. Set `SUPABASE_URL` to the project origin, such as `https://YOUR-PROJECT.supabase.co`. Set `SUPABASE_SERVICE_ROLE_KEY` to the legacy **service_role JWT** from API keys. The adapter expects that server JWT, not an anon/publishable key. Never put it in JavaScript, screenshots, Git, or chat.
4. Django creates a private `likha` schema and revokes schema access from PUBLIC, anon and authenticated roles. **Keep `likha` out of Supabase Data API exposed schemas.** Do not expose Django sessions, password hashes or metadata through Supabase REST/GraphQL. Restrict database network access where supported. Django users do not use Supabase Auth's `auth.uid()`.

The database role must create the schema and apply migrations. A later separate least-privilege runtime role needs explicit private-schema table/sequence grants and staging verification.

## Render setup

Push the complete source to your private Git repository, then create a Render Blueprint using `render.yaml`. This task does not publish or deploy. The blueprint creates one web service with no Render database or disk. It selects the free plan; service sleep/startup latency and provider quotas still apply. Change plans yourself if needed.

Enter these environment settings in Render:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase session-pooler PostgreSQL URI |
| `SUPABASE_URL` | Supabase HTTPS project origin |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only legacy service_role JWT |
| `SUPABASE_STORAGE_BUCKET` | `likha-private` |
| `DJANGO_ALLOWED_HOSTS` | Optional override for custom domains; default is Render's assigned hostname |
| `LIKHA_ORIGIN` | Optional custom-domain override; defaults to HTTPS on Render's assigned hostname |
| `LIKHA_PRIVACY_CONTACT` | Real operator/institutional help contact; need not be an email |
| `LIKHA_PRIVACY_APPROVED` | `1` after the operator approves enrollment/consent and documented retention |

Render automatically supplies its assigned hostname; the app derives explicit allowed hosts and its HTTPS/CSRF origin from it. The Blueprint does not ask for these two optional overrides. Render generates stable `DJANGO_SECRET_KEY` and `LIKHA_HEALTH_TOKEN`. The blueprint sets production mode, cloud media, static output, proxy handling and a temporary working directory. `.env` files are not automatically loaded.

Build:

```sh
pip install --require-hashes -r requirements/production.txt && python deploy/render_build.py
```

Start:

```sh
python deploy/render_start.py
```

Startup checks bucket privacy, prepares the private schema, applies migrations and seeds the seven assessments, then starts Waitress on `0.0.0.0:$PORT`. Use one instance initially and do not run parallel deploys against one database. Before scaling, move migrations into an independently serialized pre-deploy job.

WhiteNoise serves collected allowlisted CSS, images, scripts, admin assets and tutorial byte ranges. Django serves private artwork only after ownership and checksum checks; browsers get no public/signed object URLs. Upload intent is committed before cloud I/O, allowing retries with the same save identifier without duplicate rewards. Upload/delete operations serialize on an account lock with bounded network timeouts.

`LIKHA_PROXY_MODE=render` reads the first client address supplied by Render. Waitress preserves forwarded headers and Django accepts the HTTPS indicator. Enable this only behind Render's controlled ingress; never expose the raw WSGI port. The earlier Compose topology uses `single` mode.

## Staging verification

- Check `/health/live` returns 200. `/health/ready` requires the private `X-Health-Token` and checks database migration access and bucket privacy; it is not a storage write test.
- Create two synthetic users; save/retry/export/delete and verify image isolation. Check all labs, patterns, tutorials/seeking, quiz rewards, avatars and pet growth.
- Restart/redeploy Render and confirm records/images persist. Confirm HTTPS cookies, no redirect loop, private-path denial and distinct rate limits from two actual client connections.
- Complete a PostgreSQL **and Storage** backup/restore drill before real student use.

This laptop's former SQLite accounts/artworks have been transferred to local PostgreSQL (see LOCAL_POSTGRES.md). Uploading that local PostgreSQL database and artwork to Supabase is still a separate, unperformed step. Other SQLite installations are **not automatically transferred**. Preserve the old data and encrypted backup. A populated transfer needs a maintenance window, reviewed ORM export/import excluding sessions, private-media upload with checksum verification, reward reconciliation and before/after counts. Never delete the old files before verifying transfer.

## Backups and deletion

`backup_site` / `restore_site` refuse PostgreSQL or cloud media: their encrypted SQLite archive is not a Supabase backup. Use Supabase database backups/PITR where available, or a supported `pg_dump`/`pg_restore` workflow for the private `likha` schema. Protect credentials and encrypt off-host copies. No paid backup service was purchased.

Database backups **do not contain Storage bytes**. Back up the bucket separately with checksums. Account deletion writes a restricted `deletions/USER_UUID.json` tombstone before removing records/images. Keep those tombstones with backups. Before reopening a restored site, replay all later tombstones against restored accounts and listed objects, revoke restored sessions, and run `check_storage` / `reconcile_rewards` plus ownership checks. Database-only restoration is insufficient; cloud restoration is not yet verified.

Maintain the documented maximum 30-day backup/log retention. Retain tombstones until every backup they cover has expired. `reconcile_storage` recovers pending cloud rows with complete images and reports missing/corrupt images. Missing pending uploads require the user's retry or reviewed support recovery. Remote orphan cleanup requires a reviewed bucket inventory; it does not automatically sweep objects.

## Evidence and limits

Locally passed: 58 SQLite backend tests; 52 tests on isolated PostgreSQL 17 including populated migrations and concurrency; mocked Storage save/retry/integrity/export/delete/transport failures; Render production build, static/admin CSS, tutorial byte ranges, private-path denial and liveness. PostgreSQL testing uses a disposable loopback cluster; production requires TLS. The pinned runtime audit found no known vulnerabilities at this check.

Not verified: your Supabase credentials/network/pooler, real Storage calls, public Render HTTPS, provider limits, cloud backups/restoration and operational retention. Local tests do not prove the live deployment is complete.

Official references: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Storage access](https://supabase.com/docs/guides/storage/security/access-control), [Render Django](https://render.com/docs/deploy-django), [Render blueprint](https://render.com/docs/blueprint-spec), [WhiteNoise](https://whitenoise.readthedocs.io/en/stable/django.html).
