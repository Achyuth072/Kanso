import { useEffect, useRef, useCallback } from "react";

// Global stack to track open modals - only the topmost one should handle back
const modalStack: number[] = [];
let modalIdCounter = 0;

/**
 * Hook to manage browser history for modal/drawer components on mobile.
 * Uses a global stack to ensure only the topmost modal handles back navigation.
 * Highly optimized for minimal latency.
 *
 * @param isOpen - Whether the modal/drawer is currently open
 * @param onClose - Callback to close the modal/drawer
 */
export function useBackNavigation(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const modalIdRef = useRef<number | null>(null);
  const historyPushedRef = useRef(false);
  const isClosingViaBackRef = useRef(false);

  // Keep onClose ref up to date
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handlePopState = useCallback(() => {
    const myId = modalIdRef.current;

    // If we just landed ON this modal's history entry, don't close it.
    // This happens when a child modal closes programmatically and calls history.back()
    if (window.history.state?.modalId === myId) {
      return;
    }

    const topModalId = modalStack[modalStack.length - 1];

    // Only handle if this is the topmost modal
    if (
      myId === topModalId &&
      historyPushedRef.current &&
      !isClosingViaBackRef.current
    ) {
      isClosingViaBackRef.current = true;
      historyPushedRef.current = false;

      // Remove from stack immediately
      modalStack.pop();

      // Execute closure immediately
      onCloseRef.current();

      // Reset flag in next tick to allow re-opening
      setTimeout(() => {
        isClosingViaBackRef.current = false;
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Only push if we haven't already
      if (!historyPushedRef.current) {
        modalIdRef.current = ++modalIdCounter;
        modalStack.push(modalIdRef.current);
        window.history.pushState({ modalId: modalIdRef.current }, "");
        historyPushedRef.current = true;
      }

      window.addEventListener("popstate", handlePopState, { passive: true });

      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    } else {
      // Modal closed programmatically (not via back button)
      // We need to clean up the history entry we pushed
      if (historyPushedRef.current && !isClosingViaBackRef.current) {
        historyPushedRef.current = false;

        // Remove from stack
        const idx = modalStack.indexOf(modalIdRef.current!);
        if (idx !== -1) modalStack.splice(idx, 1);

        // Only go back if we are still on the entry we pushed
        // This prevents cancelling a concurrent forward navigation
        if (window.history.state?.modalId === modalIdRef.current) {
          window.history.back();
        }
      }
    }
  }, [isOpen, handlePopState]);
}
