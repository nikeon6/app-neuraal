import { Page, expect } from "@playwright/test";

/**
 * Logs in by posting directly to the auth API and setting cookies.
 * Much faster and more stable than navigating through the login UI.
 */
export async function loginViaApi(
  page: Page,
  email = "test@neuraal.dev",
  password = "TestPassword1!"
) {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

  const response = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });

  // If login fails (user might not exist in test env), skip auth
  if (!response.ok()) {
    console.warn(
      `[E2E] Login failed (${response.status()}). Tests may fail if routes require auth.`
    );
    return false;
  }

  // Navigate to the app so cookies get set via the browser context
  await page.goto("/");
  return true;
}

/**
 * Waits for the dashboard to be fully loaded.
 */
export async function waitForDashboard(page: Page) {
  // Wait for something that indicates the dashboard is ready
  await expect(page.locator("body")).not.toBeEmpty();
  // Give React a moment to hydrate
  await page.waitForTimeout(500);
}
