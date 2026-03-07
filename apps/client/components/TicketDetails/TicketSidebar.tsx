// @ts-nocheck
import { ClientCombo, IconCombo, UserCombo } from "../Combo";

interface TicketSidebarProps {
  ticket: any;
  users: any;
  clients: any;
  priorityOptions: any[];
  ticketStatusMap: any[];
  setN: (value: any) => void;
  setPriority: (value: any) => void;
  setTicketStatus: (value: any) => void;
  setAssignedClient: (value: any) => void;
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
                    showIcon={true}
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

              <UserCombo
                value={ticketStatusMap}
                update={setTicketStatus}
                defaultName={
                  ticket.status ? ticket.status : ""
                }
                disabled={ticket.locked}
                showIcon={true}
                placeholder="Change Client..."
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
            showIcon={true}
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
            showIcon={true}
            hideInitial={false}
          />
        )}

        {/* <div className="border-t border-gray-200">
          <div className="flex flex-row items-center justify-between mt-2">
            <span className="text-sm font-medium text-gray-500 dark:text-white">
              Time Tracking
            </span>
            {!editTime ? (
              <button
                onClick={() => setTimeEdit(true)}
                className="text-sm font-medium text-gray-500 hover:underline dark:text-white"
              >
                add
              </button>
            ) : (
              <button
                onClick={() => {
                  setTimeEdit(false);
                  addTime();
                }}
                className="text-sm font-medium text-gray-500 hover:underline dark:text-white"
              >
                save
              </button>
            )}
          </div>
          {data.ticket.TimeTracking.length > 0 ? (
            data.ticket.TimeTracking.map((i: any) => (
              <div key={i.id} className="text-xs">
                <div className="flex flex-row space-x-1.5 items-center dark:text-white">
                  <span>{i.user.name} / </span>
                  <span>{i.time} minutes</span>
                </div>
              </div>
            ))
          ) : (
            <div>
              <span className="text-xs dark:text-white">
                No Time added
              </span>
            </div>
          )}
          {editTime && (
            <div>
              <div className="mt-2 flex flex-col space-y-2">
                <input
                  type="text"
                  name="text"
                  id="timespent_text"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="What did you do?"
                  value={timeReason}
                  onChange={(e) => setTimeReason(e.target.value)}
                />
                <input
                  type="number"
                  name="number"
                  id="timespent"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="Time in minutes"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                />
              </div>
            </div>
          )}
        </div> */}
        {/* <div className="border-t border-gray-200">
          <div className="flex flex-row items-center justify-between mt-2">
            <span className="text-sm font-medium text-gray-500 dark:text-white">
              Attachments
            </span>
            <button
              className="text-sm font-medium text-gray-500 hover:underline dark:text-white"
              onClick={handleButtonClick}
            >
              upload
              <input
                id="file"
                type="file"
                hidden
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </button>
          </div>

          <>
            {data.ticket.files.length > 0 &&
              data.ticket.files.map((file: any) => (
                <div className="p-1/2 px-1  hover:bg-gray-200 hover:cursor-pointer">
                  <span className="text-xs">{file.filename}</span>
                </div>
              ))}
            {file && (
              <div className="p-1/2 px-1">
                <span className="text-xs">{file.name}</span>
              </div>
            )}
          </>
        </div> */}
      </div>
    </div>
  );
}
