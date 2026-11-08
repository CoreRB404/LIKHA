# LIKHA engineering handbook

Cloud target update: [Supabase + Render](../SUPABASE_RENDER.md) supersedes SQLite-only cloud planning in this handbook. Local accounts now use PostgreSQL; SQLite remains legacy migration/test support. Live service configuration is still pending.

Status: handbook created 2026-11-08; a Django + SQLite implementation is now available under `backend/` and verified locally. Public deployment remains unconfigured. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [local setup](../RUN_HOSTED.md) and [deployment runbook](../DEPLOY_HOSTED.md).

The goal is to turn LIKHA into an account-based website with signup, login, private saved artwork, consistent progress across devices, SQLite persistence, and a verifiable production deployment. Preserve the current working art experience during that conversion.

Account policy update: username/password signup and immediate login now replace the earlier email-verification/recovery plan. See [AUTHENTICATION.md](AUTHENTICATION.md). No email service is required.

See [local engineering improvements and verification](../LOCAL_ENGINEERING.md) for current accessibility, browser-engine, failure-recovery and security checks.

## Start here

Give an implementation agent [MASTER_PROMPT.md](MASTER_PROMPT.md), which references the rest of this handbook. Follow the phases in order and record evidence in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Read [CURRENT_SYSTEM.md](CURRENT_SYSTEM.md) before assuming any account or server features already exist.

| Document | Purpose |
| --- | --- |
| [MASTER_PROMPT.md](MASTER_PROMPT.md) | Copyable engineering assignment and execution rules |
| [CURRENT_SYSTEM.md](CURRENT_SYSTEM.md) | Actual files, state, risks, and behavior to preserve |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | User flows, scope, roles, and acceptance criteria |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Target modules, deployment boundary, and decision rationale |
| [DATABASE.md](DATABASE.md) | Models, constraints, transactions, and SQLite operations |
| [AUTHENTICATION.md](AUTHENTICATION.md) | Signup, login, sessions, recovery, and abuse controls |
| [API_CONTRACT.md](API_CONTRACT.md) | Endpoints, validation, errors, and retry behavior |
| [SECURITY.md](SECURITY.md) | Threat model, authorization, headers, and verification |
| [MEDIA_AND_PRIVACY.md](MEDIA_AND_PRIVACY.md) | Private artwork, uploads, student privacy, deletion |
| [FRONTEND_MIGRATION.md](FRONTEND_MIGRATION.md) | Server integration and offline separation |
| [PROGRESS_AND_REWARDS.md](PROGRESS_AND_REWARDS.md) | Authoritative grading, stars, pet growth, and concurrency |
| [TESTING.md](TESTING.md) | Functional, negative, security, and regression tests |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local, staging, HTTPS production, and release gates |
| [OPERATIONS.md](OPERATIONS.md) | Backups, restore, monitoring, and incident response |
| [DELIVERY_PLAN.md](DELIVERY_PLAN.md) | Phased work and copyable phase prompts |
| [DECISIONS.md](DECISIONS.md) | Proposed decisions and unresolved product choices |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Honest readiness and evidence register |
| [REFERENCES.md](REFERENCES.md) | Official technical and security references |

## Default scope

The implementation uses a same-origin Django application, SQLite on persistent local disk, private artwork storage and the existing canvas/frontend. Linux/HTTPS proxy deployment files are supplied, but not run against a public host. Remaining proposed policies and requirements are distinguished from measured evidence in the status register.

Public visitors need only a browser after deployment. Python installation is required on the developer/server environment, not on every student's laptop. The portable ZIP remains a separate demo with browser-only saves and no real accounts.

Privacy rules for the actual audience and institution, hosting credentials, domain, and operational setup must be settled before public launch. Continue local implementation with safe defaults while those decisions are pending.
