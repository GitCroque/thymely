import { prisma } from "../../../prisma";
import logger from "../../logger";
import { renderEmailTemplate } from "../render-template";
import { sanitizeEmailAddress, sanitizeEmailHeader, sanitizeTemplateValue } from "../sanitize";
import { createTransportProvider } from "../transport";

interface TicketStatusEmail {
  title: string;
  Number: number;
  email: string;
  isComplete: boolean;
}

export async function sendTicketStatus(ticket: TicketStatusEmail) {
  const email = await prisma.email.findFirst();

  if (email) {
    const transport = await createTransportProvider();

    const testhtml = await prisma.emailTemplate.findFirst({
      where: {
        type: "ticket_status_changed",
      },
    });

    const replacements = {
      title: sanitizeTemplateValue(String(ticket.title)),
      status: ticket.isComplete ? "COMPLETED" : "OUTSTANDING",
    };
    const htmlToSend = renderEmailTemplate(testhtml?.html, replacements);

    const statusLabel = ticket.isComplete ? "COMPLETED" : "OUTSTANDING";
    const to = sanitizeEmailAddress(ticket.email);
    const subject = sanitizeEmailHeader(`Issue #${ticket.Number} status is now ${statusLabel}`);

    await transport
      .sendMail({
        from: email?.reply,
        to,
        subject,
        text: `Hello there, Issue #${ticket.Number}, now has a status of ${statusLabel}`,
        html: htmlToSend,
      })
      .then((info: { messageId: string }) => {
        logger.info({ messageId: info.messageId }, "Status email sent");
      })
      .catch((err: Error) => logger.error(err, "Failed to send status email"));
  }
}
