import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { HandleTranscriptionCallback } from "./HandleTranscriptionCallback";
import { InMemoryEntryRepository } from "../../test/InMemoryEntryRepository";
import { InMemoryNotificationRepository } from "../../test/InMemoryNotificationRepository";
import { InMemoryTranscriptionRequestRepository } from "../../test/InMemoryTranscriptionRequestRepository";
import { TranscriptionRequest } from "@/domain/entities/TranscriptionRequest";
import { Entry } from "@/domain/entities/Entry";

const WEBHOOK_SECRET = "test-secret-256";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=abc123";

function createTestEntry(overrides: Partial<{ id: string; userId: string }> = {}): Entry {
  const content = {
    type: "doc",
    content: [
      {
        type: "youtube",
        attrs: { src: YOUTUBE_URL, width: 640, height: 360 },
      },
    ],
  };
  const result = Entry.create({
    id: overrides.id ?? "entry-1",
    userId: overrides.userId ?? "user-1",
    date: "2024-06-15",
    type: "note",
    title: "My Video Note",
    content,
    topicId: null,
    completed: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return result.value;
}

function signPayload(
  body: string,
  timestamp: string,
  secret: string = WEBHOOK_SECRET
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

function buildInput(payload: Record<string, unknown>) {
  const rawBody = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = signPayload(rawBody, timestamp);
  return { rawBody, timestamp, signature, payload: payload as any };
}

describe("HandleTranscriptionCallback", () => {
  let entryRepo: InMemoryEntryRepository;
  let notificationRepo: InMemoryNotificationRepository;
  let transcriptionRepo: InMemoryTranscriptionRequestRepository;
  let useCase: HandleTranscriptionCallback;

  beforeEach(() => {
    entryRepo = new InMemoryEntryRepository();
    notificationRepo = new InMemoryNotificationRepository();
    transcriptionRepo = new InMemoryTranscriptionRequestRepository();

    useCase = new HandleTranscriptionCallback(
      entryRepo,
      transcriptionRepo,
      notificationRepo,
      WEBHOOK_SECRET,
      () => "notif-1"
    );
  });

  it("should process callback, inject transcription, and mark done", async () => {
    const entry = createTestEntry();
    await entryRepo.save(entry);

    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markSubmitted());

    const input = buildInput({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Hello, this is the transcription text.",
    });

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
    expect(result.value.success).toBe(true);

    // Verify request is done
    const updated = await transcriptionRepo.findById("req-1");
    expect(updated!.status.isDone()).toBe(true);

    // Verify notification was created
    const notifications = notificationRepo.getAll();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type.toString()).toBe("TRANSCRIPTION_DONE");

    // Verify transcription was injected into entry content
    const updatedEntry = await entryRepo.findById("entry-1");
    const content = updatedEntry!.content.toJSON() as any;
    const youtubeNode = content.content[0];
    expect(youtubeNode.attrs.transcription).toBe(
      "Hello, this is the transcription text."
    );
  });

  it("should return idempotent success if already processed", async () => {
    const entry = createTestEntry();
    await entryRepo.save(entry);

    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markDone());

    const input = buildInput({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Some text",
    });

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);
    expect(result.value.alreadyProcessed).toBe(true);
  });

  it("should reject invalid signature", async () => {
    const payload = {
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Some text",
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    const result = await useCase.execute({
      rawBody,
      timestamp,
      signature: "invalid-signature-0000000000000000000000000000000000000000000000000000000000000000",
      payload: payload as any,
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject expired timestamp", async () => {
    const payload = {
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Some text",
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 min ago
    const signature = signPayload(rawBody, timestamp);

    const result = await useCase.execute({
      rawBody,
      timestamp,
      signature,
      payload: payload as any,
    });

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject if request not found", async () => {
    const input = buildInput({
      requestId: "nonexistent",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Some text",
    });

    const result = await useCase.execute(input);

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should reject if userId does not match", async () => {
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markSubmitted());

    const input = buildInput({
      requestId: "req-1",
      userId: "user-hacker",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Some text",
    });

    const result = await useCase.execute(input);

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject if entryId does not match request", async () => {
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markSubmitted());

    const input = buildInput({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-wrong",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Some text",
    });

    const result = await useCase.execute(input);

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject empty transcription text", async () => {
    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markSubmitted());

    const input = buildInput({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "",
    });

    const result = await useCase.execute(input);

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("should match YouTube URLs by video ID across formats", async () => {
    // Entry has embed URL, callback sends watch URL
    const embedContent = {
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
    };
    const entryResult = Entry.create({
      id: "entry-1",
      userId: "user-1",
      date: "2024-06-15",
      type: "note",
      title: "My Video Note",
      content: embedContent,
      topicId: null,
      completed: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await entryRepo.save(entryResult.value);

    const request = TranscriptionRequest.createNew(
      "req-1",
      "user-1",
      "entry-1",
      YOUTUBE_URL // watch URL
    );
    await transcriptionRepo.save(request);
    await transcriptionRepo.update(request.markSubmitted());

    const input = buildInput({
      requestId: "req-1",
      userId: "user-1",
      entryId: "entry-1",
      youtubeUrl: YOUTUBE_URL,
      transcription: "Cross-format match text",
    });

    const result = await useCase.execute(input);

    expect(result.isOk()).toBe(true);

    // Verify transcription was injected despite different URL formats
    const updatedEntry = await entryRepo.findById("entry-1");
    const content = updatedEntry!.content.toJSON() as any;
    expect(content.content[0].attrs.transcription).toBe(
      "Cross-format match text"
    );
  });
});
