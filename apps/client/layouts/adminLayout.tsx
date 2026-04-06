import { Button } from "@radix-ui/themes";
import Link from "next/link";

import { AccountDropdown } from "../components/AccountDropdown";

import { AdminSidebar } from "@/shadcn/components/admin-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/shadcn/ui/sidebar";
import { Bell } from "lucide-react";
import { useAuthedUser } from "../store/session";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuthedUser();
  const unreadNotifications = user.notifications.filter(
    (notification) => !notification.read
  );

  if (user && !user.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1 className="text-4xl font-bold">You are not an admin</h1>
      </div>
    );
  }

  return (
    !loading &&
    user && (
      <div className="min-h-screen overflow-hidden">
        <SidebarProvider>
          <AdminSidebar />
          <div className="w-full">
            <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-x-4 border-b bg-background px-4 sm:gap-x-6">
              <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center">
                <SidebarTrigger title="[" />
                <div className="sm:flex hidden w-full justify-start items-center space-x-6">
                  {user.isAdmin && (
                    <Link href="https://github.com/GitCroque/thymely/releases">
                      <span className="inline-flex items-center rounded-md bg-green-700/10 px-3 py-2 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/20">
                        Version {process.env.NEXT_PUBLIC_CLIENT_VERSION}
                      </span>
                    </Link>
                  )}
                </div>

                <div className="flex w-full sticky right-0 justify-end items-center gap-x-2 lg:gap-x-2">
                  <Button
                    variant="outline"
                    className="relative rounded-md p-2 text-gray-500 hover:text-gray-600 hover:cursor-pointer focus:outline-none"
                  >
                    <Link href="/notifications">
                      <Bell className="h-4 w-4 text-foreground" />
                      {unreadNotifications.length > 0 && (
                        <svg
                          className="h-2.5 w-2.5 absolute bottom-6 left-6 animate-pulse fill-green-500"
                          viewBox="0 0 6 6"
                          aria-hidden="true"
                        >
                          <circle cx={3} cy={3} r={3} />
                        </svg>
                      )}
                    </Link>
                  </Button>

                  {user.isAdmin && (
                    <Link
                      href="https://github.com/GitCroque/thymely/discussions"
                      target="_blank"
                      className="hover:cursor-pointer"
                    >
                      <Button
                        variant="outline"
                        className="text-foreground hover:cursor-pointer whitespace-nowrap"
                      >
                        Send Feedback
                      </Button>
                    </Link>
                  )}

                  <AccountDropdown />
                </div>
              </div>
            </div>
            {!loading && !user.external_user && (
              <main id="main-content" className="bg-background min-h-screen">{children}</main>
            )}
          </div>
        </SidebarProvider>
      </div>
    )
  );
}
