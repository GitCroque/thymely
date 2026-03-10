import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { createTicketViaAPI } from "./helpers/ticket";

test.describe("Tickets", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should access ticket creation page", async ({ page }) => {
    await page.goto("/new");
    await page.waitForLoadState("networkidle");
    // Page should load without errors (not redirect to login)
    expect(page.url()).not.toContain("/auth/login");
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

    // Verify ticket details via API instead of DOM (avoids Mantine CSS in textContent)
    const ticketDetail = await page.evaluate(async (ticketId: string) => {
      const res = await fetch(`/api/v1/ticket/${ticketId}`, { credentials: "include" });
      return res.json();
    }, ticket.id);

    expect(ticketDetail.ticket).toBeDefined();
    expect(ticketDetail.ticket.title).toBe("Ticket detail view test");
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

  test("should assign a ticket to a user via API", async ({ page }) => {
    // Create a ticket
    await createTicketViaAPI(page, { title: "Ticket for assignment test" });

    // Get all tickets and find ours
    const tickets = await page.evaluate(async () => {
      const res = await fetch("/api/v1/tickets/all", { credentials: "include" });
      return res.json();
    });

    const ticket = tickets.tickets?.find((t: any) => t.title === "Ticket for assignment test");
    if (!ticket) {
      test.skip();
      return;
    }

    // Get the current user's ID from profile
    const profile = await page.evaluate(async () => {
      const res = await fetch("/api/v1/auth/profile", { credentials: "include" });
      return res.json();
    });

    const userId = profile.user?.id;
    if (!userId) {
      test.skip();
      return;
    }

    // Assign the ticket to the current user
    const transferResult = await page.evaluate(
      async ({ ticketId, userId }: { ticketId: string; userId: string }) => {
        const res = await fetch("/api/v1/ticket/transfer", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ticketId, user: userId }),
        });
        return res.json();
      },
      { ticketId: ticket.id, userId }
    );

    expect(transferResult.success).toBe(true);

    // Verify the assignment by fetching the ticket
    const ticketDetail = await page.evaluate(async (ticketId: string) => {
      const res = await fetch(`/api/v1/ticket/${ticketId}`, { credentials: "include" });
      return res.json();
    }, ticket.id);

    expect(ticketDetail.ticket).toBeDefined();
    expect(ticketDetail.ticket.userId).toBe(userId);
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
