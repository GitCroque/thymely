import { Ticket } from '@/shadcn/types/tickets';
import { useEffect, useMemo, useState } from 'react';
import { safeJsonParse } from '../../../lib/safeJsonParse';

export function useTicketFilters(tickets: Ticket[] = [], keyPrefix: string = "all") {
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(() => {
    return safeJsonParse(localStorage.getItem(`${keyPrefix}_selectedPriorities`), []);
  });

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    return safeJsonParse(localStorage.getItem(`${keyPrefix}_selectedStatuses`), []);
  });

  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(() => {
    return safeJsonParse(localStorage.getItem(`${keyPrefix}_selectedAssignees`), []);
  });

  useEffect(() => {
    localStorage.setItem(`${keyPrefix}_selectedPriorities`, JSON.stringify(selectedPriorities));
    localStorage.setItem(`${keyPrefix}_selectedStatuses`, JSON.stringify(selectedStatuses));
    localStorage.setItem(`${keyPrefix}_selectedAssignees`, JSON.stringify(selectedAssignees));
  }, [selectedPriorities, selectedStatuses, selectedAssignees, keyPrefix]);

  const handlePriorityToggle = (priority: string) => {
    setSelectedPriorities((prev) =>
      prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleAssigneeToggle = (assignee: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assignee)
        ? prev.filter((a) => a !== assignee)
        : [...prev, assignee]
    );
  };

  const clearFilters = () => {
    setSelectedPriorities([]);
    setSelectedStatuses([]);
    setSelectedAssignees([]);
  };

  const filteredTickets = useMemo(() =>
    tickets.filter((ticket) => {
      const priorityMatch =
        selectedPriorities.length === 0 ||
        selectedPriorities.includes(ticket.priority);
      const statusMatch =
        selectedStatuses.length === 0 ||
        selectedStatuses.includes(ticket.isComplete ? "closed" : "open");
      const assigneeMatch =
        selectedAssignees.length === 0 ||
        selectedAssignees.includes(ticket.assignedTo?.name || "Unassigned");

      return priorityMatch && statusMatch && assigneeMatch;
    }),
    [tickets, selectedPriorities, selectedStatuses, selectedAssignees]
  );

  return {
    selectedPriorities,
    selectedStatuses,
    selectedAssignees,
    handlePriorityToggle,
    handleStatusToggle,
    handleAssigneeToggle,
    clearFilters,
    filteredTickets
  };
}
