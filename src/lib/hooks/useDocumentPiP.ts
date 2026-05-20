"use client";

import { useCallback, useRef, useState } from "react";
import { useUiStore } from "@/lib/store/uiStore";

/**
 * Document Picture-in-Picture Hook
 *
 * Enables cross-site floating timer window using the Document PiP API (Chrome/Edge).
 * Falls back to window.open popup for Firefox and other browsers.
 */

interface PiPWindow extends Window {
  documentPictureInPicture?: {
    requestWindow: (options?: {
      width?: number;
      height?: number;
    }) => Promise<Window>;
  };
}

export function useDocumentPiP() {
  const setIsPipActive = useUiStore((state) => state.setIsPipActive);

  // Lazy initialization to avoid setState in useEffect
  const [isPiPSupported] = useState(
    () => typeof window !== "undefined" && "documentPictureInPicture" in window,
  );
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const isPopupFallback = useRef(false);

  const copyStylesToWindow = useCallback((targetWindow: Window) => {
    // Copy all stylesheets
    const stylesheets = Array.from(document.styleSheets);
    stylesheets.forEach((stylesheet) => {
      try {
        const cssRules = Array.from(stylesheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
        const style = targetWindow.document.createElement("style");
        style.textContent = cssRules;
        targetWindow.document.head.appendChild(style);
      } catch {
        // External stylesheets might fail due to CORS
        const link = targetWindow.document.createElement("link");
        link.rel = "stylesheet";
        link.href = (stylesheet as CSSStyleSheet).href || "";
        targetWindow.document.head.appendChild(link);
      }
    });

    // Copy html element attributes (critical for dark mode and CSS variables)
    const htmlElement = document.documentElement;
    const pipHtmlElement = targetWindow.document.documentElement;

    // Copy className (includes 'dark' class for Tailwind)
    pipHtmlElement.className = htmlElement.className;

    // Copy style attribute (CSS variables)
    const htmlStyle = htmlElement.getAttribute("style");
    if (htmlStyle) {
      pipHtmlElement.setAttribute("style", htmlStyle);
    }

    // Copy body classes and styles
    const bodyElement = document.body;
    const pipBodyElement = targetWindow.document.body;
    pipBodyElement.className = bodyElement.className;

    const bodyStyle = bodyElement.getAttribute("style");
    if (bodyStyle) {
      pipBodyElement.setAttribute("style", bodyStyle);
    }
  }, []);

  const openPiP = useCallback(
    async (width = 320, height = 280) => {
      try {
        let pipWindow: Window;

        if (isPiPSupported) {
          // Use native Document PiP (Chrome/Edge)
          pipWindow = await (
            window as PiPWindow
          ).documentPictureInPicture!.requestWindow({
            width,
            height,
          });
          isPopupFallback.current = false;
        } else {
          // Fallback to window.open for Firefox and other browsers
          const features = `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;
          const popup = window.open("", "FocusTimer", features);

          if (!popup) {
            console.error("Popup blocked. Please allow popups for this site.");
            return null;
          }

          pipWindow = popup;
          isPopupFallback.current = true;

          // Set up basic HTML structure for popup
          pipWindow.document.write(
            "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Focus Timer</title></head><body></body></html>",
          );
          pipWindow.document.close();
        }

        // Copy styles to the PiP/popup window
        copyStylesToWindow(pipWindow);

        // Handle window close - update global store when PIP actually closes
        pipWindow.addEventListener("pagehide", () => {
          setPipWindow(null);
          setIsPipActive(false);
          isPopupFallback.current = false;
        });

        setPipWindow(pipWindow);
        setIsPipActive(true); // Mark PIP as active in global store

        return pipWindow;
      } catch (error) {
        console.error("Failed to open Picture-in-Picture:", error);
        setPipWindow(null);
        setIsPipActive(false);
        return null;
      }
    },
    [isPiPSupported, copyStylesToWindow, setIsPipActive],
  );

  const closePiP = useCallback(() => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      setIsPipActive(false);
      isPopupFallback.current = false;
    }
  }, [pipWindow, setIsPipActive]);

  return {
    isPiPSupported: isPiPSupported || true, // Always show button (fallback available)
    isPiPActive: pipWindow !== null,
    pipWindow,
    openPiP,
    closePiP,
  };
}
