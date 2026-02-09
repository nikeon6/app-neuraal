/**
 * Extracts plain text from a TipTap/ProseMirror JSON content structure.
 *
 * Recursively walks the document tree and concatenates all "text" node values,
 * separated by spaces. Also extracts text from code blocks, headings,
 * and custom nodes (imageAttachment captions, fileAttachment filenames).
 *
 * @param content - The TipTap/ProseMirror JSON content (or null/undefined)
 * @returns Plain text string
 */
export function extractPlainText(
  content: Record<string, unknown> | null | undefined
): string {
  if (!content || typeof content !== "object") {
    return "";
  }

  const texts: string[] = [];
  collectText(content, texts);
  return texts.join(" ").trim();
}

/**
 * Recursively collects text from TipTap/ProseMirror nodes.
 */
function collectText(
  node: Record<string, unknown>,
  texts: string[]
): void {
  // If this is a text node, extract the text
  if (node.type === "text" && typeof node.text === "string") {
    const trimmed = node.text.trim();
    if (trimmed.length > 0) {
      texts.push(trimmed);
    }
    return;
  }

  // If this is a hardBreak, add a space separator (handled by join)
  if (node.type === "hardBreak") {
    return;
  }

  // Heading nodes — their content is recursed normally, but tag them for context
  // (the child text nodes will be collected by the recursion below)

  // Code block — extract text content from code
  if (node.type === "codeBlock") {
    // Code blocks have text children — recurse normally
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child && typeof child === "object") {
          collectText(child as Record<string, unknown>, texts);
        }
      }
    }
    return;
  }

  // Image node — extract alt text if present
  if (node.type === "image" || node.type === "imageAttachment") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (attrs?.alt && typeof attrs.alt === "string") {
      const trimmed = attrs.alt.trim();
      if (trimmed.length > 0) {
        texts.push(trimmed);
      }
    }
    return;
  }

  // File attachment node — extract filename
  if (node.type === "fileAttachment") {
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (attrs?.filename && typeof attrs.filename === "string") {
      const trimmed = attrs.filename.trim();
      if (trimmed.length > 0) {
        texts.push(trimmed);
      }
    }
    return;
  }

  // YouTube node — skip (no meaningful text)
  if (node.type === "youtube") {
    return;
  }

  // Recursively process child nodes
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (child && typeof child === "object") {
        collectText(child as Record<string, unknown>, texts);
      }
    }
  }
}
