import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      // @/shadcn/* resolves to ./@/shadcn/* (literal @ directory)
      { find: /^@\/shadcn\/(.*)/, replacement: path.resolve(__dirname, "./@/shadcn/$1") },
      // @/* resolves to ./* (project root)
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, "./$1") },
    ],
  },
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}", "pages-tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./lib/__tests__/setup.ts"],
    css: false,
  },
});
