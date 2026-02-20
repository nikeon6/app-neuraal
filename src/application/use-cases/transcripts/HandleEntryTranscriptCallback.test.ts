import { describe, it, expect, beforeEach } from "vitest";
import { HandleEntryTranscriptCallback } from "./HandleEntryTranscriptCallback";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { Entry } from "@/domain/entities/Entry";
import type {
  TranscriptRequestData,
  TranscriptRequestRepository,
} from "@/application/ports/TranscriptRequestRepository";

class InMemoryTranscriptRequestRepository implements TranscriptRequestRepository {
  private readonly requests = new Map<string, TranscriptRequestData>();

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
    this.requests.set(created.id, created);
    return created;
  }

  async findById(id: string): Promise<TranscriptRequestData | null> {
    return this.requests.get(id) ?? null;
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
    const current = this.requests.get(id);
    if (!current) return;
    this.requests.set(id, {
      ...current,
      status: "submitted",
      submittedAt: now,
    });
  }

  async markDone(
    id: string,
    now: Date,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const current = this.requests.get(id);
    if (!current) return;
    this.requests.set(id, {
      ...current,
      status: "done",
      doneAt: now,
      meta: meta ?? current.meta,
    });
  }

  async markFailed(
    id: string,
    now: Date,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const current = this.requests.get(id);
    if (!current) return;
    this.requests.set(id, {
      ...current,
      status: "failed",
      failedAt: now,
      meta: meta ?? current.meta,
    });
  }
}

describe("HandleEntryTranscriptCallback", () => {
  let entryRepository: InMemoryEntryRepository;
  let notificationRepository: InMemoryNotificationRepository;
  let transcriptRequestRepository: InMemoryTranscriptRequestRepository;
  let useCase: HandleEntryTranscriptCallback;

  const userId = "u-1";
  const entryId = "e-1";
  const requestId = "r-1";

  beforeEach(async () => {
    entryRepository = new InMemoryEntryRepository();
    notificationRepository = new InMemoryNotificationRepository();
    transcriptRequestRepository = new InMemoryTranscriptRequestRepository();
    useCase = new HandleEntryTranscriptCallback(
      transcriptRequestRepository,
      entryRepository,
      notificationRepository,
      () => "n-1",
    );

    const entry = Entry.create({
      id: entryId,
      userId,
      date: "2026-02-19",
      type: "task",
      title: "Test",
      content: {
        type: "doc",
        content: [
          {
            type: "youtube",
            attrs: {
              src: "https://www.youtube-nocookie.com/embed/abc123",
              width: 640,
              height: 360,
            },
          },
        ],
      },
      topicId: null,
      completed: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    if (entry.isErr()) throw new Error(entry.error);
    await entryRepository.save(entry.value);

    await transcriptRequestRepository.create({
      id: requestId,
      userId,
      entryId,
      youtubeUrl: "https://youtu.be/abc123",
      status: "submitted",
      createdAt: new Date(),
    });
  });

  it("injects transcription into YouTube node content", async () => {
    const result = await useCase.execute({
      requestId,
      userId,
      entryId,
      transcriptText: "hello transcript",
    });

    expect(result.isOk()).toBe(true);
    const updatedEntry = await entryRepository.findById(entryId);
    const json = updatedEntry?.content.toJSON() as {
      content?: Array<{ attrs?: { transcription?: string } }>;
    };
    expect(json.content?.[0]?.attrs?.transcription).toBe("hello transcript");
  });

  it("accepts legacy transcription field from callback payload", async () => {
    const result = await useCase.execute({
      requestId,
      userId,
      entryId,
      transcription: "legacy field text",
    });

    expect(result.isOk()).toBe(true);
    const updatedEntry = await entryRepository.findById(entryId);
    const json = updatedEntry?.content.toJSON() as {
      content?: Array<{ attrs?: { transcription?: string } }>;
    };
    expect(json.content?.[0]?.attrs?.transcription).toBe("legacy field text");
  });

  it("returns validation error when YouTube node is missing", async () => {
    await transcriptRequestRepository.create({
      id: "r-2",
      userId,
      entryId,
      youtubeUrl: "https://youtu.be/does-not-exist",
      status: "submitted",
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      requestId: "r-2",
      userId,
      entryId,
      transcriptText: "text",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
