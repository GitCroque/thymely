import { prisma } from "../../../prisma";
import logger from "../../logger";

interface TicketNotificationUser {
  id: string;
  name: string;
}

interface TicketNotificationTarget {
  id: string;
  Number: number | string;
  following: unknown;
  createdBy: unknown;
}

function getCreatedById(ticket: TicketNotificationTarget) {
  if (
    ticket.createdBy &&
    typeof ticket.createdBy === "object" &&
    "id" in ticket.createdBy &&
    typeof ticket.createdBy.id === "string"
  ) {
    return ticket.createdBy.id;
  }

  return null;
}

function getFollowerIds(ticket: TicketNotificationTarget) {
  const followers = Array.isArray(ticket.following)
    ? ticket.following.filter((userId): userId is string => typeof userId === "string")
    : [];

  const createdById = getCreatedById(ticket);

  if (!createdById) {
    return followers;
  }

  return followers.includes(createdById)
    ? followers
    : [...followers, createdById];
}

export async function assignedNotification(
  assignee: TicketNotificationUser | null,
  ticket: TicketNotificationTarget | null,
  assigner: TicketNotificationUser | null
) {
  try {
    if (!ticket || !assignee || !assigner) {
      return;
    }

    const text = `Ticket #${ticket.Number} was assigned to ${assignee.name} by ${assigner.name}`;

    const followers = getFollowerIds(ticket);

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
