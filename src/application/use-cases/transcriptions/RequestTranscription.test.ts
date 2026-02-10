import { describe, it, expect, beforeEach } from "vitest";
import { RequestTranscription } from "./RequestTranscription";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { InMemoryTranscriptionRequestRepository } from "../../test/InMemoryTranscriptionRequestRepository";
import { FakeQueuePort } from "../../test/FakeQueuePort";
import { Entry } from "@/domain/entities/Entry";

function createTestEntry(overrides: Partial<{ id: string; userId: string }> = {}): Entry {
  const result = Entry.create({
    id: overrides.id ?? "entry-1",
    userId: overrides.userId ?? "user-1",
    date: "2024-06-15",
    type: "note",
    title: "My Note",
    content: { type: "doc", content: [] },
    topicId: null,
    completed: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.value;
}

describe("RequestTranscription", () => {
  let entryRepo: InMemoryEntryRepository;
  let notificationRepo: InMemoryNotificationRepository;
  let transcriptionRepo: InMemoryTranscriptionRequestRepository;
  let queuePort: FakeQueuePort;
  let useCase: RequestTranscription;

  const youtubeUrl = "https://www.youtube.com/watch?v=abc123";

  beforeEach(() => {
    entryRepo = new InMemoryEntryRepository();
    notificationRepo = new InMemoryNotificationRepository();
    transcriptionRepo = new InMemoryTranscriptionRequestRepository();
    queuePort = new FakeQueuePort();

    useCase = new RequestTranscription(
      entryRepo,
      notificationRepo,
      transcriptionRepo,
      queuePort,
      () => "req-1",
      () => "notif-1"
    );
  });

  it("should create transcription request and enqueue job", async () => {
    await entryRepo.save(createTestEntry());

    const result = await useCase.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.requestId).toBe("req-1");
    expect(result.value.notificationId).toBe("notif-1");

    // Check request was saved
    const requests = transcriptionRepo.getAll();
    expect(requests).toHaveLength(1);
    expect(requests[0].status.isPending()).toBe(true);
    expect(requests[0].youtubeUrl).toBe(youtubeUrl);

    // Check notification was created
    const notifications = notificationRepo.getAll();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type.toString()).toBe("TRANSCRIPTION_IN_PROGRESS");

    // Check job was enqueued
    const jobs = queuePort.getEnqueuedTranscriptionJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].requestId).toBe("req-1");
    expect(jobs[0].youtubeUrl).toBe(youtubeUrl);
  });

  it("should return NOT_FOUND if entry does not exist", async () => {
    const result = await useCase.execute({
      userId: "user-1",
      entryId: "nonexistent",
      youtubeUrl,
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND if entry belongs to another user", async () => {
    await entryRepo.save(createTestEntry({ userId: "other-user" }));

    const result = await useCase.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl,
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return CONFLICT if there is already an active request for the same video", async () => {
    await entryRepo.save(createTestEntry());

    // First request succeeds
    const first = await useCase.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl,
    });
    expect(first.isOk()).toBe(true);

    // Second request for same video conflicts
    const second = await useCase.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl,
    });

    expect(second.isErr()).toBe(true);
    expect(second.error.code).toBe("CONFLICT");
  });

  it("should return VALIDATION_ERROR if youtubeUrl is empty", async () => {
    await entryRepo.save(createTestEntry());

    const result = await useCase.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: "",
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("should allow a new request after previous one is done", async () => {
    await entryRepo.save(createTestEntry());

    // First request
    await useCase.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl,
    });

    // Mark it as done
    const requests = transcriptionRepo.getAll();
    await transcriptionRepo.update(requests[0].markDone());

    // New use case instance with different IDs
    const useCase2 = new RequestTranscription(
      entryRepo,
      notificationRepo,
      transcriptionRepo,
      queuePort,
      () => "req-2",
      () => "notif-2"
    );

    const result = await useCase2.execute({
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.requestId).toBe("req-2");
  });
});
