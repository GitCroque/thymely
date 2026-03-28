import EmailReplyParser from "email-reply-parser";
import Imap from "imap";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import type { Readable } from "stream";
import { prisma } from "../../prisma";
import logger from "../logger";
import { decryptSecret } from "../security/secrets";
import { EmailConfig, EmailQueue } from "../types/email";
import { AuthService } from "./auth.service";

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "a",
    "b",
    "i",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "code",
    "img",
    "div",
    "span",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
  ],
  allowedAttributes: {
    a: ["href"],
    img: ["src"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
};

function sanitize(html: string): string {
  return sanitizeHtml(html, sanitizeOptions);
}

function getReplyText(email: { text: string }): string {
  const parsed = new EmailReplyParser().read(email.text);
  const fragments = parsed.getFragments();

  let replyText = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Fragment type from email-reply-parser is not exported
  fragments.forEach((fragment: any) => {
    logger.debug({ hasContent: !!fragment._content }, "Processing email fragment");
    if (!fragment._isHidden && !fragment._isSignature && !fragment._isQuoted) {
      replyText += fragment._content;
    }
  });

  return replyText;
}

type TicketCreatedBy = {
  id?: string;
};

/**
 * Checks if the sender email is authorized to add a comment on the given ticket.
 * Authorized senders: ticket creator, assigned user, or anyone who previously commented.
 */
async function isSenderAuthorizedForTicket(
  ticketId: string,
  senderEmail: string
): Promise<boolean> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId },
  });

  if (!ticket) {
    return false;
  }

  const lowerSender = senderEmail.toLowerCase();

  // Check if sender matches the email stored directly on the ticket (for IMAP-created tickets)
  if (ticket.email?.toLowerCase() === lowerSender) {
    return true;
  }

  // Check if sender is the ticket creator (createdBy is Json with potential userId)
  if (ticket.createdBy && typeof ticket.createdBy === "object") {
    const createdByData = ticket.createdBy as TicketCreatedBy;
    if (createdByData.id) {
      const creatorUser = await prisma.user.findUnique({
        where: { id: createdByData.id },
      });
      if (creatorUser?.email?.toLowerCase() === lowerSender) {
        return true;
      }
    }
  }

  // Check if sender is the assigned user
  if (ticket.userId) {
    const assignedUser = await prisma.user.findUnique({
      where: { id: ticket.userId },
    });
    if (assignedUser?.email?.toLowerCase() === lowerSender) {
      return true;
    }
  }

  // Check if sender has previously commented on this ticket (via replyEmail)
  const previousComment = await prisma.comment.findFirst({
    where: {
      ticketId,
      replyEmail: { equals: senderEmail, mode: "insensitive" },
    },
  });

  if (previousComment) {
    return true;
  }

  // Also check comments by users with matching email
  const userWithEmail = await prisma.user.findFirst({
    where: { email: { equals: senderEmail, mode: "insensitive" } },
  });

  if (userWithEmail) {
    const commentByUser = await prisma.comment.findFirst({
      where: {
        ticketId,
        userId: userWithEmail.id,
      },
    });
    if (commentByUser) {
      return true;
    }
  }

  return false;
}

export class ImapService {
  private static async getImapConfig(queue: EmailQueue): Promise<EmailConfig> {
    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction && process.env.ALLOW_INSECURE_IMAP_TLS === "true") {
      logger.warn("ALLOW_INSECURE_IMAP_TLS is enabled — TLS certificate validation disabled. Do NOT use in production.");
    }
    const rejectUnauthorized = isProduction || process.env.ALLOW_INSECURE_IMAP_TLS !== "true";
    const decryptedPassword = await decryptSecret(queue.password);

    switch (queue.serviceType) {
      case "gmail": {
        const validatedAccessToken = await AuthService.getValidAccessToken(
          queue
        );

        return {
          user: queue.username,
          password: "",
          host: queue.hostname,
          port: 993,
          tls: true,
          xoauth2: AuthService.generateXOAuth2Token(
            queue.username,
            validatedAccessToken
          ),
          tlsOptions: { rejectUnauthorized, servername: queue.hostname },
        };
      }
      case "other":
        return {
          user: queue.username,
          password: decryptedPassword || "",
          host: queue.hostname,
          port: queue.tls ? 993 : 143,
          tls: queue.tls || false,
          tlsOptions: { rejectUnauthorized, servername: queue.hostname },
        };
      default:
        throw new Error("Unsupported service type");
    }
  }

  private static async processEmail(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mailparser ParsedMail type is complex and loosely typed
    parsed: any,
    isReply: boolean
  ): Promise<void> {
    const { from, subject, text, html, textAsHtml } = parsed;

    logger.debug({ isReply }, "Processing email");

    if (isReply) {
      // First try to match UUID format
      const uuidMatch = subject.match(
        /(?:ref:|#)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      );
      logger.debug({ hasMatch: !!uuidMatch }, "UUID match check");

      const ticketId = uuidMatch?.[1];

      logger.debug({ ticketId }, "Extracted ticket ID");

      if (!ticketId) {
        throw new Error(`Could not extract ticket ID from subject: ${subject}`);
      }

      const ticket = await prisma.ticket.findFirst({
        where: {
          id: ticketId,
        },
      });

      logger.debug({ ticketId: ticket?.id }, "Found ticket");

      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      // Verify the sender is authorized to comment on this ticket
      const senderEmail = from.value[0].address;
      const authorized = await isSenderAuthorizedForTicket(
        ticket.id,
        senderEmail
      );

      if (!authorized) {
        // Sender is not authorized: create a new ticket instead of injecting a comment
        logger.info({ senderEmail, ticketId: ticket.id }, "Unauthorized sender, creating new ticket");

        const sanitizedHtml = sanitize(html || textAsHtml || "");

        const imapEmail = await prisma.imap_Email.create({
          data: {
            from: senderEmail,
            subject: subject || "No Subject",
            body: text || "No Body",
            html: sanitizedHtml,
            text: textAsHtml ? sanitize(textAsHtml) : "",
          },
        });

        await prisma.ticket.create({
          data: {
            email: senderEmail,
            name: from.value[0].name,
            title: imapEmail.subject || "-",
            isComplete: false,
            priority: "low",
            fromImap: true,
            detail: sanitizedHtml,
          },
        });

        return;
      }

      const replyText = getReplyText(parsed);

      await prisma.comment.create({
        data: {
          text: text ? replyText : "No Body",
          userId: null,
          ticketId: ticket.id,
          reply: true,
          replyEmail: senderEmail,
          public: true,
        },
      });
    } else {
      const sanitizedHtml = sanitize(html || "");
      const sanitizedTextAsHtml = textAsHtml ? sanitize(textAsHtml) : "";

      const imapEmail = await prisma.imap_Email.create({
        data: {
          from: from.value[0].address,
          subject: subject || "No Subject",
          body: text || "No Body",
          html: sanitizedHtml,
          text: sanitizedTextAsHtml,
        },
      });

      await prisma.ticket.create({
        data: {
          email: from.value[0].address,
          name: from.value[0].name,
          title: imapEmail.subject || "-",
          isComplete: false,
          priority: "low",
          fromImap: true,
          detail: sanitizedHtml || sanitizedTextAsHtml,
        },
      });
    }
  }

  static async fetchEmails(): Promise<void> {
    const queues =
      (await prisma.emailQueue.findMany()) as unknown as EmailQueue[];
    const today = new Date();

    for (const queue of queues) {
      try {
        const imapConfig = await this.getImapConfig(queue);

        if (queue.serviceType === "other" && !imapConfig.password) {
          logger.error("IMAP configuration is missing a password");
          throw new Error("IMAP configuration is missing a password");
        }

        const imap = new Imap(imapConfig);

        await new Promise((resolve, reject) => {
          imap.once("ready", () => {
            imap.openBox("INBOX", false, (err) => {
              if (err) {
                reject(err);
                return;
              }
              imap.search(["UNSEEN", ["ON", today]], (err, results) => {
                if (err) reject(err);
                if (!results?.length) {
                  logger.debug("No new messages");
                  imap.end();
                  resolve(null);
                  return;
                }

                const fetch = imap.fetch(results, { bodies: "" });

                fetch.on("message", (msg) => {
                  msg.on("body", (stream: NodeJS.ReadableStream) => {
                    simpleParser(stream as unknown as Readable, async (err, parsed) => {
                      if (err) throw err;
                      const subjectLower = parsed.subject?.toLowerCase() || "";
                      const isReply =
                        subjectLower.includes("re:") ||
                        subjectLower.includes("ref:");
                      await this.processEmail(parsed, isReply || false);
                    });
                  });

                  msg.once("attributes", (attrs) => {
                    imap.addFlags(attrs.uid, ["\\Seen"], () => {
                      logger.debug("Message marked as read");
                    });
                  });
                });

                fetch.once("error", reject);
                fetch.once("end", () => {
                  logger.debug("Done fetching messages");
                  imap.end();
                  resolve(null);
                });
              });
            });
          });

          imap.once("error", reject);
          imap.once("end", () => {
            logger.debug("IMAP connection ended");
            resolve(null);
          });

          imap.connect();
        });
      } catch (_error) {
        logger.error({ queueId: queue.id }, "Error processing IMAP queue");
      }
    }
  }
}
