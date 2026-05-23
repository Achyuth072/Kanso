"use client";

import { useCallback, useEffect } from "react";
import { useUiStore } from "@/lib/store/uiStore";
import { useHaptic } from "@/lib/hooks/useHaptic";

/**
 * Fullscreen Hook
 *
 * Manages fullscreen mode using the Browser Fullscreen API (desktop)
 * and CSS layout mode (mobile). Implements mutual exclusion with PiP per D-09.
 *
 * Desktop: uses document.documentElement.requestFullscreen() / document.exitFullscreen()
 * Mobile: sets isFullscreen flag in uiStore for custom full-page CSS layout
 */

export function useFullscreen() {
  const setIsFullscreen = useUiStore((state) => state.setIsFullscreen);
  const isFullscreen = useUiStore((state) => state.isFullscreen);
  const { isPhone } = useHaptic();

  // Sync fullscreenchange events to uiStore
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [setIsFullscreen]);

  const enterFullscreen = useCallback(async () => {
    // PiP dismissal is handled by PiPProvider's reactive useEffect —
    // no direct setIsPipActive call needed here. The provider detects
    // isFullscreen && isPiPActive and calls closePiP(), which correctly
    // handles both Chrome Document PiP and Firefox popup fallback.

    if (!isPhone && document.fullscreenEnabled) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen API can throw if user gesture is missing
        // Fall through — set isFullscreen true for CSS layout anyway
      }
    }

    // Set flag for both desktop and mobile (mobile uses this for CSS layout)
    setIsFullscreen(true);
  }, [isPhone, setIsFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
    // Do NOT auto-restore PiP per D-09
  }, [setIsFullscreen]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
