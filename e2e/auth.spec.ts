import { test, expect } from "@playwright/test";
import { login, loginAndExpectDashboard, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./helpers/auth";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("h2")).toContainText("Welcome to Thymely");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    await loginAndExpectDashboard(page);
  });

  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', "wrong@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should reject malformed email in login", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', "not-an-email");
    await page.fill('input[name="password"]', "somepassword");
    await page.click('button:has-text("Sign In")');

    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should reject unauthenticated API requests", async ({ page }) => {
    // Navigate first so relative fetch works
    await page.goto("/auth/login");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/v1/users/all", {
        credentials: "include",
      });
      return { status: res.status };
    });
    expect(response.status).toBe(401);
  });

  test("should logout successfully", async ({ page }) => {
    await login(page);

    // Verify we're logged in
    const profileRes = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return { status: res.status, body: await res.json() };
    });
    expect(profileRes.status).toBe(200);

    const userId = profileRes.body?.user?.id;
    if (!userId) {
      test.skip();
      return;
    }

    // Logout via API
    await page.evaluate(async (id: string) => {
      await fetch(`/api/v1/auth/user/${id}/logout`, {
        method: "GET",
        credentials: "include",
      });
    }, userId);

    // Verify session is invalidated
    const afterLogout = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return res.status;
    });
    expect(afterLogout).toBe(401);
  });
});
