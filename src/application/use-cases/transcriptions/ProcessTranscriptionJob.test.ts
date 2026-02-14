import { describe, it, expect, beforeEach } from "vitest";
import { ProcessTranscriptionJob } from "./ProcessTranscriptionJob";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { InMemoryTranscriptionRequestRepository } from "../../test/InMemoryTranscriptionRequestRepository";
import { FakeAutomationPort } from "../../test/FakeAutomationPort";
import { TranscriptionRequest } from "@/domain/entities/TranscriptionRequest";
import { Entry } from "@/domain/entities/Entry";

const CALLBACK_URL =
  "http://localhost:3000/api/automations/entry-transcription/callback";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=abc123";

function createTestEntry(
  overrides: Partial<{ id: string; userId: string }> = {},
): Entry {
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

describe("ProcessTranscriptionJob", () => {
  let entryRepo: InMemoryEntryRepository;
  let notificationRepo: InMemoryNotificationRepository;
  let transcriptionRepo: InMemoryTranscriptionRequestRepository;
  let automationPort: FakeAutomationPort;
  let useCase: ProcessTranscriptionJob;

  beforeEach(() => {
    entryRepo = new InMemoryEntryRepository();
    notificationRepo = new InMemoryNotificationRepository();
    transcriptionRepo = new InMemoryTranscriptionRequestRepository();
    automationPort = new FakeAutomationPort();

    useCase = new ProcessTranscriptionJob(
      entryRepo,
      transcriptionRepo,
      notificationRepo,
      automationPort,
      CALLBACK_URL,
      () => "notif-1",
    );
  });

  it("should submit request to n8n and mark as submitted", async () => {
    const entry = createTestEntry();
    await entryRepo.save(entry);

    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL,
    );
    await transcriptionRepo.save(request);

    const result = await useCase.execute({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.status).toBe("submitted");

    // Verify request status
    const updated = await transcriptionRepo.findById("req-1");
    expect(updated!.status.isSubmitted()).toBe(true);

    // Verify automation was called with correct payload
    const payloads = automationPort.getSentTranscriptionPayloads();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].youtubeUrl).toBe(YOUTUBE_URL);
    expect(payloads[0].callbackUrl).toBe(CALLBACK_URL);
  });

  it("should skip if request is not found", async () => {
    const result = await useCase.execute({
      requestId: "nonexistent",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.status).toBe("skipped");
    expect(result.value.reason).toContain("not found");
  });

  it("should skip if request is already in terminal state", async () => {
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL,
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markDone());

    const result = await useCase.execute({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.status).toBe("skipped");
    expect(result.value.reason).toContain("terminal");
  });

  it("should skip and mark failed if entry is not found", async () => {
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL,
    );
    await transcriptionRepo.save(request);

    const result = await useCase.execute({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.status).toBe("skipped");

    const updated = await transcriptionRepo.findById("req-1");
    expect(updated!.status.isFailed()).toBe(true);
  });

  it("should skip and mark failed if entry ownership does not match", async () => {
    await entryRepo.save(createTestEntry({ userId: "other-user" }));
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL,
    );
    await transcriptionRepo.save(request);

    const result = await useCase.execute({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.status).toBe("skipped");
    expect(result.value.reason).toContain("ownership");
  });

  it("should mark failed and create notification when automation fails", async () => {
    await entryRepo.save(createTestEntry());
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL,
    );
    await transcriptionRepo.save(request);

    automationPort.setShouldSucceed(false);
    automationPort.setErrorMessage("n8n unreachable");

    const result = await useCase.execute({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
    });

    expect(result.isOk()).toBe(true);
    expect(result.value.status).toBe("failed");

    const updated = await transcriptionRepo.findById("req-1");
    expect(updated!.status.isFailed()).toBe(true);

    const notifications = notificationRepo.getAll();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type.toString()).toBe("TRANSCRIPTION_FAILED");
  });
});
