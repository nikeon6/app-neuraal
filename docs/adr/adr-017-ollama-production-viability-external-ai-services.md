# ADR-017: Ollama Production Viability — Local vs External AI Services

- **Status:** Accepted
- **Date:** 2026-02-23
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — evaluating AI inference deployment strategy for production

---

## Context

Neuraal uses **Ollama** as its local AI inference engine for two features:

1. **Embeddings** (auto-topic classification): `qwen3-embedding:latest` — synchronous, ~4096-dim vectors.
2. **OCR** (image text extraction): `glm-ocr:q8_0` — synchronous, vision model.

The original design decision (ADR-009) chose Ollama for privacy, zero API cost, and offline capability. During development on a machine with a dedicated GPU (NVIDIA), Ollama performs well: embedding generation is sub-second and OCR completes in 1–3 seconds.

However, testing on a **production VPS** (typical cloud instance without GPU) revealed critical performance problems.

### Observed behavior on CPU-only VPS

| Operation                   | GPU workstation            | CPU-only VPS (4 vCPU)                              |
| --------------------------- | -------------------------- | -------------------------------------------------- |
| Embedding (qwen3-embedding) | ~200–500 ms                | ~1-2 s                                             |
| OCR (glm-ocr:q8_0)          | ~1–3 s                     | ~30–90 s                                           |
| CPU usage during inference  | Offloaded to GPU           | **100% across all cores**                          |
| Concurrent requests         | Handled by GPU parallelism | Queue behind single inference, compounding latency |

On a CPU-only server, Ollama inference **saturates all CPU cores**

### GPU-enabled VPS cost analysis

Cloud GPU instances that could run these models acceptably:

| Provider | GPU instance       | Monthly cost |
| -------- | ------------------ | ------------ |
| Hetzner  | CCX33 + GPU        | ~€150–300/mo |
| AWS      | g4dn.xlarge        | ~$526/mo     |
| GCP      | n1-standard-4 + T4 | ~$450/mo     |

Compared to the current VPS cost (~€10–20/mo for a CPU-only instance), adding GPU capability **multiplies infrastructure cost by 15–30x** — unjustifiable for the scale of this project.

### External API cost comparison

Using external embedding and vision APIs for the same workload:

| Service                         | Operation | Cost estimate              |
| ------------------------------- | --------- | -------------------------- |
| OpenAI `text-embedding-3-small` | Embedding | ~$0.02 per 1M tokens       |
| OpenAI `gpt-4o-mini` (vision)   | OCR       | ~$0.15 per 1M input tokens |
| Cohere `embed-v4`               | Embedding | Free tier: 1000 req/mo     |

For a single-user or small-team app, external API costs would be **< $1/month** — negligible compared to GPU server costs.

## Decision

### For production

The recommended production architecture replaces synchronous Ollama calls with **asynchronous worker + n8n workflows** using external AI services:

```
Embeddings:  API → BullMQ queue → Worker → n8n → External API → Callback → DB
OCR:         API → BullMQ queue → Worker → n8n → External API → Callback → DB + Notification
```

This follows the same proven pattern already used for summaries and transcriptions (ADR-008). Benefits:

- No GPU infrastructure required.
- CPU-only VPS remains responsive.
- External API costs are minimal at this scale.
- Consistent async architecture across all AI features.
- LangSmith observability applies uniformly to all AI operations via n8n.

### For development and TFM demonstration

Ollama remains the **default local development** option. The current synchronous implementation is preserved because:

- It demonstrates that a fully local, privacy-respecting AI stack is technically viable.
- It showcases the ability to run inference without external dependencies.
- It is a core part of the TFM research contribution (exploring local LLM deployment).
- Development machines with GPU handle it without issues.

### Configuration strategy

The system should support both modes via environment configuration:

| Feature        | Development (Ollama)                   | Production (External)              |
| -------------- | -------------------------------------- | ---------------------------------- |
| Embeddings     | Synchronous, `OllamaEmbeddingProvider` | Async worker → n8n → OpenAI/Cohere |
| OCR            | Synchronous, `OllamaVisionProvider`    | Async worker → n8n → OpenAI Vision |
| Summaries      | Already async (n8n)                    | Same                               |
| Transcriptions | Already async (n8n)                    | Same                               |

The provider interface pattern (ports in Application layer, implementations in Infrastructure) already supports swapping providers without touching business logic.

## Consequences

### Positive

- Production VPS remains affordable (~€10–20/mo) and responsive.
- All AI features converge on the same async worker + n8n pattern.
- External API costs are predictable and minimal at this scale.
- The guardrails system (ADR-011) applies equally to both local and external providers.
- Local Ollama option preserved for experimentation, demos, and privacy-sensitive deployments.

### Negative / Trade-offs

- Production deployments depend on external API availability.
- Embedding dimensions may differ between Ollama and external models (requires re-embedding topics on provider switch).
- Two code paths to maintain (local + external), mitigated by the port/adapter pattern.

## Alternatives Considered

1. **Keep Ollama in production with CPU-only server**
   - Rejected: unacceptable latency, CPU saturation, poor user experience.
2. **Rent a GPU-enabled VPS**
   - Rejected: 15–30x cost increase for marginal benefit at this scale.
3. **Use a dedicated inference service (Replicate, Together.ai, HuggingFace Inference)**
   - Viable alternative to direct OpenAI/Cohere calls; could be explored if more model control is needed.
4. **Remove AI features from production entirely**
   - Rejected: the features add significant product value and differentiation.

## References

- ADR-008: Automation & Async Workflows (n8n + BullMQ)
- ADR-009: pgvector Embeddings for Auto-Topic Classification
- ADR-011: AI Guardrails and Usage Tracking
- `src/infrastructure/embedding/OllamaEmbeddingProvider.ts`
- `src/infrastructure/ocr/OllamaVisionProvider.ts`
- `src/application/ports/EmbeddingProviderPort.ts`
