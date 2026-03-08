import { useRouter } from "next/router";
import Link from "next/link";
import { getCookie } from "cookies-next";
import {
  KeyRound,
  Mail,
  Users,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";

import { useUser } from "../store/session";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";

const steps = [
  {
    title: "Change your password",
    description: "Secure your admin account",
    href: "/settings/password",
    icon: KeyRound,
  },
  {
    title: "Configure email",
    description: "Set up SMTP to send notifications",
    href: "/admin/smtp",
    icon: Mail,
  },
  {
    title: "Create your team",
    description: "Add users who will handle tickets",
    href: "/admin/users/internal/new",
    icon: Users,
  },
  {
    title: "Explore the dashboard",
    description: "You're all set!",
    href: "/",
    icon: LayoutDashboard,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { user } = useUser();

  async function updateFirstLogin() {
    await fetch(`/api/v1/auth/user/${user.id}/first-login`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCookie("session")}`,
      },
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          router.push("/");
        }
      });
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome to Thymely
          </h1>
          <p className="text-muted-foreground">
            Let&apos;s get you set up. Here are the recommended first steps:
          </p>
        </div>

        <div className="grid gap-4">
          {steps.map((step, index) => (
            <Link key={step.href} href={step.href} className="block group">
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base">
                      <span className="text-muted-foreground mr-2">
                        {index + 1}.
                      </span>
                      {step.title}
                    </CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={updateFirstLogin} size="lg">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
