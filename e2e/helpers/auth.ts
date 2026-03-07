import { Page, expect } from "@playwright/test";

export const TEST_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@admin.com";
export const TEST_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin";

export async function login(page: Page, email = TEST_ADMIN_EMAIL, password = TEST_ADMIN_PASSWORD) {
  await page.goto("/auth/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Sign In")');
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });
}

export async function loginAndExpectDashboard(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/(onboarding)?$/);
}

export async function logout(page: Page) {
  // Navigate to settings which has logout, or call API directly
  await page.evaluate(() => {
    return fetch("/api/v1/auth/logout", { method: "GET", credentials: "include" });
  });
  await page.goto("/auth/login");
}
