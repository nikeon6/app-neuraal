import type { ObjectStoragePort } from "../ports/ObjectStoragePort";

/**
 * Fake implementation of ObjectStoragePort for testing.
 * Returns predictable URLs and tracks calls.
 */
export class FakeObjectStorage implements ObjectStoragePort {
  private deletedKeys: string[] = [];
  private storedObjects = new Map<string, Buffer>();

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
    this.storedObjects.delete(storageKey);
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const buf = this.storedObjects.get(storageKey);
    if (!buf) {
      throw new Error(`Object not found: ${storageKey}`);
    }
    return buf;
  }

  /**
   * Helper for tests: store an object.
   */
  putObject(storageKey: string, data: Buffer): void {
    this.storedObjects.set(storageKey, data);
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
    this.storedObjects.clear();
  }
}
