import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "../auth/login";

const mockPush = vi.fn();
const mockToast = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    pathname: "/auth/login",
    route: "/auth/login",
    asPath: "/auth/login",
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isReady: true,
  }),
}));

vi.mock("@/shadcn/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    });
  });

  it("renders email and password fields", () => {
    render(<Login />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("renders forgot password link", () => {
    render(<Login />);
    expect(screen.getByText("Forgot your password?")).toBeInTheDocument();
  });

  it("submits credentials and redirects to dashboard on success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () =>
        Promise.resolve({
          user: { id: "1", firstLogin: false, external_user: false },
        }),
    });

    render(<Login />);
    await user.type(screen.getByLabelText("Email address"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@test.com",
          password: "password123",
        }),
      });
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("redirects to /onboarding when firstLogin is true", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () =>
        Promise.resolve({
          user: { id: "1", firstLogin: true, external_user: false },
        }),
    });

    render(<Login />);
    await user.type(screen.getByLabelText("Email address"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("redirects to /portal for external users", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () =>
        Promise.resolve({
          user: { id: "1", firstLogin: false, external_user: true },
        }),
    });

    render(<Login />);
    await user.type(screen.getByLabelText("Email address"), "client@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/portal");
    });
  });

  it("shows error toast on invalid credentials", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () =>
        Promise.resolve({ message: "Invalid credentials" }),
    });

    render(<Login />);
    await user.type(screen.getByLabelText("Email address"), "bad@test.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
        })
      );
    });
  });

  it("shows error toast on network failure", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      // First call is oidcLogin (useEffect), let it succeed
      if (callCount === 1) {
        return Promise.resolve({ json: () => Promise.resolve({}) });
      }
      // Second call is the login attempt, make it fail
      return Promise.reject(new Error("Network error"));
    });

    render(<Login />);
    await user.type(screen.getByLabelText("Email address"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Connection error. Please try again.",
        })
      );
    });
  });

  it("shows OIDC button when SSO is configured", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () =>
        Promise.resolve({ success: true, url: "https://sso.example.com/auth" }),
    });

    render(<Login />);

    await waitFor(() => {
      expect(screen.getByText("Sign in with OIDC")).toBeInTheDocument();
    });
  });
});
