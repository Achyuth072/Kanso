"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";
import { LoaderOverlay } from "@/components/ui/loader-overlay";
import { EncryptionSetupScreen } from "@/components/encryption/EncryptionSetupScreen";
import { UnlockScreen } from "@/components/encryption/UnlockScreen";
export function EncryptionGate({ children }: { children: React.ReactNode }) {
  const { user, isGuestMode } = useAuth();
  const { status, recheck } = useEncryptionGate();

  if (
    !user ||
    isGuestMode ||
    status === "not-applicable" ||
    status === "unlocked"
  ) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <LoaderOverlay message="Checking encryption status..." />;
  }

  if (status === "needs-setup") {
    return <EncryptionSetupScreen userId={user.id} onComplete={recheck} />;
  }

  return <UnlockScreen userId={user.id} onUnlocked={recheck} />;
}
