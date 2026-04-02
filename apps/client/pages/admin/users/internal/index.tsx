import { getCookie } from "cookies-next";
import Link from "next/link";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useFilters,
  useGlobalFilter,
  usePagination,
  useTable,
} from "react-table";
import ResetPassword from "../../../../components/ResetPassword";
import UpdateUserModal from "../../../../components/UpdateUserModal";

interface InternalUserRecord {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface InternalUsersResponse {
  users: InternalUserRecord[];
}

interface ColumnFilterProps {
  column: {
    filterValue?: string;
    setFilter: (value?: string) => void;
  };
}

interface TableColumnDefinition {
  id: string;
  hideHeader?: boolean;
  canFilter?: boolean;
  getHeaderProps: () => Record<string, unknown>;
  render: (name: string) => unknown;
}

interface TableHeaderGroupDefinition {
  headers: TableColumnDefinition[];
  getHeaderGroupProps: () => Record<string, unknown>;
}

interface TableCellDefinition {
  getCellProps: () => Record<string, unknown>;
  render: (name: string) => unknown;
}

interface TableRowDefinition {
  values: Record<string, unknown>;
  cells: TableCellDefinition[];
  original: InternalUserRecord;
  getRowProps: () => Record<string, unknown>;
}

interface TableInstanceDefinition {
  getTableProps: () => Record<string, unknown>;
  getTableBodyProps: () => Record<string, unknown>;
  headerGroups: TableHeaderGroupDefinition[];
  page: TableRowDefinition[];
  prepareRow: (row: TableRowDefinition) => void;
  canPreviousPage: boolean;
  canNextPage: boolean;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (pageSize: number) => void;
  state: {
    pageSize: number;
  };
}

async function fetchUsers(token?: string) {
  const response = await fetch("/api/v1/users/all", {
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  });

  return response.json() as Promise<InternalUsersResponse>;
}

function DefaultColumnFilter({ column: { filterValue, setFilter } }: ColumnFilterProps) {
  return (
    <input
      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
      type="text"
      value={filterValue || ""}
      onChange={(event) => {
        setFilter(event.target.value || undefined);
      }}
      placeholder="Type to filter"
    />
  );
}

function Table({
  columns,
  data,
}: {
  columns: Array<Record<string, unknown>>;
  data: InternalUserRecord[];
}) {
  const filterTypes = React.useMemo(
    () => ({
      text: (
        rows: TableRowDefinition[],
        id: string,
        filterValue: string
      ) =>
        rows.filter((row) => {
          const rowValue = row.values[id];
          return rowValue !== undefined
            ? String(rowValue)
                .toLowerCase()
                .startsWith(String(filterValue).toLowerCase())
            : true;
        }),
    }),
    []
  );

  const defaultColumn = React.useMemo(
    () => ({
      Filter: DefaultColumnFilter,
    }),
    []
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    canPreviousPage,
    canNextPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageSize },
  } = useTable(
    {
      columns: columns as never,
      data: data as never,
      defaultColumn: defaultColumn as never,
      filterTypes: filterTypes as never,
      initialState: {
        pageIndex: 0,
      } as never,
    } as never,
    useFilters,
    useGlobalFilter,
    usePagination
  ) as unknown as TableInstanceDefinition;

  return (
    <div className="overflow-x-auto md:-mx-6 lg:-mx-8">
      <div className="py-2 align-middle inline-block min-w-full md:px-6 lg:px-8">
        <div className="shadow overflow-hidden border-b border-gray-200 md:rounded-lg">
          <table
            {...getTableProps()}
            className="min-w-full divide-y divide-gray-200"
          >
            <thead className="bg-gray-50">
              {headerGroups.map((headerGroup: TableHeaderGroupDefinition) => (
                <tr
                  {...headerGroup.getHeaderGroupProps()}
                  key={headerGroup.headers.map((header) => header.id).join("-")}
                >
                  {headerGroup.headers.map((column: TableColumnDefinition) =>
                    column.hideHeader === false ? null : (
                      <th
                        {...column.getHeaderProps()}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.render("Header") as React.ReactNode}
                        <div>
                          {column.canFilter
                            ? (column.render("Filter") as React.ReactNode)
                            : null}
                        </div>
                      </th>
                    )
                  )}
                </tr>
              ))}
            </thead>
            <tbody {...getTableBodyProps()}>
              {page.map((row: TableRowDefinition) => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()} className="bg-white">
                    {row.cells.map((cell: TableCellDefinition) => (
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                        {...cell.getCellProps()}
                      >
                        {cell.render("Cell") as React.ReactNode}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data.length > 10 && (
            <nav
              className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6"
              aria-label="Pagination"
            >
              <div className="hidden sm:block">
                <div className="flex flex-row flex-nowrap w-full space-x-2">
                  <p className="block text-sm font-medium text-gray-700 mt-4">
                    Show
                  </p>
                  <select
                    id="location"
                    name="location"
                    className="block w-full pl-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                    }}
                  >
                    {[10, 20, 30, 40, 50].map((currentPageSize) => (
                      <option key={currentPageSize} value={currentPageSize}>
                        {currentPageSize}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex-1 flex justify-between sm:justify-end">
                <button
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  type="button"
                  onClick={() => previousPage()}
                  disabled={!canPreviousPage}
                >
                  Previous
                </button>
                <button
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  type="button"
                  onClick={() => nextPage()}
                  disabled={!canNextPage}
                >
                  Next
                </button>
              </div>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InternalUsersPage() {
  const token = getCookie("session")?.toString();
  const { data, status, refetch } = useQuery({
    queryKey: ["fetchAuthUsers"],
    queryFn: () => fetchUsers(token),
  });

  async function deleteUser(id: string) {
    try {
      await fetch(`/api/v1/auth/user/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      await refetch();
    } catch (error) {
      console.log(error);
    }
  }

  const columns = React.useMemo(
    () => [
      {
        Header: "Name",
        accessor: "name",
        width: 10,
        id: "name",
      },
      {
        Header: "Email",
        accessor: "email",
        id: "email",
      },
      {
        Header: "",
        id: "actions",
        Cell: ({ row }: { row: { original: InternalUserRecord } }) => (
          <div className="space-x-4 flex flex-row">
            <UpdateUserModal user={row.original} />
            <ResetPassword user={row.original} />
            {row.original.isAdmin ? null : (
              <button
                type="button"
                onClick={() => deleteUser(row.original.id)}
                className="inline-flex items-center px-4 py-1.5 border font-semibold border-gray-300 shadow-sm text-xs rounded text-white bg-red-700 hover:bg-red-500"
              >
                Delete
              </button>
            )}
          </div>
        ),
      },
    ],
    [token]
  );

  return (
    <main className="flex-1">
      <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
        <div className="pt-10 pb-16 divide-y-2">
          <div className="px-4 sm:px-6 md:px-0">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Internal Users
            </h1>
          </div>
          <div className="px-4 sm:px-6 md:px-0">
            <div className="sm:flex sm:items-center">
              <div className="sm:flex-auto mt-4">
                <p className="mt-2 text-sm text-gray-700 dark:text-white">
                  A list of all internal users of your instance.
                </p>
              </div>
              <div className="sm:ml-16 mt-5 sm:flex-none">
                <Link
                  href="/admin/users/internal/new"
                  className="rounded bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  New User
                </Link>
              </div>
            </div>
            <div className="py-4">
              {status === "pending" && (
                <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
                  <h2> Loading data ... </h2>
                </div>
              )}

              {status === "error" && (
                <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
                  <h2 className="text-2xl font-bold">Error fetching data ...</h2>
                </div>
              )}

              {status === "success" && data && (
                <div>
                  <div className="hidden sm:block">
                    <Table columns={columns} data={data.users} />
                  </div>
                  <div className="sm:hidden">
                    {data.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col text-center bg-white rounded-lg shadow mt-4"
                      >
                        <div className="flex-1 flex flex-col p-8">
                          <h3 className="text-gray-900 text-sm font-medium">
                            {user.name}
                          </h3>
                          <dl className="mt-1 flex-grow flex flex-col justify-between">
                            <dd className="text-gray-500 text-sm">
                              {user.email}
                            </dd>
                            <dt className="sr-only">Role</dt>
                            <dd className="mt-3">
                              <span className="px-2 py-1 text-green-800 text-xs font-medium bg-green-100 rounded-full">
                                {user.isAdmin ? "admin" : "user"}
                              </span>
                            </dd>
                          </dl>
                        </div>
                        <div className="space-x-4 flex flex-row justify-center -mt-8 mb-4">
                          <UpdateUserModal user={user} />
                          <ResetPassword user={user} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
