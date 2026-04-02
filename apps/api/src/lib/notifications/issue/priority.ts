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

export async function priorityNotification(
  issue: TicketNotificationTarget | null,
  updatedBy: TicketNotificationUser | null,
  oldPriority: string,
  newPriority: string
) {
  try {
    if (!issue || !updatedBy) {
      return;
    }

    const text = `Priority changed on #${issue.Number} from ${oldPriority} to ${newPriority} by ${updatedBy.name}`;

    const followers = getFollowerIds(issue);

    // Create notifications for all followers (except the person who updated)
    await prisma.notifications.createMany({
      data: followers
        .filter((userId: string) => userId !== updatedBy.id)
        .map((userId: string) => ({
          text,
          userId,
          ticketId: issue.id,
        })),
    });
  } catch (error) {
    logger.error(error, "Error creating priority change notifications");
  }
}
