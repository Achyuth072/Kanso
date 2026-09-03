export interface CspOptions {
  supabaseUrl?: string;
  sentryDsn?: string;
  mode?: "enforce" | "report-only";
}

const TURNSTILE = "https://challenges.cloudflare.com";

function parseUrl(url: string | undefined): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function contentSecurityPolicyHeader(options: CspOptions = {}): {
  key: string;
  value: string;
} {
  const supabase = parseUrl(options.supabaseUrl);
  const sentry = parseUrl(options.sentryDsn);

  const supabaseWs = supabase
    ? `${supabase.protocol === "http:" ? "ws:" : "wss:"}//${supabase.host}`
    : null;

  const connectSrc = [
    "'self'",
    supabase?.origin,
    supabaseWs,
    sentry?.origin,
    // Direct calendar sync (Google / Microsoft)
    "https://www.googleapis.com",
    "https://graph.microsoft.com",
    // HaveIBeenPwned password breach check
    "https://api.pwnedpasswords.com",
    TURNSTILE,
  ].filter((source): source is string => Boolean(source));

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", TURNSTILE],
    // Next.js runtime and next/font inject un-nonced <style> tags
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "connect-src": connectSrc,
    "frame-src": [TURNSTILE],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'none'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const mode = options.mode ?? "enforce";

  return {
    key:
      mode === "report-only"
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy",
    value: Object.entries(directives)
      .map(([name, sources]) => [name, ...sources].join(" "))
      .join("; "),
  };
}
