import { describe, it, expect } from "vitest";
import { RequestEntryTranscript } from "./RequestEntryTranscript";
import { InMemoryNotificationRepository } from "@/application/test/InMemoryNotificationRepository";
import { FakeQueuePort } from "@/application/test/FakeQueuePort";
import { InMemoryAiUsageRepository } from "@/application/test/InMemoryAiUsageRepository";
import { FakeClock } from "@/application/test/FakeClock";
import type { TranscriptRequestData } from "@/application/ports/TranscriptRequestRepository";
import type { EntryRepository } from "@/application/ports/EntryRepository";

class InMemoryTranscriptRequestRepository {
  private readonly items = new Map<string, TranscriptRequestData>();

  async create(
    data: Omit<
      TranscriptRequestData,
      "updatedAt" | "submittedAt" | "doneAt" | "failedAt"
    >,
  ): Promise<TranscriptRequestData> {
    const created: TranscriptRequestData = {
      ...data,
      updatedAt: data.createdAt,
      submittedAt: null,
      doneAt: null,
      failedAt: null,
    };
    this.items.set(created.id, created);
    return created;
  }

  async findById(id: string): Promise<TranscriptRequestData | null> {
    return this.items.get(id) ?? null;
  }

  async findActiveByEntryId(
    _entryId: string,
  ): Promise<TranscriptRequestData | null> {
    return null;
  }

  async countActiveByUserId(_userId: string): Promise<number> {
    return 0;
  }

  async markSubmitted(id: string, now: Date): Promise<void> {
    const current = this.items.get(id);
    if (!current) return;
    this.items.set(id, { ...current, status: "submitted", submittedAt: now });
  }

  async markDone(
    id: string,
    now: Date,
    _meta?: Record<string, unknown>,
  ): Promise<void> {
    const current = this.items.get(id);
    if (!current) return;
    this.items.set(id, { ...current, status: "done", doneAt: now });
  }

  async markFailed(
    id: string,
    now: Date,
    _meta?: Record<string, unknown>,
  ): Promise<void> {
    const current = this.items.get(id);
    if (!current) return;
    this.items.set(id, { ...current, status: "failed", failedAt: now });
  }
}

function createUseCase() {
  const queue = new FakeQueuePort();
  const transcriptRepo = new InMemoryTranscriptRequestRepository();
  const entryRepository = {
    findById: async () => ({ userId: "u-1" }),
  } as unknown as EntryRepository;

  const useCase = new RequestEntryTranscript(
    entryRepository,
    new InMemoryNotificationRepository(),
    transcriptRepo,
    queue,
    new InMemoryAiUsageRepository(),
    new FakeClock(),
    () => "id-1",
  );

  return { useCase, queue };
}

describe("RequestEntryTranscript URL validation", () => {
  it("accepts youtube embed URL", async () => {
    const { useCase, queue } = createUseCase();

    const result = await useCase.execute({
      userId: "u-1",
      entryId: "e-1",
      youtubeUrl: "https://www.youtube.com/embed/abc123",
    });

    expect(result.isOk()).toBe(true);
    expect(queue.getEnqueuedTranscriptionJobs()).toHaveLength(1);
  });

  it("accepts youtube-nocookie embed URL", async () => {
    const { useCase, queue } = createUseCase();

    const result = await useCase.execute({
      userId: "u-1",
      entryId: "e-1",
      youtubeUrl: "https://www.youtube-nocookie.com/embed/abc123",
    });

    expect(result.isOk()).toBe(true);
    expect(queue.getEnqueuedTranscriptionJobs()).toHaveLength(1);
  });

  it("accepts watch and shorts URLs", async () => {
    const watch = createUseCase();
    const shorts = createUseCase();

    const watchResult = await watch.useCase.execute({
      userId: "u-1",
      entryId: "e-1",
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
    });
    const shortsResult = await shorts.useCase.execute({
      userId: "u-1",
      entryId: "e-1",
      youtubeUrl: "https://www.youtube.com/shorts/abc123",
    });

    expect(watchResult.isOk()).toBe(true);
    expect(shortsResult.isOk()).toBe(true);
  });

  it("rejects non-youtube URLs", async () => {
    const { useCase } = createUseCase();

    const result = await useCase.execute({
      userId: "u-1",
      entryId: "e-1",
      youtubeUrl: "https://example.com/video/abc123",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
