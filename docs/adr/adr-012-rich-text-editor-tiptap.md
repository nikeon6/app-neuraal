# ADR-012: Rich Text Editor — TipTap 3

- **Status:** Accepted
- **Date:** 2026-02-05
- **Deciders:** Project maintainer(s)
- **Technical Story:** Neuraal (TFM) — entry content editing experience

---

## Context

Neuraal entries (tasks and notes) need a rich text editing experience that supports formatted text, code blocks, embedded media (YouTube videos, images), and file attachments. The editor must integrate with React, support custom extensions, and store content in a serializable format suitable for server-side processing (AI summaries, search).

## Decision

Use **TipTap 3** (ProseMirror-based) as the rich text editor with custom extensions.

### Content Storage

Entry content is stored as **JSON** (ProseMirror document format) in the `entries.content` column (Prisma `Json` type). This enables:

- Structured traversal for AI text extraction.
- Lossless round-trip editing.
- No HTML sanitization concerns for stored content.

### Custom Extensions

| Extension                  | Purpose                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `YoutubeEmbed`             | Embeds YouTube videos with custom rendering; extracts URLs for transcription. |
| `ImageAttachment`          | Displays inline images from S3 presigned URLs with lazy loading.              |
| `FileAttachment`           | Displays file attachment chips with download links.                           |
| `CodeBlockWithLineNumbers` | Code blocks with syntax highlighting line numbers.                            |

### Integration

- TipTap editor wrapped in `MinimalTiptapEditor` component (`src/shared/ui/`).
- Editor state managed locally within `TaskEditor` feature.
- Content synced to API on blur/save (not on every keystroke).
- Plain text extraction utility (`extractPlainText`) for AI processing and search.

## Consequences

### Positive

- ProseMirror foundation provides robust, well-tested editing primitives.
- JSON storage avoids HTML injection risks and enables structured content processing.
- Custom extensions allow tight integration with the attachment and transcription systems.
- Active ecosystem with TypeScript support.

### Negative / Trade-offs

- TipTap adds significant bundle size (~150KB gzipped with extensions).
- Custom extensions require understanding ProseMirror's node/mark system.
- JSON content format is opaque without a rendering layer.

## Alternatives Considered

1. **Lexical (Meta)** — Considered; less mature extension ecosystem at the time of evaluation.
2. **Slate.js** — Considered; more low-level, requires more custom work for basic features.
3. **Plain textarea + markdown** — Rejected; insufficient for embedded media and file attachments.

## References

- `src/features/task-editor/extensions/`
- `src/shared/ui/MinimalTiptapEditor.tsx`
- `src/shared/lib/extractPlainText.ts`
