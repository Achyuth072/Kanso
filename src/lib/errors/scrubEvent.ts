// Structural payload shape so changing reporting backends requires only a DSN update.
export const REDACTED = "[redacted]";

// Allowlisted because breadcrumbs and spans carry arbitrary SDK and runtime keys.
const SAFE_DATA_KEYS = ["method", "status_code", "from", "to", "url"];

const URL_DATA_KEYS = ["url", "from", "to", "http.url"];

type ScrubbableBreadcrumb = {
  message?: unknown;
  data?: Record<string, unknown>;
};

type ScrubbableEvent = {
  message?: unknown;
  exception?: {
    values?: {
      value?: unknown;
      stacktrace?: { frames?: { vars?: unknown }[] };
    }[];
  };
  breadcrumbs?: ScrubbableBreadcrumb[];
  spans?: { description?: unknown; data?: Record<string, unknown> }[];
  request?: { url?: unknown; method?: unknown };
  extra?: unknown;
  contexts?: Record<string, unknown>;
  user?: { id?: unknown };
};

// Supabase REST puts filter values in query strings (`?title=eq.Buy+milk`), leaking content.
function stripQuery(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

function pickSafeData(
  data: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const safe: Record<string, unknown> = {};
  for (const key of SAFE_DATA_KEYS) {
    if (!(key in data)) continue;
    safe[key] = URL_DATA_KEYS.includes(key) ? stripQuery(data[key]) : data[key];
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

export function scrubBreadcrumb<T extends object>(breadcrumb: T): T {
  const crumb = breadcrumb as ScrubbableBreadcrumb;
  if (typeof crumb.message === "string") crumb.message = REDACTED;
  if (crumb.data) crumb.data = pickSafeData(crumb.data);
  return breadcrumb;
}

export function scrubEvent<T extends object>(event: T): T {
  const payload = event as ScrubbableEvent;

  if (typeof payload.message === "string") payload.message = REDACTED;

  for (const exception of payload.exception?.values ?? []) {
    if (typeof exception.value === "string") exception.value = REDACTED;
    for (const frame of exception.stacktrace?.frames ?? []) {
      delete frame.vars;
    }
  }

  payload.breadcrumbs?.forEach(scrubBreadcrumb);

  for (const span of payload.spans ?? []) {
    span.description = stripQuery(span.description);
    if (span.data) span.data = pickSafeData(span.data);
  }

  if (payload.request) {
    payload.request = {
      url: stripQuery(payload.request.url),
      method: payload.request.method,
    };
  }

  delete payload.extra;
  delete payload.contexts?.state;
  if (payload.user) payload.user = { id: payload.user.id };

  return event;
}
