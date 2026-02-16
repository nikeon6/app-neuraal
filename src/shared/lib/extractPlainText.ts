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
  content: Record<string, unknown> | null | undefined,
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
function pushTrimmedText(texts: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    texts.push(trimmed);
  }
}

function readAttrString(node: Record<string, unknown>, key: string): unknown {
  const attrs = node.attrs as Record<string, unknown> | undefined;
  return attrs?.[key];
}

function collectChildren(content: unknown, texts: string[]): void {
  if (!Array.isArray(content)) return;
  for (const child of content) {
    if (child && typeof child === "object") {
      collectText(child as Record<string, unknown>, texts);
    }
  }
}

function collectText(node: Record<string, unknown>, texts: string[]): void {
  const nodeType = typeof node.type === "string" ? node.type : "";

  switch (nodeType) {
    case "text":
      pushTrimmedText(texts, node.text);
      return;
    case "hardBreak":
      return;
    case "codeBlock":
      collectChildren(node.content, texts);
      return;
    case "image":
    case "imageAttachment":
      pushTrimmedText(texts, readAttrString(node, "alt"));
      return;
    case "fileAttachment":
      pushTrimmedText(texts, readAttrString(node, "filename"));
      return;
    case "youtube":
      return;
    default:
      collectChildren(node.content, texts);
  }
}
