"use client";

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { useDocumentPiP } from "@/lib/hooks/useDocumentPiP";
import { createPortal } from "react-dom";
import { PiPTimer } from "@/components/PiPTimer";
import { useUiStore } from "@/lib/store/uiStore";

interface PiPContextType {
  isPiPSupported: boolean;
  isPiPActive: boolean;
  isFullscreen: boolean;
  pipWindow: Window | null;
  openPiP: (width?: number, height?: number) => Promise<Window | null>;
  closePiP: () => void;
}

const PiPContext = createContext<PiPContextType | null>(null);

export function PiPProvider({ children }: { children: ReactNode }) {
  const pip = useDocumentPiP();
  const { isPiPActive, closePiP } = pip;
  const isFullscreen = useUiStore((state) => state.isFullscreen);

  // D-09 reactive close: when fullscreen activates, close any active PiP
  // This handles both Chrome Document PiP and Firefox popup fallback
  // (closePiP correctly closes both types).
  // Exiting fullscreen does NOT auto-restore PiP (D-09 contract).
  useEffect(() => {
    if (isFullscreen && isPiPActive) {
      closePiP();
    }
  }, [isFullscreen, isPiPActive, closePiP]);

  // D-09 mutual exclusion: block PiP when fullscreen is active
  const openPiPWithGuard = async (width?: number, height?: number) => {
    if (useUiStore.getState().isFullscreen) {
      return null;
    }
    return pip.openPiP(width, height);
  };

  return (
    <PiPContext.Provider
      value={{
        isPiPSupported: pip.isPiPSupported,
        isPiPActive: pip.isPiPActive,
        isFullscreen,
        pipWindow: pip.pipWindow,
        openPiP: openPiPWithGuard,
        closePiP: pip.closePiP,
      }}
    >
      {children}
      {pip.pipWindow &&
        createPortal(
          <PiPTimer onClose={pip.closePiP} />,
          pip.pipWindow.document.body,
        )}
    </PiPContext.Provider>
  );
}

export function usePiP() {
  const context = useContext(PiPContext);
  if (!context) {
    throw new Error("usePiP must be used within a PiPProvider");
  }
  return context;
}
