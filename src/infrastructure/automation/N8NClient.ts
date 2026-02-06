import { createHmac } from "crypto";
import {
  AutomationPort,
  ReminderPayload,
  EntrySummaryPayload,
  AutomationResult,
} from "../../application/ports/AutomationPort";

/**
 * Configuration for N8NClient.
 */
export interface N8NClientConfig {
  reminderWebhookUrl: string;
  summaryWebhookUrl: string;
  webhookSecret: string;
  basicAuthUser?: string;
  basicAuthPassword?: string;
}

/**
 * N8N HTTP client implementing AutomationPort.
 * Sends requests to n8n webhooks with HMAC signature.
 */
export class N8NClient implements AutomationPort {
  private config: N8NClientConfig;

  constructor(config?: Partial<N8NClientConfig>) {
    this.config = {
      reminderWebhookUrl:
        config?.reminderWebhookUrl ??
        process.env.N8N_REMINDER_WEBHOOK_URL ??
        "",
      summaryWebhookUrl:
        config?.summaryWebhookUrl ??
        process.env.N8N_SUMMARY_WEBHOOK_URL ??
        "",
      webhookSecret:
        config?.webhookSecret ?? process.env.N8N_WEBHOOK_SECRET ?? "",
      basicAuthUser: config?.basicAuthUser ?? process.env.N8N_BASIC_AUTH_USER,
      basicAuthPassword:
        config?.basicAuthPassword ?? process.env.N8N_BASIC_AUTH_PASSWORD,
    };
  }

  async sendReminder(payload: ReminderPayload): Promise<AutomationResult> {
    if (!this.config.reminderWebhookUrl) {
      return { success: false, error: "N8N reminder webhook URL not configured" };
    }

    return this.sendRequest(this.config.reminderWebhookUrl, payload);
  }

  async requestEntrySummary(
    payload: EntrySummaryPayload
  ): Promise<AutomationResult> {
    if (!this.config.summaryWebhookUrl) {
      return { success: false, error: "N8N summary webhook URL not configured" };
    }

    return this.sendRequest(this.config.summaryWebhookUrl, payload);
  }

  /**
   * Sends a signed request to an n8n webhook.
   */
  private async sendRequest(
    url: string,
    payload: Record<string, unknown>
  ): Promise<AutomationResult> {
    const timestamp = Date.now().toString();
    const body = JSON.stringify(payload);
    const signature = this.createSignature(timestamp, body);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    };

    // Add basic auth if configured
    if (this.config.basicAuthUser && this.config.basicAuthPassword) {
      const credentials = Buffer.from(
        `${this.config.basicAuthUser}:${this.config.basicAuthPassword}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });

      if (response.ok) {
        return { success: true, statusCode: response.status };
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: `Network error: ${errorMessage}` };
    }
  }

  /**
   * Creates HMAC-SHA256 signature for the request.
   * Format: HMAC(secret, timestamp + "." + body)
   */
  private createSignature(timestamp: string, body: string): string {
    const message = `${timestamp}.${body}`;
    return createHmac("sha256", this.config.webhookSecret)
      .update(message)
      .digest("hex");
  }
}
