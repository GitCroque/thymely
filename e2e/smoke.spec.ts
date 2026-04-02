import { test, expect } from "@playwright/test";
import { login, TEST_ADMIN_EMAIL } from "./helpers/auth";
import { createTicketViaAPI } from "./helpers/ticket";

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("Smoke", () => {
  test("couvre les surfaces publiques et le refus d'acces", async ({ page, browser }) => {
    await page.goto("/auth/login");
    await expect(page.locator("h2")).toContainText("Welcome to Thymely");

    const unauthenticatedProfile = await page.evaluate(async () => {
      const response = await fetch("/api/v1/auth/profile", {
        credentials: "include",
      });

      return response.status;
    });

    expect(unauthenticatedProfile).toBe(401);

    const publicTicketTitle = uniqueId("public-ticket");
    const publicTicketResult = await page.evaluate(async (title) => {
      const response = await fetch("/api/v1/ticket/public/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          detail: "Smoke public ticket",
          priority: "low",
          name: "Smoke Public User",
          email: `${title}@example.com`,
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, publicTicketTitle);

    expect(publicTicketResult.status).toBe(200);
    expect(publicTicketResult.body.success).toBe(true);

    const passwordReset = await page.evaluate(async (email) => {
      const response = await fetch("/api/v1/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, TEST_ADMIN_EMAIL);

    expect(passwordReset.status).toBe(200);
    expect(passwordReset.body.success).toBe(true);

    const externalPassword = "ExternalPass123!";
    const externalEmail = `${uniqueId("external-user")}@example.com`;

    const registerExternal = await page.evaluate(
      async ({ email, password }) => {
        const response = await fetch("/api/v1/auth/user/register/external", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            name: "Smoke External User",
            language: "en",
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      { email: externalEmail, password: externalPassword }
    );

    expect(registerExternal.status).toBe(200);
    expect(registerExternal.body.success).toBe(true);

    const externalContext = await browser.newContext();
    const externalPage = await externalContext.newPage();

    await externalPage.goto(`${process.env.E2E_BASE_URL || "http://localhost:3000"}/auth/login`);
    await externalPage.fill('input[name="email"]', externalEmail);
    await externalPage.fill('input[name="password"]', externalPassword);
    await externalPage.click('button:has-text("Sign In")');
    await externalPage.waitForURL((url) => !url.pathname.includes("/auth/login"), {
      timeout: 10000,
    });

    const adminSensitiveRequest = await externalPage.evaluate(async () => {
      const response = await fetch("/api/v1/auth/user/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `blocked-${Date.now()}@example.com`,
          password: "BlockedPass123!",
          admin: false,
          name: "Blocked User",
        }),
      });

      return response.status;
    });

    expect(adminSensitiveRequest).toBe(401);

    await externalContext.close();
  });

  test("couvre le cycle ticket interne et le contrat des pieces jointes", async ({ page }) => {
    await login(page);

    const ticketTitle = uniqueId("smoke-ticket");
    const createResult = await createTicketViaAPI(page, {
      title: ticketTitle,
      detail: "Smoke internal ticket",
      priority: "low",
    });

    expect(createResult.success).toBe(true);

    const ticketList = await page.evaluate(async () => {
      const response = await fetch("/api/v1/tickets/all", {
        credentials: "include",
      });

      return response.json();
    });

    const ticket = ticketList.tickets?.find(
      (entry: { id: string; title: string }) => entry.title === ticketTitle
    );

    expect(ticket?.id).toBeTruthy();

    const ticketDetails = await page.evaluate(async (ticketId) => {
      const response = await fetch(`/api/v1/ticket/${ticketId}`, {
        credentials: "include",
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, ticket.id);

    expect(ticketDetails.status).toBe(200);
    expect(ticketDetails.body.ticket.title).toBe(ticketTitle);

    const commentResult = await page.evaluate(async (ticketId) => {
      const response = await fetch("/api/v1/ticket/comment", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: ticketId,
          text: "Smoke comment",
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, ticket.id);

    expect(commentResult.status).toBe(200);
    expect(commentResult.body.success).toBe(true);

    const profile = await page.evaluate(async () => {
      const response = await fetch("/api/v1/auth/profile", {
        credentials: "include",
      });

      return response.json();
    });

    const transferResult = await page.evaluate(
      async ({ ticketId, userId }) => {
        const response = await fetch("/api/v1/ticket/transfer", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: ticketId,
            user: userId,
          }),
        });

        return {
          status: response.status,
          body: await response.json(),
        };
      },
      { ticketId: ticket.id, userId: profile.user.id }
    );

    expect(transferResult.status).toBe(200);
    expect(transferResult.body.success).toBe(true);

    const statusResult = await page.evaluate(async (ticketId) => {
      const response = await fetch("/api/v1/ticket/status/update", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: ticketId,
          status: true,
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, ticket.id);

    expect(statusResult.status).toBe(200);
    expect(statusResult.body.success).toBe(true);

    const uploadResult = await page.evaluate(async (ticketId) => {
      const formData = new FormData();
      const file = new File(["smoke-file-content"], "smoke.txt", {
        type: "text/plain",
      });
      formData.append("file", file);

      const response = await fetch(`/api/v1/storage/ticket/${ticketId}/upload/single`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, ticket.id);

    expect(uploadResult.status).toBe(200);
    expect(uploadResult.body.success).toBe(true);
    expect(uploadResult.body.file.id).toBeTruthy();

    const fileId = uploadResult.body.file.id as string;

    const listFiles = await page.evaluate(async (ticketId) => {
      const response = await fetch(`/api/v1/storage/ticket/${ticketId}/files`, {
        credentials: "include",
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, ticket.id);

    expect(listFiles.status).toBe(200);
    expect(listFiles.body.files.some((file: { id: string }) => file.id === fileId)).toBe(true);

    const downloadFile = await page.evaluate(async (currentFileId) => {
      const response = await fetch(`/api/v1/storage/file/${currentFileId}/download`, {
        credentials: "include",
      });
      const content = await response.text();

      return {
        status: response.status,
        content,
        contentType: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
      };
    }, fileId);

    expect(downloadFile.status).toBe(200);
    expect(downloadFile.content).toBe("smoke-file-content");
    expect(downloadFile.contentType).toContain("text/plain");
    expect(downloadFile.disposition).toContain('filename="smoke.txt"');

    const deleteFile = await page.evaluate(async (currentFileId) => {
      const response = await fetch(`/api/v1/storage/file/${currentFileId}`, {
        method: "DELETE",
        credentials: "include",
      });

      return {
        status: response.status,
        body: await response.json(),
      };
    }, fileId);

    expect(deleteFile.status).toBe(200);
    expect(deleteFile.body.success).toBe(true);

    const listAfterDelete = await page.evaluate(async (ticketId) => {
      const response = await fetch(`/api/v1/storage/ticket/${ticketId}/files`, {
        credentials: "include",
      });

      return response.json();
    }, ticket.id);

    expect(listAfterDelete.files.some((file: { id: string }) => file.id === fileId)).toBe(false);
  });
});
