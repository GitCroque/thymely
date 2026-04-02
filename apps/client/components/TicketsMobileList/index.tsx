import Link from "next/link";
import { useState } from "react";

interface TicketListItem {
  id: string;
  title: string;
  priority?: string | null;
  name?: string | null;
  issue?: string | null;
  detail?: string | null;
  client?: {
    name?: string | null;
  } | null;
}

function getPriorityBadgeClass(priority?: string | null) {
  switch (priority?.toLowerCase()) {
    case "urgent":
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
    case "normal":
      return "bg-green-100 text-green-800";
    case "low":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default function TicketsMobileList({ tickets }: { tickets: TicketListItem[] }) {
  const [search, setSearch] = useState("");

  const filteredTickets = tickets.filter((ticket) => {
    const haystack = [ticket.title, ticket.name, ticket.priority]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase();

    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="overflow-x-auto md:-mx-6 lg:-mx-8 mt-10">
      <div>
        <input
          type="text"
          name="text"
          id="text"
          className="shadow-sm focus:border-gray-300 focus:ring-gray-300 appearance-none block w-full sm:text-sm border-gray-300 rounded-md"
          placeholder="Search ...."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="py-2 align-middle inline-block min-w-full md:px-6 lg:px-8">
        <div className="overflow-hidden md:rounded-lg">
          {filteredTickets.map((ticket) => (
            <div className="flex justify-start" key={ticket.id}>
              <div className="w-full mb-2 border">
                <div className="px-4 py-4">
                  <div>
                    <h1 className="font-semibold leading-tight text-2xl text-gray-800 hover:text-gray-800 ml-1">
                      {ticket.title}
                    </h1>
                    <p className="px-2">
                      Client: {ticket.client?.name || "n/a"}
                    </p>
                    <p className="px-2">Name of caller: {ticket.name || "n/a"}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadgeClass(ticket.priority)}`}
                  >
                    {ticket.priority || "unknown"}
                  </span>
                  <p className="text-gray-900 m-2">{ticket.issue || ticket.detail || ""}</p>
                  <div className="text-gray-700 text-sm font-bold mt-2">
                    <Link href={`/issue/${ticket.id}`}>View Full Ticket</Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
