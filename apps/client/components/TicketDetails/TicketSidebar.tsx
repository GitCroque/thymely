import { ClientCombo, IconCombo, UserCombo } from "../Combo";
import type { ComboOption } from "../Combo";

interface TicketSidebarTicket {
  assignedTo?: { name: string } | null;
  client?: { name: string } | null;
  priority?: string | null;
  status?: string | null;
  locked: boolean;
}

interface TicketSidebarProps {
  ticket: TicketSidebarTicket;
  users?: ComboOption[];
  clients?: ComboOption[];
  priorityOptions: ComboOption[];
  ticketStatusMap: ComboOption[];
  setN: (value: ComboOption | null) => void;
  setPriority: (value: ComboOption | null) => void;
  setTicketStatus: (value: ComboOption | null) => void;
  setAssignedClient: (value: ComboOption | null) => void;
  variant: "desktop" | "mobile";
}

export default function TicketSidebar({
  ticket,
  users,
  clients,
  priorityOptions,
  ticketStatusMap,
  setN,
  setPriority,
  setTicketStatus,
  setAssignedClient,
  variant,
}: TicketSidebarProps) {
  if (variant === "mobile") {
    return (
      <aside className="mt-4 lg:hidden">
        <div className="border-b pb-1">
          <div className="border-t pt-1">
            <div className="flex flex-col sm:flex-row space-x-2">
              <div className="ml-2">
                {users && (
                  <UserCombo
                    value={users}
                    update={setN}
                    defaultName={
                      ticket.assignedTo
                        ? ticket.assignedTo.name
                        : ""
                    }
                    disabled={ticket.locked}
                    placeholder="Assign User..."
                    hideInitial={false}

                  />
                )}
              </div>

              <IconCombo
                value={priorityOptions}
                update={setPriority}
                defaultName={
                  ticket.priority ? ticket.priority : ""
                }
                disabled={ticket.locked}
                hideInitial={false}
              />

              <IconCombo
                value={ticketStatusMap}
                update={setTicketStatus}
                defaultName={
                  ticket.status ? ticket.status : ""
                }
                disabled={ticket.locked}
                hideInitial={false}
              />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="hidden lg:block lg:pl-8 lg:order-2 order-1">
      <h2 className="sr-only">Details</h2>
      <div className="space-y-1 py-2">
        {users && (
          <UserCombo
            value={users}
            update={setN}
            defaultName={
              ticket.assignedTo
                ? ticket.assignedTo.name
                : ""
            }
            disabled={ticket.locked}

            placeholder="Change User..."
            hideInitial={false}
          />
        )}
        <IconCombo
          value={priorityOptions}
          update={setPriority}
          defaultName={
            ticket.priority ? ticket.priority : ""
          }
          disabled={ticket.locked}
          hideInitial={false}
        />
        <IconCombo
          value={ticketStatusMap}
          update={setTicketStatus}
          defaultName={ticket.status ? ticket.status : ""}
          disabled={ticket.locked}
          hideInitial={false}
        />
        {clients && (
          <ClientCombo
            value={clients}
            update={setAssignedClient}
            defaultName={
              ticket.client
                ? ticket.client.name
                : "No Client Assigned"
            }
            disabled={ticket.locked}
          />
        )}

      </div>
    </div>
  );
}
