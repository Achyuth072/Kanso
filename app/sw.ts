import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  NetworkFirst,
  type RuntimeCaching,
  type SerwistPlugin,
} from "serwist";

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

interface StrategyWithCacheName {
  cacheName: string;
  plugins?: SerwistPlugin[];
}

// ⚡ Offline Resilience: Patch defaultCache to add a 3s timeout to navigation/pages.
// Without this, the browser waits for the full TCP timeout (~3.3 min) before serving cache.
const patchedCache = defaultCache.map((entry) => {
  const handler = entry.handler;
  // Check if handler is a strategy object with a cacheName (like NetworkFirst)
  if (handler && typeof handler !== "function" && "cacheName" in handler) {
    const strategy = handler as unknown as StrategyWithCacheName;
    if (
      strategy.cacheName === PAGES_CACHE_NAME.html ||
      strategy.cacheName === PAGES_CACHE_NAME.rsc ||
      strategy.cacheName === PAGES_CACHE_NAME.rscPrefetch ||
      strategy.cacheName === "others"
    ) {
      return {
        ...entry,
        handler: new NetworkFirst({
          cacheName: strategy.cacheName,
          plugins: strategy.plugins,
          networkTimeoutSeconds: 3,
        }),
      };
    }
  }
  return entry;
});

// Replace the final catch-all NetworkOnly (matcher: /.*/i) with a 10s NetworkFirst
const finalCache: RuntimeCaching[] = [
  ...patchedCache.filter((e) => {
    // Keep everything except the catch-all NetworkOnly rule
    const isCatchAll =
      e.matcher instanceof RegExp &&
      e.matcher.source === ".*" &&
      e.matcher.flags.includes("i");
    return !isCatchAll;
  }),
  {
    matcher: /.*/i,
    method: "GET",
    handler: new NetworkFirst({
      cacheName: "others",
      networkTimeoutSeconds: 10,
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: finalCache,
  // 🛡️ Offline Fallback: Serve the precached /~offline page when navigations fail.
  // Content is served directly (no redirect) to avoid infinite loops.
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Push Notification Handlers
// Fix for Vercel build: NotificationOptions in some envs is missing vibrate
interface ExtendedNotificationOptions extends NotificationOptions {
  vibrate?: number[];
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

self.addEventListener("push", (event) => {
  console.log("[SW] Push event received", event);

  const options: ExtendedNotificationOptions = {
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: "kanso-notification",
  };

  let title = "Kanso";
  let body = "You have a new notification";

  if (event.data) {
    try {
      const data = event.data.json();
      console.log("[SW] Push data parsed:", data);
      title = data.title || title;
      body = data.body || body;

      if (data.icon) options.icon = data.icon;
      if (data.badge) options.badge = data.badge;
      if (data.tag) options.tag = data.tag;
      if (data.data) options.data = data.data;
      if (data.actions) options.actions = data.actions;
    } catch (err) {
      console.warn(
        "[SW] Push data failed to parse as JSON, falling back to text",
        err,
      );
      body = event.data.text();
    }
  } else {
    console.log("[SW] Push event has no data");
  }

  event.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        ...options,
      })
      .then(() => {
        console.log("[SW] Notification shown successfully:", title);
      })
      .catch((err) => {
        console.error("[SW] Failed to show notification:", err);
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // If a window is already open, focus it
      for (const client of allClients) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })(),
  );
});
