import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shadcn/ui/dropdown-menu";
import {
  Ellipsis,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import useTranslation from "next-translate/useTranslation";

interface TicketHeaderProps {
  ticket: any;
  title: any;
  setTitle: (value: any) => void;
  isAdmin: boolean;
  onHide: (hidden: boolean) => void;
  onLock: (locked: boolean) => void;
  onDelete: () => void;
}

export default function TicketHeader({
  ticket,
  title,
  setTitle,
  isAdmin,
  onHide,
  onLock,
  onDelete,
}: TicketHeaderProps) {
  const { t } = useTranslation("thymely");

  return (
    <div className="md:flex md:justify-between md:space-x-4 lg:border-b lg:pb-4">
      <div className="w-full">
        <div className="flex flex-row space-x-1">
          <h1 className="text-2xl mt-[5px] font-bold text-foreground">
            #{ticket.Number} -
          </h1>
          <input
            type="text"
            name="title"
            id="title"
            style={{ fontSize: "1.5rem" }}
            className="border-none -mt-[1px] px-0 pl-0.5 w-3/4 truncated m block text-foreground bg-transparent font-bold focus:outline-none focus:ring-0 placeholder:text-primary sm:text-sm sm:leading-6"
            value={title}
            defaultValue={ticket.title}
            onChange={(e) => setTitle(e.target.value)}
            key={ticket.id}
            disabled={ticket.locked}
          />
        </div>
        <div className="mt-2 text-xs flex flex-row justify-between items-center space-x-1">
          <div className="flex flex-row space-x-1 items-center">
            {ticket.client && (
              <div>
                <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                  {ticket.client.name}
                </span>
              </div>
            )}
            <div>
              {!ticket.isComplete ? (
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    {t("open_issue")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                    {t("closed_issue")}
                  </span>
                </div>
              )}
            </div>
            <div>
              <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                {ticket.type}
              </span>
            </div>
            {ticket.hidden && (
              <div>
                <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Hidden
                </span>
              </div>
            )}
            {ticket.locked && (
              <div>
                <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                  Locked
                </span>
              </div>
            )}
          </div>
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center px-2 py-1 text-xs font-medium text-foreground ring-none outline-none ">
                <Ellipsis className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[160px]"
              >
                <DropdownMenuLabel>
                  <span>Issue Actions</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ticket.hidden ? (
                  <DropdownMenuItem
                    className="flex flex-row space-x-3 items-center"
                    onClick={() => onHide(false)}
                  >
                    <Eye className="h-4 w-4" />
                    <span>Show Issue</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="flex flex-row space-x-3 items-center"
                    onClick={() => onHide(true)}
                  >
                    <EyeOff className="h-4 w-4" />
                    <span>Hide Issue</span>
                  </DropdownMenuItem>
                )}
                {ticket.locked ? (
                  <DropdownMenuItem
                    className="flex flex-row space-x-3 items-center"
                    onClick={() => onLock(false)}
                  >
                    <Unlock className="h-4 w-4" />
                    <span>Unlock Issue</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="flex flex-row space-x-3 items-center"
                    onClick={() => onLock(true)}
                  >
                    <Lock className="h-4 w-4" />
                    <span>Lock Issue</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex flex-row space-x-3 items-center transition-colors duration-200 focus:bg-red-500 focus:text-white"
                  onClick={() => onDelete()}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="">Delete Issue</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
