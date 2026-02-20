import { Page, expect } from "@playwright/test";

/**
 * Logs in by posting directly to the auth API and setting cookies.
 * Much faster and more stable than navigating through the login UI.
 */
export async function loginViaApi(
  page: Page,
  email = process.env.E2E_USER_EMAIL ?? "test@neuraal.dev",
  password = process.env.E2E_USER_PASSWORD ?? "TestPassword1!",
) {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:5173";

  const response = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });

  // Fail loudly to avoid false positives in authenticated E2E tests.
  if (!response.ok()) {
    throw new Error(
      `[E2E] Login failed (${response.status()}) for ${email}. Ensure E2E seed ran successfully.`,
    );
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
