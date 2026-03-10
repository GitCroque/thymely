import { prisma } from "../../../prisma";
import logger from "../../logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma objects with many nullable fields
export async function activeStatusNotification(
  ticket: any,
  updater: any,
  newStatus: string
) {
  try {
    const text = `#${ticket.Number} status changed to ${
      newStatus ? "Closed" : "Open"
    } by ${updater.name}`;

    // Get all followers of the ticket, ensuring the creator is not already a follower
    const followers = [
      ...(ticket.following || []),
      ...(ticket.following?.includes(ticket.createdBy.id)
        ? []
        : [ticket.createdBy.id]),
    ];

    // Create notifications for all followers (except the updater)
    await prisma.notifications.createMany({
      data: followers
        .filter((userId: string) => userId !== updater.id)
        .map((userId: string) => ({
          text,
          userId,
          ticketId: ticket.id,
        })),
    });
  } catch (error) {
    logger.error(error, "Error creating status change notifications");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function statusUpdateNotification(
  ticket: any,
  updater: any,
  newStatus: string
) {
  try {
    const text = `#${ticket.Number} status changed to ${newStatus} by ${updater.name}`;

    // Get all followers of the ticket, ensuring the creator is not already a follower
    const followers = [
      ...(ticket.following || []),
      ...(ticket.following?.includes(ticket.createdBy.id)
        ? []
        : [ticket.createdBy.id]),
    ];

    // Create notifications for all followers (except the updater)
    await prisma.notifications.createMany({
      data: followers
        .filter((userId: string) => userId !== updater.id)
        .map((userId: string) => ({
          text,
          userId,
          ticketId: ticket.id,
        })),
    });
  } catch (error) {
    logger.error(error, "Error creating status update notifications");
  }
}
