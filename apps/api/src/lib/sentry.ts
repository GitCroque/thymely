import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.APP_VERSION || "dev",
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    beforeSend(event) {
      // Strip sensitive data from error reports
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });
}

export { Sentry };
export const sentryEnabled = Boolean(dsn);
