# ADR-007: Hybrid Persistence: Postgres (source of truth) + S3-Compatible Object Storage

- **Status:** Proposed
- **Date:** 2026-01-28
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — architecture decision

---


## Context

Neuraal needs to persist:
- Relational application data (users, tasks/topics, schedules, AI jobs)
- Binary objects (attachments such as images and documents)

Relational data fits Postgres; binary objects are better handled by an object store.
The deployment model is “hybrid”: core services are **self-hosted** on a VPS (e.g., Postgres), while object storage may be either self-hosted or external.

## Decision

1. Use **Postgres** as the **source of truth** for all application entities.
2. Use **S3-compatible object storage** for attachments:
   - Production: external S3 provider (e.g., AWS S3 / Cloudflare R2) *or* self-hosted S3-compatible storage.
   - Development: **MinIO** (S3-compatible) via Docker Compose.
3. Store **only metadata** about objects in Postgres (never the binary itself), including:
   - `ownerId`
   - `bucket`
   - `key`
   - `mimeType`
   - `sizeBytes`
   - `createdAt`
   - optional `etag` / checksum

Access pattern:
- Use **pre-signed URLs** for uploads/downloads where possible.
- Enforce authorization before issuing pre-signed URLs.

## Consequences

### Positive
- Postgres remains clean and efficient for relational queries.
- Object storage scales for large files and reduces load on the app server.
- S3 compatibility allows flexible hosting (AWS/R2/MinIO) with minimal code changes.

### Negative / Trade-offs
- Adds an external dependency (object store) and its credentials/permissions.
- Requires lifecycle management (delete/GC, retention).

## Alternatives Considered

1. Store files in Postgres (bytea)
   - Rejected: operationally heavy and less scalable.
2. Store files on VPS filesystem
   - Considered: simple, but increases backup/HA complexity and can become brittle as volume grows.

## Implementation Notes

- Use a service abstraction (e.g., `ObjectStorage` port) so swapping providers is painless.
- Implement background cleanup jobs for orphaned objects.
- Consider virus scanning for uploads if the threat model requires it.
