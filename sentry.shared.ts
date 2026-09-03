import { scrubBreadcrumb, scrubEvent } from "@/lib/errors/scrubEvent";

// Shared across client, server, and edge runtimes. Falsy DSN disables reporting.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_RELEASE_CHANNEL,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
};
