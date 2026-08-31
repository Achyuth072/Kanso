import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionGate } from "@/components/encryption/EncryptionGate";
import { useAuth } from "@/components/AuthProvider";
import { useEncryptionGate } from "@/lib/hooks/useEncryptionGate";
import type { EncryptionGateStatus } from "@/lib/hooks/useEncryptionGate";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/hooks/useEncryptionGate", () => ({
  useEncryptionGate: vi.fn(),
}));

vi.mock("@/components/encryption/EncryptionSetupScreen", () => ({
  EncryptionSetupScreen: () => <div>setup-screen</div>,
}));

vi.mock("@/components/encryption/UnlockScreen", () => ({
  UnlockScreen: () => <div>unlock-screen</div>,
}));

function mockGate(status: EncryptionGateStatus) {
  vi.mocked(useEncryptionGate).mockReturnValue({ status, recheck: vi.fn() });
}

describe("EncryptionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" },
      isGuestMode: false,
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders children once unlocked", () => {
    mockGate("unlocked");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("app-content")).toBeInTheDocument();
  });

  it("renders children for a guest regardless of gate status", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "guest" },
      isGuestMode: true,
    } as unknown as ReturnType<typeof useAuth>);
    mockGate("needs-setup");

    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("app-content")).toBeInTheDocument();
  });

  it("renders the setup screen and withholds children when a key hasn't been set up", () => {
    mockGate("needs-setup");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("setup-screen")).toBeInTheDocument();
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });

  it("renders the unlock screen and withholds children when the device has no cached key", () => {
    mockGate("needs-unlock");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.getByText("unlock-screen")).toBeInTheDocument();
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });

  it("withholds children while resolving gate status", () => {
    mockGate("loading");
    render(
      <EncryptionGate>
        <div>app-content</div>
      </EncryptionGate>,
    );
    expect(screen.queryByText("app-content")).not.toBeInTheDocument();
  });
});
