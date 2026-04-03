import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// Mock next/router
vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    query: {},
    pathname: "/",
    route: "/",
    asPath: "/",
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isReady: true,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href: _href }: { children: React.ReactNode; href: string }) => {
    return children;
  },
}));

// Mock toast
vi.mock("@/shadcn/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

// Mock cookies-next
vi.mock("cookies-next", () => ({
  getCookie: vi.fn(() => "mock-session-token"),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));
