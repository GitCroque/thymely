import { CheckCircleIcon } from "@heroicons/react/20/solid";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(localizedFormat);
import useTranslation from "next-translate/useTranslation";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Button } from "@/shadcn/ui/button";
import { Switch } from "@/shadcn/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import { PanelTopClose, Trash2 } from "lucide-react";

interface TicketComment {
  id: string;
  text: string;
  createdAt: string;
  public: boolean;
  userId: string;
  replyEmail?: string;
  user?: { name: string; image?: string };
}

interface TicketData {
  following?: string[];
  fromImap?: boolean;
  email?: string;
  name?: string;
  createdAt: string;
  createdBy?: { name: string };
  client?: { name: string };
  comments: TicketComment[];
  isComplete: boolean;
  locked: boolean;
  assignedTo?: { id: string; name: string } | null;
}

interface TicketCommentsProps {
  ticket: TicketData;
  user: { id: string; isAdmin: boolean };
  users: { id: string; name: string }[] | undefined;
  comment: string | undefined;
  setComment: (value: string) => void;
  publicComment: boolean;
  setPublicComment: (value: boolean) => void;
  onAddComment: () => void;
  onDeleteComment: (id: string) => void;
  onUpdateStatus: () => void;
  onSubscribe: () => void;
}

export default function TicketComments({
  ticket,
  user,
  users,
  comment: _comment,
  setComment,
  publicComment,
  setPublicComment,
  onAddComment,
  onDeleteComment,
  onUpdateStatus,
  onSubscribe,
}: TicketCommentsProps) {
  const { t } = useTranslation("thymely");

  return (
    <section
      aria-labelledby="activity-title "
      className="border-t mt-4"
    >
      <div className="p-2 flex flex-col space-y-1">
        <div className="flex flex-row items-center justify-between">
          <span
            id="activity-title"
            className="text-base font-medium "
          >
            Activity
          </span>

          <div className="flex flex-row items-center space-x-2">
            <Button
              variant={
                ticket.following?.includes(user.id)
                  ? "ghost"
                  : "ghost"
              }
              onClick={() => onSubscribe()}
              size="sm"
              className="flex items-center gap-1 group"
            >
              {ticket.following?.includes(user.id) ? (
                <>
                  <span className="text-xs group-hover:hidden">
                    following
                  </span>
                  <span className="text-xs hidden group-hover:inline text-destructive">
                    unsubscribe
                  </span>
                </>
              ) : (
                <span className="text-xs">follow</span>
              )}
            </Button>

            {ticket.following &&
              ticket.following.length > 0 && (
                <div className="flex space-x-2">
                  <Popover>
                    <PopoverTrigger aria-label="View followers">
                      <PanelTopClose className="h-4 w-4" />
                    </PopoverTrigger>
                    <PopoverContent>
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs">Followers</span>
                        {ticket.following.map(
                          (follower: string) => {
                            const userMatch = users?.find(
                              (u: { id: string }) =>
                                u.id === follower &&
                                u.id !==
                                  ticket.assignedTo?.id
                            );
                            return userMatch ? (
                              <div key={follower}>
                                <span>{userMatch.name}</span>
                              </div>
                            ) : null;
                          }
                        )}

                        {ticket.following.filter(
                          (follower: string) =>
                            follower !== ticket.assignedTo?.id
                        ).length === 0 && (
                          <span className="text-xs">
                            This issue has no followers
                          </span>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
          </div>
        </div>
        <div>
          <div className="flex flex-row items-center text-sm space-x-1">
            {ticket.fromImap ? (
              <>
                <span className="font-bold">
                  {ticket.email}
                </span>
                <span>created via email at </span>
                <span className="font-bold">
                  {dayjs(ticket.createdAt).format(
                    "DD/MM/YYYY"
                  )}
                </span>
              </>
            ) : (
              <>
                {ticket.createdBy ? (
                  <div className="flex flex-row space-x-1">
                    <span>
                      Created by
                      <strong className="ml-1">
                        {ticket.createdBy.name}
                      </strong>{" "}
                      at{" "}
                    </span>
                    <span className="">
                      {dayjs(ticket.createdAt).format(
                        "LLL"
                      )}
                    </span>
                    {ticket.name && (
                      <span>
                        for <strong>{ticket.name}</strong>
                      </span>
                    )}
                    {ticket.email && (
                      <span>
                        ( <strong>{ticket.email}</strong> )
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-row space-x-1">
                    <span>Created at </span>
                    <span className="">
                      <strong>
                        {dayjs(ticket.createdAt).format(
                          "LLL"
                        )}
                      </strong>
                      {ticket.client && (
                        <span>
                          for{" "}
                          <strong>
                            {ticket.client.name}
                          </strong>
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="">
          <ul role="list" className="space-y-2">
            {ticket.comments.length > 0 &&
              ticket.comments.map((comment) => (
                <li
                  key={comment.id}
                  className="group flex flex-col space-y-1 text-sm bg-secondary/50 dark:bg-secondary/50 px-4 py-2 rounded-lg relative"
                >
                  <div className="flex flex-row space-x-2 items-center">
                    <Avatar className="w-6 h-6">
                      <AvatarImage
                        src={
                          comment.user ? comment.user.image : ""
                        }
                      />
                      <AvatarFallback>
                        {comment.user
                          ? comment.user.name.slice(0, 1)
                          : comment.replyEmail?.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold">
                      {comment.user
                        ? comment.user.name
                        : comment.replyEmail}
                    </span>
                    <span className="text-xs lowercase">
                      {dayjs(comment.createdAt).format("LLL")}
                    </span>
                    {(user.isAdmin ||
                      (comment.user &&
                        comment.userId === user.id)) && (
                      <Trash2
                        className="h-4 w-4 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          onDeleteComment(comment.id);
                        }}
                      />
                    )}
                  </div>
                  <span className="ml-1">{comment.text}</span>
                </li>
              ))}
          </ul>
        </div>
        <div className="mt-6">
          <div className="flex space-x-3">
            <div className="min-w-0 flex-1">
              <div>
                <div>
                  <label htmlFor="comment" className="sr-only">
                    {t("comment")}
                  </label>
                  <textarea
                    id="comment"
                    name="comment"
                    rows={3}
                    className="block w-full bg-secondary/50 dark:bg-secondary/50 rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-background focus:ring-0 focus:ring-inset focus:ring-gray-900 sm:text-sm sm:leading-6"
                    placeholder={
                      ticket.locked
                        ? "This ticket is locked"
                        : "Leave a comment"
                    }
                    defaultValue={""}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={ticket.locked}
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <div>
                    <div className="flex flex-row items-center space-x-2">
                      <Switch
                        checked={publicComment}
                        onCheckedChange={setPublicComment}
                      />
                      <span> Public Reply</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end space-x-4">
                  {ticket.isComplete ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!ticket.locked) {
                          onUpdateStatus();
                        }
                      }}
                      disabled={ticket.locked}
                      className={`inline-flex justify-center items-center gap-x-1.5 rounded-md ${
                        ticket.locked
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-white hover:bg-gray-50"
                      } px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300`}
                    >
                      <CheckCircleIcon
                        className="-ml-0.5 h-5 w-5 text-red-500"
                        aria-hidden="true"
                      />
                      <span className="">
                        {t("reopen_issue")}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!ticket.locked) {
                          onUpdateStatus();
                        }
                      }}
                      disabled={ticket.locked}
                      className={`inline-flex justify-center gap-x-1.5 rounded-md ${
                        ticket.locked
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-white hover:bg-gray-50"
                      } px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300`}
                    >
                      <CheckCircleIcon
                        className="-ml-0.5 h-5 w-5 text-green-500"
                        aria-hidden="true"
                      />
                      {t("close_issue")}
                    </button>
                  )}
                  <button
                    onClick={() => onAddComment()}
                    type="submit"
                    disabled={ticket.locked}
                    className={`inline-flex items-center justify-center rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 ${
                      ticket.locked
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gray-900 hover:bg-gray-700"
                    }`}
                  >
                    {t("comment")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
