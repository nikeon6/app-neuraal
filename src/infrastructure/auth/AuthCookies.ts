import { NextResponse } from "next/server";
import type { AuthConfig } from "./AuthConfig";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

/**
 * Sets auth cookies (access_token and refresh_token) on a NextResponse.
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
  config: AuthConfig,
): void {
  response.cookies.set("access_token", accessToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/",
    maxAge: config.accessTtlSeconds,
  });

  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/api/auth",
    maxAge: config.refreshTtlDays * 24 * 60 * 60,
  });
}

/**
 * Clears auth cookies from a NextResponse.
 */
export function clearAuthCookies(
  response: NextResponse,
  config: AuthConfig,
): void {
  response.cookies.set("access_token", "", {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: "/api/auth",
    maxAge: 0,
  });
}
