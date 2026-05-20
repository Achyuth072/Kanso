"use client";
import React from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, Home } from "lucide-react";

/**
 * 🛡️ Offline Fallback Page
 * This page is served by the Service Worker when a user is offline
 * and tries to navigate to a page that isn't in the cache.
 */
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 text-center">
      <div className="mb-6 p-4 bg-muted rounded-full">
        <WifiOff className="w-12 h-12 text-muted-foreground" />
      </div>

      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        It looks like you&apos;ve lost your internet connection. Kanso is
        designed to work offline, but this page hasn&apos;t been cached yet.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Refreshing
        </button>

        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Home className="w-4 h-4 mr-2" />
          Go to Dashboard
        </Link>
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Once you&apos;re back online, your changes will sync automatically.
      </p>
    </div>
  );
}
