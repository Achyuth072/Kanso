import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";
import { version } from "./package.json";

import bundleAnalyzer from "@next/bundle-analyzer";
import { contentSecurityPolicyHeader } from "@/lib/security/csp";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: true,
});

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable:
    process.env.NODE_ENV === "development" && process.env.ENABLE_PWA !== "true",
  // App Router routes are reached via client-side navigation, so a document
  // fetch never happens for them unless we cache it ourselves on navigate.
  cacheOnNavigation: true,
});

const isMobile = process.env.NEXT_PUBLIC_IS_CAPACITOR === "true";

const isTurbopack = process.env.TURBOPACK === "1";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  allowedDevOrigins: process.env.LAN_DEV_ORIGIN
    ? [process.env.LAN_DEV_ORIGIN]
    : [],
  output: isMobile ? "export" : undefined,
  images: {
    // Mobile builds use static export (no optimization server).
    unoptimized: isMobile,
  },
  // Silences Next.js warning when webpack plugins coexist with Turbopack.
  turbopack: {},
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Retained for older browsers; CSP frame-ancestors supersedes it.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          contentSecurityPolicyHeader({
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
            mode:
              process.env.CSP_MODE === "report-only"
                ? "report-only"
                : undefined,
          }),
        ],
      },
      {
        source: "/changelog.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/changelog-version.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

const config = withBundleAnalyzer(
  isTurbopack ? nextConfig : withSerwist(nextConfig),
);

// No-ops unless SENTRY_AUTH_TOKEN and org/project are set.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Upload source maps once after the full build instead of per compiler pass.
  useRunAfterProductionCompileHook: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
