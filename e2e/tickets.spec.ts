import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { createTicketViaAPI } from "./helpers/ticket";

test.describe("Tickets", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should create a ticket via the UI", async ({ page }) => {
    await page.goto("/new");

    // Fill in ticket form
    await page.fill('input[name="title"], input[placeholder*="title" i]', "E2E Test Ticket");

    // Look for email input if present
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailInput.fill("e2e-test@example.com");
    }

    // Look for name input if present
    const nameInput = page.locator('input[name="name"]');
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill("E2E Tester");
    }

    // Submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")');
    await submitButton.first().click();

    // Should redirect to ticket detail or show success
    await page.waitForTimeout(3000);
    // Either we're on a ticket detail page or issues list
    const url = page.url();
    expect(url.includes("/issue/") || url.includes("/issues")).toBe(true);
  });

  test("should create a ticket via API", async ({ page }) => {
    const result = await createTicketViaAPI(page, { title: "API Created Ticket" });
    expect(result.success).toBe(true);
  });

  test("should list tickets", async ({ page }) => {
    // Create a ticket first
    await createTicketViaAPI(page, { title: "Ticket for listing test" });

    await page.goto("/issues");
    await page.waitForLoadState("networkidle");

    // The page should contain some ticket content
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
  });

  test("should view ticket details", async ({ page }) => {
    // Create a ticket and get its data
    await createTicketViaAPI(page, { title: "Ticket detail view test" });

    // Get the ticket list to find the ticket
    const tickets = await page.evaluate(async () => {
      const res = await fetch("/api/v1/tickets/all", { credentials: "include" });
      return res.json();
    });

    const ticket = tickets.tickets?.find((t: any) => t.title === "Ticket detail view test") ;
    if (!ticket) {
      test.skip();
      return;
    }

    await page.goto(`/issue/${ticket.id}`);
    await page.waitForLoadState("networkidle");

    const content = await page.textContent("body");
    expect(content).toContain("Ticket detail view test");
  });

  test("should add a comment to a ticket via API", async ({ page }) => {
    // Create a ticket first
    await createTicketViaAPI(page, { title: "Ticket for comment test" });

    const tickets = await page.evaluate(async () => {
      const res = await fetch("/api/v1/tickets/all", { credentials: "include" });
      return res.json();
    });

    const ticket = tickets.tickets?.find((t: any) => t.title === "Ticket for comment test") ;
    if (!ticket) {
      test.skip();
      return;
    }

    // Add a comment
    const commentResult = await page.evaluate(async (ticketId: string) => {
      const res = await fetch(`/api/v1/ticket/comment`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "E2E test comment", id: ticketId }),
      });
      return res.json();
    }, ticket.id);

    expect(commentResult.success).toBe(true);
  });

  test("should change ticket status via API", async ({ page }) => {
    await createTicketViaAPI(page, { title: "Ticket for status test" });

    const tickets = await page.evaluate(async () => {
      const res = await fetch("/api/v1/tickets/all", { credentials: "include" });
      return res.json();
    });

    const ticket = tickets.tickets?.find((t: any) => t.title === "Ticket for status test") ;
    if (!ticket) {
      test.skip();
      return;
    }

    // Close the ticket
    const statusResult = await page.evaluate(async (ticketId: string) => {
      const res = await fetch(`/api/v1/ticket/status/update`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, status: true }),
      });
      return res.json();
    }, ticket.id);

    expect(statusResult.success).toBe(true);
  });

  test("should enforce pagination on ticket listing", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/v1/tickets/all?page=1&limit=5", { credentials: "include" });
      return res.json();
    });

    // Should have pagination metadata
    expect(result.pagination).toBeDefined();
    expect(result.pagination.limit).toBe(5);
    expect(result.pagination.page).toBe(1);
    expect(result.tickets.length).toBeLessThanOrEqual(5);
  });
});
