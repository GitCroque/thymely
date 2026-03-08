import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import logger from "../../logger";
import { sanitizeEmailAddress, sanitizeEmailHeader, sanitizeTemplateValue } from "../sanitize";
import { createTransportProvider } from "../transport";

export async function sendTicketCreate(ticket: any) {
  try {
    const email = await prisma.email.findFirst();

    if (email) {
      const transport = await createTransportProvider();

      const testhtml = await prisma.emailTemplate.findFirst({
        where: {
          type: "ticket_created",
        },
      });

      const template = handlebars.compile(testhtml?.html);
      const replacements = {
        id: sanitizeTemplateValue(String(ticket.id)),
      };
      const htmlToSend = template(replacements);

      const to = sanitizeEmailAddress(ticket.email);
      const subject = sanitizeEmailHeader(`Issue #${ticket.id} has just been created & logged`);

      await transport
        .sendMail({
          from: email?.reply,
          to,
          subject,
          text: `Hello there, Issue #${ticket.id}, which you reported on ${ticket.createdAt}, has now been created and logged`,
          html: htmlToSend,
        })
        .then((info: any) => {
          logger.info({ messageId: info.messageId }, "Ticket creation email sent");
        })
        .catch((err: any) => logger.error(err, "Failed to send ticket creation email"));
    }
  } catch (error) {
    logger.error(error, "Error in sendTicketCreate");
  }
}
