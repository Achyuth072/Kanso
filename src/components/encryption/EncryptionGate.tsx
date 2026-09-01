"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";
import { LoaderOverlay } from "@/components/ui/loader-overlay";
import { EncryptionSetupScreen } from "@/components/encryption/EncryptionSetupScreen";
import { UnlockScreen } from "@/components/encryption/UnlockScreen";

interface EncryptionGateActions {
  lock: () => Promise<void>;
}

const EncryptionGateContext = createContext<EncryptionGateActions | undefined>(
  undefined,
);

// Only available to descendants rendered while unlocked — there is nothing
// to lock for a guest or a signed-out user, and the gate itself owns the
// unlock screens.
export function useEncryptionGateActions(): EncryptionGateActions {
  const ctx = useContext(EncryptionGateContext);
  if (!ctx) {
    throw new Error(
      "useEncryptionGateActions must be used within an unlocked EncryptionGate",
    );
  }
  return ctx;
}

export function EncryptionGate({ children }: { children: React.ReactNode }) {
  const { user, isGuestMode } = useAuth();
  const { status, recheck, lock } = useEncryptionGate();

  if (!user || isGuestMode || status === "not-applicable") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <LoaderOverlay message="Checking encryption status..." />;
  }

  if (status === "needs-setup") {
    return <EncryptionSetupScreen userId={user.id} onComplete={recheck} />;
  }

  if (status === "needs-unlock") {
    return <UnlockScreen userId={user.id} onUnlocked={recheck} />;
  }

  return (
    <EncryptionGateContext.Provider value={{ lock }}>
      {children}
    </EncryptionGateContext.Provider>
  );
}
