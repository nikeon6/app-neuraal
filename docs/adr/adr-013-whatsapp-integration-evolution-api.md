# ADR-013: WhatsApp Integration via Evolution API

- **Status:** Deprecated
- **Date:** 2026-02-08
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — reminder delivery via WhatsApp

---

## Context

Neuraal's reminder system needed a channel to deliver time-sensitive notifications beyond in-app alerts. WhatsApp was chosen as the primary external channel due to its ubiquity and high open rates. The system needed to send reminders programmatically when BullMQ jobs fire at their scheduled time.

## Decision

Integrate **Evolution API** (self-hosted WhatsApp gateway) as the WhatsApp delivery channel, orchestrated by **n8n** workflows.

### Architecture

1. BullMQ `reminders` worker fires at `scheduledAt` time.
2. Worker sends HMAC-signed webhook to n8n.
3. n8n workflow calls Evolution API to send WhatsApp message.
4. n8n calls back to `/api/automations` endpoint with delivery result.
5. API creates a notification (success or failure) for the user.

### Docker Integration

Evolution API runs as a Docker Compose service alongside the application stack, with its own data volume and health check.

## Status: Deprecated

**This decision has been deprecated.** Evolution API uses unofficial WhatsApp Web protocols, which led to:

- **Account bans from Meta** during testing, as Meta actively detects and blocks unofficial API usage.
- **Unreliable message delivery** due to session disconnections and QR code re-authentication requirements.
- **Terms of Service violations** that make this approach unsuitable for a production/academic project.

The Evolution API service remains in `docker-compose.yml` for reference but should not be used. The reminder system continues to function with in-app notifications as the delivery channel.

## Next Steps

Evaluating **Twilio** as an alternative for WhatsApp Business API integration. Twilio provides an official, Meta-approved API that avoids the ban issues, though it introduces per-message costs and requires WhatsApp Business account approval.

## Consequences

### Original Positive (No Longer Applicable)

- Self-hosted, no per-message costs.
- Full control over the WhatsApp session.

### Negative (Reasons for Deprecation)

- Meta bans unofficial API usage; accounts get permanently banned.
- QR code re-authentication is fragile and not suitable for unattended operation.
- Violates WhatsApp Terms of Service.

## References

- `docker-compose.yml` (evolution-api service definition)
- `n8n/workflows/neuraal-send-reminder.json`
- `src/infrastructure/queue/reminderWorker.ts`
