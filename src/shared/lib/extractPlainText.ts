/**
 * Extracts plain text from a TipTap/ProseMirror JSON content structure.
 *
 * Recursively walks the document tree and concatenates all "text" node values,
 * separated by spaces. Ignores marks/formatting.
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

  // Recursively process child nodes
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (child && typeof child === "object") {
        collectText(child as Record<string, unknown>, texts);
      }
    }
  }
}
