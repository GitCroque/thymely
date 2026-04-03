import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { createTestUser, TestUser } from "./helpers/onboarding";

test.describe("Onboarding flow", () => {
  let testUser: TestUser;
  const newPassword = "NewSecurePass456!";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    testUser = await createTestUser(page);
    await page.close();
  });

  test("complete onboarding: password → skip email → dashboard", async ({ page }) => {
    // 1. Login with fresh user → should redirect to /onboarding
    await login(page, testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/onboarding/);

    // 2. Step 0: Change password
    await page.fill("#password", newPassword);
    await page.fill("#confirm", newPassword);
    await page.click('button:has-text("Continue")');

    // Wait for step to advance — "Skip for now" button appears in email step
    await expect(page.locator('button:has-text("Skip for now")')).toBeVisible({ timeout: 15000 });

    // 3. Step 1: Skip email configuration
    await page.click('button:has-text("Skip for now")');

    // Wait for done step — "Go to Dashboard" button appears
    await expect(page.locator('button:has-text("Go to Dashboard")')).toBeVisible({ timeout: 5000 });

    // 4. Step 2: Finish onboarding → must land on "/" (NOT /onboarding, NOT /auth/login)
    await page.click('button:has-text("Go to Dashboard")');
    await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });

    // 5. Verify session is valid after full onboarding
    const profileStatus = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return res.status;
    });
    expect(profileStatus).toBe(200);
  });

  test("second login after onboarding goes directly to dashboard", async ({ page }) => {
    // Login with the new password set during onboarding
    await login(page, testUser.email, newPassword);

    // Should go to "/" directly, NOT /onboarding (firstLogin must be false)
    await expect(page).toHaveURL(/^.*\/$/);
    await expect(page).not.toHaveURL(/\/onboarding/);
  });
});
