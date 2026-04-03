import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Portal from "../pages/portal/index";

const mockPush = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    pathname: "/portal",
    route: "/portal",
    asPath: "/portal",
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isReady: true,
  }),
}));

vi.mock("next-translate/useTranslation", () => ({
  default: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        recent_tickets: "Recent tickets",
        title: "Title",
        priority: "Priority",
        status: "Status",
        created: "Created",
        assigned_to: "Assigned to",
        open: "Open",
        closed: "Closed",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("cookies-next", () => ({
  getCookie: vi.fn(() => "mock-session-token"),
}));

vi.mock("../store/session", () => ({
  useUser: () => ({
    user: { id: "1", name: "Test", email: "test@test.com", isAdmin: false, notifications: [] },
    loading: false,
  }),
}));

const mockTickets = [
  {
    id: "ticket-1",
    title: "Cannot login",
    email: "user@test.com",
    priority: "High",
    createdAt: "2026-03-15T10:00:00Z",
    isComplete: false,
    assignedTo: { name: "Admin" },
  },
  {
    id: "ticket-2",
    title: "Feature request",
    email: "user@test.com",
    priority: "Low",
    createdAt: "2026-03-10T10:00:00Z",
    isComplete: true,
    assignedTo: null,
  },
];

describe("Portal home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows CTA when no tickets exist", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: [] }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("Create your first issue")).toBeInTheDocument();
    });
  });

  it("navigates to /portal/new when CTA is clicked", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: [] }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("Create your first issue")).toBeInTheDocument();
    });

    screen.getByText("Create your first issue").closest("button")?.click();

    expect(mockPush).toHaveBeenCalledWith("/portal/new");
  });

  it("renders ticket list when tickets exist", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: mockTickets }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("Recent tickets")).toBeInTheDocument();
    });

    expect(screen.getByText("Cannot login")).toBeInTheDocument();
    expect(screen.getByText("Feature request")).toBeInTheDocument();
  });

  it("displays priority badges correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: mockTickets }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("High")).toBeInTheDocument();
    });
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("displays open/closed status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: mockTickets }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("Open")).toBeInTheDocument();
    });
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("displays assigned user name or dash", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: mockTickets }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("navigates to ticket detail on row click", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: mockTickets }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(screen.getByText("Cannot login")).toBeInTheDocument();
    });

    screen.getByText("Cannot login").closest("tr")?.click();

    expect(mockPush).toHaveBeenCalledWith("/issue/ticket-1");
  });

  it("calls the correct API endpoint with auth header", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ tickets: [] }),
    });

    render(<Portal />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/tickets/user/open", {
        method: "GET",
        headers: {
          Authorization: "Bearer mock-session-token",
        },
      });
    });
  });
});
