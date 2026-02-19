export interface AuthConfig {
  jwtSecret: string;
  accessTtlSeconds: number;
  refreshTtlDays: number;
  cookieSecure: boolean;
  cookieSameSite: "lax" | "strict" | "none";
  resetTtlMinutes: number;
  verificationTtlHours: number;
}

let cachedConfig: AuthConfig | null = null;

export function getAuthConfig(): AuthConfig {
  if (cachedConfig) return cachedConfig;

  const jwtSecret = process.env.AUTH_JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("AUTH_JWT_SECRET must be set and at least 32 characters");
  }

  const accessTtlSeconds = parseInt(
    process.env.AUTH_ACCESS_TTL_SECONDS || "900",
    10,
  );
  if (isNaN(accessTtlSeconds) || accessTtlSeconds <= 0) {
    throw new Error("AUTH_ACCESS_TTL_SECONDS must be a positive integer");
  }

  const refreshTtlDays = parseInt(
    process.env.AUTH_REFRESH_TTL_DAYS || "30",
    10,
  );
  if (isNaN(refreshTtlDays) || refreshTtlDays <= 0) {
    throw new Error("AUTH_REFRESH_TTL_DAYS must be a positive integer");
  }

  const cookieSecure = process.env.AUTH_COOKIE_SECURE === "true";

  const cookieSameSiteRaw = (
    process.env.AUTH_COOKIE_SAMESITE || "lax"
  ).toLowerCase();
  if (!["lax", "strict", "none"].includes(cookieSameSiteRaw)) {
    throw new Error("AUTH_COOKIE_SAMESITE must be lax, strict, or none");
  }
  const cookieSameSite = cookieSameSiteRaw as "lax" | "strict" | "none";

  const resetTtlMinutes = parseInt(
    process.env.AUTH_RESET_TTL_MINUTES || "30",
    10,
  );
  if (isNaN(resetTtlMinutes) || resetTtlMinutes <= 0) {
    throw new Error("AUTH_RESET_TTL_MINUTES must be a positive integer");
  }

  const verificationTtlHours = parseInt(
    process.env.AUTH_VERIFICATION_TTL_HOURS || "24",
    10,
  );
  if (isNaN(verificationTtlHours) || verificationTtlHours <= 0) {
    throw new Error("AUTH_VERIFICATION_TTL_HOURS must be a positive integer");
  }

  cachedConfig = {
    jwtSecret,
    accessTtlSeconds,
    refreshTtlDays,
    cookieSecure,
    cookieSameSite,
    resetTtlMinutes,
    verificationTtlHours,
  };

  return cachedConfig;
}

/**
 * Clears cached config (for testing).
 */
export function clearAuthConfigCache(): void {
  cachedConfig = null;
}
