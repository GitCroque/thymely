import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Admin", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should list users via API", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/users/all", { credentials: "include" });
      return res.json();
    });

    expect(result.users).toBeDefined();
    expect(Array.isArray(result.users)).toBe(true);
    expect(result.pagination).toBeDefined();
  });

  test("should create a new user via API", async ({ page }) => {
    const uniqueEmail = `e2e-user-${Date.now()}@test.com`;

    const result = await page.evaluate(async (email: string) => {
      const res = await fetch("/api/v1/auth/user/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "TestPassword123!",
          name: "E2E Test User",
          admin: false,
        }),
      });
      return { status: res.status, body: await res.json() };
    }, uniqueEmail);

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  test("should reject duplicate user creation", async ({ page }) => {
    const uniqueEmail = `e2e-dup-${Date.now()}@test.com`;

    // Create first user
    await page.evaluate(async (email: string) => {
      await fetch("/api/v1/auth/user/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "TestPassword123!",
          name: "Duplicate User",
          admin: false,
        }),
      });
    }, uniqueEmail);

    // Try creating same user again
    const result = await page.evaluate(async (email: string) => {
      const res = await fetch("/api/v1/auth/user/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: "TestPassword123!",
          name: "Duplicate User",
          admin: false,
        }),
      });
      return { status: res.status, body: await res.json() };
    }, uniqueEmail);

    expect(result.status).toBe(400);
    expect(result.body.message).toContain("already exists");
  });

  test("should list clients via API", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/clients/all", { credentials: "include" });
      return res.json();
    });

    expect(result.clients).toBeDefined();
    expect(Array.isArray(result.clients)).toBe(true);
  });

  test("should access admin settings page", async ({ page }) => {
    await page.goto("/admin/authentication");
    await page.waitForLoadState("networkidle");
    // Should not redirect to login (we're authenticated as admin)
    expect(page.url()).toContain("/admin");
  });
});
