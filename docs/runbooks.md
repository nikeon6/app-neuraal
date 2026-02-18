# Operational Runbooks

## Quick Reference

| Check          | Command                                    |
| -------------- | ------------------------------------------ |
| App health     | `curl http://localhost:3000/api/health`    |
| Queue status   | Open Bull Board at `http://localhost:3001` |
| Metrics        | `curl http://localhost:3000/api/metrics`   |
| Logs (API)     | Check stdout of Next.js process            |
| Logs (workers) | Check stdout of worker processes           |

---

## Scenario: Queue is stuck (jobs not processing)

### Symptoms

- Jobs stay in "waiting" or "active" state indefinitely
- Bull Board shows growing queue size

### Steps

1. Check worker process is running: `ps aux | grep worker`
2. Check Redis connectivity: `redis-cli ping`
3. Check worker logs for errors
4. If worker crashed: restart with `pnpm worker:reminders` (or summaries/transcriptions)
5. If jobs are stuck in "active": they may be stalled. Workers auto-handle stalled jobs.
6. For truly stuck jobs: use Bull Board UI to retry or remove them

---

## Scenario: n8n is down

### Symptoms

- Summary/transcript jobs fail with connection errors
- `/api/health` shows `n8n: { ok: false }`

### Steps

1. Check n8n container: `docker ps | grep n8n`
2. Restart if needed: `docker compose restart n8n`
3. Wait for health to recover
4. Failed jobs will auto-retry (3 attempts, exponential backoff: 30s → 1m → 2m)
5. Check Bull Board for failed jobs that exhausted retries
6. Manually retry via Bull Board if needed

---

## Scenario: Ollama is down

### Symptoms

- OCR requests fail
- Auto-topic classification fails
- Topic embedding generation fails
- `/api/health` shows `ollama: { ok: false }`

### Steps

1. Check Ollama process: `docker ps | grep ollama`
2. Restart: `docker compose restart ollama`
3. Verify: `curl http://localhost:11434/api/version`
4. OCR and embedding requests are synchronous — they will fail immediately
5. Users will see error messages; no data loss

---

## Scenario: Database is down

### Symptoms

- All API requests fail
- `/api/health` returns 503 with `db: { ok: false }`

### Steps

1. Check PostgreSQL: `docker ps | grep postgres`
2. Check disk space: `df -h`
3. Check PostgreSQL logs: `docker logs neuraal-postgres`
4. Restart if needed: `docker compose restart postgres`
5. If data corruption suspected: restore from backup

### Prevention

- Regular backups: `pg_dump` daily (minimum)
- Monitor disk space
- Set up replication for production

---

## Scenario: Redis is down

### Symptoms

- Queue operations fail (enqueue/dequeue)
- Rate limiting stops working (all requests pass)
- `/api/health` shows `redis: { ok: false }`

### Steps

1. Check Redis: `docker ps | grep redis`
2. Restart: `docker compose restart redis`
3. Redis data is ephemeral (rate limit counters, concurrency locks)
4. Jobs in queues may be lost if Redis was not persisted
5. Pending BullMQ jobs need to be re-enqueued if lost

### Prevention

- Enable Redis persistence (`appendonly yes`) for production
- Monitor memory usage

---

## Scenario: S3/MinIO is down

### Symptoms

- File uploads fail (presigned URL generation fails)
- File downloads fail
- `/api/health` shows `s3: { ok: false }`

### Steps

1. Check MinIO: `docker ps | grep minio`
2. Restart: `docker compose restart minio`
3. Existing files are preserved (stored on disk)
4. Pending uploads may need to be retried by users

---

## VPS Operational Checklist

### Daily

- [ ] Check `/api/health` (automate with uptime monitor)
- [ ] Review Sentry for new errors

### Weekly

- [ ] Check disk space
- [ ] Review Bull Board for stuck/failed jobs
- [ ] Check Redis memory usage
- [ ] Review application logs for warnings

### Monthly

- [ ] Rotate logs (if not using log rotation service)
- [ ] Test database backup restoration
- [ ] Review and update dependencies (`pnpm audit`)
- [ ] Check SSL certificate expiration

### On Deploy

- [ ] Run `pnpm prisma migrate deploy`
- [ ] Restart workers
- [ ] Verify `/api/health` returns `ok`
- [ ] Smoke test critical flows (login, create entry)

---

## Optional: Prometheus + Grafana Stack

For full monitoring, deploy alongside the app:

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3002:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
```

Prometheus config:

```yaml
# monitoring/prometheus.yml
scrape_configs:
  - job_name: neuraal
    scrape_interval: 15s
    bearer_token: "${METRICS_TOKEN}"
    static_configs:
      - targets: ["app:3000"]
```
