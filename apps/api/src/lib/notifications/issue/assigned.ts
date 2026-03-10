import { prisma } from "../../../prisma";
import logger from "../../logger";

/**
 * Creates assignment notifications for all ticket followers.
 *
 * @param {object} ticket - The ticket object
 * @param {object} assignee - The user object being assigned
 * @param {object} assigner - The user object doing the assigning
 * @returns {Promise<void>}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma objects with many nullable fields
export async function assignedNotification(
  assignee: any,
  ticket: any,
  assigner: any
) {
  try {
    const text = `Ticket #${ticket.Number} was assigned to ${assignee.name} by ${assigner.name}`;

    // Get all followers of the ticket, ensuring the creator is not already a follower
    const followers = [
      ...(ticket.following || []),
      ...(ticket.following?.includes(ticket.createdBy.id)
        ? []
        : [ticket.createdBy.id]),
    ];

    // Create notifications for all followers (except the assigner)
    await prisma.notifications.createMany({
      data: followers
        .filter((userId: string) => userId !== assigner.id)
        .map((userId: string) => ({
          text,
          userId,
          ticketId: ticket.id,
        })),
    });
  } catch (error) {
    logger.error(error, "Error creating assignment notifications");
  }
}
