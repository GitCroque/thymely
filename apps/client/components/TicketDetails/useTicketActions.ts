import { getCookie } from "cookies-next";
import { useRouter } from "next/router";
import { toast } from "@/shadcn/hooks/use-toast";

interface UseTicketActionsOptions {
  id: string | string[] | undefined;
  refetch: () => void;
  userId: string;
}

export function useTicketActions({ id, refetch, userId }: UseTicketActionsOptions) {
  const token = getCookie("session");
  const router = useRouter();

  async function update(payload: {
    detail?: string;
    note?: string;
    title?: string;
    priority?: string;
    status?: string;
    locked?: boolean;
  }) {
    if (payload.locked) return;

    const res = await fetch(`/api/v1/ticket/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id,
        detail: payload.detail,
        note: payload.note,
        title: payload.title,
        priority: payload.priority,
        status: payload.status,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to update ticket",
      });
    }
  }

  async function updateStatus(isComplete: boolean, locked: boolean) {
    if (locked) return;

    const res = await fetch(`/api/v1/ticket/status/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: !isComplete,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to update status",
      });
      return;
    }
    refetch();
  }

  async function hide(hidden: boolean, locked: boolean) {
    if (locked) return;

    const res = await fetch(`/api/v1/ticket/status/hide`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ hidden, id }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to update visibility",
      });
      return;
    }
    refetch();
  }

  async function lock(locked: boolean) {
    const res = await fetch(`/api/v1/ticket/status/lock`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ locked, id }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to update lock status",
      });
      return;
    }
    refetch();
  }

  async function deleteIssue() {
    await fetch(`/api/v1/ticket/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          toast({
            variant: "default",
            title: "Issue Deleted",
            description: "The issue has been deleted",
          });
          router.push("/issues");
        }
      });
  }

  async function addComment(comment: string, publicComment: boolean, locked: boolean) {
    if (locked) return;

    const res = await fetch(`/api/v1/ticket/comment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: comment,
        id,
        public: publicComment,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to add comment",
      });
      return;
    }
    refetch();
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/v1/ticket/comment/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: commentId }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          refetch();
        } else {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete comment",
          });
        }
      });
  }

  async function addTime(timeSpent: string, timeReason: string, locked: boolean) {
    if (locked) return;

    await fetch(`/api/v1/time/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        time: timeSpent,
        ticket: id,
        title: timeReason,
        user: userId,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          refetch();
          toast({
            variant: "default",
            title: "Time Added",
            description: "Time has been added to the ticket",
          });
        }
      });
  }

  async function subscribe(following: string[] | undefined, locked: boolean) {
    if (locked) return;

    const isFollowing = following?.includes(userId);
    const action = isFollowing ? "unsubscribe" : "subscribe";

    const res = await fetch(`/api/v1/ticket/${action}/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || `Failed to ${action} to issue`,
      });
      return;
    }

    toast({
      title: isFollowing ? "Unsubscribed" : "Subscribed",
      description: isFollowing
        ? "You will no longer receive updates"
        : "You will now receive updates",
      duration: 3000,
    });

    refetch();
  }

  async function transferTicket(targetUser: { id: string } | undefined, locked: boolean) {
    if (locked) return;
    if (targetUser === undefined) return;

    const res = await fetch(`/api/v1/ticket/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user: targetUser.id,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to transfer ticket",
      });
      return;
    }
    refetch();
  }

  async function transferClient(client: { id: string } | undefined, locked: boolean) {
    if (locked) return;
    if (client === undefined) return;

    const res = await fetch(`/api/v1/ticket/transfer/client`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client: client.id,
        id,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({
        variant: "destructive",
        title: "Error",
        description: res.message || "Failed to transfer client",
      });
      return;
    }
    refetch();
  }

  async function updateTicketStatus(_e: React.MouseEvent, ticket: { id: string; isComplete: boolean }) {
    await fetch(`/api/v1/ticket/status/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: ticket.id, status: !ticket.isComplete }),
    })
      .then((res) => res.json())
      .then(() => {
        toast({
          title: ticket.isComplete ? "Issue re-opened" : "Issue closed",
          description: "The status of the issue has been updated.",
          duration: 3000,
        });
        refetch();
      });
  }

  async function updateTicketAssignee(ticketId: string, user: { id: string } | undefined) {
    try {
      const response = await fetch(`/api/v1/ticket/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user: user ? user.id : undefined,
          id: ticketId,
        }),
      });

      if (!response.ok) throw new Error("Failed to update assignee");

      toast({
        title: "Assignee updated",
        description: `Transferred issue successfully`,
        duration: 3000,
      });
      refetch();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update assignee",
        variant: "destructive",
        duration: 3000,
      });
    }
  }

  async function updateTicketPriority(ticket: { id: string; detail: string; note: string; title: string; status: string }, priority: string) {
    try {
      const response = await fetch(`/api/v1/ticket/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: ticket.id,
          detail: ticket.detail,
          note: ticket.note,
          title: ticket.title,
          priority: priority,
          status: ticket.status,
        }),
      }).then((res) => res.json());

      if (!response.success) throw new Error("Failed to update priority");

      toast({
        title: "Priority updated",
        description: `Ticket priority set to ${priority}`,
        duration: 3000,
      });
      refetch();
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
        duration: 3000,
      });
    }
  }

  async function uploadFile(file: File, ticketId: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("user", userId);

    try {
      const result = await fetch(
        `/api/v1/storage/ticket/${ticketId}/upload/single`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await result.json();

      if (data.success) {
        refetch();
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload file",
      });
    }
  }

  return {
    update,
    updateStatus,
    hide,
    lock,
    deleteIssue,
    addComment,
    deleteComment,
    addTime,
    subscribe,
    transferTicket,
    transferClient,
    updateTicketStatus,
    updateTicketAssignee,
    updateTicketPriority,
    uploadFile,
  };
}
