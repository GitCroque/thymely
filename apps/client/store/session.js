// UserContext.js
import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext();

const shouldUsePostHog =
  process.env.NEXT_PUBLIC_ENVIRONMENT === "production" &&
  process.env.NEXT_PUBLIC_TELEMETRY === "1" &&
  !!process.env.NEXT_PUBLIC_POSTHOG;

export const SessionProvider = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posthogClient, setPosthogClient] = useState(null);
  const [PHProvider, setPHProvider] = useState(null);

  // Lazy-load PostHog only when telemetry is enabled (~50-70KB saved otherwise)
  useEffect(() => {
    if (!shouldUsePostHog) return;

    Promise.all([import("posthog-js"), import("posthog-js/react")]).then(
      ([posthogModule, reactModule]) => {
        const posthog = posthogModule.default;
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG);
        setPosthogClient(posthog);
        setPHProvider(() => reactModule.PostHogProvider);
      }
    );
  }, []);

  const fetchUserProfile = async () => {
    try {
      await fetch(`/api/v1/auth/profile`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.user) {
            setUser(res.user);
            setLoading(false);
          } else {
            console.error("Failed to fetch user profile");
            router.push("/auth/login");
          }
        });
    } catch (error) {
      // Handle fetch errors if necessary
      console.error("Error fetching user profile:", error);
      router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
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
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
