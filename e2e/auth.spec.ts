import { test, expect } from "@playwright/test";
import { login, loginAndExpectDashboard, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./helpers/auth";
import { createTestUser } from "./helpers/onboarding";

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

  test("session is invalidated after password reset", async ({ browser }) => {
    const page = await browser.newPage();

    // Create a dedicated user to avoid breaking admin for other tests
    const user = await createTestUser(page, "session-reset");
    await login(page, user.email, user.password);

    // Verify session works
    const before = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return { status: res.status, body: await res.json() };
    });
    expect(before.status).toBe(200);

    const userId = before.body?.user?.id;
    expect(userId).toBeTruthy();

    // Reset password → this deletes ALL sessions
    const resetRes = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "ChangedPass789!" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Session should now be invalid
    const after = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return res.status;
    });
    expect(after).toBe(401);

    // first-login should also fail (this is exactly the onboarding bug scenario)
    const firstLogin = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/v1/auth/user/${id}/first-login`, {
        method: "POST",
        credentials: "include",
      });
      return res.status;
    }, userId);
    expect(firstLogin).toBe(401);

    await page.close();
  });

  test("session works after re-login following password reset", async ({ browser }) => {
    const page = await browser.newPage();

    const user = await createTestUser(page, "session-relogin");
    const newPassword = "ChangedPass789!";

    await login(page, user.email, user.password);

    // Reset password (invalidates session)
    await page.evaluate(async (pw: string) => {
      await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
    }, newPassword);

    // Re-login with new password
    await login(page, user.email, newPassword);

    // Session should be valid again
    const profile = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return res.status;
    });
    expect(profile).toBe(200);

    await page.close();
  });
});
