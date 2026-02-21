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
    await page
      .getByRole("button", { name: /log\s*in|sign\s*in|enter|entrar/i })
      .click();

    // Should show an error message (not redirect)
    await expect(page).toHaveURL(/login/);
  });

  test("login with valid credentials redirects to app", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL ?? "test@neuraal.dev";
    const password = process.env.E2E_USER_PASSWORD ?? "TestPassword1!";

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page
      .getByRole("button", { name: /log\s*in|sign\s*in|enter|entrar/i })
      .click();

    await expect(page).not.toHaveURL(/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
  });
});
