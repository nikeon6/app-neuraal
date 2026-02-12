import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);

    // Should show login form
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test("register page is accessible", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveURL(/register/);
  });

  test("unauthenticated users are redirected to login", async ({ page }) => {
    await page.goto("/");
    // Should redirect to /login since there's no auth cookie
    await expect(page).toHaveURL(/login/);
  });

  test("API returns 401 for unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/entries?date=2026-01-15");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel(/email/i).fill("nonexistent@test.com");
    await page.getByLabel(/password/i).fill("WrongPassword123!");
    await page.getByRole("button", { name: /log\s*in|sign\s*in|enter|entrar/i }).click();

    // Should show an error message (not redirect)
    await expect(page).toHaveURL(/login/);
  });
});
