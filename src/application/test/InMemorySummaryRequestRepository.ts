import { EntrySummaryRequest } from "@/domain/entities/EntrySummaryRequest";
import type { SummaryRequestRepository } from "../ports/SummaryRequestRepository";

/**
 * In-memory implementation of SummaryRequestRepository for testing.
 */
export class InMemorySummaryRequestRepository implements SummaryRequestRepository {
  private requests: EntrySummaryRequest[] = [];

  async save(request: EntrySummaryRequest): Promise<void> {
    this.requests.push(request);
  }

  async findById(id: string): Promise<EntrySummaryRequest | null> {
    return this.requests.find((r) => r.id === id) ?? null;
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<EntrySummaryRequest | null> {
    return (
      this.requests.find((r) => r.id === id && r.userId === userId) ?? null
    );
  }

  async update(request: EntrySummaryRequest): Promise<void> {
    const index = this.requests.findIndex((r) => r.id === request.id);
    if (index !== -1) {
      this.requests[index] = request;
    }
  }

  async findActiveByEntryId(
    entryId: string,
  ): Promise<EntrySummaryRequest | null> {
    const activeRequests = this.requests.filter(
      (r) => r.entryId === entryId && !r.isTerminal(),
    );
    if (activeRequests.length === 0) return null;
    return activeRequests.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return this.requests.filter((r) => r.userId === userId && !r.isTerminal())
      .length;
  }

  /**
   * Helper for tests: clear all requests.
   */
  clear(): void {
    this.requests = [];
  }

  /**
   * Helper for tests: get all requests.
   */
  getAll(): EntrySummaryRequest[] {
    return [...this.requests];
  }
}
