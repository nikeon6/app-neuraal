export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

let cachedConfig: EmailConfig | null = null;

/**
 * Reads email configuration from environment variables.
 *
 * Required env vars:
 *   SMTP_HOST       — SMTP server hostname (e.g. smtp.gmail.com, smtp.resend.com)
 *   SMTP_PORT       — SMTP port (465 for TLS, 587 for STARTTLS)
 *   SMTP_SECURE     — "true" for port 465/TLS, "false" for STARTTLS
 *   SMTP_USER       — SMTP username (often the email address itself)
 *   SMTP_PASSWORD   — SMTP password or app-specific password
 *   SMTP_FROM_ADDRESS — Sender email (e.g. noreply@neuraal.app)
 *   SMTP_FROM_NAME  — Sender display name (e.g. "Neuraal")
 */
export function getEmailConfig(): EmailConfig {
  if (cachedConfig) return cachedConfig;

  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST is required");

  const portStr = process.env.SMTP_PORT ?? "587";
  const port = Number.parseInt(portStr, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive integer");
  }

  const secure = process.env.SMTP_SECURE === "true";

  const user = process.env.SMTP_USER;
  if (!user) throw new Error("SMTP_USER is required");

  const password = process.env.SMTP_PASSWORD;
  if (!password) throw new Error("SMTP_PASSWORD is required");

  const fromAddress = process.env.SMTP_FROM_ADDRESS;
  if (!fromAddress) throw new Error("SMTP_FROM_ADDRESS is required");

  const fromName = process.env.SMTP_FROM_NAME ?? "Neuraal";

  cachedConfig = { host, port, secure, user, password, fromAddress, fromName };
  return cachedConfig;
}

export function clearEmailConfigCache(): void {
  cachedConfig = null;
}
