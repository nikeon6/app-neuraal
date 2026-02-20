# Neuraal – Deployment, Automatic Rollback & PostgreSQL Backups (VPS + GHCR)

This document describes the production deployment flow for **Neuraal** using:

- **GitHub Actions** (build/push image to **GHCR** and deploy via SSH)
- **Docker Compose** on the **VPS**
- A VPS-side deploy script `deploy.sh` that performs:
  - **pre-migration PostgreSQL backup**
  - **image update** (pin by commit SHA)
  - **Prisma migrations**
  - **service restart**
  - **healthcheck**
  - **automatic rollback** on failure

It also includes a **manual recovery playbook** (manual rollback and database restore).

---

## 1) High-level architecture

### Source of truth

- Your application image is built in GitHub Actions and pushed to:
  - `ghcr.io/<owner>/neuraal:<git-sha>`
  - (optionally) `ghcr.io/<owner>/neuraal:latest` for convenience

### VPS runtime

- The VPS runs `docker compose` in `/srv/neuraal`.
- The VPS keeps a pinned tag in `.env.prod`:
  - `APP_IMAGE_TAG=<git-sha>`
- The compose file references:
  - `ghcr.io/<owner>/neuraal:${APP_IMAGE_TAG}`

### Deploy safety guarantees

- Each deploy:
  1. **backs up PostgreSQL** before migrations
  2. runs migrations
  3. restarts services
  4. verifies the app via an internal health endpoint
- If healthcheck fails, it automatically:
  - rolls back to the previous known good image tag
  - restarts services
  - leaves the DB backup available for manual restore if needed

---

## 2) Preconditions / requirements

### On the VPS

- Docker + Docker Compose plugin installed
- Directory: `/srv/neuraal`
- Files present in `/srv/neuraal`:
  - `docker-compose.prod.yml`
  - `.env.prod`
  - `deploy.sh` (executable)
- Services defined in `docker-compose.prod.yml`:
  - `app`
  - `postgres`
  - `redis`
  - any additional services (caddy, n8n, minio, workers, etc.)
- Your app exposes an internal health endpoint reachable from inside the container:
  - `http://localhost:3000/api/health`
  - **If your endpoint differs**, update the healthcheck in `deploy.sh`.

### On GitHub

- Secrets configured for SSH deploy:
  - `VPS_HOST`
  - `VPS_USER`
  - `VPS_PORT`
  - `VPS_SSH_KEY` (private key without passphrase OR provide passphrase support)
- Secrets for pulling from GHCR (private packages/images):
  - `GHCR_PULL_USER`
  - `GHCR_PULL_TOKEN` (PAT with at least `read:packages`)

---

## 3) VPS file layout and key files

### 3.1 `/srv/neuraal/.env.prod`

**Must include**:

- `APP_IMAGE_TAG=<git-sha>` (the currently deployed version)
- PostgreSQL vars used by the Postgres container:
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DB`
- App env vars (DATABASE_URL, REDIS_URL, S3/MinIO, N8N, etc.)

**Example**

```env
APP_IMAGE_TAG=52109a12e47e3c728a4940026d2d899b6b1e53e9
POSTGRES_USER=neuraal
POSTGRES_PASSWORD=super_secret
POSTGRES_DB=neuraal
# ... plus the rest of your production environment
```

### 3.2 `/srv/neuraal/.last_deploy_tag` and `.last_good_tag`

- `.last_deploy_tag`: last tag attempted for deploy
- `.last_good_tag`: last tag that passed healthcheck successfully

These are maintained by `deploy.sh`.

### 3.3 `/srv/neuraal/backups/postgres/`

Backup files created automatically:

- `YYYYMMDD-HHMMSS_<tag>.dump.gz`

Retention:

- The script deletes backups older than **14 days** (adjustable).

---

## 4) Docker Compose (production) – image pinning

Your `docker-compose.prod.yml` should reference the pinned tag:

```yaml
services:
  app:
    image: ghcr.io/<owner>/neuraal:${APP_IMAGE_TAG}
    env_file: .env.prod
    # ...
```

Workers should also use the same image tag:

```yaml
worker-summaries:
  image: ghcr.io/<owner>/neuraal:${APP_IMAGE_TAG}
  env_file: .env.prod
  command: ["node", "dist/workers/summaryWorker.mjs"]
```

---

## 5) Deploy script: `deploy.sh`

### 5.1 What it does

Given a new commit SHA (tag):

1. Reads:
   - `CURRENT_TAG` from `.env.prod (APP_IMAGE_TAG=...)`
   - `LAST_GOOD_TAG` from `.last_good_tag` (if exists)
2. Creates a PostgreSQL backup **before** migrations.
3. Updates `.env.prod` to set `APP_IMAGE_TAG=<new-sha>`.
4. Pulls new images.
5. Runs `pnpm prisma migrate deploy` in the `app` container.
6. Restarts services via `docker compose up -d`.
7. Runs a healthcheck loop.
8. If healthy:
   - marks `<new-sha>` as `.last_good_tag`
9. If unhealthy:
   - rolls back to the **previous known good** tag
   - restarts services
   - prints manual restore instructions for the backup that was created

### 5.2 Running it manually on the VPS

```bash
cd /srv/neuraal
./deploy.sh <git-sha>
```

---

## 6) GitHub Actions workflow (Build → Push → Deploy)

### Typical flow

1. CI workflow runs tests.
2. If CI succeeds on `main`, the deploy workflow:
   - builds + pushes image to GHCR with tag = commit SHA
   - SSH into VPS and runs:
     - `docker login ghcr.io`
     - `./deploy.sh <git-sha>`

### Key requirement

The deploy workflow must pass the SHA to `deploy.sh`, for example:

```bash
cd /srv/neuraal
./deploy.sh "${GITHUB_SHA}"
```

---

## 7) Automatic rollback: what it can and cannot do

### What it _can_ do automatically

- Roll back the **application containers** to the previous known good image tag.

### What it _cannot_ do automatically (important)

- Roll back the **database schema/data** after migrations.

If a migration introduces breaking schema changes, rolling back the application image
may not be enough. In that case you may need to **restore the database** from the backup.

---

## 8) Manual rollback (no DB restore)

Use when:

- The new release is bad (UI broken, errors, performance regression)
- DB schema is still compatible with the previous app version

### Steps

1. Identify the last good tag:

```bash
cd /srv/neuraal
cat .last_good_tag
```

2. Set the tag in `.env.prod`:

```bash
cd /srv/neuraal
sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=$(cat .last_good_tag)/" .env.prod
```

3. Pull and restart:

```bash
cd /srv/neuraal
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
```

4. Verify health:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T app   node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

---

## 9) Manual database restore (when required)

### When should you restore the database?

Restore is a **last resort** and implies data loss since the backup time.

Restore when:

- Migrations succeeded but the new schema breaks the previous version
- Rollback image starts but fails due to missing/changed tables/columns
- Severe corruption or bad data writes occurred and you need to revert state
- You must undo a destructive migration and no forward fix is available quickly

### Choose a backup file

```bash
cd /srv/neuraal
ls -lh backups/postgres | tail -n 20
```

### Restore command (recommended pattern)

This restores the full DB from the dump and cleans existing objects:

```bash
cd /srv/neuraal
BACKUP="backups/postgres/<your-backup-file>.dump.gz"

gunzip -c "$BACKUP" | docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres   pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
```

### After restore

1. Ensure app tag is set to the correct compatible version (usually the rollback tag)
2. Restart:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
```

3. Verify health + login + core flows.

---

## 10) Incident response playbook (recommended)

### Symptoms → Action

#### A) Website shows errors (5xx) or app unhealthy after deploy

1. Check container status:

```bash
cd /srv/neuraal
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

2. Check app logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail 200 app
```

3. Check health endpoint from inside container:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T app   node -e "fetch('http://localhost:3000/api/health').then(r=>console.log(r.status)).catch(console.error)"
```

4. If rollback did not happen automatically:

- Perform **manual rollback** (Section 8)

#### B) Rollback image starts but Prisma errors / schema mismatch

- This typically indicates the DB schema is no longer compatible.
- Perform **manual DB restore** (Section 9) using the backup created during the deploy.

#### C) Data corruption or severe bad writes

- Restore from the latest clean backup (Section 9)
- Then deploy a known good image tag

---

## 11) Verification checklist (post-deploy)

- App health endpoint returns 200
- Login works
- Create/read/update entries work
- Attachments upload/download work (S3/MinIO)
- Workers are running (reminders, summaries, transcriptions)
- n8n workflows are reachable and webhooks work
- No unexpected error spikes in logs

---

## 12) Operational recommendations (strongly suggested)

1. **Offsite backups**  
   VPS backups are not enough for disaster recovery. Copy `backups/postgres/*.gz`
   to external storage (another VPS, S3, etc.).

2. **Keep migrations reversible when possible**  
   Avoid destructive migrations without a recovery plan.

3. **Alerting/monitoring**  
   Track /api/health, container restarts, and DB health.

4. **Disk space monitoring**  
   Backups + logs + volumes can fill a VPS disk quickly.

---

## 13) Quick reference (commands)

### Deploy a specific version

```bash
cd /srv/neuraal
./deploy.sh <git-sha>
```

### Show current deployed tag

```bash
cd /srv/neuraal
grep '^APP_IMAGE_TAG=' .env.prod
```

### Show last good tag

```bash
cd /srv/neuraal
cat .last_good_tag
```

### Manual rollback (no DB restore)

```bash
cd /srv/neuraal
sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=$(cat .last_good_tag)/" .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
```

### Restore DB from a backup (destructive)

```bash
cd /srv/neuraal
BACKUP="backups/postgres/<file>.dump.gz"
gunzip -c "$BACKUP" | docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres   pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
```

---

**End of document**
