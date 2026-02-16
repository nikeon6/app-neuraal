import {
  AutomationPort,
  ReminderPayload,
  EntrySummaryPayload,
  EntryTranscriptionPayload,
  AutomationResult,
} from "../ports/AutomationPort";

/**
 * Fake implementation of AutomationPort for testing.
 */
export class FakeAutomationPort implements AutomationPort {
  private sentReminderPayloads: ReminderPayload[] = [];
  private sentSummaryPayloads: EntrySummaryPayload[] = [];
  private sentTranscriptionPayloads: EntryTranscriptionPayload[] = [];
  private shouldSucceed: boolean = true;
  private statusCode: number = 200;
  private errorMessage: string = "Automation error";

  async sendReminder(payload: ReminderPayload): Promise<AutomationResult> {
    this.sentReminderPayloads.push(payload);

    if (this.shouldSucceed) {
      return { success: true, statusCode: this.statusCode };
    } else {
      return {
        success: false,
        statusCode: this.statusCode,
        error: this.errorMessage,
      };
    }
  }

  async requestEntrySummary(
    payload: EntrySummaryPayload,
  ): Promise<AutomationResult> {
    this.sentSummaryPayloads.push(payload);

    if (this.shouldSucceed) {
      return { success: true, statusCode: this.statusCode };
    } else {
      return {
        success: false,
        statusCode: this.statusCode,
        error: this.errorMessage,
      };
    }
  }

  async requestEntryTranscription(
    payload: EntryTranscriptionPayload,
  ): Promise<AutomationResult> {
    this.sentTranscriptionPayloads.push(payload);

    if (this.shouldSucceed) {
      return { success: true, statusCode: this.statusCode };
    } else {
      return {
        success: false,
        statusCode: this.statusCode,
        error: this.errorMessage,
      };
    }
  }

  // Test helpers
  setShouldSucceed(value: boolean): void {
    this.shouldSucceed = value;
  }

  setStatusCode(code: number): void {
    this.statusCode = code;
  }

  setErrorMessage(message: string): void {
    this.errorMessage = message;
  }

  // Reminder helpers
  getSentPayloads(): ReminderPayload[] {
    return [...this.sentReminderPayloads];
  }

  getLastSentPayload(): ReminderPayload | undefined {
    return this.sentReminderPayloads[this.sentReminderPayloads.length - 1];
  }

  // Summary helpers
  getSentSummaryPayloads(): EntrySummaryPayload[] {
    return [...this.sentSummaryPayloads];
  }

  getLastSentSummaryPayload(): EntrySummaryPayload | undefined {
    return this.sentSummaryPayloads[this.sentSummaryPayloads.length - 1];
  }

  // Transcription helpers
  getSentTranscriptionPayloads(): EntryTranscriptionPayload[] {
    return [...this.sentTranscriptionPayloads];
  }

  getLastSentTranscriptionPayload(): EntryTranscriptionPayload | undefined {
    return this.sentTranscriptionPayloads[
      this.sentTranscriptionPayloads.length - 1
    ];
  }

  clear(): void {
    this.sentReminderPayloads = [];
    this.sentSummaryPayloads = [];
    this.sentTranscriptionPayloads = [];
    this.shouldSucceed = true;
    this.statusCode = 200;
  }
}
