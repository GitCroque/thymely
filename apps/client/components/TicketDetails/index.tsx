import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/shadcn/ui/context-menu";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

import {
  CircleCheck,
  CircleDotDashed,
  LifeBuoy,
  Loader,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from "lucide-react";
import { useAuthedUser } from "../../store/session";

import TicketHeader from "./TicketHeader";
import TicketSidebar from "./TicketSidebar";
import TicketComments from "./TicketComments";
import TicketContextMenu from "./TicketContextMenu";
import TicketEditor from "./TicketEditor";
import { useTicketData } from "./useTicketData";
import { useTicketActions } from "./useTicketActions";
import type { ComboOption } from "../Combo";

const ticketStatusMap = [
  { id: 0, value: "hold", name: "Hold", icon: CircleDotDashed },
  { id: 1, value: "needs_support", name: "Needs Support", icon: LifeBuoy },
  { id: 2, value: "in_progress", name: "In Progress", icon: CircleDotDashed },
  { id: 3, value: "in_review", name: "In Review", icon: Loader },
  { id: 4, value: "done", name: "Done", icon: CircleCheck },
];

const priorityOptions = [
  { id: "1", name: "Low", value: "low", icon: SignalLow },
  { id: "2", name: "Medium", value: "medium", icon: SignalMedium },
  { id: "3", name: "High", value: "high", icon: SignalHigh },
];

const priorities = ["low", "medium", "high"];

export default function Ticket() {
  const { user } = useAuthedUser();

  const { id, data, status, refetch, users, userOptions, clientOptions } = useTicketData();

  const actions = useTicketActions({ id, refetch, userId: user.id });

  // Local UI state
  const [title, setTitle] = useState<string>();
  const [issue, setIssue] = useState<unknown>();
  const [priority, setPriority] = useState<ComboOption | null>();
  const [ticketStatus, setTicketStatus] = useState<ComboOption | null>();
  const [comment, setComment] = useState<string>();
  const [publicComment, setPublicComment] = useState(false);
  const [n, setN] = useState<ComboOption | null>();
  const [assignedClient, setAssignedClient] = useState<ComboOption | null>();
  // Debounced values for auto-save
  const [debouncedValue] = useDebounce(issue, 500);
  const [debounceTitle] = useDebounce(title, 500);

  // Auto-save on priority, status, or title change
  useEffect(() => {
    if (!data?.ticket) return;
    actions.update({
      detail: debouncedValue ? JSON.stringify(debouncedValue) : undefined,
      title: debounceTitle,
      priority: priority?.value,
      status: ticketStatus?.value,
      locked: data.ticket.locked,
    });
  }, [priority, ticketStatus, debounceTitle]);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!issue || !data?.ticket) return;
    actions.update({
      detail: JSON.stringify(debouncedValue),
      locked: data.ticket.locked,
    });
  }, [debouncedValue]);

  // Transfer ticket on user selection
  useEffect(() => {
    if (!data?.ticket || n === undefined) return;
    actions.transferTicket(n ? { id: n.value } : null, data.ticket.locked);
  }, [n]);

  // Transfer client on client selection
  useEffect(() => {
    if (!data?.ticket || assignedClient === undefined) return;
    actions.transferClient(
      assignedClient ? { id: assignedClient.value } : null,
      data.ticket.locked
    );
  }, [assignedClient]);

  return (
    <div>
      {status === "pending" && (
        <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <h2> Loading data ... </h2>
        </div>
      )}

      {status === "error" && (
        <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold"> Error fetching data ... </h2>
        </div>
      )}

      {status === "success" && (
        <ContextMenu>
          <ContextMenuTrigger>
            <main className="flex-1 min-h-[90vh] py-8">
              <div className="mx-auto max-w-7xl w-full px-4 flex flex-col lg:flex-row justify-center">
                <div className="lg:border-r lg:pr-8 lg:w-2/3">
                  <TicketHeader
                    ticket={data.ticket}
                    title={title}
                    setTitle={setTitle}
                    isAdmin={user.isAdmin}
                    onHide={(hidden) => actions.hide(hidden, data.ticket.locked)}
                    onLock={(locked) => actions.lock(locked)}
                    onDelete={actions.deleteIssue}
                  />
                  <TicketSidebar
                    ticket={data.ticket}
                    users={userOptions}
                    clients={clientOptions}
                    priorityOptions={priorityOptions}
                    ticketStatusMap={ticketStatusMap}
                    setN={setN}
                    setPriority={setPriority}
                    setTicketStatus={setTicketStatus}
                    setAssignedClient={setAssignedClient}
                    variant="mobile"
                  />
                  <TicketEditor
                    ticket={data.ticket}
                    status={status}
                    onContentChange={setIssue}
                  />
                  <TicketComments
                    ticket={data.ticket}
                    user={user}
                    users={users}
                    comment={comment}
                    setComment={setComment}
                    publicComment={publicComment}
                    setPublicComment={setPublicComment}
                    onAddComment={() => actions.addComment(comment ?? "", publicComment, data.ticket.locked)}
                    onDeleteComment={actions.deleteComment}
                    onUpdateStatus={() => actions.updateStatus(data.ticket.isComplete, data.ticket.locked)}
                    onSubscribe={() => actions.subscribe(data.ticket.following, data.ticket.locked)}
                  />
                </div>
                <TicketSidebar
                  ticket={data.ticket}
                  users={userOptions}
                  clients={clientOptions}
                  priorityOptions={priorityOptions}
                  ticketStatusMap={ticketStatusMap}
                  setN={setN}
                  setPriority={setPriority}
                  setTicketStatus={setTicketStatus}
                  setAssignedClient={setAssignedClient}
                  variant="desktop"
                />
              </div>
            </main>
          </ContextMenuTrigger>
          <TicketContextMenu
            ticket={data.ticket}
            user={user}
            users={users}
            priorities={priorities}
            onUpdateTicketStatus={actions.updateTicketStatus}
            onUpdateTicketAssignee={actions.updateTicketAssignee}
            onUpdateTicketPriority={actions.updateTicketPriority}
            onDeleteIssue={actions.deleteIssue}
          />
        </ContextMenu>
      )}
    </div>
  );
}
