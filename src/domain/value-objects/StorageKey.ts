import { Result, ok, err } from "../core/Result";

const MAX_LENGTH = 1024;

/**
 * StorageKey value object.
 * Represents the key/path for object storage (S3).
 */
export class StorageKey {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Creates a StorageKey from a string.
   */
  static create(value: string): Result<StorageKey, string> {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return err("Storage key cannot be empty");
    }

    if (trimmed.length > MAX_LENGTH) {
      return err(`Storage key must be at most ${MAX_LENGTH} characters`);
    }

    return ok(new StorageKey(trimmed));
  }

  /**
   * Generates a unique storage key for a user and filename.
   */
  static generate(userId: string, filename: string): StorageKey {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `attachments/${userId}/${timestamp}-${random}-${sanitizedFilename}`;
    return new StorageKey(key);
  }

  toString(): string {
    return this.value;
  }

  equals(other: StorageKey): boolean {
    return this.value === other.value;
  }
}
