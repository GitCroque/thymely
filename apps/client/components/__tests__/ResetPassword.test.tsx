import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPassword from "../ResetPassword/index";

const mockToast = vi.fn();

vi.mock("@/shadcn/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("cookies-next", () => ({
  getCookie: vi.fn(() => "mock-session-token"),
}));

describe("ResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
  });

  it("renders the reset password button", () => {
    render(<ResetPassword user={{ id: "user-1" }} />);
    expect(screen.getByText("Reset Password")).toBeInTheDocument();
  });

  it("opens the dialog when clicking the button", async () => {
    const user = userEvent.setup();
    render(<ResetPassword user={{ id: "user-1" }} />);

    await user.click(screen.getByText("Reset Password"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Enter users new password")
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Confirm users password")
      ).toBeInTheDocument();
    });
  });

  it("calls API and shows success toast when passwords match", async () => {
    const user = userEvent.setup();
    render(<ResetPassword user={{ id: "user-1" }} />);

    await user.click(screen.getByText("Reset Password"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Enter users new password")
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Enter users new password"),
      "newpassword123"
    );
    await user.type(
      screen.getByPlaceholderText("Confirm users password"),
      "newpassword123"
    );

    await user.click(screen.getByText("Update"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/auth/admin/reset-password",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            password: "newpassword123",
            user: "user-1",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Password Reset Successful",
        })
      );
    });
  });

  it("shows error toast when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<ResetPassword user={{ id: "user-1" }} />);

    await user.click(screen.getByText("Reset Password"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Enter users new password")
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Enter users new password"),
      "password1"
    );
    await user.type(
      screen.getByPlaceholderText("Confirm users password"),
      "password2"
    );

    await user.click(screen.getByText("Update"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Passwords do not match",
        })
      );
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows error toast when API returns failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });

    const user = userEvent.setup();
    render(<ResetPassword user={{ id: "user-1" }} />);

    await user.click(screen.getByText("Reset Password"));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("Enter users new password")
      ).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText("Enter users new password"),
      "newpassword123"
    );
    await user.type(
      screen.getByPlaceholderText("Confirm users password"),
      "newpassword123"
    );

    await user.click(screen.getByText("Update"));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Uh oh! Something went wrong.",
        })
      );
    });
  });

  it("closes the dialog when clicking cancel", async () => {
    const user = userEvent.setup();
    render(<ResetPassword user={{ id: "user-1" }} />);

    await user.click(screen.getByText("Reset Password"));

    await waitFor(() => {
      expect(screen.getByText("Update")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Enter users new password")
      ).not.toBeInTheDocument();
    });
  });
});
