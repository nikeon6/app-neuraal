/**
 * Payload sent to the automation service (n8n) for reminders.
 */
export interface ReminderPayload {
  reminderId: string;
  userId: string;
  entryId: string;
  scheduledAt: string;
  channel: string;
  message: string | null;
  entryTitle: string;
  entrySummary: string | null;
}

/**
 * Payload sent to the automation service (n8n) for entry summaries.
 * When plainTextForSummary is set (e.g. truncated input), n8n uses it instead of entry content.
 */
export interface EntrySummaryPayload {
  requestId: string;
  userId: string;
  entryId: string;
  callbackUrl: string;
  entryTitle: string;
  entryType: string;
  entryContent: Record<string, unknown>;
  /** When set, use this text for summary instead of extracting from entryContent. */
  plainTextForSummary?: string;
}

/**
 * Result of sending a request to automation service.
 */
export interface AutomationResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Payload sent to the automation service (n8n) for entry transcriptions.
 * Includes the YouTube URL so n8n can call the external transcription API.
 */
export interface EntryTranscriptionPayload {
  requestId: string;
  userId: string;
  entryId: string;
  youtubeUrl: string;
  callbackUrl: string;
  entryTitle: string;
}

/**
 * Port for automation service (n8n) operations.
 */
export interface AutomationPort {
  /**
   * Sends a reminder notification request to the automation service.
   * Handles HMAC signing and optional basic auth.
   */
  sendReminder(payload: ReminderPayload): Promise<AutomationResult>;

  /**
   * Sends an entry summary request to the automation service.
   * n8n will process the request and POST the result to the callbackUrl.
   * Handles HMAC signing and optional basic auth.
   */
  requestEntrySummary(payload: EntrySummaryPayload): Promise<AutomationResult>;

  /**
   * Sends a transcription request to the automation service.
   * n8n will call an external API and POST the result to the callbackUrl.
   * Handles HMAC signing and optional basic auth.
   */
  requestEntryTranscription(
    payload: EntryTranscriptionPayload,
  ): Promise<AutomationResult>;
}
