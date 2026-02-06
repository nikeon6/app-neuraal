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
}

/**
 * Payload sent to the automation service (n8n) for entry summaries.
 * Includes entry content so n8n can generate the summary without DB access.
 */
export interface EntrySummaryPayload {
  requestId: string;
  userId: string;
  entryId: string;
  callbackUrl: string;
  entryTitle: string;
  entryType: string;
  entryContent: Record<string, unknown>;
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
}
