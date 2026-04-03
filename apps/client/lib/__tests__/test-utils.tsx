import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { SessionProvider, type SessionUser } from "../../store/session";

const mockUser: SessionUser = {
  id: "test-user-id",
  email: "admin@test.com",
  name: "Test Admin",
  isAdmin: true,
  language: "en",
  notifications: [],
  firstLogin: false,
};

interface WrapperProps {
  children: ReactNode;
}

function createWrapper(fetchResponse?: Partial<SessionUser>) {
  const user = fetchResponse ? { ...mockUser, ...fetchResponse } : mockUser;

  // Mock the fetch for profile endpoint before rendering
  global.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/v1/auth/profile")) {
        return new Response(JSON.stringify({ user }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    },
    { name: "mockFetch" }
  ) as typeof fetch;

  return function Wrapper({ children }: WrapperProps) {
    return <SessionProvider>{children}</SessionProvider>;
  };
}

export function renderWithSession(
  ui: ReactElement,
  userOverrides?: Partial<SessionUser>,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: createWrapper(userOverrides), ...options });
}

export { mockUser };
export { render, screen, waitFor, within } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
