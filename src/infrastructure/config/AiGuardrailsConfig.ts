/**
 * AI Guardrails configuration.
 * Values are read from environment variables with validation and defaults.
 */

export interface AiGuardrailsConfig {
  /** Rate limit: max requests per minute (per user per action) */
  summaryRateLimitPerMinute: number;
  /** Rate limit: max requests per hour (0 = disabled) */
  summaryRateLimitPerHour: number;
  /** Max concurrent SUMMARY requests per user (pending + submitted) */
  summaryMaxActivePerUser: number;
  /** Max concurrent SUMMARY requests per entry */
  summaryMaxActivePerEntry: number;
  /** Max input length (chars) for summary - plain text from title + content */
  summaryMaxInputChars: number;
  /** Monthly quota: max summary requests per user per month */
  summaryMonthlyQuotaRequests: number;
  /** Monthly quota: max tokens per user per month (0 = disabled) */
  summaryMonthlyQuotaTokens: number;
  /** Redis key prefix for rate limit keys */
  rateLimitPrefix: string;
}

const DEFAULTS: AiGuardrailsConfig = {
  summaryRateLimitPerMinute: 5,
  summaryRateLimitPerHour: 30,
  summaryMaxActivePerUser: 1,
  summaryMaxActivePerEntry: 1,
  summaryMaxInputChars: 12_000,
  summaryMonthlyQuotaRequests: 100,
  summaryMonthlyQuotaTokens: 0,
  rateLimitPrefix: "ai:rl",
};

function parseEnvInt(
  key: string,
  defaultValue: number,
  min: number = 0
): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < min) {
    console.warn(
      `Invalid value for ${key}: "${value}". Using default: ${defaultValue}`
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
    summaryRateLimitPerMinute: parseEnvInt(
      "AI_SUMMARY_RATE_LIMIT_PER_MINUTE",
      DEFAULTS.summaryRateLimitPerMinute,
      1
    ),
    summaryRateLimitPerHour: parseEnvInt(
      "AI_SUMMARY_RATE_LIMIT_PER_HOUR",
      DEFAULTS.summaryRateLimitPerHour,
      0
    ),
    summaryMaxActivePerUser: parseEnvInt(
      "AI_SUMMARY_MAX_ACTIVE_PER_USER",
      DEFAULTS.summaryMaxActivePerUser,
      1
    ),
    summaryMaxActivePerEntry: parseEnvInt(
      "AI_SUMMARY_MAX_ACTIVE_PER_ENTRY",
      DEFAULTS.summaryMaxActivePerEntry,
      1
    ),
    summaryMaxInputChars: parseEnvInt(
      "AI_SUMMARY_MAX_INPUT_CHARS",
      DEFAULTS.summaryMaxInputChars,
      100
    ),
    summaryMonthlyQuotaRequests: parseEnvInt(
      "AI_SUMMARY_MONTHLY_QUOTA_REQUESTS",
      DEFAULTS.summaryMonthlyQuotaRequests,
      1
    ),
    summaryMonthlyQuotaTokens: parseEnvInt(
      "AI_SUMMARY_MONTHLY_QUOTA_TOKENS",
      DEFAULTS.summaryMonthlyQuotaTokens,
      0
    ),
    rateLimitPrefix: parseEnvString("AI_RATE_PREFIX", DEFAULTS.rateLimitPrefix),
  };
}
