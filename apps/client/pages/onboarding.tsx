import { useRouter } from "next/router";
import { useState } from "react";
import {
  KeyRound,
  Mail,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  CircleCheck,
  CircleX,
  Plug,
  Settings,
  Users,
  BookOpen,
} from "lucide-react";

import { useUser } from "../store/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/ui/card";
import { Button } from "@/shadcn/ui/button";
import { Input } from "@/shadcn/ui/input";
import { Label } from "@/shadcn/ui/label";

const TOTAL_STEPS = 3;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i === current
              ? "w-8 bg-primary"
              : i < current
                ? "w-2 bg-primary/50"
                : "w-2 bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function PasswordStep({
  email,
  onNext,
}: {
  email: string;
  onNext: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isValid = password.length >= 8 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    try {
      // Change the password (this deletes all sessions + clears cookie)
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }).then((r) => r.json());

      if (!res.success) {
        setError(res.message || "Failed to update password");
        return;
      }

      // Re-login to get a fresh session (reset-password invalidates all sessions)
      const login = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());

      if (login.user) {
        onNext();
      } else {
        setError("Password changed but re-login failed. Please refresh and log in.");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Secure your account</CardTitle>
            <CardDescription>
              Change the default admin password to something secure.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-destructive">
                Password must be at least 8 characters
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type the same password"
            />
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-destructive">
                Passwords do not match
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={!isValid || loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type SmtpTestStatus = "idle" | "testing" | "success" | "error";

function EmailStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("465");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState<SmtpTestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");

  const hasSmtpFields =
    host.length > 0 &&
    port.length > 0 &&
    username.length > 0 &&
    password.length > 0;

  const isValid = hasSmtpFields && reply.length > 0;

  async function handleTest() {
    if (!hasSmtpFields) return;

    setTestStatus("testing");
    setTestMessage("");

    try {
      const res = await fetch("/api/v1/config/email/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, username, password }),
      }).then((r) => r.json());

      if (res.success) {
        setTestStatus("success");
        setTestMessage("Connection successful");
      } else {
        setTestStatus("error");
        setTestMessage(res.message || "Connection failed");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Could not reach the server");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/config/email", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, username, password, reply, active: true }),
      }).then((r) => r.json());

      if (res.success) {
        onNext();
      } else {
        setError(res.message || "Failed to configure email");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Configure email</CardTitle>
            <CardDescription>
              Set up SMTP so Thymely can send ticket notifications. You can
              also configure this later in Settings.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP host</Label>
              <Input
                id="smtp-host"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  setTestStatus("idle");
                }}
                placeholder="smtp.gmail.com"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                value={port}
                onChange={(e) => {
                  setPort(e.target.value);
                  setTestStatus("idle");
                }}
                placeholder="465"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-user">Username</Label>
            <Input
              id="smtp-user"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setTestStatus("idle");
              }}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtp-pass">Password</Label>
            <Input
              id="smtp-pass"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setTestStatus("idle");
              }}
              placeholder="SMTP password or app password"
            />
          </div>

          {/* Test connection button */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasSmtpFields || testStatus === "testing"}
              onClick={handleTest}
            >
              {testStatus === "testing" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plug className="h-4 w-4 mr-2" />
              )}
              Test connection
            </Button>
            {testStatus === "success" && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CircleCheck className="h-4 w-4" />
                {testMessage}
              </span>
            )}
            {testStatus === "error" && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <CircleX className="h-4 w-4" />
                {testMessage}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="smtp-reply">Reply-to address</Label>
            <Input
              id="smtp-reply"
              type="email"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="support@example.com"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
            <Button type="submit" disabled={!isValid || loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save & Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DoneStep({
  onFinish,
  emailConfigured,
}: {
  onFinish: () => void;
  emailConfigured: boolean;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Card>
      <CardHeader className="text-center pb-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">You&apos;re all set!</CardTitle>
        <CardDescription>
          Thymely is ready to use. Here&apos;s what you can do next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Recommended next steps</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Users className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Create user accounts</strong> &mdash;
                Add your team members in Settings &gt; Users
              </span>
            </li>
            {!emailConfigured && (
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-foreground">Set up email</strong> &mdash;
                  Configure SMTP in Settings to enable notifications
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <Settings className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Customize your instance</strong> &mdash;
                Adjust branding, roles, and integrations in Settings
              </span>
            </li>
            <li className="flex items-start gap-2">
              <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">Read the docs</strong> &mdash;
                Visit{" "}
                <a
                  href="https://github.com/GitCroque/thymely"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  the documentation
                </a>{" "}
                for guides and API reference
              </span>
            </li>
          </ul>
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => {
              setLoading(true);
              onFinish();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [emailConfigured, setEmailConfigured] = useState(false);

  if (!user) {
    return null;
  }

  const currentUser = user;

  async function finishOnboarding() {
    try {
      await fetch(`/api/v1/auth/user/${currentUser.id}/first-login`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — redirect regardless
    }
    router.push("/");
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">
            Welcome to Thymely
          </h1>
          <p className="text-muted-foreground text-sm">
            {step < TOTAL_STEPS - 1
              ? `Step ${step + 1} of ${TOTAL_STEPS - 1}`
              : "Setup complete"}
          </p>
        </div>

        <StepIndicator current={step} />

        {step === 0 && (
          <PasswordStep email={currentUser.email} onNext={() => setStep(1)} />
        )}

        {step === 1 && (
          <EmailStep
            onNext={() => {
              setEmailConfigured(true);
              setStep(2);
            }}
            onSkip={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <DoneStep
            onFinish={finishOnboarding}
            emailConfigured={emailConfigured}
          />
        )}

        {step > 0 && step < TOTAL_STEPS - 1 && (
          <div className="flex justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
