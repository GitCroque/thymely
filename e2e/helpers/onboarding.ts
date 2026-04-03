import { Page } from "@playwright/test";
import { login, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./auth";

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Creates a fresh user via the admin API.
 * The new user will have firstLogin: true (schema default).
 * Requires the admin session — call login(page) first or let this helper do it.
 */
export async function createTestUser(page: Page, prefix = "onboard"): Promise<TestUser> {
  // Login as admin to get a session
  await login(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

  const email = `${prefix}-${Date.now()}@test.com`;
  const password = "TestPassword123!";

  const result = await page.evaluate(
    async ({ email, password }: { email: string; password: string }) => {
      const res = await fetch("/api/v1/auth/user/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: "E2E Onboard User",
          admin: false,
        }),
      });
      return { status: res.status, body: await res.json() };
    },
    { email, password },
  );

  if (result.status !== 200 || !result.body.success) {
    throw new Error(`Failed to create test user: ${JSON.stringify(result)}`);
  }

  return { email, password };
}
