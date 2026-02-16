import { Result, ok, err } from "../core/Result";
import { EntryTitle } from "../value-objects/EntryTitle";
import { EntryContent } from "../value-objects/EntryContent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for creating a Sticky entity.
 */
export interface StickyProps {
  id: string;
  userId: string;
  title: string;
  content: Record<string, unknown>;
  version: number;
  sortOrder?: number;
  /** Column index: 0 = left, 1 = right. */
  columnIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial props for updating a Sticky.
 */
export interface StickyUpdateProps {
  title?: string;
  content?: Record<string, unknown>;
  columnIndex?: number;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

/**
 * Sticky entity — a persistent note displayed in the Stickies section.
 *
 * Business rules:
 * - Title max 120 chars (reuses EntryTitle VO)
 * - Content must be a JSON object (reuses EntryContent VO)
 * - Version >= 1
 * - columnIndex must be 0 or 1
 */
export class Sticky {
  readonly id: string;
  readonly userId: string;
  readonly title: EntryTitle;
  readonly content: EntryContent;
  readonly version: number;
  readonly sortOrder: number;
  readonly columnIndex: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    title: EntryTitle,
    content: EntryContent,
    version: number,
    sortOrder: number,
    columnIndex: number,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.userId = userId;
    this.title = title;
    this.content = content;
    this.version = version;
    this.sortOrder = sortOrder;
    this.columnIndex = columnIndex;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Creates a Sticky entity from raw props.
   */
  static create(props: StickyProps): Result<Sticky, string> {
    if (!props.id || props.id.trim().length === 0) {
      return err("Sticky id cannot be empty");
    }

    if (!props.userId || props.userId.trim().length === 0) {
      return err("Sticky userId cannot be empty");
    }

    const titleResult = EntryTitle.create(props.title);
    if (titleResult.isErr()) {
      return err(titleResult.error);
    }

    const contentResult = EntryContent.create(props.content);
    if (contentResult.isErr()) {
      return err(contentResult.error);
    }

    if (props.version < 1) {
      return err("Version must be at least 1");
    }

    const col = props.columnIndex ?? 0;
    if (col !== 0 && col !== 1) {
      return err("columnIndex must be 0 or 1");
    }

    return ok(
      new Sticky(
        props.id.trim(),
        props.userId.trim(),
        titleResult.value,
        contentResult.value,
        props.version,
        props.sortOrder ?? 0,
        col,
        props.createdAt,
        props.updatedAt,
      ),
    );
  }

  /**
   * Returns a plain object representation.
   */
  toJSON(): {
    id: string;
    userId: string;
    title: string;
    content: Record<string, unknown>;
    version: number;
    sortOrder: number;
    columnIndex: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title.toString(),
      content: this.content.toJSON(),
      version: this.version,
      sortOrder: this.sortOrder,
      columnIndex: this.columnIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates a new Sticky with incremented version.
   */
  incrementVersion(): Sticky {
    return new Sticky(
      this.id,
      this.userId,
      this.title,
      this.content,
      this.version + 1,
      this.sortOrder,
      this.columnIndex,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Creates a new Sticky with updated fields.
   */
  withUpdates(updates: StickyUpdateProps): Result<Sticky, string> {
    let newTitle = this.title;
    if (updates.title !== undefined) {
      const titleResult = EntryTitle.create(updates.title);
      if (titleResult.isErr()) {
        return err(titleResult.error);
      }
      newTitle = titleResult.value;
    }

    let newContent = this.content;
    if (updates.content !== undefined) {
      const contentResult = EntryContent.create(updates.content);
      if (contentResult.isErr()) {
        return err(contentResult.error);
      }
      newContent = contentResult.value;
    }

    const newCol = updates.columnIndex ?? this.columnIndex;
    if (newCol !== 0 && newCol !== 1) {
      return err("columnIndex must be 0 or 1");
    }

    return ok(
      new Sticky(
        this.id,
        this.userId,
        newTitle,
        newContent,
        this.version,
        this.sortOrder,
        newCol,
        this.createdAt,
        new Date(),
      ),
    );
  }
}
