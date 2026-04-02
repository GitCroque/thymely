import type { ComponentType, Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/router";

export interface UserNotification {
  id: string;
  createdAt: string;
  read: boolean;
  text: string;
  ticketId: string | null;
  [key: string]: unknown;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  language?: string | null;
  role?: string | null;
  avatar?: string | null;
  external_user?: boolean;
  firstLogin?: boolean;
  notifications: UserNotification[];
  ticket_created?: boolean;
  ticket_status_changed?: boolean;
  ticket_comments?: boolean;
  ticket_assigned?: boolean;
  [key: string]: unknown;
}

export interface UserContextValue {
  user: SessionUser | null;
  setUser: Dispatch<SetStateAction<SessionUser | null>>;
  loading: boolean;
  fetchUserProfile: () => Promise<void>;
}

interface SessionProviderProps {
  children: ReactNode;
}

interface ProfileResponse {
  user?: SessionUser;
}

type PostHogProviderComponent = ComponentType<{
  client: unknown;
  children: ReactNode;
}>;

const UserContext = createContext<UserContextValue | undefined>(undefined);

const shouldUsePostHog =
  process.env.NEXT_PUBLIC_ENVIRONMENT === "production" &&
  process.env.NEXT_PUBLIC_TELEMETRY === "1" &&
  Boolean(process.env.NEXT_PUBLIC_POSTHOG);

export function SessionProvider({ children }: SessionProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [posthogClient, setPosthogClient] = useState<unknown | null>(null);
  const [PHProvider, setPHProvider] = useState<PostHogProviderComponent | null>(null);

  useEffect(() => {
    if (!shouldUsePostHog) {
      return;
    }

    void Promise.all([import("posthog-js"), import("posthog-js/react")]).then(
      ([posthogModule, reactModule]) => {
        const posthog = posthogModule.default;
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG || "");
        setPosthogClient(posthog);
        setPHProvider(() => reactModule.PostHogProvider as PostHogProviderComponent);
      }
    );
  }, []);

  async function fetchUserProfile() {
    try {
      const response = await fetch("/api/v1/auth/profile", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as ProfileResponse;

      if (payload.user) {
        setUser(payload.user);
        return;
      }

      console.error("Failed to fetch user profile");
      await router.push("/auth/login");
    } catch (error) {
      console.error("Error fetching user profile:", error);
      await router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchUserProfile();
  }, [router]);

  const provider = (
    <UserContext.Provider value={{ user, setUser, loading, fetchUserProfile }}>
      {children}
    </UserContext.Provider>
  );

  if (shouldUsePostHog && posthogClient && PHProvider) {
    return <PHProvider client={posthogClient}>{provider}</PHProvider>;
  }

  return provider;
}

export function useUser() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }

  return context;
}

export function useAuthedUser() {
  const context = useUser();

  if (!context.user) {
    throw new Error("useAuthedUser requires an authenticated user");
  }

  return {
    ...context,
    user: context.user,
  };
}
