import { TranscriptionRequest } from "@/domain/entities/TranscriptionRequest";
import type { TranscriptionRequestRepository } from "../ports/TranscriptionRequestRepository";

/**
 * In-memory implementation of TranscriptionRequestRepository for testing.
 */
export class InMemoryTranscriptionRequestRepository
  implements TranscriptionRequestRepository
{
  private requests: TranscriptionRequest[] = [];

  async save(request: TranscriptionRequest): Promise<void> {
    this.requests.push(request);
  }

  async findById(id: string): Promise<TranscriptionRequest | null> {
    return this.requests.find((r) => r.id === id) ?? null;
  }

  async update(request: TranscriptionRequest): Promise<void> {
    const index = this.requests.findIndex((r) => r.id === request.id);
    if (index !== -1) {
      this.requests[index] = request;
    }
  }

  async findActiveByEntryAndUrl(
    entryId: string,
    youtubeUrl: string
  ): Promise<TranscriptionRequest | null> {
    const activeRequests = this.requests.filter(
      (r) =>
        r.entryId === entryId &&
        r.youtubeUrl === youtubeUrl &&
        !r.isTerminal()
    );
    if (activeRequests.length === 0) {
      return null;
    }
    return activeRequests.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];
  }

  /** Helper for tests: clear all requests. */
  clear(): void {
    this.requests = [];
  }

  /** Helper for tests: get all requests. */
  getAll(): TranscriptionRequest[] {
    return [...this.requests];
  }
}
