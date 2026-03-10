import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import logger from "../../logger";
import { sanitizeEmailAddress } from "../sanitize";
import { createTransportProvider } from "../transport";

export async function sendAssignedEmail(email: string) {
  try {
    const provider = await prisma.email.findFirst();

    if (provider) {
      const mail = await createTransportProvider();

      const to = sanitizeEmailAddress(email);
      logger.debug({ to }, "Sending assignment notification email");

      const testhtml = await prisma.emailTemplate.findFirst({
        where: {
          type: "ticket_assigned",
        },
      });

      const template = handlebars.compile(testhtml?.html);
      const htmlToSend = template({});

      await mail
        .sendMail({
          from: provider?.reply,
          to,
          subject: `A new ticket has been assigned to you`,
          text: `Hello there, a ticket has been assigned to you`,
          html: htmlToSend,
        })
        .then((info: { messageId: string }) => {
          logger.info({ messageId: info.messageId }, "Assignment email sent");
        })
        .catch((err: Error) => logger.error(err, "Failed to send assignment email"));
    }
  } catch (error) {
    logger.error(error, "Error in sendAssignedEmail");
  }
}
