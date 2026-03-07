import logger from "./logger";
import { ImapService } from "./services/imap.service";

export const getEmails = async (): Promise<void> => {
  try {
    await ImapService.fetchEmails();
    logger.debug("Email fetch completed");
  } catch (error) {
    logger.error(error, "Error fetching emails");
  }
};
