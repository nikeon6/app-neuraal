/**
 * Per-action guardrails configuration.
 */
export interface ActionGuardrailsConfig {
  rateLimitPerMinute: number;
  rateLimitPerHour: number; // 0 = disabled
  maxActivePerUser: number;
  maxActivePerEntry: number; // 0 = N/A (e.g. for whatsapp)
  maxInputChars: number; // 0 = N/A
  maxInputBytes: number; // 0 = N/A (only for OCR)
  monthlyQuotaRequests: number;
  monthlyQuotaTokens: number; // 0 = disabled
}

/**
 * AI Guardrails configuration for all actions.
 */
export interface AiGuardrailsConfig {
  summary: ActionGuardrailsConfig;
  transcriptYoutube: ActionGuardrailsConfig;
  ocrImage: ActionGuardrailsConfig;
  reminderWhatsapp: ActionGuardrailsConfig;
  /** Redis key prefix for rate limit keys */
  rateLimitPrefix: string;
}

function parseEnvInt(
  key: string,
  defaultValue: number,
  min: number = 0,
): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min) {
    console.warn(
      `Invalid value for ${key}: "${value}". Using default: ${defaultValue}`,
    );
    return defaultValue;
  }
  return parsed;
}

function parseEnvString(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) return defaultValue;
  return value.trim();
}

/**
 * Reads AI guardrails configuration from environment variables.
 */
export function getAiGuardrailsConfig(): AiGuardrailsConfig {
  return {
    summary: {
      rateLimitPerMinute: parseEnvInt("AI_SUMMARY_RATE_LIMIT_PER_MINUTE", 5, 1),
      rateLimitPerHour: parseEnvInt("AI_SUMMARY_RATE_LIMIT_PER_HOUR", 30, 0),
      maxActivePerUser: parseEnvInt("AI_SUMMARY_MAX_ACTIVE_PER_USER", 1, 1),
      maxActivePerEntry: parseEnvInt("AI_SUMMARY_MAX_ACTIVE_PER_ENTRY", 1, 0),
      maxInputChars: parseEnvInt("AI_SUMMARY_MAX_INPUT_CHARS", 12_000, 100),
      maxInputBytes: 0,
      monthlyQuotaRequests: parseEnvInt(
        "AI_SUMMARY_MONTHLY_QUOTA_REQUESTS",
        50,
        1,
      ),
      monthlyQuotaTokens: parseEnvInt("AI_SUMMARY_MONTHLY_QUOTA_TOKENS", 0, 0),
    },
    transcriptYoutube: {
      rateLimitPerMinute: parseEnvInt(
        "AI_TRANSCRIPT_RATE_LIMIT_PER_MINUTE",
        3,
        1,
      ),
      rateLimitPerHour: 0,
      maxActivePerUser: parseEnvInt("AI_TRANSCRIPT_MAX_ACTIVE_PER_USER", 1, 1),
      maxActivePerEntry: parseEnvInt(
        "AI_TRANSCRIPT_MAX_ACTIVE_PER_ENTRY",
        1,
        0,
      ),
      maxInputChars: parseEnvInt("AI_TRANSCRIPT_MAX_INPUT_CHARS", 12_000, 100),
      maxInputBytes: 0,
      monthlyQuotaRequests: parseEnvInt(
        "AI_TRANSCRIPT_MONTHLY_QUOTA_REQUESTS",
        10,
        1,
      ),
      monthlyQuotaTokens: parseEnvInt(
        "AI_TRANSCRIPT_MONTHLY_QUOTA_TOKENS",
        0,
        0,
      ),
    },
    ocrImage: {
      rateLimitPerMinute: parseEnvInt("AI_OCR_RATE_LIMIT_PER_MINUTE", 3, 1),
      rateLimitPerHour: 0,
      maxActivePerUser: parseEnvInt("AI_OCR_MAX_ACTIVE_PER_USER", 1, 1),
      maxActivePerEntry: 0,
      maxInputChars: 0,
      maxInputBytes: parseEnvInt("AI_OCR_MAX_INPUT_BYTES", 4_000_000, 1000),
      monthlyQuotaRequests: parseEnvInt(
        "AI_OCR_MONTHLY_QUOTA_REQUESTS",
        100,
        1,
      ),
      monthlyQuotaTokens: parseEnvInt("AI_OCR_MONTHLY_QUOTA_TOKENS", 0, 0),
    },
    reminderWhatsapp: {
      rateLimitPerMinute: parseEnvInt(
        "AI_WHATSAPP_RATE_LIMIT_PER_MINUTE",
        3,
        1,
      ),
      rateLimitPerHour: 0,
      maxActivePerUser: parseEnvInt("AI_WHATSAPP_MAX_ACTIVE_PER_USER", 50, 1),
      maxActivePerEntry: 0,
      maxInputChars: parseEnvInt("AI_WHATSAPP_MAX_MESSAGE_CHARS", 500, 10),
      maxInputBytes: 0,
      monthlyQuotaRequests: parseEnvInt(
        "AI_WHATSAPP_MONTHLY_QUOTA_REQUESTS",
        40,
        1,
      ),
      monthlyQuotaTokens: 0,
    },
    rateLimitPrefix: parseEnvString("AI_RATE_PREFIX", "ai:rl"),
  };
}

/**
 * Returns the ActionGuardrailsConfig for a given action string.
 */
export function getActionConfig(
  config: AiGuardrailsConfig,
  action: string,
): ActionGuardrailsConfig | null {
  switch (action) {
    case "SUMMARY":
      return config.summary;
    case "TRANSCRIPT_YOUTUBE":
      return config.transcriptYoutube;
    case "OCR_IMAGE":
      return config.ocrImage;
    case "REMINDER_WHATSAPP":
      return config.reminderWhatsapp;
    default:
      return null;
  }
}
