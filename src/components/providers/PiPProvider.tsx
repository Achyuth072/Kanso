"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useDocumentPiP } from "@/lib/hooks/useDocumentPiP";
import { createPortal } from "react-dom";
import { PiPTimer } from "@/components/PiPTimer";

interface PiPContextType {
  isPiPSupported: boolean;
  isPiPActive: boolean;
  pipWindow: Window | null;
  openPiP: (width?: number, height?: number) => Promise<Window | null>;
  closePiP: () => void;
}

const PiPContext = createContext<PiPContextType | null>(null);

export function PiPProvider({ children }: { children: ReactNode }) {
  const pip = useDocumentPiP();

  return (
    <PiPContext.Provider value={pip}>
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
