import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStoragePort } from "@/application/ports/ObjectStoragePort";
import { getS3Config } from "../config/AttachmentConfig";

// Presigned URL expiration (1 hour)
const PRESIGNED_URL_EXPIRES_IN = 3600;

/**
 * S3/R2/MinIO implementation of ObjectStoragePort.
 */
export class S3ObjectStorage implements ObjectStoragePort {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const config = getS3Config();

    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async getPresignedPutUrl(
    storageKey: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    });

    return url;
  }

  async getPresignedGetUrl(storageKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    });

    return url;
  }

  async deleteObject(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    await this.client.send(command);
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`Object not found or empty: ${storageKey}`);
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
}
