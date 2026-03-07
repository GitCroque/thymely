import handlebars from "handlebars";
import { prisma } from "../../../prisma";
import logger from "../../logger";
import { sanitizeEmailAddress, sanitizeEmailHeader, sanitizeTemplateValue } from "../sanitize";
import { createTransportProvider } from "../transport";

export async function sendComment(
  comment: string,
  title: string,
  id: string,
  email: string
) {
  try {
    const provider = await prisma.email.findFirst();

    const transport = await createTransportProvider();

    const testhtml = await prisma.emailTemplate.findFirst({
      where: {
        type: "ticket_comment",
      },
    });

    var template = handlebars.compile(testhtml?.html);
    var replacements = {
      title: sanitizeTemplateValue(title),
      comment: sanitizeTemplateValue(comment),
    };
    var htmlToSend = template(replacements);

    const to = sanitizeEmailAddress(email);
    const subject = sanitizeEmailHeader(`New comment on Issue #${title} ref: #${id}`);

    logger.debug({ ticketId: id }, "Sending comment notification email");
    await transport
      .sendMail({
        from: provider?.reply,
        to,
        subject,
        text: `Hello there, Issue #${title}, has had an update with a comment of ${comment}`,
        html: htmlToSend,
      })
      .then((info: any) => {
        logger.info({ messageId: info.messageId }, "Comment email sent");
      })
      .catch((err: any) => logger.error(err, "Failed to send comment email"));
  } catch (error) {
    logger.error(error, "Error in sendComment");
  }
}
