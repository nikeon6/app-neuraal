import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers";

function isoDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test.describe("Dashboard critical flows", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: /dashboard navigation/i }),
    ).toBeVisible();
  });

  test("can change selected day from calendar", async ({ page }) => {
    const titleBefore =
      (await page.locator("header h1").first().textContent()) ?? "";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = isoDateKey(tomorrow);

    const dayButton = page
      .locator(`[data-date-key="${tomorrowKey}"]:visible`)
      .first();
    await expect(dayButton).toBeVisible();
    await dayButton.click();

    await expect
      .poll(
        async () =>
          (await page.locator("header h1").first().textContent()) ?? "",
      )
      .not.toBe(titleBefore);
  });

  test("can create and edit a new entry", async ({ page }) => {
    const entries = page.locator('[data-testid^="task-editor-wrapper-"]');
    const beforeCount = await entries.count();

    await page
      .getByRole("button", { name: /add new task/i })
      .first()
      .click();

    await expect
      .poll(async () => await entries.count())
      .toBeGreaterThan(beforeCount);
    const newEntry = entries.last();
    const titleInput = newEntry.locator('textarea[aria-label="Title"]');
    await expect(titleInput).toBeVisible();

    await titleInput.fill("E2E created task");
    await expect(titleInput).toHaveValue("E2E created task");
  });

  test("can open reminder dialog and schedule reminder", async ({ page }) => {
    // Ensure at least one entry exists for reminder interaction.
    const addEntryButton = page
      .getByRole("button", { name: /add new task/i })
      .first();
    await addEntryButton.click();

    const entries = page.locator('[data-testid^="task-editor-wrapper-"]');
    await expect(entries).not.toHaveCount(0);
    const targetEntry = entries.last();

    await targetEntry.click();
    await targetEntry
      .getByRole("button", { name: /schedule reminder/i })
      .click();

    const reminderDialog = page.getByRole("dialog", {
      name: /schedule reminder/i,
    });
    await expect(reminderDialog).toBeVisible();
    await reminderDialog.getByRole("button", { name: /^schedule$/i }).click();

    await expect(reminderDialog).not.toBeVisible();
  });
});
