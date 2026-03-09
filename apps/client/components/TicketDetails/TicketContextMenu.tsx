import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/shadcn/ui/context-menu";
import { toast } from "@/shadcn/hooks/use-toast";
import { cn } from "@/shadcn/lib/utils";
import { CheckIcon } from "lucide-react";

interface TicketContextMenuProps {
  ticket: any;
  user: any;
  users: any;
  priorities: string[];
  onUpdateTicketStatus: (e: any, ticket: any) => void;
  onUpdateTicketAssignee: (ticketId: string, user: any) => void;
  onUpdateTicketPriority: (ticket: any, priority: string) => void;
  onDeleteIssue: () => void;
}

export default function TicketContextMenu({
  ticket,
  user,
  users,
  priorities,
  onUpdateTicketStatus,
  onUpdateTicketAssignee,
  onUpdateTicketPriority,
  onDeleteIssue,
}: TicketContextMenuProps) {
  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem
        onClick={(e) => onUpdateTicketStatus(e, ticket)}
      >
        {ticket.isComplete ? "Re-open Issue" : "Close Issue"}
      </ContextMenuItem>
      <ContextMenuSeparator />

      <ContextMenuSub>
        <ContextMenuSubTrigger>Assign To</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-64 ml-1 -mt-1/2">
          <Command>
            <CommandList>
              <CommandGroup heading="Assigned To">
                <CommandItem
                  onSelect={() =>
                    onUpdateTicketAssignee(ticket.id, undefined)
                  }
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      ticket.assignedTo === null
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible"
                    )}
                  >
                    <CheckIcon className={cn("h-4 w-4")} />
                  </div>
                  <span>Unassigned</span>
                </CommandItem>
                {users?.map((user: { id: string; name: string }) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() =>
                      onUpdateTicketAssignee(ticket.id, user)
                    }
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        ticket.assignedTo?.name === user.name
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <CheckIcon className={cn("h-4 w-4")} />
                    </div>
                    <span>{user.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSub>
        <ContextMenuSubTrigger>Change Priority</ContextMenuSubTrigger>
        <ContextMenuSubContent className="w-64 ml-1">
          <Command>
            <CommandList>
              <CommandGroup heading="Priority">
                {priorities.map((priority) => (
                  <CommandItem
                    key={priority}
                    onSelect={() =>
                      onUpdateTicketPriority(ticket, priority)
                    }
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        ticket.priority.toLowerCase() === priority
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <CheckIcon className={cn("h-4 w-4")} />
                    </div>
                    <span className="capitalize">{priority}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />

      <ContextMenuItem
        onClick={(e) => {
          e.preventDefault();
          toast({
            title: "Link copied to clipboard",
            description: "You can now share the link with others.",
            duration: 3000,
          });
          navigator.clipboard.writeText(
            `${window.location.origin}/issue/${ticket.id}`
          );
        }}
      >
        Share Link
      </ContextMenuItem>

      <ContextMenuSeparator />

      {user.isAdmin && (
        <ContextMenuItem
          className="text-red-600"
          onClick={() => onDeleteIssue()}
        >
          Delete Ticket
        </ContextMenuItem>
      )}
    </ContextMenuContent>
  );
}
