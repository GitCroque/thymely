import { Page, expect } from "@playwright/test";

export async function createTicketViaAPI(page: Page, data: { title: string; detail?: string; priority?: string }) {
  const response = await page.evaluate(async (ticketData) => {
    const res = await fetch("/api/v1/ticket/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ticketData.title,
        detail: ticketData.detail || "E2E test ticket",
        priority: ticketData.priority || "low",
        name: "E2E Test",
        email: "e2e@test.com",
      }),
    });
    return res.json();
  }, data);

  expect(response.success).toBe(true);
  return response;
}
