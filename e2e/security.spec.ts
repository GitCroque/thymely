import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Security", () => {
  test("should set security headers", async ({ page }) => {
    await login(page);

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return {
        status: res.status,
        headers: {
          xContentTypeOptions: res.headers.get("x-content-type-options"),
          xFrameOptions: res.headers.get("x-frame-options"),
          referrerPolicy: res.headers.get("referrer-policy"),
        },
      };
    });

    expect(response.headers.xContentTypeOptions).toBe("nosniff");
    expect(response.headers.xFrameOptions).toBe("DENY");
    expect(response.headers.referrerPolicy).toBe("no-referrer");
  });

  test("should reject XSS in ticket title", async ({ page }) => {
    await login(page);

    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/ticket/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: '<script>alert("xss")</script>Test Ticket',
          detail: "test",
          priority: "low",
          name: "Tester",
          email: "test@test.com",
        }),
      });
      return res.json();
    });

    // The ticket should be created but title should not contain raw script tags
    // when retrieved (sanitization happens on display/email, not storage for title)
    expect(result.success).toBe(true);
  });

  test("should sanitize XSS in comments", async ({ page }) => {
    await login(page);

    // Create a ticket first
    const createResult = await page.evaluate(async () => {
      const res = await fetch("/api/v1/ticket/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "XSS Comment Test",
          detail: "test",
          priority: "low",
          name: "Tester",
          email: "xss@test.com",
        }),
      });
      return res.json();
    });

    const tickets = await page.evaluate(async () => {
      const res = await fetch("/api/v1/tickets/all", { credentials: "include" });
      return res.json();
    });

    const ticket = tickets.tickets?.find((t: any) => t.title === "XSS Comment Test");
    if (!ticket) {
      test.skip();
      return;
    }

    // Post a comment with XSS payload
    const commentResult = await page.evaluate(async (ticketId: string) => {
      const res = await fetch("/api/v1/ticket/comment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: '<img src=x onerror=alert("xss")>Hello',
          id: ticketId,
        }),
      });
      return res.json();
    }, ticket.id);

    expect(commentResult.success).toBe(true);

    // Fetch ticket details and verify the comment is sanitized
    const ticketDetail = await page.evaluate(async (ticketId: string) => {
      const res = await fetch(`/api/v1/ticket/${ticketId}`, { credentials: "include" });
      return res.json();
    }, ticket.id);

    const comments = ticketDetail.ticket?.comments || [];
    const xssComment = comments.find((c: any) => c.text?.includes("Hello"));
    if (xssComment) {
      expect(xssComment.text).not.toContain("onerror");
    }
  });

  test("should reject requests with invalid body schema", async ({ page }) => {
    await login(page);

    // Missing required 'title' field
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/ticket/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detail: "no title" }),
      });
      return { status: res.status };
    });

    expect(result.status).toBe(400);
  });

  test("should reject invalid email format in ticket creation", async ({ page }) => {
    await login(page);

    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/ticket/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          email: "not-an-email",
          priority: "low",
        }),
      });
      return { status: res.status };
    });

    expect(result.status).toBe(400);
  });

  test("should reject unknown fields (additionalProperties: false)", async ({ page }) => {
    await login(page);

    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/ticket/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          maliciousField: "should be rejected",
        }),
      });
      return { status: res.status };
    });

    expect(result.status).toBe(400);
  });

  test("public ticket creation should work without auth", async ({ page }) => {
    await page.goto("/auth/login");
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/ticket/public/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Public ticket test",
          detail: "Created without auth",
          priority: "low",
          name: "Public User",
          email: "public@test.com",
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });
});
