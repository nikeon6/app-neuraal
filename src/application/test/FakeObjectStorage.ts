import type { ObjectStoragePort } from "../ports/ObjectStoragePort";

/**
 * Fake implementation of ObjectStoragePort for testing.
 * Returns predictable URLs and tracks calls.
 */
export class FakeObjectStorage implements ObjectStoragePort {
  private deletedKeys: string[] = [];

  async getPresignedPutUrl(
    storageKey: string,
    mimeType: string,
    _sizeBytes: number
  ): Promise<string> {
    return `https://fake-s3.example.com/put/${storageKey}?contentType=${encodeURIComponent(mimeType)}`;
  }

  async getPresignedGetUrl(storageKey: string): Promise<string> {
    return `https://fake-s3.example.com/get/${storageKey}`;
  }

  async deleteObject(storageKey: string): Promise<void> {
    this.deletedKeys.push(storageKey);
  }

  /**
   * Helper for tests: get all deleted keys.
   */
  getDeletedKeys(): string[] {
    return [...this.deletedKeys];
  }

  /**
   * Helper for tests: check if key was deleted.
   */
  wasDeleted(storageKey: string): boolean {
    return this.deletedKeys.includes(storageKey);
  }

  /**
   * Helper for tests: reset state.
   */
  clear(): void {
    this.deletedKeys = [];
  }
}
