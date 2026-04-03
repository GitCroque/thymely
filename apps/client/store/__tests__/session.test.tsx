import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionProvider, useUser, useAuthedUser } from "../session";

const mockPush = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    pathname: "/",
    route: "/",
    asPath: "/",
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isReady: true,
  }),
}));

const mockProfile = {
  id: "user-1",
  email: "admin@test.com",
  name: "Test Admin",
  isAdmin: true,
  notifications: [],
  firstLogin: false,
};

function TestConsumer() {
  const { user, loading } = useUser();
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>No user</div>;
  return (
    <div>
      <span data-testid="user-name">{user.name}</span>
      <span data-testid="user-email">{user.email}</span>
      <span data-testid="user-admin">{String(user.isAdmin)}</span>
    </div>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches user profile and provides it to children", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ user: mockProfile }),
    });

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("user-name")).toHaveTextContent("Test Admin");
    });
    expect(screen.getByTestId("user-email")).toHaveTextContent("admin@test.com");
    expect(screen.getByTestId("user-admin")).toHaveTextContent("true");
  });

  it("redirects to login when profile fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("redirects to login on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    render(
      <SessionProvider>
        <TestConsumer />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/auth/login");
    });
  });
});

describe("useUser", () => {
  it("throws when used outside SessionProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useUser must be used within a UserProvider"
    );
    spy.mockRestore();
  });
});

describe("useAuthedUser", () => {
  it("throws when no user is authenticated", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    // useAuthedUser will throw during render when user is null
    // The SessionProvider sets user to null initially and during loading
    // We need to test this carefully
    let error: Error | null = null;
    function ErrorCatcher() {
      try {
        const { user } = useAuthedUser();
        return <span>{user.name}</span>;
      } catch (e) {
        error = e as Error;
        return <span>Error caught</span>;
      }
    }

    render(
      <SessionProvider>
        <ErrorCatcher />
      </SessionProvider>
    );

    // During loading, user is null, so useAuthedUser should throw
    expect(error).toBeTruthy();
    expect(error!.message).toBe("useAuthedUser requires an authenticated user");

    spy.mockRestore();
  });
});
