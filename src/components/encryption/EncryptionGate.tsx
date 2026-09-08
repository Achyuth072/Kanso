"use client";

import { createContext, useContext } from "react";
import { CloudOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";
import { LoaderOverlay } from "@/components/ui/loader-overlay";
import { EncryptionSetupScreen } from "@/components/encryption/EncryptionSetupScreen";
import { UnlockScreen } from "@/components/encryption/UnlockScreen";
import { EncryptionMigrationScreen } from "@/components/encryption/EncryptionMigrationScreen";

interface EncryptionGateActions {
  lock: () => Promise<void>;
}

const EncryptionGateContext = createContext<EncryptionGateActions | undefined>(
  undefined,
);

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

  if (status === "unavailable") {
    return (
      <AuthShell>
        <div className="w-full space-y-5 text-center">
          <CloudOff
            className="h-8 w-8 mx-auto text-muted-foreground"
            strokeWidth={1.75}
          />
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">
              Couldn&apos;t check your encryption
            </h1>
            <p className="text-sm text-muted-foreground">
              This device hasn&apos;t stored your key details yet, so it needs a
              connection once before you can unlock.
            </p>
          </div>
          <Button
            type="button"
            onClick={recheck}
            className="w-full h-11 text-base font-medium"
          >
            Try again
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (status === "needs-setup") {
    return <EncryptionSetupScreen userId={user.id} onComplete={recheck} />;
  }

  if (status === "needs-unlock") {
    return <UnlockScreen userId={user.id} onUnlocked={recheck} />;
  }

  if (status === "needs-migration") {
    return <EncryptionMigrationScreen userId={user.id} onComplete={recheck} />;
  }

  return (
    <EncryptionGateContext.Provider value={{ lock }}>
      {children}
    </EncryptionGateContext.Provider>
  );
}
