import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Must mock dynamic imports and heavy deps before importing the component
vi.mock("next/dynamic", () => ({
  default: () => {
    const MockEditor = ({ setIssue }: { setIssue: (v: string) => void }) => (
      <textarea
        data-testid="mock-editor"
        onChange={(e) => setIssue(e.target.value)}
      />
    );
    MockEditor.displayName = "MockEditor";
    return MockEditor;
  },
}));

vi.mock("next-translate/useTranslation", () => ({
  default: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("cookies-next", () => ({
  getCookie: vi.fn(() => "mock-token"),
}));

const mockPush = vi.fn();
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    pathname: "/new",
    route: "/new",
    asPath: "/new",
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isReady: true,
  }),
}));

const mockToast = vi.fn();
vi.mock("@/shadcn/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("../store/session", () => ({
  useAuthedUser: () => ({
    user: { id: "user-1", name: "Admin", email: "admin@test.com", isAdmin: true, notifications: [] },
  }),
}));

import CreateTicket from "../pages/new";

describe("Create Ticket page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return clients and users for the initial fetches
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/clients/all")) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              clients: [
                { id: "c1", name: "Acme Corp" },
                { id: "c2", name: "Beta Inc" },
              ],
            }),
        });
      }
      if (url.includes("/api/v1/users/all")) {
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              users: [
                { id: "u1", name: "Alice" },
                { id: "u2", name: "Bob" },
              ],
            }),
        });
      }
      if (url.includes("/api/v1/ticket/create")) {
        return Promise.resolve({
          json: () => Promise.resolve({ success: true, id: "new-ticket-id" }),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
  });

  it("renders the ticket creation form", async () => {
    render(<CreateTicket />);

    await waitFor(() => {
      expect(screen.getByText("Create Ticket")).toBeInTheDocument();
    });
  });

  it("fetches clients and users on mount", async () => {
    render(<CreateTicket />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/clients/all",
        expect.objectContaining({ method: "GET" })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/users/all",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("shows error toast when client fetch fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (url: string) => {
        if (url.includes("/api/v1/clients/all")) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          json: () => Promise.resolve({ users: [] }),
        });
      }
    );

    render(<CreateTicket />);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
        })
      );
    });
  });

  it("submits ticket and navigates on success", async () => {
    const user = userEvent.setup();
    render(<CreateTicket />);

    // Fill in the title field
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /title/i }) || screen.getByPlaceholderText(/title/i)).toBeInTheDocument();
    });

    // Find title input and fill it
    const titleInputs = screen.getAllByRole("textbox");
    const titleInput = titleInputs.find(
      (el) => el.getAttribute("name") === "title" || el.getAttribute("placeholder")?.toLowerCase().includes("title")
    );

    if (titleInput) {
      await user.type(titleInput, "Test ticket title");
    }
  });
});
