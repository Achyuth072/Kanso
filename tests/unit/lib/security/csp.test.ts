import { describe, expect, it } from "vitest";
import { contentSecurityPolicyHeader } from "@/lib/security/csp";

const env = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  sentryDsn: "https://deadbeef@o123.ingest.de.sentry.io/456",
};

function directives(value: string): Map<string, string[]> {
  return new Map(
    value.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name, sources];
    }),
  );
}

function policy(
  overrides: Parameters<typeof contentSecurityPolicyHeader>[0] = {},
) {
  return directives(contentSecurityPolicyHeader(overrides).value);
}

describe("contentSecurityPolicyHeader", () => {
  it("enforces by default when mode is omitted, and reports in report-only mode", () => {
    expect(contentSecurityPolicyHeader(env).key).toBe(
      "Content-Security-Policy",
    );
    expect(contentSecurityPolicyHeader({ ...env, mode: "enforce" }).key).toBe(
      "Content-Security-Policy",
    );
    expect(
      contentSecurityPolicyHeader({ ...env, mode: "report-only" }).key,
    ).toBe("Content-Security-Policy-Report-Only");
  });

  it("locks down the fallback and the injection primitives", () => {
    const directiveMap = policy({ ...env, mode: "enforce" });

    expect(directiveMap.get("default-src")).toEqual(["'self'"]);
    expect(directiveMap.get("object-src")).toEqual(["'none'"]);
    expect(directiveMap.get("base-uri")).toEqual(["'none'"]);
    expect(directiveMap.get("form-action")).toEqual(["'self'"]);
    expect(directiveMap.get("frame-ancestors")).toEqual(["'none'"]);
    expect(directiveMap.get("worker-src")).toEqual(["'self'"]);
  });

  it("allows egress only to the origins the app genuinely calls", () => {
    const connect = policy({ ...env, mode: "enforce" }).get("connect-src");

    expect(connect).toEqual([
      "'self'",
      "https://abcdefgh.supabase.co",
      "wss://abcdefgh.supabase.co",
      "https://o123.ingest.de.sentry.io",
      "https://www.googleapis.com",
      "https://graph.microsoft.com",
      "https://api.pwnedpasswords.com",
      "https://challenges.cloudflare.com",
    ]);
  });

  it("derives ws:// for http:// supabase URLs (local dev) and wss:// for https://", () => {
    const localConnect = policy({
      supabaseUrl: "http://127.0.0.1:54321",
    }).get("connect-src");

    expect(localConnect).toContain("http://127.0.0.1:54321");
    expect(localConnect).toContain("ws://127.0.0.1:54321");
    expect(localConnect).not.toContain("wss://127.0.0.1:54321");

    const prodConnect = policy({
      supabaseUrl: "https://abcdefgh.supabase.co",
    }).get("connect-src");

    expect(prodConnect).toContain("https://abcdefgh.supabase.co");
    expect(prodConnect).toContain("wss://abcdefgh.supabase.co");
    expect(prodConnect).not.toContain("ws://abcdefgh.supabase.co");
  });

  it("omits origins whose configuration is absent", () => {
    const connect = policy({ mode: "enforce" }).get("connect-src");

    expect(connect).not.toContain("https://abcdefgh.supabase.co");
    expect(connect).not.toContain("https://o123.ingest.de.sentry.io");
    expect(connect).toContain("'self'");
  });

  it("ignores unparseable configuration rather than emitting a broken source", () => {
    const connect = policy({
      supabaseUrl: "not-a-url",
      sentryDsn: "also-not-a-url",
      mode: "enforce",
    }).get("connect-src");

    expect(connect).toEqual([
      "'self'",
      "https://www.googleapis.com",
      "https://graph.microsoft.com",
      "https://api.pwnedpasswords.com",
      "https://challenges.cloudflare.com",
    ]);
  });

  it("keeps the CAPTCHA loadable: its script, its frame, and its callbacks", () => {
    const directiveMap = policy({ ...env, mode: "enforce" });

    expect(directiveMap.get("script-src")).toContain(
      "https://challenges.cloudflare.com",
    );
    expect(directiveMap.get("frame-src")).toEqual([
      "https://challenges.cloudflare.com",
    ]);
    expect(directiveMap.get("connect-src")).toContain(
      "https://challenges.cloudflare.com",
    );
  });

  it("permits inline and eval scripts in script-src", () => {
    const scriptSrc = policy({ ...env, mode: "enforce" }).get("script-src");

    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).toContain("'unsafe-eval'");
  });

  it("adds no CDN origin", () => {
    const value = contentSecurityPolicyHeader({
      ...env,
      mode: "enforce",
    }).value;

    expect(value).not.toMatch(/cdn|unpkg|jsdelivr|cdnjs/i);
  });
});
