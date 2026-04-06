import {
  BookOpenText,
  ContactIcon,
  KeyRound,
  Mail,
  Mailbox,
  MoveLeft,
  RollerCoaster,
  UserRound,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { NavMain } from "@/shadcn/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/shadcn/ui/sidebar";
import useTranslation from "next-translate/useTranslation";
import { useRouter } from "next/router";
import ThemeSettings from "../../../components/ThemeSettings";

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useRouter();
  const { t } = useTranslation("thymely");

  const data = {
    navMain: [
      {
        title: "Back",
        url: "/",
        icon: MoveLeft,
        isActive: false,
        initial: "",
      },
      {
        title: t("sl_users"),
        url: "/admin/users/internal",
        icon: UserRound,
        isActive: location.pathname === "/admin/users/internal",
        initial: "",
      },
      {
        title: t("sl_clients"),
        url: "/admin/clients",
        icon: ContactIcon,
        isActive: location.pathname === "/admin/clients",
        initial: "",
      },
      {
        title: "Email Queues",
        url: "/admin/email-queues",
        icon: Mail,
        isActive: location.pathname === "/admin/email-queues",
        initial: "",
      },
      {
        title: "Webhooks",
        url: "/admin/webhooks",
        icon: Webhook,
        isActive: location.pathname === "/admin/webhooks",
        initial: "",
      },
      {
        title: "SMTP Email",
        url: "/admin/smtp",
        icon: Mailbox,
        isActive: location.pathname === "/admin/smtp",
        initial: "",
      },
      {
        title: "Authentication",
        url: "/admin/authentication",
        icon: KeyRound,
        isActive: location.pathname === "/admin/authentication",
        initial: "",
      },
      {
        title: "Roles",
        url: "/admin/roles",
        icon: RollerCoaster,
        isActive: location.pathname === "/admin/roles",
        initial: "",
      },
      {
        title: "Knowledge Base",
        url: "/admin/knowledge-base",
        icon: BookOpenText,
        isActive: location.pathname === "/admin/knowledge-base",
        initial: "",
      },
    ],
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 no-underline">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
            <img src="/favicon/favicon-32x32.png" className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-xl">Thymely</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="hidden sm:block">
          <ThemeSettings />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
