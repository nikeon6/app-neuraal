/**
 * Port (interface) for Object Storage (S3/R2/MinIO).
 */
export interface ObjectStoragePort {
  /**
   * Generates a presigned URL for uploading a file.
   * @param storageKey The key/path where the file will be stored
   * @param mimeType The content type of the file
   * @param sizeBytes The expected size of the file
   * @returns Presigned PUT URL
   */
  getPresignedPutUrl(
    storageKey: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<string>;

  /**
   * Generates a presigned URL for downloading a file.
   * @param storageKey The key/path of the file
   * @returns Presigned GET URL
   */
  getPresignedGetUrl(storageKey: string): Promise<string>;

  /**
   * Deletes an object from storage.
   * @param storageKey The key/path of the file to delete
   */
  deleteObject(storageKey: string): Promise<void>;

  /**
   * Downloads an object's raw bytes from storage.
   * @param storageKey The key/path of the file to download
   * @returns Buffer with the file contents
   */
  getObjectBuffer(storageKey: string): Promise<Buffer>;
}
