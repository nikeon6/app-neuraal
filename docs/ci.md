# Continuous Integration (GitHub Actions)

The CI workflow (`.github/workflows/ci.yml`) runs on push/PR to `main` and `develop`:

1. **Lint & Typecheck** — `pnpm lint`, `pnpm typecheck`
2. **Unit & Integration tests** — `pnpm test:run`
3. **E2E tests (Playwright)** — `pnpm test:e2e` with Postgres and Redis services

## E2E job: required configuration

The E2E job uses **repository variables and a secret** so that no credentials are stored in the workflow file.

In the repo: **Settings → Secrets and variables → Actions**:

- **Variables** (non-sensitive):
  - `CI_POSTGRES_USER` — e.g. `neuraal`
  - `CI_POSTGRES_DB` — e.g. `neuraal_test`
- **Secret** (masked in logs):
  - `CI_POSTGRES_PASSWORD` — any password for the ephemeral Postgres used only in CI

If these are not set, the E2E job will fail when starting the Postgres service.

## Running CI steps locally

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:run    # unit/integration tests
pnpm test:e2e    # requires Postgres + Redis (e.g. Docker) and env vars
```

For E2E locally, set `DATABASE_URL` and `REDIS_URL` (and optionally `AUTH_JWT_SECRET`) to match your local or test database.
