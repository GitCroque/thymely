import { PostHog } from "posthog-node";

const noopClient = {
  capture: () => {},
  shutdownAsync: () => Promise.resolve(),
} as unknown as PostHog;

export function track(): PostHog {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) {
    return noopClient;
  }

  return new PostHog(apiKey, { host: "https://app.posthog.com" });
}
