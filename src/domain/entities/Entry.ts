import { Result, ok, err } from "../core/Result";
import { ISODate } from "../value-objects/ISODate";
import { EntryType } from "../value-objects/EntryType";
import { EntryTitle } from "../value-objects/EntryTitle";
import { EntryContent } from "../value-objects/EntryContent";

/**
 * Props for creating an Entry entity.
 */
export interface EntryProps {
  id: string;
  userId: string;
  date: string;
  type: "task" | "note";
  title: string;
  content: Record<string, unknown>;
  topicId: string | null;
  completed: boolean | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial props for updating an Entry.
 */
export interface EntryUpdateProps {
  title?: string;
  content?: Record<string, unknown>;
  topicId?: string | null;
  completed?: boolean;
  /** Change entry type between "task" and "note". */
  type?: "task" | "note";
}

/**
 * Entry entity representing a task or note.
 * Encapsulates business rules:
 * - Notes cannot have completed field set
 * - Version must be >= 1
 */
export class Entry {
  readonly id: string;
  readonly userId: string;
  readonly date: ISODate;
  readonly type: EntryType;
  readonly title: EntryTitle;
  readonly content: EntryContent;
  readonly topicId: string | null;
  readonly completed: boolean | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    id: string,
    userId: string,
    date: ISODate,
    type: EntryType,
    title: EntryTitle,
    content: EntryContent,
    topicId: string | null,
    completed: boolean | null,
    version: number,
    createdAt: Date,
    updatedAt: Date
  ) {
    this.id = id;
    this.userId = userId;
    this.date = date;
    this.type = type;
    this.title = title;
    this.content = content;
    this.topicId = topicId;
    this.completed = completed;
    this.version = version;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Creates an Entry entity from raw props.
   */
  static create(props: EntryProps): Result<Entry, string> {
    // Validate id
    if (!props.id || props.id.trim().length === 0) {
      return err("Entry id cannot be empty");
    }

    // Validate userId
    if (!props.userId || props.userId.trim().length === 0) {
      return err("Entry userId cannot be empty");
    }

    // Validate date
    const dateResult = ISODate.create(props.date);
    if (dateResult.isErr()) {
      return err(dateResult.error);
    }

    // Validate type
    const typeResult = EntryType.create(props.type);
    if (typeResult.isErr()) {
      return err(typeResult.error);
    }

    // Validate title
    const titleResult = EntryTitle.create(props.title);
    if (titleResult.isErr()) {
      return err(titleResult.error);
    }

    // Validate content
    const contentResult = EntryContent.create(props.content);
    if (contentResult.isErr()) {
      return err(contentResult.error);
    }

    // Validate version
    if (props.version < 1) {
      return err("Version must be at least 1");
    }

    // Business rule: notes cannot have completed set
    if (typeResult.value.isNote() && props.completed !== null) {
      return err("completed field cannot be set for notes");
    }

    return ok(
      new Entry(
        props.id.trim(),
        props.userId.trim(),
        dateResult.value,
        typeResult.value,
        titleResult.value,
        contentResult.value,
        props.topicId,
        props.completed,
        props.version,
        props.createdAt,
        props.updatedAt
      )
    );
  }

  /**
   * Returns a plain object representation.
   */
  toJSON(): {
    id: string;
    userId: string;
    date: string;
    type: string;
    title: string;
    content: Record<string, unknown>;
    topicId: string | null;
    completed: boolean | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date.toString(),
      type: this.type.toString(),
      title: this.title.toString(),
      content: this.content.toJSON(),
      topicId: this.topicId,
      completed: this.completed,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Creates a new Entry with incremented version.
   */
  incrementVersion(): Entry {
    return new Entry(
      this.id,
      this.userId,
      this.date,
      this.type,
      this.title,
      this.content,
      this.topicId,
      this.completed,
      this.version + 1,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Creates a new Entry with updated fields.
   * Returns error if updates violate business rules.
   */
  withUpdates(updates: EntryUpdateProps): Result<Entry, string> {
    // Validate title if provided
    let newTitle = this.title;
    if (updates.title !== undefined) {
      const titleResult = EntryTitle.create(updates.title);
      if (titleResult.isErr()) {
        return err(titleResult.error);
      }
      newTitle = titleResult.value;
    }

    // Validate content if provided
    let newContent = this.content;
    if (updates.content !== undefined) {
      const contentResult = EntryContent.create(updates.content);
      if (contentResult.isErr()) {
        return err(contentResult.error);
      }
      newContent = contentResult.value;
    }

    // Handle topicId (can be string or null)
    const newTopicId =
      updates.topicId !== undefined ? updates.topicId : this.topicId;

    // Handle type change
    let newType = this.type;
    if (updates.type !== undefined) {
      const typeResult = EntryType.create(updates.type);
      if (typeResult.isErr()) {
        return err(typeResult.error);
      }
      newType = typeResult.value;
    }

    // Handle completed — check against the NEW type (not the old one)
    let newCompleted = this.completed;
    if (newType.isNote()) {
      // Business rule: notes never have completed set — reset to null
      newCompleted = null;
    } else if (updates.completed !== undefined) {
      newCompleted = updates.completed;
    }

    return ok(
      new Entry(
        this.id,
        this.userId,
        this.date,
        newType,
        newTitle,
        newContent,
        newTopicId,
        newCompleted,
        this.version,
        this.createdAt,
        new Date()
      )
    );
  }
}
