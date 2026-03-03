import axios from "axios";
import crypto from "crypto";
import { decryptSecret } from "../security/secrets";
import { assertSafeWebhookUrl } from "../security/webhook-url";

function getPriorityColor(priority: string): number {
  switch (priority.toLowerCase()) {
    case "high":
      return 16711680; // Red
    case "medium":
      return 16753920; // Orange
    case "low":
      return 65280; // Green
    default:
      return 8421504; // Grey
  }
}

function buildSignatureHeaders(secret: string | null | undefined, body: unknown) {
  if (!secret) {
    return {};
  }

  const timestamp = Date.now().toString();
  const payload = JSON.stringify(body);
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return {
    "X-Thymely-Timestamp": timestamp,
    "X-Thymely-Signature": `sha256=${digest}`,
  };
}

export async function sendWebhookNotification(webhook: any, message: any) {
  if (!webhook.active) return;

  const url = webhook.url;
  await assertSafeWebhookUrl(url);
  const secret = await decryptSecret(webhook.secret);

  if (url.includes("discord.com")) {
    const discordMessage = {
      embeds: [
        {
          title: "Issue Created",
          description: "A new issue has been created",
          color: getPriorityColor(message.priority),
          footer: {
            text: "Issue ID: " + message.id,
          },
          author: {
            name: "thymely",
            icon_url:
              "https://avatars.githubusercontent.com/u/76014454?s=200&v=4",
            url: "https://github.com/GitCroque/thymely",
          },
          fields: [
            {
              name: "Title",
              value: message.title,
              inline: false,
            },
            {
              name: "Priority Level",
              value: message.priority,
              inline: false,
            },
            {
              name: "Contact Email",
              value: message.email ? message.email : "No email provided",
              inline: false,
            },
            {
              name: "Created By",
              value: message.createdBy.name,
              inline: false,
            },
            {
              name: "Assigned To",
              value: message.assignedTo ? message.assignedTo.name : "Unassigned",
              inline: false,
            },
            {
              name: "Client",
              value: message.client ? message.client.name : "No client assigned",
              inline: false,
            },
            {
              name: "Type",
              value: message.type,
              inline: false,
            },
          ],
        },
      ],
      content: "",
    };

    try {
      await axios.post(url, discordMessage, {
        timeout: 5000,
        maxRedirects: 0,
        headers: {
          ...buildSignatureHeaders(secret, discordMessage),
        },
      });
    } catch (error: any) {
      if (error.response) {
        console.error("Discord API response error:", error.response.data);
      } else {
        console.error("Error sending Discord webhook:", error.message);
      }
      throw error;
    }
  } else {
    const payload = {
      data: message,
    };

    try {
      await axios.post(url, payload, {
        timeout: 5000,
        maxRedirects: 0,
        headers: {
          "Content-Type": "application/json",
          ...buildSignatureHeaders(secret, payload),
        },
      });
    } catch (error) {
      console.error("Error sending webhook:", error);
    }
  }
}
