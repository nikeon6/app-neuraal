import { describe, it, expect } from "vitest";
import { extractPlainText } from "./extractPlainText";

describe("extractPlainText", () => {
  it("should extract text from a simple paragraph", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Hello world");
  });

  it("should concatenate text from multiple paragraphs", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph" }],
        },
      ],
    };

    expect(extractPlainText(content)).toBe(
      "First paragraph Second paragraph"
    );
  });

  it("should handle inline marks (bold, italic, etc)", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Normal " },
            {
              type: "text",
              marks: [{ type: "bold" }],
              text: "bold",
            },
            { type: "text", text: " text" },
          ],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Normal bold text");
  });

  it("should handle headings", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "My Heading" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Some text" }],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("My Heading Some text");
  });

  it("should handle bullet lists", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 2" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Item 1 Item 2");
  });

  it("should return empty string for null content", () => {
    expect(extractPlainText(null)).toBe("");
  });

  it("should return empty string for undefined content", () => {
    expect(extractPlainText(undefined)).toBe("");
  });

  it("should return empty string for empty object", () => {
    expect(extractPlainText({})).toBe("");
  });

  it("should return empty string for doc with no content", () => {
    expect(extractPlainText({ type: "doc" })).toBe("");
  });

  it("should handle deeply nested content", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Quoted " },
                {
                  type: "text",
                  marks: [{ type: "italic" }],
                  text: "text",
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Quoted text");
  });

  it("should handle nodes without text (e.g. images, dividers)", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Before" }],
        },
        { type: "horizontalRule" },
        {
          type: "paragraph",
          content: [{ type: "text", text: "After" }],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Before After");
  });

  it("should handle hardBreak nodes", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Line one" },
            { type: "hardBreak" },
            { type: "text", text: "Line two" },
          ],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Line one Line two");
  });

  it("should handle taskList nodes", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Done task" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Pending task" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPlainText(content)).toBe("Done task Pending task");
  });
});
