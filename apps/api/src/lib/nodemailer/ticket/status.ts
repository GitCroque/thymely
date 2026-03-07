import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import logger from "../../logger";
import { sanitizeEmailAddress, sanitizeEmailHeader, sanitizeTemplateValue } from "../sanitize";
import { createTransportProvider } from "../transport";

export async function sendTicketStatus(ticket: any) {
  const email = await prisma.email.findFirst();

  if (email) {
    const transport = await createTransportProvider();

    const testhtml = await prisma.emailTemplate.findFirst({
      where: {
        type: "ticket_status_changed",
      },
    });

    var template = handlebars.compile(testhtml?.html);
    var replacements = {
      title: sanitizeTemplateValue(String(ticket.title)),
      status: ticket.isComplete ? "COMPLETED" : "OUTSTANDING",
    };
    var htmlToSend = template(replacements);

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
      .then((info: any) => {
        logger.info({ messageId: info.messageId }, "Status email sent");
      })
      .catch((err: any) => logger.error(err, "Failed to send status email"));
  }
}
